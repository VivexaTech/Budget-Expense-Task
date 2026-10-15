import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  IncomeTask,
  IncomePaymentRecord,
  IncomeTaskStatus,
  IncomeCollectionMetrics,
  PaymentMode,
  UserProfile,
  BillingPreference,
} from '@/types';
import { callBackendApi } from './apiClient';
import { recalculateTaskEligibility } from './taskService';
import { removeUndefinedFields, sanitizePaymentRecord } from '@/utils/firestoreUtils';

/**
 * Create a new Income Collection Task
 * (Admin or Authorized Employee)
 */
export async function createIncomeTask(
  data: {
    clientId?: string;
    clientName: string;
    clientPhone?: string;
    projectName: string;
    originalAmount?: number;
    discountType?: 'FIXED' | 'PERCENTAGE';
    discountValue?: number;
    discountAmount?: number;
    expectedAmount: number;
    dueDate: string; // YYYY-MM-DD
    reminderDate?: string; // YYYY-MM-DD
    notes?: string;
    monthKey: string; // YYYY-MM
    invoicePreference?: BillingPreference;
    assignedToUid?: string;
    assignedToEmployeeId?: string;
    assignedToName?: string;
  },
  user: UserProfile
): Promise<IncomeTask> {
  const companyId = user.companyId || 'company_vivexa';
  const newRef = doc(collection(db, 'incomeTasks'));
  const now = new Date().toISOString();
  const amount = Number(data.expectedAmount);

  const rawTask = {
    id: newRef.id,
    companyId,
    clientId: data.clientId || undefined,
    clientName: data.clientName.trim(),
    clientPhone: data.clientPhone?.trim() || '',
    projectName: data.projectName.trim(),
    originalAmount: data.originalAmount !== undefined ? Number(data.originalAmount) : amount,
    discountType: data.discountType || undefined,
    discountValue: data.discountValue !== undefined ? Number(data.discountValue) : undefined,
    discountAmount: data.discountAmount !== undefined ? Number(data.discountAmount) : 0,
    expectedAmount: amount,
    receivedAmount: 0,
    remainingAmount: amount,
    dueDate: data.dueDate,
    reminderDate: data.reminderDate || undefined,
    notes: data.notes?.trim() || '',
    monthKey: data.monthKey,
    status: 'PENDING' as IncomeTaskStatus,
    invoicePreference: data.invoicePreference || 'ASK_EVERY_TIME',
    invoiceStatus: 'NOT_GENERATED' as const,
    createdByUid: user.uid,
    createdByEmployeeId: user.employeeId,
    createdByName: user.displayName,
    assignedToUid: data.assignedToUid || undefined,
    assignedToEmployeeId: data.assignedToEmployeeId || undefined,
    assignedToName: data.assignedToName || undefined,
    payments: [],
    createdAt: now,
    updatedAt: now,
  };

  const task = removeUndefinedFields(rawTask) as IncomeTask;
  await setDoc(newRef, task);
  await setDoc(doc(db, 'companies', companyId, 'incomeTasks', task.id), task);

  // Audit log
  const auditData = {
    companyId,
    actorUid: user.uid,
    actorName: user.displayName,
    actorRole: user.role,
    action: 'INCOME_TASK_CREATED',
    entityType: 'task',
    entityId: newRef.id,
    description: `${user.displayName} created collection task for ${task.clientName} (${task.projectName}) — Expected: ₹${task.expectedAmount.toLocaleString('en-IN')}, Due: ${task.dueDate}`,
    metadata: {
      clientName: task.clientName,
      expectedAmount: task.expectedAmount,
      dueDate: task.dueDate,
      monthKey: task.monthKey,
    },
    timestamp: now,
  };
  await addDoc(collection(db, 'companies', companyId, 'activityLogs'), auditData);
  await addDoc(collection(db, 'activityLogs'), auditData);

  return task;
}

/**
 * Record a payment (Full or Partial) for an Income Collection Task.
 * 
 * ATOMIC TRANSACTION GUARANTEES:
 * 1. Validates task exists and is not CANCELLED or already COMPLETED.
 * 2. Prevents overpayment: payment amount cannot exceed remaining balance.
 * 3. Creates an IncomeEntry ONLY for the exact received amount.
 * 4. Updates remaining balance, received amount, and payment history atomically.
 * 5. Automatically marks task COMPLETED when remaining balance reaches zero.
 * 6. Updates next due date if partial payment and new date provided.
 * 7. Recalculates available company cash balance immediately.
 */
