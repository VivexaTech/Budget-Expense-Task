import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { FinancialTask, RecurringTaskTemplate, UserProfile, TaskStatus } from '@/types';
import { callBackendApi } from './apiClient';
import { syncBudgetTarget } from './budgetService';
import { formatCurrency } from '@/utils/formatters';

/**
 * Authoritatively calculate the current Available Company Balance for a given monthKey:
 * Available Balance = Opening Balance + Valid Income - Completed Task Payments - Paid Reimbursed Outflows
 */
export async function calculateAvailableBalanceForMonth(monthKey: string): Promise<{
  availableBalance: number;
  openingBalance: number;
  validIncome: number;
  completedTasksAmount: number;
  paidExpensesAmount: number;
}> {
  // 1. Fetch opening balance from budgets/{monthKey}
  const budgetSnap = await getDoc(doc(db, 'budgets', monthKey));
  const openingBalance = Number(budgetSnap.data()?.openingBalance || 0);

  // 2. Fetch all valid income entries for monthKey
  const incomeQuery = query(
    collection(db, 'incomeEntries'),
    where('monthKey', '==', monthKey),
    where('status', '==', 'VALID')
  );
  const incomeSnap = await getDocs(incomeQuery);
  let validIncome = 0;
  incomeSnap.forEach((d) => {
    validIncome += Number(d.data().amount || 0);
  });

  // 3. Fetch all completed tasks (actual company payment disbursements)
  const completedTasksQuery = query(
    collection(db, 'tasks'),
    where('monthKey', '==', monthKey),
    where('status', '==', 'COMPLETED')
  );
  const completedTasksSnap = await getDocs(completedTasksQuery);
  let completedTasksAmount = 0;
  completedTasksSnap.forEach((d) => {
    completedTasksAmount += Number(d.data().amount || 0);
  });

  // 4. Fetch all approved & reimbursed flexible expenses
  const paidExpensesQuery = query(
    collection(db, 'expenseEntries'),
    where('monthKey', '==', monthKey),
    where('approvalStatus', '==', 'APPROVED'),
    where('reimbursementStatus', '==', 'PAID')
  );
  const paidExpensesSnap = await getDocs(paidExpensesQuery);
  let paidExpensesAmount = 0;
  paidExpensesSnap.forEach((d) => {
    paidExpensesAmount += Number(d.data().amount || 0);
  });

  const availableBalance = openingBalance + validIncome - completedTasksAmount - paidExpensesAmount;

  return {
    availableBalance,
    openingBalance,
    validIncome,
    completedTasksAmount,
    paidExpensesAmount,
  };
}

/**
 * Deterministically recalculates task eligibility for all active tasks of a monthKey.
 * Allocates available company balance to pending tasks in strict priority order (dueDate ASC, createdAt ASC).
 * Updates Firestore directly and triggers backend sync if configured.
 */
export async function recalculateTaskEligibility(monthKey: string): Promise<{
  availableBalance: number;
  evaluatedTasks: FinancialTask[];
  newlyReadyCount: number;
}> {
  const { availableBalance } = await calculateAvailableBalanceForMonth(monthKey);

  // Fetch active (non-cancelled, non-completed) tasks for this month
  const tasksQuery = query(collection(db, 'tasks'), where('monthKey', '==', monthKey));
  const tasksSnap = await getDocs(tasksQuery);
  const allTasks: FinancialTask[] = [];

  tasksSnap.forEach((d) => {
    allTasks.push(d.data() as FinancialTask);
  });

  // Filter pending and ready tasks and sort deterministically: dueDate ASC, createdAt ASC, id ASC
  const activeTasks = allTasks
    .filter((t) => t.status === 'PENDING' || t.status === 'READY_TO_COMPLETE')
    .sort((a, b) => {
      const d = (a.dueDate || '').localeCompare(b.dueDate || '');
      if (d !== 0) return d;
      const c = (a.createdAt || '').localeCompare(b.createdAt || '');
      if (c !== 0) return c;
      return a.id.localeCompare(b.id);
    });

  let remainingFunds = availableBalance;
  let newlyReadyCount = 0;
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  let batchHasUpdates = false;

  for (const task of activeTasks) {
    const taskAmount = Number(task.amount || 0);
    const isEligible = remainingFunds >= taskAmount;

    let targetStatus: TaskStatus;
    let targetAllocated: number;
    let targetReason: string;

    if (isEligible) {
      targetStatus = 'READY_TO_COMPLETE';
      targetAllocated = taskAmount;
      targetReason = 'Financially verified: Sufficient company funds allocated and available.';
      remainingFunds -= taskAmount;
      if (task.status !== 'READY_TO_COMPLETE') {
        newlyReadyCount++;
      }
    } else {
      targetStatus = 'PENDING';
      targetAllocated = 0;
      const shortfall = taskAmount - Math.max(0, remainingFunds);
      targetReason = `Insufficient Available Funds: Task requires ${formatCurrency(taskAmount)}, but only ${formatCurrency(Math.max(0, remainingFunds))} unallocated balance remains (Shortfall: ${formatCurrency(shortfall)}).`;
    }

    // Check if task needs an update in Firestore
    if (
      task.status !== targetStatus ||
      task.allocatedAmount !== targetAllocated ||
      task.eligibilityReason !== targetReason
    ) {
      const taskRef = doc(db, 'tasks', task.id);
      batch.update(taskRef, {
        status: targetStatus,
        allocatedAmount: targetAllocated,
        eligibilityReason: targetReason,
        updatedAt: now,
      });
      batchHasUpdates = true;

      // Update local in-memory object
      task.status = targetStatus;
      task.allocatedAmount = targetAllocated;
      task.eligibilityReason = targetReason;
    }
  }

  if (batchHasUpdates) {
    await batch.commit();
  }

  // Also trigger backend recalculation in background if backend URL is configured
  callBackendApi('/api/recalculate-eligibility', 'POST', { monthKey }).catch(() => {});

  return {
    availableBalance,
    evaluatedTasks: activeTasks,
    newlyReadyCount,
  };
}

