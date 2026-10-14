import type * as NotificationsType from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { NotificationEvent } from '@/types';
import { updateUserPushToken } from './authService';
import { callBackendApi } from './apiClient';

/**
 * Detect whether the application is running inside the Expo Go client app.
 * In Expo SDK 53+, remote push notifications are not supported in Expo Go and require
 * a development build (expo-dev-client) or standalone APK/AAB build.
 */
export function isRunningInExpoGo(): boolean {
  try {
    return (
      Constants?.appOwnership === 'expo' ||
      Constants?.executionEnvironment === ExecutionEnvironment.StoreClient
    );
  } catch {
    return false;
  }
}

// Module cache for expo-notifications
let _notificationsModule: typeof NotificationsType | null = null;
let _handlerConfigured = false;
let _lastRegisteredToken: string | null = null;

export function getLastRegisteredPushToken(): string | null {
  return _lastRegisteredToken;
}

/**
 * Safely access expo-notifications module only when NOT running in Expo Go.
 * In Expo Go (SDK 53+), the native module is removed and importing/requiring it throws errors.
 */
function getNotifications(): typeof NotificationsType | null {
  if (isRunningInExpoGo()) {
    return null;
  }
  if (_notificationsModule) {
    return _notificationsModule;
  }
  try {
    _notificationsModule = require('expo-notifications');
    if (_notificationsModule && !_handlerConfigured) {
      _notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: _notificationsModule?.AndroidNotificationPriority?.MAX,
        }),
      });
      _handlerConfigured = true;
    }
    return _notificationsModule;
  } catch {
    return null;
  }
}

/**
 * Returns the current notification environment info for UI and diagnostics.
 */
export function getNotificationEnvironment(): {
  isExpoGo: boolean;
  isDevice: boolean;
  pushToken: string | null;
  statusMessage: string;
} {
  const isExpoGo = isRunningInExpoGo();
  return {
    isExpoGo,
    isDevice: Device.isDevice,
    pushToken: _lastRegisteredToken,
    statusMessage: isExpoGo
      ? 'Running in Expo Go: Remote push notifications are disabled by Expo SDK 53+. Push notifications automatically activate in the Android APK / Dev build.'
      : _lastRegisteredToken
        ? `Registered for push notifications (${_lastRegisteredToken.substring(0, 22)}...)`
        : 'Standalone / Dev Build: Push token registration active.',
  };
}

/**
 * Configure Android notification channels with HIGH importance for notifications to pop up.
 */
export async function configureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    // Primary channel for financial & task alerts
    await Notifications.setNotificationChannelAsync('financial-alerts', {
      name: 'Financial & Task Alerts',
      description: 'Alerts for task readiness, daily summaries, and income collections',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A73E8',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      sound: 'default',
    });

    // Fallback default channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Alerts',
      description: 'General application alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A73E8',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      sound: 'default',
    });

    console.log('[NotificationService] Android notification channels configured successfully.');
  } catch (chanErr) {
    console.warn('[NotificationService] Notification channel creation warning:', chanErr);
  }
}

/**
 * Register device for Push Notifications & create Android channel.
 * 
 * - In Expo Go: Gracefully skips remote push token generation to prevent SDK 53+ errors.
 * - In Development / Standalone APK builds: Fully registers push token and updates Firestore.
 */
export async function registerForPushNotificationsAsync(uid?: string): Promise<string | null> {
  // If running inside Expo Go, remote push notifications are not supported starting in SDK 53+.
  if (isRunningInExpoGo()) {
    console.log('[NotificationService] Running in Expo Go client. Remote push registration skipped.');
    return null;
  }

  const Notifications = getNotifications();
  if (!Notifications) {
    return null;
  }

  // Always configure notification channels on Android
  await configureAndroidNotificationChannels();

  // iOS simulator cannot receive remote APNs tokens
  if (!Device.isDevice && Platform.OS === 'ios') {
    console.log('[NotificationService] Push notifications require a physical iOS device.');
    return null;
  }

  let token: string | null = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[NotificationService] Notification permission not granted by user.');
      return null;
    }

    // Determine project ID from EAS config or app config
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      'ace45463-6461-4e98-ab8d-aca80e0ea715';

    // 1. Try Expo Push Token first
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = tokenData.data;
      console.log('[NotificationService] Successfully obtained Expo Push Token:', token);
    } catch (expoErr: any) {
      console.warn('[NotificationService] Expo push token retrieval failed, attempting native FCM token:', expoErr?.message || expoErr);
      // 2. Fallback to native FCM Device Token
      try {
        const deviceData = await Notifications.getDevicePushTokenAsync();
        token = deviceData.data;
        console.log('[NotificationService] Successfully obtained Native FCM Token:', token);
      } catch (fcmErr: any) {
        console.error('[NotificationService] Failed to obtain native push token:', fcmErr?.message || fcmErr);
      }
    }

    if (token) {
      _lastRegisteredToken = token;
      if (uid) {
        await updateUserPushToken(uid, token);
      }
    }

    // Listen for provider token refreshes
    try {
      Notifications.addPushTokenListener((tokenData) => {
        if (tokenData?.data) {
          console.log('[NotificationService] Push token refreshed:', tokenData.data);
          _lastRegisteredToken = tokenData.data;
          if (uid) {
            updateUserPushToken(uid, tokenData.data).catch(() => {});
          }
        }
      });
    } catch {
      // Listener setup fallback
    }
  } catch (err: any) {
    console.error('[NotificationService] Error in registerForPushNotificationsAsync:', err?.message || err);
  }

  return token;
}

