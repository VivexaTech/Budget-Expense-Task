import * as admin from 'firebase-admin';

export interface PushPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
}

export interface PushResult {
  successCount: number;
  failureCount: number;
  expoCount: number;
  fcmCount: number;
}

/**
 * Universal Push Notification Dispatcher
 * Automatically routes Expo Push Tokens to Expo's Push API
 * and native FCM device tokens to Firebase Admin SDK Messaging.
 */
export async function sendUniversalPushNotification({
  tokens,
  title,
  body,
  data = {},
  channelId = 'financial-alerts',
}: PushPayload): Promise<PushResult> {
  const expoTokens: string[] = [];
  const fcmTokens: string[] = [];

  for (const t of tokens) {
    if (!t || typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (trimmed.startsWith('ExponentPushToken[') || trimmed.startsWith('ExpoPushToken[')) {
      expoTokens.push(trimmed);
    } else {
      fcmTokens.push(trimmed);
    }
  }

  let successCount = 0;
  let failureCount = 0;

  // 1. Dispatch Expo Push Tokens via Expo's Push Service API
  if (expoTokens.length > 0) {
    try {
      const messages = expoTokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data,
        channelId,
        priority: 'high',
      }));

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const dataArr = Array.isArray(json?.data) ? json.data : [json?.data];
        for (const item of dataArr) {
          if (item?.status === 'ok') {
            successCount++;
          } else {
            failureCount++;
          }
        }
      } else {
        failureCount += expoTokens.length;
      }
    } catch (expoErr) {
      console.warn('[PushDispatcher] Expo push delivery error:', expoErr);
      failureCount += expoTokens.length;
    }
  }

  // 2. Dispatch native FCM Device Tokens via Firebase Admin
  if (fcmTokens.length > 0) {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId,
            color: '#1A73E8',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;
    } catch (fcmErr) {
      console.warn('[PushDispatcher] FCM push delivery error:', fcmErr);
      failureCount += fcmTokens.length;
    }
  }

  return {
    successCount,
    failureCount,
    expoCount: expoTokens.length,
    fcmCount: fcmTokens.length,
  };
}
