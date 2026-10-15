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

    const companyId = authUser.companyId || 'company_vivexa';
    const companyTaskRef = firestore.collection('companies').doc(companyId).collection('tasks').doc(taskId);
    let effectiveTaskRef = companyTaskRef;
    let isRootTask = false;

    let initialSnap = await companyTaskRef.get();
    if (!initialSnap.exists) {
      const rootTaskRef = firestore.collection('tasks').doc(taskId);
      initialSnap = await rootTaskRef.get();
      if (initialSnap.exists) {
        effectiveTaskRef = rootTaskRef;
        isRootTask = true;
      }
    }

    const now = new Date().toISOString();

    // Use Firestore transaction for safe concurrent completion
    const result = await firestore.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(effectiveTaskRef);
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

      const updatePayload = {
        status: 'COMPLETED',
        completedBy: authUser.uid,
        completedByName: callerData?.displayName || 'Admin',
        completedAt: now,
        paymentNotes: paymentNotes || 'Payment confirmed by administrator',
        updatedAt: now,
      };

      // Mark completed in effective task
      transaction.update(effectiveTaskRef, updatePayload);

      // If effective task was company subcollection, sync root task if present
      if (!isRootTask) {
        const rootDoc = await transaction.get(firestore.collection('tasks').doc(taskId));
        if (rootDoc.exists) {
          transaction.update(rootDoc.ref, updatePayload);
        }
      }

      // Write company audit log
      const companyAuditRef = firestore.collection('companies').doc(companyId).collection('activityLogs').doc();
      const auditPayload = {
        companyId,
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
      };

      transaction.set(companyAuditRef, auditPayload);

      // Dual write to root audit log
      const rootAuditRef = firestore.collection('activityLogs').doc();
      transaction.set(rootAuditRef, auditPayload);

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
