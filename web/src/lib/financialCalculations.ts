/**
 * Authoritative Unified Financial Calculations Engine for Next.js SaaS Web App
 * 
 * Strictly mirrors mobile calculation logic to guarantee 100% calculation parity.
 */

export interface BudgetConfig {
  monthKey?: string;
  companyId?: string;
  fixedExpenseBudget?: number;
  additionalExpectedExpenses?: number;
  profitTarget?: number;
  monthlyTarget?: number;
  openingBalance?: number;
  isOverridden?: boolean;
  overrideReason?: string;
}

export interface TaskLike {
  id?: string;
  amount?: number;
  status?: string;
  companyId?: string;
  monthKey?: string;
}

export interface IncomeEntryLike {
  id?: string;
  amount: number;
  status?: 'VALID' | 'VOID' | string;
  companyId?: string;
  monthKey?: string;
  receivedDate?: string;
  createdAt?: string;
}

export interface ExpenseEntryLike {
  id?: string;
  amount: number;
  status?: string;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  paymentSource?: 'COMPANY_FUND' | 'SELF_PAID' | string;
  reimbursementStatus?: 'PENDING' | 'REIMBURSED' | 'PAID' | string;
  companyId?: string;
  monthKey?: string;
}

export function filterByTenantAndMonth<T extends { companyId?: string; monthKey?: string }>(
  items: T[],
  companyId?: string,
  monthKey?: string
): T[] {
  return items.filter((item) => {
    if (companyId) {
      const itemComp = item.companyId || 'company_vivexa';
      if (itemComp !== companyId) return false;
    }
    if (monthKey && item.monthKey && item.monthKey !== monthKey) {
      return false;
    }
    return true;
  });
}

export function computeMonthlyTarget(
  budget: BudgetConfig | null | undefined,
  tasks: TaskLike[],
  companyId?: string,
  monthKey?: string
): {
  monthlyTarget: number;
  fixedExpenses: number;
  additionalExpenses: number;
  profitTarget: number;
  isOverridden: boolean;
  activeTasksSum: number;
} {
  const isOverridden = Boolean(budget?.isOverridden && Number(budget.monthlyTarget) > 0);

  const scopedTasks = filterByTenantAndMonth(tasks, companyId, monthKey);

  const activeTasksSum = scopedTasks
    .filter((t) => t.status !== 'CANCELLED')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const configuredFixed = Number(budget?.fixedExpenseBudget) || 0;

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
      activeTasksSum,
    };
  }

  const calculatedTarget = fixedExpenses + additionalExpenses + profitTarget;

  return {
    monthlyTarget: calculatedTarget,
    fixedExpenses,
    additionalExpenses,
    profitTarget,
    isOverridden: false,
    activeTasksSum,
  };
}

export function computeCollectedIncome(
  incomeEntries: IncomeEntryLike[],
  companyId?: string,
  monthKey?: string
): number {
  const scoped = filterByTenantAndMonth(incomeEntries, companyId, monthKey);
  return scoped
    .filter((i) => i.status === 'VALID' || !i.status)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

export function computeCompletedTasksAmount(
  tasks: TaskLike[],
  companyId?: string,
  monthKey?: string
): number {
  const scoped = filterByTenantAndMonth(tasks, companyId, monthKey);
  return scoped
    .filter((t) => t.status === 'COMPLETED')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

export function isCompanyExpenseOutflow(entry: ExpenseEntryLike): boolean {
  if (entry.approvalStatus === 'REJECTED' || entry.status === 'REJECTED') {
    return false;
  }
  if (entry.paymentSource === 'COMPANY_FUND') {
    return true;
  }
  const isApproved = entry.approvalStatus === 'APPROVED' || entry.status === 'APPROVED';
  const isReimbursed = entry.reimbursementStatus === 'PAID' || entry.reimbursementStatus === 'REIMBURSED';
  return isApproved && isReimbursed;
}

export function computeCompanyExpenseOutflows(
  expenseEntries: ExpenseEntryLike[],
  companyId?: string,
  monthKey?: string
): number {
  const scoped = filterByTenantAndMonth(expenseEntries, companyId, monthKey);
  return scoped.reduce((sum, e) => {
    return isCompanyExpenseOutflow(e) ? sum + (Number(e.amount) || 0) : sum;
  }, 0);
}

export function computeFinancialOverview(params: {
  budget: BudgetConfig | null | undefined;
  tasks: TaskLike[];
  incomeEntries: IncomeEntryLike[];
  expenseEntries: ExpenseEntryLike[];
  companyId?: string;
  monthKey?: string;
}) {
  const { budget, tasks, incomeEntries, expenseEntries, companyId, monthKey } = params;

  const openingBalance = Number(budget?.openingBalance) || 0;
  const targetCalc = computeMonthlyTarget(budget, tasks, companyId, monthKey);
  const incomeCollected = computeCollectedIncome(incomeEntries, companyId, monthKey);
  const completedTasksAmount = computeCompletedTasksAmount(tasks, companyId, monthKey);
  const paidExpensesAmount = computeCompanyExpenseOutflows(expenseEntries, companyId, monthKey);

  const actualCompanyExpensesPaid = completedTasksAmount + paidExpensesAmount;
  const availableBalance = openingBalance + incomeCollected - actualCompanyExpensesPaid;
  const remainingIncomeTarget = Math.max(0, targetCalc.monthlyTarget - incomeCollected);
  const targetProgressPercent = targetCalc.monthlyTarget > 0
    ? Math.min(100, Math.round((incomeCollected / targetCalc.monthlyTarget) * 100))
    : 100;

  return {
    ...targetCalc,
    openingBalance,
    incomeCollected,
    completedTasksAmount,
    paidExpensesAmount,
    actualCompanyExpensesPaid,
    availableBalance,
    remainingIncomeTarget,
    targetProgressPercent,
  };
}
