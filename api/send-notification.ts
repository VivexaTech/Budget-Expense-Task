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
    let authUser: any = null;

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

    const companyId = req.body.companyId || (authUser as any)?.companyId || 'company_vivexa';

    // Determine target push tokens
    const tokens: string[] = [];

    if (recipientUid && recipientUid !== 'ALL_AUTHORIZED') {
      const userDoc = await firestore.collection('users').doc(recipientUid).get();
      const userData = userDoc.data();
      const userCompany = userData?.companyId || 'company_vivexa';
      // Ensure recipient belongs to the caller's company
      if (userCompany === companyId) {
        const token = userData?.pushToken;
        if (token && typeof token === 'string' && token.trim().length > 0) {
          tokens.push(token.trim());
        }
      }
    } else {
      // Broadcast strictly to active users in the SAME company
      const activeUsersSnap = await firestore
        .collection('users')
        .where('active', '==', true)
        .get();

      activeUsersSnap.forEach((doc) => {
        const u = doc.data();
        const userCompany = u.companyId || 'company_vivexa';
        if (userCompany === companyId) {
          const token = u.pushToken;
          if (token && typeof token === 'string' && token.trim().length > 0 && !tokens.includes(token.trim())) {
            tokens.push(token.trim());
          }
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
