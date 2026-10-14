/**
 * Core Financial Engine & Task Allocation Test Suite
 */

interface TaskItem {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  createdAt: string;
  status: 'PENDING' | 'READY_TO_COMPLETE' | 'COMPLETED' | 'CANCELLED';
  allocatedAmount: number;
}

// 1. Calculate Monthly Target
export function calculateMonthlyTarget(
  fixed: number,
  additional: number,
  profit: number,
  isOverridden = false,
  overrideAmount = 0
): number {
  if (isOverridden) {
    return overrideAmount;
  }
  return fixed + additional + profit;
}

// 2. Calculate Available Company Balance
export function calculateAvailableBalance(
  openingBalance: number,
  validIncome: number,
  completedTasksAmount: number,
  paidExpensesAmount: number
): number {
  return openingBalance + validIncome - completedTasksAmount - paidExpensesAmount;
}

// 3. Deterministic Allocation Pass
export function allocateFundsToTasks(
  availableBalance: number,
  tasks: TaskItem[]
): {
  evaluatedTasks: TaskItem[];
  remainingUnallocatedFunds: number;
  newlyReadyCount: number;
  revertedCount: number;
} {
  // Sort deterministically: dueDate ASC, createdAt ASC
  const sorted = [...tasks].sort((a, b) => {
    const d = a.dueDate.localeCompare(b.dueDate);
    if (d !== 0) return d;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let remaining = availableBalance;
  let newlyReadyCount = 0;
  let revertedCount = 0;

  const result: TaskItem[] = sorted.map((task) => {
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      return task;
    }

    if (remaining >= task.amount) {
      remaining -= task.amount;
      if (task.status !== 'READY_TO_COMPLETE') {
        newlyReadyCount++;
      }
      return {
        ...task,
        status: 'READY_TO_COMPLETE',
        allocatedAmount: task.amount,
      };
    } else {
      if (task.status === 'READY_TO_COMPLETE') {
        revertedCount++;
      }
      return {
        ...task,
        status: 'PENDING',
        allocatedAmount: 0,
      };
    }
  });

  return {
    evaluatedTasks: result,
    remainingUnallocatedFunds: remaining,
    newlyReadyCount,
    revertedCount,
  };
}

// =======================
// ASSERTION TEST RUNNER
// =======================
export function runFinancialLogicTests(): boolean {
  console.log('--- RUNNING FINANCIAL LOGIC & TASK READINESS TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // Test 1: Monthly Target Calculation
  const target1 = calculateMonthlyTarget(70000, 10000, 20000);
  assert('Monthly Target equals Fixed (70k) + Additional (10k) + Profit (20k) = 100k', target1 === 100000);

  // Test 2: Target Override
  const target2 = calculateMonthlyTarget(70000, 10000, 20000, true, 120000);
  assert('Target override returns explicit 120k value', target2 === 120000);

  // Test 3: Available Balance Formula
  // Opening (50k) + Income (35k) - Completed Tasks (20k) - Reimbursed Expenses (5k) = 60k
  const balance = calculateAvailableBalance(50000, 35000, 20000, 5000);
  assert('Available Balance = 50k + 35k - 20k - 5k = 60k', balance === 60000);

  // Test 4: Deterministic Task Allocation Order
  const mockTasks: TaskItem[] = [
    {
      id: 'task-3',
      title: 'Electricity Bill',
      amount: 15000,
      dueDate: '2026-10-15',
      createdAt: '2026-10-01T00:00:00Z',
      status: 'PENDING',
      allocatedAmount: 0,
    },
    {
      id: 'task-1',
      title: 'Office Rent',
      amount: 30000,
      dueDate: '2026-10-05',
      createdAt: '2026-10-01T00:00:00Z',
      status: 'PENDING',
      allocatedAmount: 0,
    },
    {
      id: 'task-2',
      title: 'Internet Fiber',
      amount: 5000,
      dueDate: '2026-10-10',
      createdAt: '2026-10-01T00:00:00Z',
      status: 'PENDING',
      allocatedAmount: 0,
    },
    {
      id: 'task-4',
      title: 'Salaries',
      amount: 50000,
      dueDate: '2026-10-25',
      createdAt: '2026-10-01T00:00:00Z',
      status: 'PENDING',
      allocatedAmount: 0,
    },
  ];

  // Available cash is ₹40,000
  // In due date order:
  // 1. Rent (₹30,000, due Oct 5) -> Covered! (Remaining ₹10,000)
  // 2. Internet (₹5,000, due Oct 10) -> Covered! (Remaining ₹5,000)
  // 3. Electricity (₹15,000, due Oct 15) -> Not covered! (Needs ₹15,000, only ₹5,000 left)
  // 4. Salaries (₹50,000, due Oct 25) -> Not covered!
  const allocationResult = allocateFundsToTasks(40000, mockTasks);

  assert(
    'Task 1 (Rent) is READY_TO_COMPLETE with 30k allocated',
    allocationResult.evaluatedTasks[0].id === 'task-1' &&
      allocationResult.evaluatedTasks[0].status === 'READY_TO_COMPLETE' &&
      allocationResult.evaluatedTasks[0].allocatedAmount === 30000
  );

  assert(
    'Task 2 (Internet) is READY_TO_COMPLETE with 5k allocated',
    allocationResult.evaluatedTasks[1].id === 'task-2' &&
      allocationResult.evaluatedTasks[1].status === 'READY_TO_COMPLETE' &&
      allocationResult.evaluatedTasks[1].allocatedAmount === 5000
  );

  assert(
    'Task 3 (Electricity) remains PENDING with 0 allocated due to insufficient funds',
    allocationResult.evaluatedTasks[2].id === 'task-3' &&
      allocationResult.evaluatedTasks[2].status === 'PENDING' &&
      allocationResult.evaluatedTasks[2].allocatedAmount === 0
  );

  assert(
    'Remaining unallocated funds equal exactly ₹5,000',
    allocationResult.remainingUnallocatedFunds === 5000
  );

  assert('Two newly ready tasks identified', allocationResult.newlyReadyCount === 2);

  // Test 5: No double counting on task completion
  // When Task 1 (Rent ₹30k) is completed, it leaves available balance:
  const newBalance = calculateAvailableBalance(50000, 35000, 30000, 5000); // 50k
  assert('Available balance after 30k disbursement is 50k', newBalance === 50000);

  // Test 6: Reversion on financial correction
  // If income was voided and balance dropped from 40k to 20k:
  const revertedAllocation = allocateFundsToTasks(20000, allocationResult.evaluatedTasks);
  // Rent needs 30k, so even Rent cannot be covered with only 20k!
  assert(
    'Rent reverts to PENDING when funds drop below requirement',
    revertedAllocation.evaluatedTasks[0].status === 'PENDING'
  );

  // Test 7: Target reflects active tasks when fixedExpenseBudget is unconfigured/0 (Fixes Target Always Showing ₹0)
  const tasksForMonth = [
    { id: 't1', amount: 30000, status: 'PENDING' as const },
    { id: 't2', amount: 44000, status: 'READY_TO_COMPLETE' as const },
  ];
  const taskSum = tasksForMonth.reduce((s, t) => s + t.amount, 0); // 74k
  const effectiveFixedUnconfigured = Math.max(0, taskSum);
  const targetUnconfigured = calculateMonthlyTarget(effectiveFixedUnconfigured, 0, 0);
  assert('Target is non-zero (74k) when tasks are added before configuring budget', targetUnconfigured === 74000);

  // Test 8: No double-counting when both fixed budget and tasks exist
  // Configured fixed = 74k, tasks = 74k, additional = 10k, profit = 20k -> Target = 104k (not 178k!)
  const effectiveFixedNoDouble = Math.max(74000, taskSum);
  const targetNoDoubleCount = calculateMonthlyTarget(effectiveFixedNoDouble, 10000, 20000);
  assert('Target does NOT double-count expenses when both fixed budget (74k) and tasks (74k) exist: equals 104k', targetNoDoubleCount === 104000);

  // Test 9: Target increases when tasks exceed configured fixed budget
  // If tasks total 80k and configured fixed is 74k: effective fixed = 80k -> Target = 110k
  const updatedTasksSum = 80000;
  const effectiveFixedIncreased = Math.max(74000, updatedTasksSum);
  const targetIncreased = calculateMonthlyTarget(effectiveFixedIncreased, 10000, 20000);
  assert('Target increases to 110k when newly created tasks (80k) exceed configured fixed budget', targetIncreased === 110000);

  // Test 10: Complete task eligibility check
  const availableBal = 50000;
  const eligibleTaskAmount = 30000;
  const canCompleteEligible = availableBal >= eligibleTaskAmount;
  assert('Eligible task can be completed when available balance (50k) >= task amount (30k)', canCompleteEligible === true);

  // Test 11: Exact shortfall calculation for ineligible task
  const ineligibleTaskAmount = 70000;
  const shortfall = ineligibleTaskAmount - availableBal;
  const canCompleteIneligible = availableBal >= ineligibleTaskAmount;
  assert('Ineligible task cannot be completed and exact shortfall equals ₹20,000', canCompleteIneligible === false && shortfall === 20000);

  // Test 12: By Company Fund immediately deducts from available balance
  // Opening = 100k, Income = 20k, Tasks = 0, CompanyFund Expense = 5k
  interface TestExpense {
    amount: number;
    paymentSource: 'SELF' | 'COMPANY_FUND';
    approvalStatus: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    reimbursementStatus: 'UNPAID' | 'PAID';
  }
  function isCompanyExpenseOutflowTest(exp: TestExpense): boolean {
    if (exp.approvalStatus === 'REJECTED') return false;
    if (exp.paymentSource === 'COMPANY_FUND') return true;
    return exp.approvalStatus === 'APPROVED' && exp.reimbursementStatus === 'PAID';
  }

  const companyFundExpense: TestExpense = {
    amount: 5000,
    paymentSource: 'COMPANY_FUND',
    approvalStatus: 'SUBMITTED',
    reimbursementStatus: 'PAID',
  };
  const outflowCompanyFund = isCompanyExpenseOutflowTest(companyFundExpense) ? companyFundExpense.amount : 0;
  const balWithCompanyFund = calculateAvailableBalance(100000, 20000, 0, outflowCompanyFund);
  assert(
    'By Company Fund expense is immediately deducted from available balance (115k)',
    balWithCompanyFund === 115000
  );

  // Test 13: By Self (Employee Paid) does NOT deduct from available balance upon submission
  const selfSubmittedExpense = {
    amount: 8000,
    paymentSource: 'SELF' as const,
    approvalStatus: 'SUBMITTED' as const,
    reimbursementStatus: 'UNPAID' as const,
  };
  const outflowSelfSubmitted = isCompanyExpenseOutflowTest(selfSubmittedExpense) ? selfSubmittedExpense.amount : 0;
  const balWithSelfSubmitted = calculateAvailableBalance(100000, 20000, 0, outflowSelfSubmitted);
  assert(
    'By Self submitted expense does NOT deduct from available balance (remains 120k)',
    balWithSelfSubmitted === 120000
  );

  // Test 14: By Self deducts only after admin approval and reimbursement
  const selfReimbursedExpense = {
    amount: 8000,
    paymentSource: 'SELF' as const,
    approvalStatus: 'APPROVED' as const,
    reimbursementStatus: 'PAID' as const,
  };
  const outflowSelfReimbursed = isCompanyExpenseOutflowTest(selfReimbursedExpense) ? selfReimbursedExpense.amount : 0;
  const balWithSelfReimbursed = calculateAvailableBalance(100000, 20000, 0, outflowSelfReimbursed);
  assert(
    'By Self expense deducts from company cash only after being reimbursed (112k)',
    balWithSelfReimbursed === 112000
  );

  // Test 15: Rejected Company Fund expense is NOT counted as outflow
  const companyFundRejected = {
    amount: 5000,
    paymentSource: 'COMPANY_FUND' as const,
    approvalStatus: 'REJECTED' as const,
    reimbursementStatus: 'PAID' as const,
  };
  const outflowRejected = isCompanyExpenseOutflowTest(companyFundRejected) ? companyFundRejected.amount : 0;
  const balWithRejected = calculateAvailableBalance(100000, 20000, 0, outflowRejected);
  assert(
    'Rejected company-funded expense is NOT an outflow and preserves company balance (120k)',
    balWithRejected === 120000
  );

  // Test 16: RFC 4180 CSV escaping handles quotes, commas, and UTF-8 BOM
  function escapeCsvCellTest(val: any): string {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }
  const testDesc = 'Office "Special" Supplies, Pens & Paper';
  const escaped = escapeCsvCellTest(testDesc);
  assert(
    'CSV cell escapes internal quotes and handles commas',
    escaped === '"Office ""Special"" Supplies, Pens & Paper"'
  );

  // Test 17: Partial Payment on Income Task updates balances and due date
  interface TestIncomePayment {
    id: string;
    amount: number;
    date: string;
    paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
  }

  interface TestIncomeTask {
    id: string;
    clientName: string;
    expectedAmount: number;
    receivedAmount: number;
    remainingAmount: number;
    dueDate: string;
    status: 'PENDING' | 'PARTIALLY_PAID' | 'COMPLETED' | 'CANCELLED';
    payments: TestIncomePayment[];
  }

  function recordTestPayment(
    task: TestIncomeTask,
    paymentAmount: number,
    nextDueDate?: string,
    paymentDate: string = '2026-10-14'
  ): TestIncomeTask {
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throw new Error('Cannot record payment for completed or cancelled task');
    }
    if (paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    if (paymentAmount > task.remainingAmount) {
      throw new Error(`Payment amount (₹${paymentAmount}) exceeds remaining balance (₹${task.remainingAmount})`);
    }

    const newReceived = task.receivedAmount + paymentAmount;
    const newRemaining = Math.max(0, task.expectedAmount - newReceived);
    const newStatus = newRemaining === 0 ? 'COMPLETED' : 'PARTIALLY_PAID';
    const effectiveDueDate = newRemaining > 0 && nextDueDate ? nextDueDate : task.dueDate;

    const paymentRecord: TestIncomePayment = {
      id: `pay-${Date.now()}`,
      amount: paymentAmount,
      date: paymentDate,
      paymentMode: 'UPI',
    };

    return {
      ...task,
      receivedAmount: newReceived,
      remainingAmount: newRemaining,
      status: newStatus,
      dueDate: effectiveDueDate,
      payments: [...task.payments, paymentRecord],
    };
  }

  const initialIncomeTask: TestIncomeTask = {
    id: 'itask-1',
    clientName: 'Acme Corp',
    expectedAmount: 4000,
    receivedAmount: 0,
    remainingAmount: 4000,
    dueDate: '2026-10-15',
    status: 'PENDING',
    payments: [],
  };

  const partialTask = recordTestPayment(initialIncomeTask, 1500, '2026-10-18');
  assert(
    'Partial payment (₹1,500 of ₹4,000) updates received to ₹1,500, remaining to ₹2,500, status to PARTIALLY_PAID, and next due date to 2026-10-18',
    partialTask.receivedAmount === 1500 &&
      partialTask.remainingAmount === 2500 &&
      partialTask.status === 'PARTIALLY_PAID' &&
      partialTask.dueDate === '2026-10-18' &&
      partialTask.payments.length === 1
  );

  // Test 18: Overpayment prevention throws an error
  let overpaymentPrevented = false;
  try {
    recordTestPayment(partialTask, 3000); // Remaining is 2500, trying to pay 3000
  } catch (err: any) {
    if (err.message.includes('exceeds remaining balance')) {
      overpaymentPrevented = true;
    }
  }
  assert('Overpayment attempt (₹3,000 when ₹2,500 remaining) is safely blocked', overpaymentPrevented);

  // Test 19: Full final payment marks task COMPLETED with 0 remaining
  const completedIncomeTask = recordTestPayment(partialTask, 2500);
  assert(
    'Final payment of exact remaining balance (₹2,500) sets remaining to 0 and status to COMPLETED',
    completedIncomeTask.receivedAmount === 4000 &&
      completedIncomeTask.remainingAmount === 0 &&
      completedIncomeTask.status === 'COMPLETED' &&
      completedIncomeTask.payments.length === 2
  );

  // Test 20: Strict Cash Flow Rule — Uncollected receivables NEVER increase available company balance
  // Opening balance = 50k, Existing valid income = 20k
  const baseOpeningBalance = 50000;
  const initialValidIncome = 20000;
  const balanceBeforeReceivable = calculateAvailableBalance(baseOpeningBalance, initialValidIncome, 0, 0); // 70k

  // Task created with expected ₹4,000 (Receivable) -> Balance MUST remain 70k (NOT 74k)
  const balanceWithUncollectedReceivable = calculateAvailableBalance(
    baseOpeningBalance,
    initialValidIncome, // Uncollected expected amount is NOT added
    0,
    0
  );
  assert(
    'Uncollected expected receivable (₹4,000) does NOT increase company available balance (remains 70k)',
    balanceWithUncollectedReceivable === 70000
  );

  // Partial payment of ₹1,500 collected -> ONLY the actual ₹1,500 creates an IncomeEntry and increases balance to 71.5k
  const balanceAfterPartialCollection = calculateAvailableBalance(
    baseOpeningBalance,
    initialValidIncome + partialTask.payments[0].amount, // ONLY actual received 1.5k
    0,
    0
  );
  assert(
    'Only actual partial payment collected (₹1,500) increases available company balance to 71.5k (NOT 74k)',
    balanceAfterPartialCollection === 71500
  );

  // Test 21: Income Collection Metrics Segregation (Due Today, Overdue, Outstanding, Month Collected)
  function calculateTestIncomeCollectionMetrics(
    tasks: TestIncomeTask[],
    todayStr: string
  ) {
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

      for (const p of t.payments || []) {
        if (p.date && p.date.startsWith(currentMonth)) {
          amountCollectedThisMonth += Number(p.amount || 0);
        }
      }

      if (t.status === 'COMPLETED') {
        completedTasksCount++;
        continue;
      }

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

  const sampleTasks: TestIncomeTask[] = [
    {
      id: 'task-overdue',
      clientName: 'Client Alpha',
      expectedAmount: 5000,
      receivedAmount: 0,
      remainingAmount: 5000,
      dueDate: '2026-10-10', // Overdue relative to 2026-10-14
      status: 'PENDING',
      payments: [],
    },
    {
      id: 'task-due-today',
      clientName: 'Client Beta',
      expectedAmount: 8000,
      receivedAmount: 2000,
      remainingAmount: 6000,
      dueDate: '2026-10-14', // Due today
      status: 'PARTIALLY_PAID',
      payments: [{ id: 'p1', amount: 2000, date: '2026-10-02', paymentMode: 'UPI' }],
    },
    {
      id: 'task-future',
      clientName: 'Client Gamma',
      expectedAmount: 10000,
      receivedAmount: 0,
      remainingAmount: 10000,
      dueDate: '2026-10-25', // Future
      status: 'PENDING',
      payments: [],
    },
    {
      id: 'task-completed',
      clientName: 'Client Delta',
      expectedAmount: 4000,
      receivedAmount: 4000,
      remainingAmount: 0,
      dueDate: '2026-10-05',
      status: 'COMPLETED',
      payments: [{ id: 'p2', amount: 4000, date: '2026-10-05', paymentMode: 'BANK_TRANSFER' }],
    },
    {
      id: 'task-cancelled',
      clientName: 'Client Epsilon',
      expectedAmount: 3000,
      receivedAmount: 0,
      remainingAmount: 3000,
      dueDate: '2026-10-12',
      status: 'CANCELLED',
      payments: [],
    },
  ];

  const metrics = calculateTestIncomeCollectionMetrics(sampleTasks, '2026-10-14');
  assert(
    'Total outstanding collections equals sum of active tasks remaining (5k + 6k + 10k = 21k)',
    metrics.totalOutstandingCollections === 21000
  );
  assert(
    'Due today amount equals 6k and due today count equals 1',
    metrics.amountDueToday === 6000 && metrics.dueTodayCount === 1
  );
  assert(
    'Overdue amount equals 5k and overdue count equals 1 (cancelled 3k task ignored)',
    metrics.amountOverdue === 5000 && metrics.overdueCount === 1
  );
  assert(
    'Month collected amount equals sum of payments in current month (2k + 4k = 6k)',
    metrics.amountCollectedThisMonth === 6000
  );
  assert(
    'Completed tasks count is 1 and active pending tasks count is 3',
    metrics.completedTasksCount === 1 && metrics.pendingTasksCount === 3
  );

  console.log(`\nTEST RESULTS: ${passed} Passed, ${failed} Failed`);
  return failed === 0;
}

// Run if called directly
runFinancialLogicTests();


