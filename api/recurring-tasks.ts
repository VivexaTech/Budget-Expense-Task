import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';
import { sendUniversalPushNotification } from './_pushDispatcher';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    getFirebaseAdmin();
    const firestore = admin.firestore();

    // Verify trigger: either authorized admin or secret cron header
    const cronSecretHeader = req.headers['x-cron-secret'] || req.headers['authorization'];
    const expectedSecret = process.env.CRON_SECRET;
    let isAuthorized = false;

    if (expectedSecret && cronSecretHeader === `Bearer ${expectedSecret}`) {
      isAuthorized = true;
    } else {
      const authUser = await verifyAuthToken(req.headers.authorization);
      if (authUser) {
        const callerDoc = await firestore.collection('users').doc(authUser.uid).get();
        if (callerDoc.data()?.role === 'admin') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized to trigger recurring tasks.' });
    }

    // Determine target monthKey (default to current month YYYY-MM)
    const targetMonthKey = (req.body?.monthKey as string) || (req.query?.monthKey as string) || new Date().toISOString().substring(0, 7);

    // Fetch active recurring templates
    const templatesSnap = await firestore
      .collection('recurringTaskTemplates')
      .where('active', '==', true)
      .get();

    if (templatesSnap.empty) {
      return res.status(200).json({
        success: true,
        message: 'No active recurring task templates found.',
        createdCount: 0,
      });
    }

    let createdCount = 0;
    const now = new Date().toISOString();

    for (const doc of templatesSnap.docs) {
      const template = doc.data();
      const recurrenceKey = `${doc.id}_${targetMonthKey}`;

      // Check if task already exists for this template and month (Idempotency)
      const existingTaskSnap = await firestore
        .collection('tasks')
        .where('recurrenceKey', '==', recurrenceKey)
        .limit(1)
        .get();

      if (existingTaskSnap.empty) {
        // Construct due date for this month
        const dayOfMonth = Math.min(Math.max(1, template.dueDayOfMonth || 1), 28);
        const dayStr = dayOfMonth.toString().padStart(2, '0');
        const dueDate = `${targetMonthKey}-${dayStr}`;

        const newTaskRef = firestore.collection('tasks').doc();
        await newTaskRef.set({
          id: newTaskRef.id,
          title: template.title,
          amount: Number(template.amount),
          description: template.description || 'Monthly recurring company expense',
          category: template.category || 'Recurring Operations',
          monthKey: targetMonthKey,
          dueDate,
          status: 'PENDING',
          taskType: 'RECURRING',
          allocatedAmount: 0,
          recurrenceKey,
          createdBy: 'SYSTEM_CRON',
          createdAt: now,
          updatedAt: now,
        });

        // Log audit event
        await firestore.collection('activityLogs').add({
          actorUid: 'SYSTEM_CRON',
          actorName: 'Recurring Tasks Engine',
          actorRole: 'system',
          action: 'TASK_CREATED',
          entityType: 'task',
          entityId: newTaskRef.id,
          description: `Generated recurring monthly task: ${template.title} for ${targetMonthKey}`,
          metadata: { templateId: doc.id, monthKey: targetMonthKey, dueDate, amount: template.amount },
          timestamp: now,
        });

        createdCount++;
      }
    }

    if (createdCount > 0) {
      try {
        const adminsSnap = await firestore.collection('users').where('role', '==', 'admin').where('active', '==', true).get();
        const adminTokens: string[] = [];
        adminsSnap.forEach((doc) => {
          const t = doc.data()?.pushToken;
          if (t && typeof t === 'string' && t.trim().length > 0 && !adminTokens.includes(t.trim())) {
            adminTokens.push(t.trim());
          }
        });
        if (adminTokens.length > 0) {
          await sendUniversalPushNotification({
            tokens: adminTokens,
            title: 'Recurring Operations Tasks',
            body: `Generated ${createdCount} recurring operations task(s) for ${targetMonthKey}.`,
            data: { url: 'companybudget://tasks', monthKey: targetMonthKey },
            channelId: 'financial-alerts',
          });
        }
      } catch (pushErr) {
        console.warn('[RecurringTasks] Push dispatch error:', pushErr);
      }
    }

    return res.status(200).json({
      success: true,
      monthKey: targetMonthKey,
      totalTemplates: templatesSnap.size,
      createdCount,
      message: `Generated ${createdCount} recurring tasks for ${targetMonthKey}.`,
    });
  } catch (error: any) {
    console.error('[RecurringTasks] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate recurring tasks.' });
  }
}
