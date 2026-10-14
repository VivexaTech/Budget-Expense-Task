import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';
import { sendUniversalPushNotification } from './_pushDispatcher';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET for Vercel Cron, and POST for manual trigger
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  try {
    getFirebaseAdmin();
    const firestore = admin.firestore();

    // If manual POST, verify authorization
    if (req.method === 'POST') {
      const authUser = await verifyAuthToken(req.headers.authorization);
      if (!authUser) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
    }

    // Determine current date in Asia/Kolkata (IST: UTC + 5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const todayStr = istDate.toISOString().split('T')[0];

    // 1. Fetch all active income collection tasks
    const tasksSnap = await firestore
      .collection('incomeTasks')
      .where('status', 'in', ['PENDING', 'PARTIALLY_PAID'])
      .get();

    interface RawTask {
      id: string;
      clientName: string;
      expectedAmount: number;
      remainingAmount: number;
      dueDate: string;
      createdByUid: string;
      assignedToUid?: string;
    }

    const allActiveTasks: RawTask[] = [];
    tasksSnap.forEach((doc) => {
      const d = doc.data();
      allActiveTasks.push({
        id: doc.id,
        clientName: d.clientName || 'Client',
        expectedAmount: Number(d.expectedAmount || 0),
        remainingAmount: Number(d.remainingAmount || 0),
        dueDate: d.dueDate || '',
        createdByUid: d.createdByUid || '',
        assignedToUid: d.assignedToUid || '',
      });
    });

    // 2. Fetch all active users
    const usersSnap = await firestore
      .collection('users')
      .where('active', '==', true)
      .get();

    let dispatchedCount = 0;
    let skippedCount = 0;
    const details: any[] = [];

    for (const userDoc of usersSnap.docs) {
      const u = userDoc.data();
      const uid = userDoc.id;
      const role = u.role || 'employee';
      const pushToken = u.pushToken;

      // Filter tasks relevant to this user:
      // Admin sees company-wide active tasks; Employee sees tasks they created or were assigned
      const userTasks = role === 'admin'
        ? allActiveTasks
        : allActiveTasks.filter((t) => t.createdByUid === uid || t.assignedToUid === uid);

      // Calculate Metrics for user
      let amountDueToday = 0;
      let dueTodayCount = 0;
      let amountOverdue = 0;
      let overdueCount = 0;
      let totalOutstanding = 0;

      for (const t of userTasks) {
        const rem = t.remainingAmount;
        totalOutstanding += rem;
        if (t.dueDate === todayStr) {
          amountDueToday += rem;
          dueTodayCount++;
        } else if (t.dueDate < todayStr) {
          amountOverdue += rem;
          overdueCount++;
        }
      }

      // Idempotency Key: at most once per user per daily run
      const idempotencyKey = `DAILY_FINANCIAL_SUMMARY_${uid}_${todayStr}`;
      const eventDocRef = firestore.collection('notificationEvents').doc(idempotencyKey);
      const existingEvent = await eventDocRef.get();

      if (existingEvent.exists && existingEvent.data()?.status === 'SENT') {
        skippedCount++;
        details.push({ uid, status: 'SKIPPED_DEDUPLICATED' });
        continue;
      }

      // If user has no outstanding tasks and nothing due, we can still notify or record
      const title = `Daily Collections Summary — ${todayStr}`;
      const dueTodayMsg = dueTodayCount > 0
        ? `₹${amountDueToday.toLocaleString('en-IN')} due today (${dueTodayCount} client${dueTodayCount === 1 ? '' : 's'})`
        : 'No client payments due today';
      const overdueMsg = overdueCount > 0
        ? ` • ₹${amountOverdue.toLocaleString('en-IN')} overdue (${overdueCount})`
        : '';
      const totalMsg = ` • Total Outstanding: ₹${totalOutstanding.toLocaleString('en-IN')}`;

      const body = `${dueTodayMsg}${overdueMsg}${totalMsg}.`;

      let pushSent = false;
      if (pushToken && typeof pushToken === 'string') {
        const pushRes = await sendUniversalPushNotification({
          tokens: [pushToken],
          title,
          body,
          data: { url: 'companybudget://tasks', date: todayStr },
          channelId: 'financial-alerts',
        });
        pushSent = pushRes.successCount > 0;
      }

      // Save notification event record
      await eventDocRef.set({
        id: idempotencyKey,
        title,
        body,
        recipientUid: uid,
        recipientRole: role,
        todayStr,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        pushDelivered: pushSent,
        metrics: {
          amountDueToday,
          dueTodayCount,
          amountOverdue,
          overdueCount,
          totalOutstanding,
        },
      });

      dispatchedCount++;
      details.push({
        uid,
        status: 'SENT',
        pushSent,
        dueTodayCount,
        amountDueToday,
        overdueCount,
        amountOverdue,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Daily financial summary processed for ${todayStr}. Dispatched: ${dispatchedCount}, Skipped: ${skippedCount}.`,
      todayStr,
      dispatchedCount,
      skippedCount,
      details,
    });
  } catch (error: any) {
    console.error('[DailyFinancialSummary] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error processing daily summary.' });
  }
}