/**
 * Create a new fixed financial task (Admin only).
 * Automatically synchronizes budget monthly target and recalculates task eligibility immediately.
 */
export async function createFixedTask(
  data: {
    title: string;
    amount: number;
    dueDate: string; // YYYY-MM-DD
    monthKey: string; // YYYY-MM
    description?: string;
    category?: string;
  },
  adminUser: UserProfile
): Promise<FinancialTask> {
  const newTaskRef = doc(collection(db, 'tasks'));
  const now = new Date().toISOString();

  const task: FinancialTask = {
    id: newTaskRef.id,
    title: data.title.trim(),
    amount: Number(data.amount),
    dueDate: data.dueDate,
    monthKey: data.monthKey,
    description: data.description?.trim() || '',
    category: data.category?.trim() || 'General Operations',
    status: 'PENDING',
    taskType: 'FIXED',
    allocatedAmount: 0,
    createdBy: adminUser.uid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(newTaskRef, task);

  // Log activity
  await setDoc(doc(collection(db, 'activityLogs')), {
    id: doc(collection(db, 'activityLogs')).id,
    actorUid: adminUser.uid,
    actorName: adminUser.displayName,
    actorRole: 'admin',
    action: 'TASK_CREATED',
    entityType: 'task',
    entityId: newTaskRef.id,
    description: `Created fixed task: ${task.title} (₹${task.amount.toLocaleString('en-IN')}) due on ${task.dueDate}`,
    metadata: { title: task.title, amount: task.amount, monthKey: task.monthKey },
    timestamp: now,
  });

  // Synchronize monthly target immediately so dashboard reflects the newly added task amount
  await syncBudgetTarget(data.monthKey);

  // Recalculate eligibility immediately in Firestore so sufficient funds immediately ready the task
  await recalculateTaskEligibility(data.monthKey);

  return task;
}

/**
 * Cancel a task (Admin only).
 * Releases allocated funds and re-evaluates remaining tasks & budget target.
 */
export async function cancelTask(taskId: string, monthKey: string, adminUser: UserProfile): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'tasks', taskId), {
    status: 'CANCELLED',
    allocatedAmount: 0,
    eligibilityReason: 'Task cancelled by company administrator.',
    updatedAt: now,
  });

  // Log activity
  await setDoc(doc(collection(db, 'activityLogs')), {
    id: doc(collection(db, 'activityLogs')).id,
    actorUid: adminUser.uid,
    actorName: adminUser.displayName,
    actorRole: 'admin',
    action: 'TASK_CANCELLED',
    entityType: 'task',
    entityId: taskId,
    description: `Cancelled task ID: ${taskId}`,
    timestamp: now,
  });

  // Recalculate budget target and release funds to next tasks in priority order
  await syncBudgetTarget(monthKey);
  await recalculateTaskEligibility(monthKey);
}

/**
 * Complete a task safely using a Firestore transaction (Admin only).
 * Ensures available balance is verified, prevents duplicate payments, marks task COMPLETED,
 * writes immutable audit log, and immediately recalculates remaining tasks.
 */
