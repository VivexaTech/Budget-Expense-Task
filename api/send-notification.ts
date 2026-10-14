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

    if (expectedSecret && (authHeader === `Bearer ${expectedSecret}` || cronSecretHeader === expectedSecret)) {
      isAuthorized = true;
    } else {
      const authUser = await verifyAuthToken(authHeader);
      if (authUser) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { eventId, idempotencyKey, title, body, targetTaskId, recipientUid, data: extraData } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required.' });
    }

    const firestore = admin.firestore();
    const key = idempotencyKey || eventId;

    // Check if notification was already sent
    if (key) {
      const eventDoc = await firestore.collection('notificationEvents').doc(key).get();
      if (eventDoc.exists && eventDoc.data()?.status === 'SENT') {
        return res.status(200).json({
          success: true,
          message: 'Notification already dispatched previously (deduplicated).',
          deduplicated: true,
        });
      }
    }

    // Determine target push tokens
    const tokens: string[] = [];

    if (recipientUid && recipientUid !== 'ALL_AUTHORIZED') {
      const userDoc = await firestore.collection('users').doc(recipientUid).get();
      const token = userDoc.data()?.pushToken;
      if (token && typeof token === 'string' && token.trim().length > 0) {
        tokens.push(token.trim());
      }
    } else {
      // Broadcast to active users with tokens
      const activeUsersSnap = await firestore
        .collection('users')
        .where('active', '==', true)
        .get();

      activeUsersSnap.forEach((doc) => {
        const token = doc.data()?.pushToken;
        if (token && typeof token === 'string' && token.trim().length > 0 && !tokens.includes(token.trim())) {
          tokens.push(token.trim());
        }
      });
    }

    let sentCount = 0;
    const now = new Date().toISOString();

    if (tokens.length > 0) {
      const pushRes = await sendUniversalPushNotification({
        tokens,
        title,
        body,
        data: {
          taskId: targetTaskId || '',
          url: targetTaskId ? `companybudget://tasks/${targetTaskId}` : (extraData?.url || 'companybudget://notifications'),
          ...(extraData || {}),
        },
        channelId: 'financial-alerts',
      });
      sentCount = pushRes.successCount;
    }

    // Record notification event status
    if (key) {
      await firestore.collection('notificationEvents').doc(key).set({
        id: key,
        title,
        body,
        targetTaskId: targetTaskId || null,
        recipientUid: recipientUid || 'ALL_AUTHORIZED',
        status: 'SENT',
        sentAt: now,
        tokensTargeted: tokens.length,
        tokensSuccess: sentCount,
        updatedAt: now,
      }, { merge: true });
    }

    return res.status(200).json({
      success: true,
      message: `Dispatched push notification to ${sentCount} device(s).`,
      sentCount,
      totalTargeted: tokens.length,
    });
  } catch (error: any) {
    console.error('[SendNotification] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch push notification.' });
  }
}
