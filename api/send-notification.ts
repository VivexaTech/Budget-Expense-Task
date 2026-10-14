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

    const { eventId, idempotencyKey, title, body, targetTaskId, recipientUid } = req.body;

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
      if (token) tokens.push(token);
    } else {
      // Broadcast to active users with tokens
      const activeUsersSnap = await firestore
        .collection('users')
        .where('active', '==', true)
        .get();

      activeUsersSnap.forEach((doc) => {
        const token = doc.data()?.pushToken;
        if (token && typeof token === 'string' && !tokens.includes(token)) {
          tokens.push(token);
        }
      });
    }

    let sentCount = 0;
    const now = new Date().toISOString();

    if (tokens.length > 0) {
      // Send multicast push via FCM
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: {
          taskId: targetTaskId || '',
          url: targetTaskId ? `companybudget://tasks/${targetTaskId}` : 'companybudget://',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'financial-alerts',
            color: '#1A73E8',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      sentCount = response.successCount;

      // Clean up invalid tokens if any
      response.responses.forEach(async (resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            const badToken = tokens[idx];
            console.warn(`Removing stale push token: ${badToken}`);
            const staleUserSnap = await firestore
              .collection('users')
              .where('pushToken', '==', badToken)
              .get();
            staleUserSnap.forEach((u) => u.ref.update({ pushToken: admin.firestore.FieldValue.delete() }));
          }
        }
      });
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