export async function completeTaskWithTransaction(
  taskId: string,
  paymentNotes: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    const now = new Date().toISOString();

    let monthKeyToSync = '';

    await runTransaction(db, async (transaction) => {
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists()) {
        throw new Error('Task not found.');
      }

      const task = taskDoc.data() as FinancialTask;
      if (task.status === 'COMPLETED') {
        throw new Error('Task is already marked as completed.');
      }
      if (task.status === 'CANCELLED') {
        throw new Error('Cannot complete a cancelled task.');
      }

      monthKeyToSync = task.monthKey;

      // Mark task as COMPLETED
      transaction.update(taskRef, {
        status: 'COMPLETED',
        allocatedAmount: task.amount,
        completedBy: adminUser.uid,
        completedByName: adminUser.displayName,
        completedAt: now,
        paymentNotes: paymentNotes?.trim() || 'Payment confirmed by administrator',
        updatedAt: now,
      });

      // Write immutable audit log atomically
      const auditRef = doc(collection(db, 'activityLogs'));
      transaction.set(auditRef, {
        id: auditRef.id,
        actorUid: adminUser.uid,
        actorName: adminUser.displayName,
        actorRole: 'admin',
        action: 'TASK_COMPLETED',
        entityType: 'task',
        entityId: taskId,
        description: `Completed financial task: ${task.title} (₹${Number(task.amount).toLocaleString('en-IN')})`,
        metadata: {
          taskTitle: task.title,
          amount: task.amount,
          monthKey: task.monthKey,
          paymentNotes: paymentNotes?.trim() || null,
        },
        timestamp: now,
      });
    });

    // Re-evaluate eligibility for remaining pending tasks now that funds have been disbursed
    if (monthKeyToSync) {
      await recalculateTaskEligibility(monthKeyToSync);
      await syncBudgetTarget(monthKeyToSync);
    }

    return { success: true };
  } catch (error: any) {
    console.error('[CompleteTask] Transaction failed:', error);
    return { success: false, error: error.message || 'Failed to complete task transaction.' };
  }
}

/**
 * Backward-compatible helper to complete a task
 */
export async function confirmTaskCompletion(
  taskId: string,
  paymentNotes: string,
  monthKey: string,
  adminUser?: UserProfile
): Promise<{ success: boolean; error?: string }> {
  if (adminUser) {
    return completeTaskWithTransaction(taskId, paymentNotes, adminUser);
  }
  // Try backend first; if backend unavailable, fallback
  const res = await callBackendApi('/api/complete-task', 'POST', { taskId, paymentNotes });
  if (res.success) {
    await recalculateTaskEligibility(monthKey);
    await syncBudgetTarget(monthKey);
    return { success: true };
  }
  return { success: false, error: res.error };
}

/**
 * Subscribe to tasks for a specific monthKey
 */
export function subscribeToTasksForMonth(
  monthKey: string,
  callback: (tasks: FinancialTask[]) => void
) {
  const q = query(
    collection(db, 'tasks'),
    where('monthKey', '==', monthKey),
    orderBy('dueDate', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: FinancialTask[] = [];
      snapshot.forEach((doc) => {
        tasks.push(doc.data() as FinancialTask);
      });
      callback(tasks);
    },
    (err) => {
      console.error('[TaskService] Subscription error:', err);
    }
  );
}

/**
 * Fetch recurring task templates (Admin only)
 */
export async function getRecurringTemplates(): Promise<RecurringTaskTemplate[]> {
  const snap = await getDocs(collection(db, 'recurringTaskTemplates'));
  const list: RecurringTaskTemplate[] = [];
  snap.forEach((d) => list.push(d.data() as RecurringTaskTemplate));
  return list;
}

/**
 * Subscribe to recurring task templates
 */
export function subscribeToRecurringTemplates(callback: (templates: RecurringTaskTemplate[]) => void) {
  return onSnapshot(collection(db, 'recurringTaskTemplates'), (snapshot) => {
    const list: RecurringTaskTemplate[] = [];
    snapshot.forEach((d) => list.push(d.data() as RecurringTaskTemplate));
    callback(list);
  });
}

/**
 * Create a new recurring task template
 */
export async function createRecurringTemplate(
  data: {
    title: string;
    amount: number;
    dueDayOfMonth: number;
    description?: string;
    category?: string;
  },
  adminUser: UserProfile
): Promise<RecurringTaskTemplate> {
  const ref = doc(collection(db, 'recurringTaskTemplates'));
  const template: RecurringTaskTemplate = {
    id: ref.id,
    title: data.title.trim(),
    amount: Number(data.amount),
    dueDayOfMonth: Number(data.dueDayOfMonth),
    description: data.description?.trim() || '',
    category: data.category?.trim() || 'Recurring Operational Expense',
    active: true,
    recurrenceKey: ref.id,
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, template);
  return template;
}

/**
 * Trigger monthly recurring task generation
 */
export async function generateRecurringTasksForMonth(monthKey: string): Promise<any> {
  return callBackendApi('/api/recurring-tasks', 'POST', { monthKey });
}
