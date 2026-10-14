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
      Constants?.executionEnvironment === ExecutionEnvironment.StoreClient ||
      Boolean(Constants?.expoVersion)
    );
  } catch {
    return false;
  }
}

// Module cache for expo-notifications
let _notificationsModule: typeof NotificationsType | null = null;
let _handlerConfigured = false;

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
          priority: _notificationsModule?.AndroidNotificationPriority?.HIGH,
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
  statusMessage: string;
} {
  const isExpoGo = isRunningInExpoGo();
  return {
    isExpoGo,
    isDevice: Device.isDevice,
    statusMessage: isExpoGo
      ? 'Running in Expo Go: Remote push notifications are disabled by Expo SDK 53+. Push notifications automatically activate in the Android APK / Dev build.'
      : 'Standalone / Development Build: Remote FCM push notifications enabled.',
  };
}

/**
 * Register device for Push Notifications & create Android channel.
 * 
 * - In Expo Go: Gracefully skips remote push token generation to prevent SDK 53+ errors.
 * - In Development / Standalone APK builds: Fully registers push token and updates Firestore.
 */
export async function registerForPushNotificationsAsync(uid?: string): Promise<string | null> {
  // If running inside Expo Go, remote push notifications are not supported starting in SDK 53+.
  // Return null gracefully without logging warnings or errors.
  if (isRunningInExpoGo()) {
    return null;
  }

  const Notifications = getNotifications();
  if (!Notifications) {
    return null;
  }

  // Always configure notification channel on Android for local & remote alerts
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('financial-alerts', {
        name: 'Financial & Task Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1A73E8',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    } catch {
      // Non-critical channel creation error
    }
  }

  // When running in a real standalone APK or development build on a physical device:
  if (!Device.isDevice) {
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
    } catch {
      // 2. Fallback to native FCM Device Token if Expo Push token generation fails
      try {
        const deviceData = await Notifications.getDevicePushTokenAsync();
        token = deviceData.data;
      } catch {
        // Both unavailable
      }
    }

    if (uid && token) {
      await updateUserPushToken(uid, token);
    }
  } catch {
    // Suppress token registration errors in non-configured environments
  }

  return token;
}

/**
 * Send a test notification that works seamlessly in both Expo Go and APK:
 * - In Expo Go: records the notification in Firestore so it appears in Notification Center.
 * - In APK: dispatches via backend FCM service.
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
        message: 'Notification recorded in Notification Center! In the final Android APK build, native FCM push alerts will pop up on your device.',
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
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationResponse(response, onNavigate);
        }
      })
      .catch(() => {});

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

  if (data.taskId) {
    onNavigate('/task-detail', { taskId: String(data.taskId) });
  } else if (data.url) {
    if (String(data.url).includes('/tasks')) {
      onNavigate('/(tabs)/tasks');
    } else if (String(data.url).includes('/activity')) {
      onNavigate('/(tabs)/activity');
    } else {
      onNavigate('/notifications');
    }
  } else {
    onNavigate('/notifications');
  }
}

