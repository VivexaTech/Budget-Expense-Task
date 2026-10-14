import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    getFirebaseAdmin();
    const authUser = await verifyAuthToken(req.headers.authorization);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const firestore = admin.firestore();
    const callerDoc = await firestore.collection('users').doc(authUser.uid).get();
    const callerData = callerDoc.data();

    if (callerData?.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can confirm task completion.' });
    }

    const { taskId, paymentNotes } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required.' });
    }

    const taskRef = firestore.collection('tasks').doc(taskId);
    const now = new Date().toISOString();

    // Use Firestore transaction for safe concurrent completion
    const result = await firestore.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) {
        throw new Error('Task not found.');
      }

      const task = taskDoc.data();
      if (!task) throw new Error('Task data missing.');

      if (task.status === 'COMPLETED') {
        throw new Error('Task is already completed.');
      }

      if (task.status !== 'READY_TO_COMPLETE') {
        throw new Error(`Task is currently ${task.status}. Only READY_TO_COMPLETE tasks can be completed.`);
      }

      // Mark completed
      transaction.update(taskRef, {
        status: 'COMPLETED',
        completedBy: authUser.uid,
        completedByName: callerData?.displayName || 'Admin',
        completedAt: now,
        paymentNotes: paymentNotes || 'Payment confirmed by administrator',
        updatedAt: now,
      });

      // Write immutable audit log
      const auditRef = firestore.collection('activityLogs').doc();
      transaction.set(auditRef, {
        actorUid: authUser.uid,
        actorName: callerData?.displayName || 'Admin',
        actorRole: 'admin',
        action: 'TASK_COMPLETED',
        entityType: 'task',
        entityId: taskId,
        description: `Completed financial task: ${task.title} (₹${Number(task.amount).toLocaleString('en-IN')})`,
        metadata: {
          taskTitle: task.title,
          amount: task.amount,
          monthKey: task.monthKey,
          paymentNotes: paymentNotes || null,
        },
        timestamp: now,
      });

      return {
        id: taskId,
        title: task.title,
        amount: task.amount,
        monthKey: task.monthKey,
      };
    });

    return res.status(200).json({
      success: true,
      message: `Task "${result.title}" completed successfully.`,
      task: result,
    });
  } catch (error: any) {
    console.error('[CompleteTask] Error:', error);
    return res.status(400).json({ error: error.message || 'Failed to complete task.' });
  }
}