export async function recordIncomeTaskPayment(
  taskId: string,
  data: {
    amount: number;
    paymentMode: PaymentMode;
    notes?: string;
    nextDueDate?: string; // YYYY-MM-DD
  },
  user: UserProfile,
  currentMonthKey: string
): Promise<{ task: IncomeTask; paymentRecord: IncomePaymentRecord }> {
  const taskRef = doc(db, 'incomeTasks', taskId);
  const incomeRef = doc(collection(db, 'incomeEntries'));
  const now = new Date().toISOString();
  const paymentAmount = Number(data.amount);

  if (paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  let updatedTask: IncomeTask | null = null;
  let newPaymentRecord: IncomePaymentRecord | null = null;

  await runTransaction(db, async (transaction) => {
    const taskDoc = await transaction.get(taskRef);
    if (!taskDoc.exists()) {
      throw new Error('Income collection task not found.');
    }

    const task = taskDoc.data() as IncomeTask;

    if (task.status === 'COMPLETED') {
      throw new Error('This task is already completed. No further payments can be recorded.');
    }

    if (task.status === 'CANCELLED') {
      throw new Error('This task has been cancelled.');
    }

    // Permission check: Admin or task creator/assignee
    const isOwner = task.createdByUid === user.uid || task.assignedToUid === user.uid;
    if (user.role !== 'admin' && !isOwner) {
      throw new Error('You are not authorized to record payments on this task.');
    }

    const currentRemaining = Number(task.remainingAmount);
    if (paymentAmount > currentRemaining) {
      throw new Error(
        `Payment amount (₹${paymentAmount.toLocaleString('en-IN')}) cannot exceed remaining balance of ₹${currentRemaining.toLocaleString('en-IN')}.`
      );
    }

    const newReceived = Number(task.receivedAmount) + paymentAmount;
    const newRemaining = Math.max(0, currentRemaining - paymentAmount);
    const newStatus: IncomeTaskStatus = newRemaining === 0 ? 'COMPLETED' : 'PARTIALLY_PAID';

    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const effectiveNextDueDate =
      newRemaining > 0 && data.nextDueDate ? data.nextDueDate : (task.dueDate || '');

    newPaymentRecord = sanitizePaymentRecord({
      id: paymentId,
      amount: paymentAmount,
      paymentMode: data.paymentMode,
      date: now,
      receivedByUid: user.uid,
      receivedByEmployeeId: user.employeeId,
      receivedByName: user.displayName,
      notes: data.notes?.trim() || '',
      nextDueDate: newRemaining > 0 && effectiveNextDueDate ? effectiveNextDueDate : undefined,
      incomeEntryId: incomeRef.id,
    });

    // 1. Create Income Entry for the actual received amount ONLY
    transaction.set(incomeRef, removeUndefinedFields({
      id: incomeRef.id,
      employeeId: user.employeeId,
      employeeUid: user.uid,
      employeeNameSnapshot: user.displayName,
      amount: paymentAmount,
      collectedFrom: task.clientName,
      workDescription: `${task.projectName} (Payment from ${task.clientName})`,
      paymentMode: data.paymentMode,
      monthKey: currentMonthKey,
      notes: `Collection Task #${task.id.slice(0, 8)}: ${data.notes || ''}`.trim(),
      createdAt: now,
      status: 'VALID',
      incomeTaskId: task.id,
    }));

    // 2. Update Income Collection Task
    const rawPayments = [...(task.payments || []), newPaymentRecord];
    const updatedPayments = rawPayments.map((p) => sanitizePaymentRecord(p));

    const taskUpdatePayload = removeUndefinedFields({
      receivedAmount: newReceived,
      remainingAmount: newRemaining,
      status: newStatus,
      dueDate: effectiveNextDueDate || task.dueDate || '',
      reminderDate: newRemaining > 0 && data.nextDueDate ? data.nextDueDate : (task.reminderDate || null),
      payments: updatedPayments,
      completedAt: newRemaining === 0 ? now : null,
      updatedAt: now,
    });

    transaction.update(taskRef, taskUpdatePayload);

    // 3. Activity Audit Log
    const auditRef = doc(collection(db, 'activityLogs'));
    transaction.set(auditRef, removeUndefinedFields({
      id: auditRef.id,
      actorUid: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'INCOME_TASK_PAYMENT',
      entityType: 'task',
      entityId: taskId,
      description: `${user.displayName} recorded ₹${paymentAmount.toLocaleString('en-IN')} payment for ${task.clientName} (${task.projectName}) • Remaining: ₹${newRemaining.toLocaleString('en-IN')}`,
      metadata: {
        taskId,
        clientName: task.clientName,
        paymentAmount,
        remainingAmount: newRemaining,
        paymentMode: data.paymentMode,
        isCompleted: newRemaining === 0,
      },
      timestamp: now,
    }));

    updatedTask = {
      ...task,
      receivedAmount: newReceived,
      remainingAmount: newRemaining,
      status: newStatus,
      dueDate: effectiveNextDueDate || task.dueDate,
      payments: updatedPayments,
      ...(newRemaining === 0 ? { completedAt: now } : {}),
      updatedAt: now,
    };
  });

  // Re-evaluate company task eligibility since available cash increased!
  await recalculateTaskEligibility(currentMonthKey);
  callBackendApi('/api/recalculate-eligibility', 'POST', { monthKey: currentMonthKey }).catch(() => {});

  return { task: updatedTask!, paymentRecord: newPaymentRecord! };
}

/**
 * Reschedule or update an Income Task's Due Date and notes
 */
export async function updateIncomeTaskSchedule(
  taskId: string,
  data: {
    dueDate: string; // YYYY-MM-DD
    reminderDate?: string;
    notes?: string;
  },
  user: UserProfile
): Promise<void> {
  const taskRef = doc(db, 'incomeTasks', taskId);
  const now = new Date().toISOString();

  const snap = await getDoc(taskRef);
  if (!snap.exists()) {
    throw new Error('Task not found.');
  }

  const task = snap.data() as IncomeTask;
  const isOwner = task.createdByUid === user.uid || task.assignedToUid === user.uid;
  if (user.role !== 'admin' && !isOwner) {
    throw new Error('Not authorized to update this task.');
  }

  await updateDoc(taskRef, removeUndefinedFields({
    dueDate: data.dueDate,
    reminderDate: data.reminderDate || null,
    notes: data.notes !== undefined ? data.notes.trim() : (task.notes || ''),
    updatedAt: now,
  }));

  // Audit log
  const auditRef = doc(collection(db, 'activityLogs'));
  await setDoc(auditRef, {
    id: auditRef.id,
    actorUid: user.uid,
    actorName: user.displayName,
    actorRole: user.role,
    action: 'INCOME_TASK_UPDATED',
    entityType: 'task',
    entityId: taskId,
    description: `${user.displayName} updated due date for ${task.clientName} to ${data.dueDate}`,
    timestamp: now,
  });
}

/**
 * Cancel an Income Collection Task (Admin or Task Creator)
 */
export async function cancelIncomeTask(
  taskId: string,
  reason: string,
  user: UserProfile
): Promise<void> {
  const taskRef = doc(db, 'incomeTasks', taskId);
  const now = new Date().toISOString();

  const snap = await getDoc(taskRef);
  if (!snap.exists()) {
    throw new Error('Task not found.');
  }

  const task = snap.data() as IncomeTask;
  const isOwner = task.createdByUid === user.uid || task.assignedToUid === user.uid;
  if (user.role !== 'admin' && !isOwner) {
    throw new Error('Not authorized to cancel this task.');
  }

  await updateDoc(taskRef, {
    status: 'CANCELLED',
    updatedAt: now,
    cancelReason: reason,
  });

  // Audit log
  const auditRef = doc(collection(db, 'activityLogs'));
  await setDoc(auditRef, {
    id: auditRef.id,
    actorUid: user.uid,
    actorName: user.displayName,
    actorRole: user.role,
    action: 'INCOME_TASK_CANCELLED',
    entityType: 'task',
    entityId: taskId,
    description: `${user.displayName} cancelled collection task for ${task.clientName}: ${reason}`,
    timestamp: now,
  });
}

/**
 * Subscribe to Income Collection Tasks with role-based permissions:
 * - Admin: view all tasks
 * - Employee: view only their own created/assigned tasks
 */
export function subscribeToIncomeTasks(
  user: UserProfile,
  callback: (tasks: IncomeTask[]) => void
) {
  const userCompany = user.companyId || 'company_vivexa';
  let q;
  if (user.role === 'admin') {
    q = query(
      collection(db, 'incomeTasks'),
      orderBy('dueDate', 'asc')
    );
  } else {
    q = query(
      collection(db, 'incomeTasks'),
      where('createdByUid', '==', user.uid),
      orderBy('dueDate', 'asc')
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const list: IncomeTask[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as IncomeTask;
        const itemCompany = item.companyId || 'company_vivexa';
        if (itemCompany === userCompany) {
          list.push(item);
        }
      });
      callback(list);
    },
    (err) => {
      console.error('[IncomeTaskService] Subscription error:', err);
    }
  );
}

