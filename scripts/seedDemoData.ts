/**
 * Demo Data Seeder & Verification Script
 * Can be run with: npx ts-node scripts/seedDemoData.ts
 * Or imported directly into test runners
 */
import * as admin from 'firebase-admin';

// Initialize Firebase Admin for seeder if credentials exist or in emulator
export async function seedDemoData() {
  console.log('[Seed] Starting company budget demo data seed...');

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'company-budget-demo',
    });
  }

  const firestore = admin.firestore();
  const currentMonth = '2026-10';
  const now = new Date().toISOString();

  // 1. Seed Users
  const users = [
    {
      uid: 'demo_admin_uid',
      displayName: 'Vikram Malhotra (Admin)',
      email: 'admin@company.internal',
      employeeId: 'EMP-001',
      role: 'admin',
      active: true,
      createdAt: now,
    },
    {
      uid: 'demo_emp1_uid',
      displayName: 'Ananya Sen',
      email: 'employee1@company.internal',
      employeeId: 'EMP-101',
      role: 'employee',
      active: true,
      createdAt: now,
    },
    {
      uid: 'demo_emp2_uid',
      displayName: 'Rohan Gupta',
      email: 'employee2@company.internal',
      employeeId: 'EMP-102',
      role: 'employee',
      active: true,
      createdAt: now,
    },
  ];

  for (const u of users) {
    await firestore.collection('users').doc(u.uid).set(u, { merge: true });
    console.log(`[Seed] Seeded user ${u.displayName}`);
  }

  // 2. Seed Monthly Budget for 2026-10
  const budget = {
    monthKey: currentMonth,
    timezone: 'Asia/Kolkata',
    openingBalance: 50000,
    fixedExpenseBudget: 74000,
    additionalExpectedExpenses: 10000,
    profitTarget: 20000,
    monthlyTarget: 104000,
    isOverridden: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: 'Vikram Malhotra',
  };
  await firestore.collection('budgets').doc(currentMonth).set(budget, { merge: true });
  console.log('[Seed] Seeded budget for 2026-10');

  // 3. Seed Fixed Tasks
  const tasks = [
    {
      id: 'task_rent_oct',
      title: 'Office Lease Rent',
      amount: 25000,
      dueDate: '2026-10-05',
      monthKey: currentMonth,
      category: 'Office Rent',
      description: 'Monthly office rent payment to landlord',
      status: 'READY_TO_COMPLETE', // Covered by opening balance
      allocatedAmount: 25000,
      taskType: 'FIXED',
      createdBy: 'demo_admin_uid',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task_internet_oct',
      title: 'High-speed Fiber Internet',
      amount: 4000,
      dueDate: '2026-10-10',
      monthKey: currentMonth,
      category: 'Utilities & Bills',
      description: 'Airtel Enterprise Fiber 1Gbps',
      status: 'READY_TO_COMPLETE', // Covered by remaining funds
      allocatedAmount: 4000,
      taskType: 'FIXED',
      createdBy: 'demo_admin_uid',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task_electricity_oct',
      title: 'Office Electricity Bill',
      amount: 5000,
      dueDate: '2026-10-15',
      monthKey: currentMonth,
      category: 'Utilities & Bills',
      description: 'BSES Yamuna Commercial Power',
      status: 'READY_TO_COMPLETE',
      allocatedAmount: 5000,
      taskType: 'FIXED',
      createdBy: 'demo_admin_uid',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task_salaries_oct',
      title: 'Employee Salaries Disbursement',
      amount: 40000,
      dueDate: '2026-10-25',
      monthKey: currentMonth,
      category: 'Employee Salaries',
      description: 'Operational staff payroll disbursement',
      status: 'PENDING', // Awaiting more income
      allocatedAmount: 0,
      taskType: 'FIXED',
      createdBy: 'demo_admin_uid',
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const t of tasks) {
    await firestore.collection('tasks').doc(t.id).set(t, { merge: true });
    console.log(`[Seed] Seeded task ${t.title}`);
  }

  // 4. Seed Income
  const income = {
    id: 'inc_bluestar_1',
    employeeId: 'EMP-101',
    employeeUid: 'demo_emp1_uid',
    employeeNameSnapshot: 'Ananya Sen',
    amount: 35000,
    collectedFrom: 'BlueStar Logistics Pvt Ltd',
    workDescription: 'ERP Customization Milestone 2',
    paymentMode: 'UPI',
    monthKey: currentMonth,
    status: 'VALID',
    createdAt: now,
  };
  await firestore.collection('incomeEntries').doc(income.id).set(income, { merge: true });
  console.log('[Seed] Seeded income entry');

  // 5. Seed Flexible Expenses & Groups
  const exp1 = {
    id: 'exp_stat_1',
    employeeId: 'EMP-101',
    employeeUid: 'demo_emp1_uid',
    employeeNameSnapshot: 'Ananya Sen',
    title: 'Stationery & Printing',
    amount: 300,
    monthKey: currentMonth,
    approvalStatus: 'SUBMITTED',
    reimbursementStatus: 'UNPAID',
    createdAt: now,
  };
  const exp2 = {
    id: 'exp_supplies_1',
    employeeId: 'EMP-101',
    employeeUid: 'demo_emp1_uid',
    employeeNameSnapshot: 'Ananya Sen',
    title: 'Office Supplies & Coffee',
    amount: 500,
    monthKey: currentMonth,
    approvalStatus: 'SUBMITTED',
    reimbursementStatus: 'UNPAID',
    createdAt: now,
  };
  await firestore.collection('expenseEntries').doc(exp1.id).set(exp1, { merge: true });
  await firestore.collection('expenseEntries').doc(exp2.id).set(exp2, { merge: true });

  const group1 = {
    id: `EMP-101_${currentMonth}`,
    employeeId: 'EMP-101',
    employeeUid: 'demo_emp1_uid',
    employeeNameSnapshot: 'Ananya Sen',
    monthKey: currentMonth,
    totalAmount: 800,
    entryCount: 2,
    approvedAmount: 0,
    reviewStatus: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
  await firestore.collection('expenseGroups').doc(group1.id).set(group1, { merge: true });
  console.log('[Seed] Seeded grouped expenses for Ananya Sen');

  console.log('[Seed] Demo data seeding completed successfully!');
}
