import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';
import { sendUniversalPushNotification } from './_pushDispatcher';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    getFirebaseAdmin();
    const authHeader = req.headers['authorization'];
    const cronSecretHeader = req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET;
    let isAuthorized = false;
    let authUser: { uid: string; email?: string; role?: string; companyId?: string; companyName?: string } | null = null;

    if (expectedSecret && (authHeader === `Bearer ${expectedSecret}` || cronSecretHeader === expectedSecret)) {
      isAuthorized = true;
    } else {
      authUser = await verifyAuthToken(authHeader);
      if (authUser) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { monthKey } = req.body;
    if (!monthKey || typeof monthKey !== 'string') {
      return res.status(400).json({ error: 'Valid monthKey (YYYY-MM) is required.' });
    }

    const companyId = req.body.companyId || authUser?.companyId || 'company_vivexa';
    const firestore = admin.firestore();

    // 1. Fetch Budget period config (to get openingBalance and targets)
    let budgetDoc = await firestore.collection('companies').doc(companyId).collection('budgets').doc(monthKey).get();
    if (!budgetDoc.exists) {
      budgetDoc = await firestore.collection('budgets').doc(monthKey).get();
    }
    const budgetData = budgetDoc.data() || {};
    const openingBalance = Number(budgetData.openingBalance || 0);

    // 2. Fetch all valid income entries for monthKey
    let incomeSnap = await firestore
      .collection('companies').doc(companyId).collection('incomeEntries')
      .where('monthKey', '==', monthKey)
      .where('status', '==', 'VALID')
      .get();
    if (incomeSnap.empty) {
      incomeSnap = await firestore
        .collection('incomeEntries')
        .where('monthKey', '==', monthKey)
        .where('status', '==', 'VALID')
        .get();
    }
    
    let totalIncome = 0;
    incomeSnap.forEach((doc) => {
      totalIncome += Number(doc.data().amount || 0);
    });

    // 3. Fetch all completed fixed/recurring tasks (actual company payments)
    let completedTasksSnap = await firestore
      .collection('companies').doc(companyId).collection('tasks')
      .where('monthKey', '==', monthKey)
      .where('status', '==', 'COMPLETED')
      .get();
    if (completedTasksSnap.empty) {
      completedTasksSnap = await firestore
        .collection('tasks')
        .where('monthKey', '==', monthKey)
        .where('status', '==', 'COMPLETED')
        .get();
    }

    let totalCompletedTasksAmount = 0;
    completedTasksSnap.forEach((doc) => {
      totalCompletedTasksAmount += Number(doc.data().amount || 0);
    });

    // 4. Fetch all expenses for monthKey and sum actual company cash outflows
    let expensesSnap = await firestore
      .collection('companies').doc(companyId).collection('expenseEntries')
      .where('monthKey', '==', monthKey)
      .get();
    if (expensesSnap.empty) {
      expensesSnap = await firestore
        .collection('expenseEntries')
        .where('monthKey', '==', monthKey)
        .get();
    }

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
    let isCompanyTasks = true;
    let activeTasksSnap = await firestore
      .collection('companies').doc(companyId).collection('tasks')
      .where('monthKey', '==', monthKey)
      .get();
    if (activeTasksSnap.empty) {
      activeTasksSnap = await firestore
        .collection('tasks')
        .where('monthKey', '==', monthKey)
        .get();
      isCompanyTasks = false;
    }

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
      const taskRef = isCompanyTasks
        ? firestore.collection('companies').doc(companyId).collection('tasks').doc(task.id)
        : firestore.collection('tasks').doc(task.id);

      if (remainingFunds >= task.amount) {
        // Sufficient unallocated funds exist
        remainingFunds -= task.amount;

        if (task.status !== 'READY_TO_COMPLETE' || task.allocatedAmount !== task.amount) {
          const updatePayload = {
            status: 'READY_TO_COMPLETE',
            allocatedAmount: task.amount,
            eligibilityReason: `Covered by available funds (₹${availableBalance.toLocaleString('en-IN')})`,
            updatedAt: new Date().toISOString(),
          };
          batch.update(taskRef, updatePayload);
          if (isCompanyTasks) {
            batch.set(firestore.collection('tasks').doc(task.id), updatePayload, { merge: true });
          }
          newlyReadyTasks.push(task);
          updatedCount++;

          // Create notification event if transitioned from PENDING
          if (task.status === 'PENDING') {
            const idempotencyKey = `READY_${task.id}_${monthKey}`;
            const notifyRef = firestore.collection('companies').doc(companyId).collection('notificationEvents').doc(idempotencyKey);
            const notifyPayload = {
              id: idempotencyKey,
              companyId,
              eventType: 'TASK_READY',
              targetTaskId: task.id,
              recipientUid: 'ALL_AUTHORIZED',
              idempotencyKey,
              title: 'Company Task Ready for Review',
              body: `${task.title} — ₹${task.amount.toLocaleString('en-IN')} is financially ready for review.`,
              status: 'QUEUED',
              createdAt: new Date().toISOString(),
              retryCount: 0,
            };
            batch.set(notifyRef, notifyPayload, { merge: true });
            batch.set(firestore.collection('notificationEvents').doc(idempotencyKey), notifyPayload, { merge: true });
          }
        }
      } else {
        // Insufficient funds
        if (task.status === 'READY_TO_COMPLETE') {
          // Revert back to PENDING due to legitimate financial adjustment
          const revertPayload = {
            status: 'PENDING',
            allocatedAmount: 0,
            eligibilityReason: 'Awaiting sufficient unallocated income',
            updatedAt: new Date().toISOString(),
          };
          batch.update(taskRef, revertPayload);
          if (isCompanyTasks) {
            batch.set(firestore.collection('tasks').doc(task.id), revertPayload, { merge: true });
          }
          revertedTasks.push(task);
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
    }

    // Dispatch real push notifications strictly to active users in this company
    if (newlyReadyTasks.length > 0) {
      try {
        const activeUsersSnap = await firestore
          .collection('users')
          .where('active', '==', true)
          .get();

        const tokens: string[] = [];
        activeUsersSnap.forEach((doc) => {
          const u = doc.data();
          const userCompany = u.companyId || 'company_vivexa';
          if (userCompany === companyId) {
            const t = u.pushToken;
            if (t && typeof t === 'string' && t.trim().length > 0 && !tokens.includes(t.trim())) {
              tokens.push(t.trim());
            }
          }
        });

        if (tokens.length > 0) {
          for (const readyTask of newlyReadyTasks) {
            await sendUniversalPushNotification({
              tokens,
              title: 'Company Task Ready for Review',
              body: `${readyTask.title} — ₹${readyTask.amount.toLocaleString('en-IN')} is financially ready for review.`,
              data: {
                taskId: readyTask.id,
                url: `companybudget://tasks/${readyTask.id}`,
              },
              channelId: 'financial-alerts',
            });
          }
        }
      } catch (pushErr) {
        console.warn('[RecalculateEligibility] Push dispatch warning:', pushErr);
      }
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
