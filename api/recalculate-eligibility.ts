import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    getFirebaseAdmin();
    const authUser = await verifyAuthToken(req.headers.authorization);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { monthKey } = req.body;
    if (!monthKey || typeof monthKey !== 'string') {
      return res.status(400).json({ error: 'Valid monthKey (YYYY-MM) is required.' });
    }

    const firestore = admin.firestore();

    // 1. Fetch Budget period config (to get openingBalance and targets)
    const budgetDoc = await firestore.collection('budgets').doc(monthKey).get();
    const budgetData = budgetDoc.data() || {};
    const openingBalance = Number(budgetData.openingBalance || 0);

    // 2. Fetch all valid income entries for monthKey
    const incomeSnap = await firestore
      .collection('incomeEntries')
      .where('monthKey', '==', monthKey)
      .where('status', '==', 'VALID')
      .get();
    
    let totalIncome = 0;
    incomeSnap.forEach((doc) => {
      totalIncome += Number(doc.data().amount || 0);
    });

    // 3. Fetch all completed fixed/recurring tasks (actual company payments)
    const completedTasksSnap = await firestore
      .collection('tasks')
      .where('monthKey', '==', monthKey)
      .where('status', '==', 'COMPLETED')
      .get();

    let totalCompletedTasksAmount = 0;
    completedTasksSnap.forEach((doc) => {
      totalCompletedTasksAmount += Number(doc.data().amount || 0);
    });

    // 4. Fetch all expenses for monthKey and sum actual company cash outflows
    const expensesSnap = await firestore
      .collection('expenseEntries')
      .where('monthKey', '==', monthKey)
      .get();

    let totalPaidExpensesAmount = 0;
    expensesSnap.forEach((doc) => {
      const e = doc.data();
      if (e.approvalStatus !== 'REJECTED') {
        if (e.paymentSource === 'COMPANY_FUND' || (e.approvalStatus === 'APPROVED' && e.reimbursementStatus === 'PAID')) {
          totalPaidExpensesAmount += Number(e.amount || 0);
        }
      }
    });

    // 5. Calculate authoritative Available Balance
    // Available Balance = Opening Balance + Valid Income - Verified Company Payments - Confirmed Outflows
    const availableBalance = openingBalance + totalIncome - totalCompletedTasksAmount - totalPaidExpensesAmount;

    // 6. Fetch pending and ready_to_complete tasks
    // Sort deterministically: dueDate ASC, createdAt ASC
    const activeTasksSnap = await firestore
      .collection('tasks')
      .where('monthKey', '==', monthKey)
      .get();

    interface TaskRecord {
      id: string;
      title: string;
      amount: number;
      dueDate: string;
      createdAt: string;
      status: string;
      allocatedAmount: number;
    }

    const uncompletedTasks: TaskRecord[] = [];
    activeTasksSnap.forEach((doc) => {
      const data = doc.data();
      if (data.status === 'PENDING' || data.status === 'READY_TO_COMPLETE') {
        uncompletedTasks.push({
          id: doc.id,
          title: data.title,
          amount: Number(data.amount || 0),
          dueDate: data.dueDate || '9999-99-99',
          createdAt: data.createdAt || '',
          status: data.status,
          allocatedAmount: Number(data.allocatedAmount || 0),
        });
      }
    });

    // Sort by due date, then created date
    uncompletedTasks.sort((a, b) => {
      const dateCompare = a.dueDate.localeCompare(b.dueDate);
      if (dateCompare !== 0) return dateCompare;
      return a.createdAt.localeCompare(b.createdAt);
    });

    // 7. Deterministic allocation pass
    let remainingFunds = availableBalance;
    const batch = firestore.batch();
    const newlyReadyTasks: TaskRecord[] = [];
    const revertedTasks: TaskRecord[] = [];
    let updatedCount = 0;

    for (const task of uncompletedTasks) {
      const taskRef = firestore.collection('tasks').doc(task.id);

      if (remainingFunds >= task.amount) {
        // Sufficient unallocated funds exist
        remainingFunds -= task.amount;

        if (task.status !== 'READY_TO_COMPLETE' || task.allocatedAmount !== task.amount) {
          batch.update(taskRef, {
            status: 'READY_TO_COMPLETE',
            allocatedAmount: task.amount,
            eligibilityReason: `Covered by available funds (₹${availableBalance.toLocaleString('en-IN')})`,
            updatedAt: new Date().toISOString(),
          });
          newlyReadyTasks.push(task);
          updatedCount++;

          // Create notification event if transitioned from PENDING
          if (task.status === 'PENDING') {
            const idempotencyKey = `READY_${task.id}_${monthKey}`;
            const notifyRef = firestore.collection('notificationEvents').doc(idempotencyKey);
            batch.set(notifyRef, {
              id: idempotencyKey,
              eventType: 'TASK_READY',
              targetTaskId: task.id,
              recipientUid: 'ALL_AUTHORIZED', // Handled by notification dispatcher
              idempotencyKey,
              title: 'Company Task Ready for Review',
              body: `${task.title} — ₹${task.amount.toLocaleString('en-IN')} is financially ready for review.`,
              status: 'QUEUED',
              createdAt: new Date().toISOString(),
              retryCount: 0,
            }, { merge: true });
          }
        }
      } else {
        // Insufficient funds
        if (task.status === 'READY_TO_COMPLETE') {
          // Revert back to PENDING due to legitimate financial adjustment
          batch.update(taskRef, {
            status: 'PENDING',
            allocatedAmount: 0,
            eligibilityReason: 'Awaiting sufficient unallocated income',
            updatedAt: new Date().toISOString(),
          });
          revertedTasks.push(task);
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      monthKey,
      financials: {
        openingBalance,
        totalIncome,
        totalCompletedTasksAmount,
        totalPaidExpensesAmount,
        availableBalance,
        unallocatedBalance: Math.max(0, remainingFunds),
      },
      evaluation: {
        totalEvaluated: uncompletedTasks.length,
        newlyReadyCount: newlyReadyTasks.length,
        revertedCount: revertedTasks.length,
        newlyReadyTasks: newlyReadyTasks.map(t => ({ id: t.id, title: t.title, amount: t.amount })),
      },
    });
  } catch (error: any) {
    console.error('[RecalculateEligibility] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to recalculate eligibility.' });
  }
}
