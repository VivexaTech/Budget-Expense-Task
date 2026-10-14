import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { COLORS } from '@/constants/theme';
import { setupNotificationListeners } from '@/services/notificationService';

function RootNavigation() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Handle push notification tap & deep links
  useEffect(() => {
    const cleanup = setupNotificationListeners((route, params) => {
      if (params) {
        router.push({ pathname: route as any, params });
      } else {
        router.push(route as any);
      }
    });

    return () => {
      cleanup();
    };
  }, [router]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if unauthenticated
      router.replace('/(auth)/login' as any);
    } else if (user && inAuthGroup) {
      // Redirect to tabs if authenticated
      router.replace('/(tabs)' as any);
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-income"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="add-expense"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="create-income-task"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="expense-group-detail"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="task-detail"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="configure-budget"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="create-task"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="recurring-tasks"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="manage-employees"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="notifications"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
