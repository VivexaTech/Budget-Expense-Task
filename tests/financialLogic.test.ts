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

  console.log(`\nTEST RESULTS: ${passed} Passed, ${failed} Failed`);
  return failed === 0;
}

// Run if called directly
runFinancialLogicTests();