/**
 * Calculate Income Collection Summary Metrics
 * Separates Today's due target from Total outstanding collections.
 */
export function calculateIncomeCollectionMetrics(
  tasks: IncomeTask[],
  todayStr: string // YYYY-MM-DD
): IncomeCollectionMetrics {
  let totalOutstandingCollections = 0;
  let amountDueToday = 0;
  let amountOverdue = 0;
  let amountCollectedThisMonth = 0;
  let completedTasksCount = 0;
  let pendingTasksCount = 0;
  let dueTodayCount = 0;
  let overdueCount = 0;

  const currentMonth = todayStr.substring(0, 7);

  for (const t of tasks) {
    if (t.status === 'CANCELLED') continue;

    // Track total received for this month's payments
    for (const p of t.payments || []) {
      if (p.date && p.date.startsWith(currentMonth)) {
        amountCollectedThisMonth += Number(p.amount || 0);
      }
    }

    if (t.status === 'COMPLETED') {
      completedTasksCount++;
      continue;
    }

    // Active tasks (PENDING or PARTIALLY_PAID)
    pendingTasksCount++;
    const remaining = Number(t.remainingAmount || 0);
    totalOutstandingCollections += remaining;

    if (t.dueDate === todayStr) {
      amountDueToday += remaining;
      dueTodayCount++;
    } else if (t.dueDate < todayStr) {
      amountOverdue += remaining;
      overdueCount++;
    }
  }

  return {
    totalOutstandingCollections,
    amountDueToday,
    amountOverdue,
    amountCollectedThisMonth,
    totalTasksCount: tasks.filter((t) => t.status !== 'CANCELLED').length,
    completedTasksCount,
    pendingTasksCount,
    dueTodayCount,
    overdueCount,
  };
}

