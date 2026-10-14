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
} from 'firebase/firestore';
import { db } from './firebase';
import {
  ExpenseEntry,
  ExpenseGroup,
  ExpenseApprovalStatus,
  ReimbursementStatus,
  ExpensePaymentSource,
  UserProfile,
  isCompanyExpenseOutflow,
  calculateCompanyExpenseOutflows,
} from '@/types';
import { callBackendApi } from './apiClient';
import { recalculateTaskEligibility } from './taskService';

export { isCompanyExpenseOutflow, calculateCompanyExpenseOutflows };

/**
 * Submit an employee flexible expense
 * Preserves individual record AND aggregates into (employeeId + monthKey) group
 */
export async function submitExpenseEntry(
  data: {
    title: string;
    amount: number;
    monthKey: string;
    paymentSource: ExpensePaymentSource;
    description?: string;
    category?: string;
    receiptUrl?: string;
  },
  user: UserProfile
): Promise<ExpenseEntry> {
  const newRef = doc(collection(db, 'expenseEntries'));
  const now = new Date().toISOString();
  const groupId = `${user.employeeId}_${data.monthKey}`;
  const groupRef = doc(db, 'expenseGroups', groupId);
  const amountNum = Number(data.amount);
  const isCompanyFund = data.paymentSource === 'COMPANY_FUND';

  const entry: ExpenseEntry = {
    id: newRef.id,
    employeeId: user.employeeId,
    employeeUid: user.uid,
    employeeNameSnapshot: user.displayName,
    title: data.title.trim(),
    amount: amountNum,
    monthKey: data.monthKey,
    description: data.description?.trim() || '',
    category: data.category?.trim() || 'General Expense',
    receiptUrl: data.receiptUrl || '',
    paymentSource: data.paymentSource,
    approvalStatus: 'SUBMITTED',
    // If company fund, no employee reimbursement needed
    reimbursementStatus: isCompanyFund ? 'PAID' : 'UNPAID',
    createdAt: now,
  };

  // Transaction to safely update both individual record and grouped summary
  await runTransaction(db, async (transaction) => {
    // 1. Write individual entry
    transaction.set(newRef, entry);

    // 2. Fetch or create grouped summary
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) {
      const newGroup: ExpenseGroup = {
        id: groupId,
        employeeId: user.employeeId,
        employeeUid: user.uid,
        employeeNameSnapshot: user.displayName,
        monthKey: data.monthKey,
        totalAmount: amountNum,
        companyFundAmount: isCompanyFund ? amountNum : 0,
        selfPaidAmount: isCompanyFund ? 0 : amountNum,
        entryCount: 1,
        approvedAmount: 0,
        reviewStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(groupRef, newGroup);
    } else {
      const g = groupDoc.data() as ExpenseGroup;
      transaction.update(groupRef, {
        totalAmount: Number(g.totalAmount || 0) + amountNum,
        companyFundAmount: Number(g.companyFundAmount || 0) + (isCompanyFund ? amountNum : 0),
        selfPaidAmount: Number(g.selfPaidAmount || 0) + (isCompanyFund ? 0 : amountNum),
        entryCount: Number(g.entryCount || 0) + 1,
        reviewStatus: 'PENDING',
        updatedAt: now,
      });
    }

    // 3. Log audit event
    const sourceDesc = isCompanyFund
      ? 'Payment Source: By Company Fund (Direct company deduction)'
      : 'Payment Source: By Self (Employee paid personally, reimbursable)';
    const auditRef = doc(collection(db, 'activityLogs'));
    transaction.set(auditRef, {
      id: auditRef.id,
      actorUid: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'EXPENSE_SUBMITTED',
      entityType: 'expense',
      entityId: newRef.id,
      description: `${user.displayName} submitted expense: ${entry.title} (₹${entry.amount.toLocaleString('en-IN')}) • ${sourceDesc}`,
      metadata: {
        amount: entry.amount,
        monthKey: entry.monthKey,
        groupId,
        paymentSource: entry.paymentSource,
      },
      timestamp: now,
    });
  });

  // If company fund, company cash is deducted immediately: re-evaluate task eligibility
  if (isCompanyFund) {
    try {
      await recalculateTaskEligibility(data.monthKey);
      callBackendApi('/api/recalculate-eligibility', 'POST', { monthKey: data.monthKey }).catch(() => {});
    } catch (e) {
      console.warn('[ExpenseService] Error triggering eligibility recalc:', e);
    }
  }

  return entry;
}

/**
 * Review an individual employee expense entry (Admin only)
 */
