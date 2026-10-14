import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { ActivityLog, DashboardFinancials } from '@/types';

/**
 * Subscribe to recent company activity logs
 */
export function subscribeToRecentActivity(
  limitCount: number = 10,
  callback: (logs: ActivityLog[]) => void
) {
  const q = query(
    collection(db, 'activityLogs'),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: ActivityLog[] = [];
      snapshot.forEach((d) => logs.push(d.data() as ActivityLog));
      callback(logs);
    },
    (err) => {
      console.error('[ActivityService] Subscription error:', err);
    }
  );
}

/**
 * Subscribe to all activity logs for full history screen
 */
export function subscribeToAllActivity(
  callback: (logs: ActivityLog[]) => void
) {
  const q = query(
    collection(db, 'activityLogs'),
    orderBy('timestamp', 'desc'),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: ActivityLog[] = [];
      snapshot.forEach((d) => logs.push(d.data() as ActivityLog));
      callback(logs);
    },
    (err) => {
      console.error('[ActivityService] Subscription error:', err);
    }
  );
}

/**
 * Compute monthly report metrics for a specific month
 */
export async function generateMonthlyReportData(monthKey: string): Promise<DashboardFinancials> {
  // 1. Fetch budget
  const budgetSnap = await getDocs(
    query(collection(db, 'budgets'), where('monthKey', '==', monthKey))
  );
  let monthlyIncomeTarget = 0;
  let openingBalance = 0;
  if (!budgetSnap.empty) {
    const b = budgetSnap.docs[0].data();
    monthlyIncomeTarget = Number(b.monthlyTarget || 0);
    openingBalance = Number(b.openingBalance || 0);
  }

  // 2. Fetch income entries
  const incomeSnap = await getDocs(
    query(
      collection(db, 'incomeEntries'),
      where('monthKey', '==', monthKey),
      where('status', '==', 'VALID')
    )
  );
  let incomeCollected = 0;
  incomeSnap.forEach((d) => {
    incomeCollected += Number(d.data().amount || 0);
  });

  // 3. Fetch completed tasks (verified company payments)
  const completedTasksSnap = await getDocs(
    query(
      collection(db, 'tasks'),
      where('monthKey', '==', monthKey),
      where('status', '==', 'COMPLETED')
    )
  );
  let completedTasksAmount = 0;
  completedTasksSnap.forEach((d) => {
    completedTasksAmount += Number(d.data().amount || 0);
  });

  // 4. Fetch ready and pending tasks
  const allTasksSnap = await getDocs(
    query(collection(db, 'tasks'), where('monthKey', '==', monthKey))
  );
  let totalOutstandingReadyTasksAmount = 0;
  let totalOutstandingPendingTasksAmount = 0;
  allTasksSnap.forEach((d) => {
    const data = d.data();
    if (data.status === 'READY_TO_COMPLETE') {
      totalOutstandingReadyTasksAmount += Number(data.amount || 0);
    } else if (data.status === 'PENDING') {
      totalOutstandingPendingTasksAmount += Number(data.amount || 0);
    }
  });

  // 5. Fetch flexible expenses
  const expensesSnap = await getDocs(
    query(collection(db, 'expenseEntries'), where('monthKey', '==', monthKey))
  );
  let paidExpensesAmount = 0;
  let pendingExpensesSubmitted = 0;
  expensesSnap.forEach((d) => {
    const data = d.data();
    if (data.reimbursementStatus === 'PAID') {
      paidExpensesAmount += Number(data.amount || 0);
    } else if (data.approvalStatus === 'SUBMITTED') {
      pendingExpensesSubmitted += Number(data.amount || 0);
    }
  });

  const actualCompanyExpensesPaid = completedTasksAmount + paidExpensesAmount;
  const availableCompanyBalance = openingBalance + incomeCollected - actualCompanyExpensesPaid;
  const remainingIncomeTarget = Math.max(0, monthlyIncomeTarget - incomeCollected);
  const targetProgressPercentage = monthlyIncomeTarget > 0
    ? (incomeCollected / monthlyIncomeTarget) * 100
    : 0;

  return {
    monthKey,
    monthlyIncomeTarget,
    incomeCollected,
    actualCompanyExpensesPaid,
    pendingExpensesSubmitted,
    remainingIncomeTarget,
    availableCompanyBalance,
    targetProgressPercentage,
    openingBalance,
    totalOutstandingReadyTasksAmount,
    totalOutstandingPendingTasksAmount,
  };
}