/**
 * Send a test notification that works seamlessly in both Expo Go and APK:
 * - In Expo Go: records the notification in Firestore so it appears in Notification Center.
 * - In APK: dispatches via backend FCM/Expo service.
 */
export async function sendTestNotificationAsync(
  recipientUid?: string
): Promise<{ success: boolean; message: string; isLocal: boolean }> {
  const isExpoGo = isRunningInExpoGo();

  if (isExpoGo) {
    try {
      // Record event in Firestore for audit & in-app notification center
      if (recipientUid) {
        const notifRef = doc(collection(db, 'notificationEvents'));
        await setDoc(notifRef, {
          id: notifRef.id,
          title: 'Company Budget Alert',
          body: 'Test notification delivered successfully. In the final APK, native FCM remote push notifications are used.',
          recipientUid,
          status: 'SENT',
          createdAt: new Date().toISOString(),
        });
      }

      return {
        success: true,
        message: 'Notification recorded in Notification Center! In the standalone Android APK, native FCM push alerts will pop up on your device.',
        isLocal: true,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Failed to record test notification.',
        isLocal: true,
      };
    }
  }

  // Standalone / development build: dispatch via backend FCM
  const res = await callBackendApi('/api/send-notification', 'POST', {
    title: 'Company Budget Alert',
    body: 'Remote push notification delivered successfully to your device.',
    recipientUid,
    data: {
      test: 'true',
      url: 'companybudget://notifications',
    },
  });

  return {
    success: res.success,
    message: res.success
      ? 'FCM remote push notification dispatched to your registered device.'
      : res.error || 'Failed to dispatch remote push notification.',
    isLocal: false,
  };
}

/**
 * Subscribe to user's notification events in Firestore
 */
export function subscribeToUserNotifications(
  uid: string,
  callback: (notifications: NotificationEvent[]) => void
) {
  const q = query(
    collection(db, 'notificationEvents'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: NotificationEvent[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as NotificationEvent;
        if (data.recipientUid === uid || data.recipientUid === 'ALL_AUTHORIZED') {
          list.push(data);
        }
      });
      callback(list);
    },
    () => {
      // Silently handle listener interruptions
    }
  );
}

/**
 * Setup notification response and deep-link listeners.
 * Handles notification tap events when app is in foreground, background, or opened from closed state.
 */
export function setupNotificationListeners(
  onNavigate: (route: string, params?: Record<string, string>) => void
): () => void {
  const Notifications = getNotifications();
  if (!Notifications) {
    return () => {};
  }

  try {
    // 1. Check if app was launched by tapping a notification while closed/killed
    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            handleNotificationResponse(response, onNavigate);
          }
        })
        .catch(() => {});
    }

    // 2. Listen for notification tap responses when app is running/backgrounded
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, onNavigate);
    });

    return () => {
      sub.remove();
    };
  } catch {
    return () => {};
  }
}

function handleNotificationResponse(
  response: any,
  onNavigate: (route: string, params?: Record<string, string>) => void
) {
  const data = response?.notification?.request?.content?.data;
  if (!data) {
    onNavigate('/notifications');
    return;
  }

  const taskId = data.taskId || data.targetTaskId;
  if (taskId) {
    onNavigate('/task-detail', { taskId: String(taskId) });
    return;
  }

  const url = data.url ? String(data.url) : '';
  if (url) {
    if (url.includes('/tasks/')) {
      const match = url.match(/\/tasks\/(.+)$/);
      if (match && match[1]) {
        onNavigate('/task-detail', { taskId: match[1] });
        return;
      }
    }
    if (url.includes('/tasks')) {
      onNavigate('/(tabs)/tasks');
      return;
    }
    if (url.includes('/activity')) {
      onNavigate('/(tabs)/activity');
      return;
    }
    if (url.includes('/create-income-task')) {
      onNavigate('/create-income-task');
      return;
    }
    if (url.includes('/configure-budget')) {
      onNavigate('/configure-budget');
      return;
    }
  }

  onNavigate('/notifications');
}