/**
 * Trigger daily financial summary push notification for a user
 * Idempotent: Dispatches at most once per user per day.
 */
export async function sendDailyFinancialSummaryAsync(
  user: UserProfile,
  tasks: IncomeTask[],
  todayStr: string
): Promise<{ success: boolean; message: string; deduplicated?: boolean }> {
  const metrics = calculateIncomeCollectionMetrics(tasks, todayStr);
  const idempotencyKey = `DAILY_FINANCIAL_SUMMARY_${user.uid}_${todayStr}`;

  const title = `Daily Collections Summary — ${todayStr}`;
  const dueTodayText = metrics.dueTodayCount > 0
    ? `₹${metrics.amountDueToday.toLocaleString('en-IN')} due today (${metrics.dueTodayCount} client${metrics.dueTodayCount === 1 ? '' : 's'})`
    : 'No client payments due today';
  const overdueText = metrics.overdueCount > 0
    ? ` • ₹${metrics.amountOverdue.toLocaleString('en-IN')} overdue (${metrics.overdueCount})`
    : '';
  const totalText = ` • Total Outstanding: ₹${metrics.totalOutstandingCollections.toLocaleString('en-IN')}`;

  const body = `${dueTodayText}${overdueText}${totalText}.`;

  try {
    const res = await callBackendApi<{ deduplicated?: boolean }>('/api/send-notification', 'POST', {
      eventId: idempotencyKey,
      idempotencyKey,
      recipientUid: user.uid,
      title,
      body,
    });
    return {
      success: res.success,
      message: res.success
        ? 'Notification dispatched successfully'
        : (res.error || 'Failed to dispatch notification'),
      deduplicated: res.data?.deduplicated,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to dispatch daily summary notification',
    };
  }
}
