import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { MonthlyBudget, UserProfile, FinancialTask } from '@/types';
import { getCurrentMonthKey } from '@/utils/formatters';

/**
 * Pure calculation to determine authoritative Monthly Target.
 * 
 * Formula:
 * If overridden: returns overrideTarget.
 * Otherwise: effectiveFixedExpenses + additionalExpectedExpenses + profitTarget.
 * 
 * To prevent double-counting:
 * Effective fixed expenses = max(configuredFixedExpenseBudget, sum of non-cancelled tasks).
 * If configuredFixedExpenseBudget is 0, the sum of non-cancelled tasks is used.
 */
export function computeMonthlyTarget(
  budget: MonthlyBudget | null,
  tasks: FinancialTask[]
): {
  monthlyTarget: number;
  fixedExpenses: number;
  additionalExpenses: number;
  profitTarget: number;
  isOverridden: boolean;
} {
  const isOverridden = Boolean(budget?.isOverridden && budget?.monthlyTarget && budget.monthlyTarget > 0);

  // Sum active, non-cancelled tasks for this month
  const activeTasksSum = tasks
    .filter((t) => t.status !== 'CANCELLED')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const configuredFixed = Number(budget?.fixedExpenseBudget) || 0;

  // Fixed expenses is either the configured amount or the tasks sum. Never add them together to avoid double counting!
  const fixedExpenses = configuredFixed > 0 ? Math.max(configuredFixed, activeTasksSum) : activeTasksSum;
  const additionalExpenses = Number(budget?.additionalExpectedExpenses) || 0;
  const profitTarget = Number(budget?.profitTarget) || 0;

  if (isOverridden) {
    return {
      monthlyTarget: Number(budget!.monthlyTarget),
      fixedExpenses,
      additionalExpenses,
      profitTarget,
      isOverridden: true,
    };
  }

  const calculatedTarget = fixedExpenses + additionalExpenses + profitTarget;

  return {
    monthlyTarget: calculatedTarget,
    fixedExpenses,
    additionalExpenses,
    profitTarget,
    isOverridden: false,
  };
}

/**
 * Fetch budget configuration for given monthKey
 */
export async function getBudgetForMonth(monthKey: string): Promise<MonthlyBudget | null> {
  try {
    const docSnap = await getDoc(doc(db, 'budgets', monthKey));
    if (docSnap.exists()) {
      return docSnap.data() as MonthlyBudget;
    }
    return null;
  } catch (error) {
    console.error('[BudgetService] Error fetching budget:', error);
    return null;
  }
}

/**
 * Synchronize and persist monthly target in Firestore for a given monthKey.
 * Queries active tasks, computes target using business rules, and updates budgets/{monthKey}.
 */
export async function syncBudgetTarget(monthKey: string): Promise<MonthlyBudget> {
  const budgetRef = doc(db, 'budgets', monthKey);
  const budgetSnap = await getDoc(budgetRef);
  const existingBudget = budgetSnap.exists() ? (budgetSnap.data() as MonthlyBudget) : null;

  // Query active tasks for this month
  const tasksQuery = query(collection(db, 'tasks'), where('monthKey', '==', monthKey));
  const tasksSnap = await getDocs(tasksQuery);
  const tasks: FinancialTask[] = [];
  tasksSnap.forEach((d) => {
    tasks.push(d.data() as FinancialTask);
  });

  const { monthlyTarget, fixedExpenses } = computeMonthlyTarget(existingBudget, tasks);
  const now = new Date().toISOString();

  const updatedBudget: MonthlyBudget = {
    monthKey,
    timezone: existingBudget?.timezone || 'Asia/Kolkata',
    openingBalance: Number(existingBudget?.openingBalance || 0),
    fixedExpenseBudget: fixedExpenses,
    additionalExpectedExpenses: Number(existingBudget?.additionalExpectedExpenses || 0),
    profitTarget: Number(existingBudget?.profitTarget || 0),
    monthlyTarget,
    isOverridden: Boolean(existingBudget?.isOverridden),
    overrideReason: existingBudget?.overrideReason || '',
    createdAt: existingBudget?.createdAt || now,
    updatedAt: now,
    updatedBy: existingBudget?.updatedBy || 'system',
  };

  await setDoc(budgetRef, updatedBudget, { merge: true });
  return updatedBudget;
}

/**
 * Subscribe to monthly budget in real-time
 */
export function subscribeToBudget(
  monthKey: string,
  callback: (budget: MonthlyBudget | null) => void
) {
  return onSnapshot(
    doc(db, 'budgets', monthKey),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as MonthlyBudget);
      } else {
        // Return default skeleton budget if not yet created for this month
        callback({
          monthKey,
          timezone: 'Asia/Kolkata',
          fixedExpenseBudget: 0,
          additionalExpectedExpenses: 0,
          profitTarget: 0,
          monthlyTarget: 0,
          openingBalance: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
        });
      }
    },
    (err) => {
      console.error('[BudgetService] Subscription error:', err);
    }
  );
}

/**
 * Save or update budget configuration for a month (Admin only)
 */
export async function saveBudgetConfiguration(
  monthKey: string,
  data: {
    fixedExpenseBudget: number;
    additionalExpectedExpenses: number;
    profitTarget: number;
    openingBalance: number;
    isOverridden?: boolean;
    overrideTarget?: number;
    overrideReason?: string;
  },
  adminUser: UserProfile
): Promise<MonthlyBudget> {
  // Query tasks to ensure fixedExpenseBudget properly accounts for active tasks without double counting
  const tasksQuery = query(collection(db, 'tasks'), where('monthKey', '==', monthKey));
  const tasksSnap = await getDocs(tasksQuery);
  const tasks: FinancialTask[] = [];
  tasksSnap.forEach((d) => {
    tasks.push(d.data() as FinancialTask);
  });

  const activeTasksSum = tasks
    .filter((t) => t.status !== 'CANCELLED')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const effectiveFixed = data.fixedExpenseBudget > 0
    ? Math.max(data.fixedExpenseBudget, activeTasksSum)
    : activeTasksSum;

  const calculatedTarget = data.isOverridden && data.overrideTarget !== undefined
    ? Number(data.overrideTarget)
    : effectiveFixed + Number(data.additionalExpectedExpenses) + Number(data.profitTarget);

  const now = new Date().toISOString();

  const budget: MonthlyBudget = {
    monthKey,
    timezone: 'Asia/Kolkata',
    fixedExpenseBudget: effectiveFixed,
    additionalExpectedExpenses: Number(data.additionalExpectedExpenses),
    profitTarget: Number(data.profitTarget),
    monthlyTarget: calculatedTarget,
    openingBalance: Number(data.openingBalance),
    isOverridden: !!data.isOverridden,
    overrideReason: data.overrideReason || '',
    createdAt: now,
    updatedAt: now,
    updatedBy: adminUser.displayName,
  };

  await setDoc(doc(db, 'budgets', monthKey), budget, { merge: true });

  // Record audit log
  await setDoc(doc(collection(db, 'activityLogs')), {
    id: doc(collection(db, 'activityLogs')).id,
    actorUid: adminUser.uid,
    actorName: adminUser.displayName,
    actorRole: 'admin',
    action: 'BUDGET_UPDATED',
    entityType: 'budget',
    entityId: monthKey,
    description: `Updated budget for ${monthKey}: Target = ₹${calculatedTarget.toLocaleString('en-IN')}`,
    metadata: { ...budget },
    timestamp: now,
  });

  return budget;
}