export async function reviewExpenseEntry(
  expenseId: string,
  approvalStatus: ExpenseApprovalStatus,
  reimbursementStatus: ReimbursementStatus,
  adminUser: UserProfile,
  rejectionReason?: string
): Promise<void> {
  const expenseRef = doc(db, 'expenseEntries', expenseId);
  const now = new Date().toISOString();

  let targetMonthKey = '';
  let needEligibilityRecalc = false;

  await runTransaction(db, async (transaction) => {
    const expenseDoc = await transaction.get(expenseRef);
    if (!expenseDoc.exists()) {
      throw new Error('Expense entry not found.');
    }

    const exp = expenseDoc.data() as ExpenseEntry;
    targetMonthKey = exp.monthKey;
    const groupId = `${exp.employeeId}_${exp.monthKey}`;
    const groupRef = doc(db, 'expenseGroups', groupId);

    const isCompanyFund = exp.paymentSource === 'COMPANY_FUND';
    // For company fund, reimbursementStatus remains PAID (cannot be reimbursed)
    const effectiveReimbursementStatus = isCompanyFund ? 'PAID' : reimbursementStatus;

    transaction.update(expenseRef, {
      approvalStatus,
      reimbursementStatus: effectiveReimbursementStatus,
      reviewedBy: adminUser.uid,
      reviewedAt: now,
      rejectionReason: rejectionReason || '',
    });

    // Recalculate group's approved amount
    const groupDoc = await transaction.get(groupRef);
    if (groupDoc.exists()) {
      const g = groupDoc.data() as ExpenseGroup;
      const wasApproved = exp.approvalStatus === 'APPROVED';
      const isNowApproved = approvalStatus === 'APPROVED';
      let approvedDiff = 0;
      if (!wasApproved && isNowApproved) {
        approvedDiff = exp.amount;
      } else if (wasApproved && !isNowApproved) {
        approvedDiff = -exp.amount;
      }
      transaction.update(groupRef, {
        approvedAmount: Math.max(0, (g.approvedAmount || 0) + approvedDiff),
        updatedAt: now,
      });
    }

    // Determine if company cash outflow status changed
    const wasOutflow = isCompanyExpenseOutflow(exp);
    const mockNextExp: ExpenseEntry = {
      ...exp,
      approvalStatus,
      reimbursementStatus: effectiveReimbursementStatus,
    };
    const isNowOutflow = isCompanyExpenseOutflow(mockNextExp);
    if (wasOutflow !== isNowOutflow) {
      needEligibilityRecalc = true;
    }

    // Audit log
    const auditRef = doc(collection(db, 'activityLogs'));
    transaction.set(auditRef, {
      id: auditRef.id,
      actorUid: adminUser.uid,
      actorName: adminUser.displayName,
      actorRole: 'admin',
      action: approvalStatus === 'APPROVED' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
      entityType: 'expense',
      entityId: expenseId,
      description: `Admin ${approvalStatus.toLowerCase()} expense: ${exp.title} (₹${exp.amount.toLocaleString('en-IN')})`,
      metadata: {
        approvalStatus,
        reimbursementStatus: effectiveReimbursementStatus,
        paymentSource: exp.paymentSource,
        rejectionReason,
      },
      timestamp: now,
    });
  });

  // If cash outflow changed, re-evaluate task eligibility
  if (needEligibilityRecalc && targetMonthKey) {
    await recalculateTaskEligibility(targetMonthKey);
    callBackendApi('/api/recalculate-eligibility', 'POST', { monthKey: targetMonthKey }).catch(() => {});
  }
}

/**
 * Subscribe to all individual expense entries for a month
 */
export function subscribeToMonthExpenses(
  monthKey: string,
  callback: (entries: ExpenseEntry[]) => void
) {
  const q = query(
    collection(db, 'expenseEntries'),
    where('monthKey', '==', monthKey),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: ExpenseEntry[] = [];
      snapshot.forEach((d) => entries.push(d.data() as ExpenseEntry));
      callback(entries);
    },
    (err) => {
      console.error('[ExpenseService] Month expenses subscription error:', err);
    }
  );
}

/**
 * Fetch all individual expense entries for a month once
 */
export async function getMonthExpenses(monthKey: string): Promise<ExpenseEntry[]> {
  const q = query(
    collection(db, 'expenseEntries'),
    where('monthKey', '==', monthKey),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const entries: ExpenseEntry[] = [];
  snap.forEach((d) => entries.push(d.data() as ExpenseEntry));
  return entries;
}

/**
 * Subscribe to grouped expenses for a month (Section E on dashboard)
 */
export function subscribeToMonthExpenseGroups(
  monthKey: string,
  callback: (groups: ExpenseGroup[]) => void
) {
  const q = query(
    collection(db, 'expenseGroups'),
    where('monthKey', '==', monthKey),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const groups: ExpenseGroup[] = [];
      snapshot.forEach((d) => groups.push(d.data() as ExpenseGroup));
      callback(groups);
    },
    (err) => {
      console.error('[ExpenseService] Expense groups subscription error:', err);
    }
  );
}

/**
 * Subscribe to all individual entries for an employee + month group
 */
export function subscribeToGroupExpenses(
  employeeId: string,
  monthKey: string,
  callback: (entries: ExpenseEntry[]) => void
) {
  const q = query(
    collection(db, 'expenseEntries'),
    where('employeeId', '==', employeeId),
    where('monthKey', '==', monthKey),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: ExpenseEntry[] = [];
      snapshot.forEach((d) => entries.push(d.data() as ExpenseEntry));
      callback(entries);
    },
    (err) => {
      console.error('[ExpenseService] Group details subscription error:', err);
    }
  );
}

/**
 * Subscribe to an employee's own expenses
 */
export function subscribeToEmployeeExpenses(
  employeeUid: string,
  callback: (entries: ExpenseEntry[]) => void
) {
  const q = query(
    collection(db, 'expenseEntries'),
    where('employeeUid', '==', employeeUid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ExpenseEntry[] = [];
      snapshot.forEach((d) => list.push(d.data() as ExpenseEntry));
      callback(list);
    },
    (err) => {
      console.error('[ExpenseService] Employee expenses subscription error:', err);
    }
  );
}
