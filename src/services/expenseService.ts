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
  UserProfile,
} from '@/types';
import { callBackendApi } from './apiClient';
import { recalculateTaskEligibility } from './taskService';

/**
 * Submit an employee flexible expense
 * Preserves individual record AND aggregates into (employeeId + monthKey) group
 */
export async function submitExpenseEntry(
  data: {
    title: string;
    amount: number;
    monthKey: string;
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

  const entry: ExpenseEntry = {
    id: newRef.id,
    employeeId: user.employeeId,
    employeeUid: user.uid,
    employeeNameSnapshot: user.displayName,
    title: data.title.trim(),
    amount: Number(data.amount),
    monthKey: data.monthKey,
    description: data.description?.trim() || '',
    category: data.category?.trim() || 'General Expense',
    receiptUrl: data.receiptUrl || '',
    approvalStatus: 'SUBMITTED',
    reimbursementStatus: 'UNPAID',
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
        totalAmount: Number(data.amount),
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
        totalAmount: Number(g.totalAmount || 0) + Number(data.amount),
        entryCount: Number(g.entryCount || 0) + 1,
        reviewStatus: 'PENDING',
        updatedAt: now,
      });
    }

    // 3. Log audit event
    const auditRef = doc(collection(db, 'activityLogs'));
    transaction.set(auditRef, {
      id: auditRef.id,
      actorUid: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'EXPENSE_SUBMITTED',
      entityType: 'expense',
      entityId: newRef.id,
      description: `${user.displayName} submitted expense: ${entry.title} (₹${entry.amount.toLocaleString('en-IN')})`,
      metadata: { amount: entry.amount, monthKey: entry.monthKey, groupId },
      timestamp: now,
    });
  });

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

  await runTransaction(db, async (transaction) => {
    const expenseDoc = await transaction.get(expenseRef);
    if (!expenseDoc.exists()) {
      throw new Error('Expense entry not found.');
    }

    const exp = expenseDoc.data() as ExpenseEntry;
    const groupId = `${exp.employeeId}_${exp.monthKey}`;
    const groupRef = doc(db, 'expenseGroups', groupId);

    transaction.update(expenseRef, {
      approvalStatus,
      reimbursementStatus,
      reviewedBy: adminUser.uid,
      reviewedAt: now,
      rejectionReason: rejectionReason || '',
    });

    // Recalculate group's approved amount
    const groupDoc = await transaction.get(groupRef);
    if (groupDoc.exists()) {
      const g = groupDoc.data() as ExpenseGroup;
      // We will refresh the approved amount when items change
      const diff = approvalStatus === 'APPROVED' ? exp.amount : 0;
      transaction.update(groupRef, {
        approvedAmount: (g.approvedAmount || 0) + (approvalStatus === 'APPROVED' ? exp.amount : 0),
        updatedAt: now,
      });
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
      metadata: { approvalStatus, reimbursementStatus, rejectionReason },
      timestamp: now,
    });
  });

  // If marked paid, actual cash outflow occurred: re-evaluate available balance!
  if (reimbursementStatus === 'PAID') {
    const expenseDoc = await getDoc(expenseRef);
    const exp = expenseDoc.data() as ExpenseEntry;
    await recalculateTaskEligibility(exp.monthKey);
    callBackendApi('/api/recalculate-eligibility', 'POST', { monthKey: exp.monthKey }).catch(() => {});
  }
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
