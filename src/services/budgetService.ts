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

import { computeMonthlyTarget as pureComputeMonthlyTarget } from '@/utils/financialCalculations';

export const computeMonthlyTarget = pureComputeMonthlyTarget;

/**
 * Fetch budget configuration for given monthKey and companyId
 */
export async function getBudgetForMonth(monthKey: string, companyId = 'company_vivexa'): Promise<MonthlyBudget | null> {
  try {
    const compBudgetSnap = await getDoc(doc(db, 'companies', companyId, 'budgets', monthKey));
    if (compBudgetSnap.exists()) {
      return compBudgetSnap.data() as MonthlyBudget;
    }
    const rootSnap = await getDoc(doc(db, 'budgets', monthKey));
    if (rootSnap.exists()) {
      return rootSnap.data() as MonthlyBudget;
    }
    return null;
  } catch (error) {
    console.error('[BudgetService] Error fetching budget:', error);
    return null;
  }
}

/**
 * Synchronize and persist monthly target in Firestore for a given monthKey and companyId.
 * Queries active tasks for the tenant, computes target using authoritative rules,
 * and updates both company subcollection and root document.
 */
export async function syncBudgetTarget(monthKey: string, companyId = 'company_vivexa'): Promise<MonthlyBudget> {
  const compBudgetRef = doc(db, 'companies', companyId, 'budgets', monthKey);
  const rootBudgetRef = doc(db, 'budgets', monthKey);
  
  let budgetSnap = await getDoc(compBudgetRef);
  if (!budgetSnap.exists()) {
    budgetSnap = await getDoc(rootBudgetRef);
  }
  const existingBudget = budgetSnap.exists() ? (budgetSnap.data() as MonthlyBudget) : null;

  // Query tasks specifically for this company and monthKey
  const compTasksSnap = await getDocs(
    query(collection(db, 'companies', companyId, 'tasks'), where('monthKey', '==', monthKey))
  );
  const tasks: FinancialTask[] = [];
  if (!compTasksSnap.empty) {
    compTasksSnap.forEach((d) => tasks.push(d.data() as FinancialTask));
  } else {
    // Check root tasks filtered strictly by companyId
    const rootTasksQuery = query(collection(db, 'tasks'), where('monthKey', '==', monthKey));
    const rootSnap = await getDocs(rootTasksQuery);
    rootSnap.forEach((d) => {
      const t = d.data() as FinancialTask;
      if ((t.companyId || 'company_vivexa') === companyId) {
        tasks.push(t);
      }
    });
  }

  const { monthlyTarget, fixedExpenses } = computeMonthlyTarget(existingBudget, tasks, companyId, monthKey);
  const now = new Date().toISOString();

  const updatedBudget: MonthlyBudget = {
    monthKey,
    companyId,
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

  await setDoc(compBudgetRef, updatedBudget, { merge: true });
  if (companyId === 'company_vivexa') {
    await setDoc(rootBudgetRef, updatedBudget, { merge: true });
  }
  return updatedBudget;
}

/**
 * Subscribe to monthly budget in real-time
 */
export function subscribeToBudget(
  monthKey: string,
  callback: (budget: MonthlyBudget | null) => void,
  companyId = 'company_vivexa'
) {
  return onSnapshot(
    doc(db, 'companies', companyId, 'budgets', monthKey),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as MonthlyBudget);
      } else {
        getDoc(doc(db, 'budgets', monthKey)).then((rootSnap) => {
          if (rootSnap.exists()) {
            callback(rootSnap.data() as MonthlyBudget);
          } else {
            callback({
              monthKey,
              companyId,
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
  const companyId = adminUser.companyId || 'company_vivexa';
  // Query tasks to ensure fixedExpenseBudget properly accounts for active tasks without double counting
  const tasksQuery = query(collection(db, 'tasks'), where('monthKey', '==', monthKey));
  const tasksSnap = await getDocs(tasksQuery);
  const tasks: FinancialTask[] = [];
  tasksSnap.forEach((d) => {
    const t = d.data() as FinancialTask;
    if ((t.companyId || 'company_vivexa') === companyId) {
      tasks.push(t);
    }
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
    companyId,
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
  await setDoc(doc(db, 'companies', companyId, 'budgets', monthKey), budget, { merge: true });

  // Record audit log
  const auditData = {
    companyId,
    actorUid: adminUser.uid,
    actorName: adminUser.displayName,
    actorRole: 'admin',
    action: 'BUDGET_UPDATED',
    entityType: 'budget',
    entityId: monthKey,
    description: `Updated budget for ${monthKey}: Target = ₹${calculatedTarget.toLocaleString('en-IN')}`,
    metadata: { ...budget },
    timestamp: now,
  };
  await setDoc(doc(collection(db, 'companies', companyId, 'activityLogs')), auditData);
  await setDoc(doc(collection(db, 'activityLogs')), auditData);

  return budget;
}

