import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, CheckCircle2, ArrowRight } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { NotificationEvent } from '@/types';
import { subscribeToUserNotifications } from '@/services/notificationService';
import { formatDateTime } from '@/utils/formatters';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserNotifications(user.uid, setNotifications);
    return () => unsub();
  }, [user]);

  const handleNotificationPress = (notif: NotificationEvent) => {
    if (notif.targetTaskId) {
      router.push({
        pathname: '/task-detail',
        params: { taskId: notif.targetTaskId },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={48} color={COLORS.textTertiary} />}
            title="All Caught Up"
            description="You will receive alerts when financial tasks become ready for review."
          />
        ) : (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              variant="outlined"
              style={styles.card}
              onPress={() => handleNotificationPress(notif)}
            >
              <View style={styles.row}>
                <View style={styles.iconCircle}>
                  <CheckCircle2 size={20} color={COLORS.success} />
                </View>
                <View style={styles.contentCol}>
                  <Text style={styles.title}>{notif.title}</Text>
                  <Text style={styles.body}>{notif.body}</Text>
                  <Text style={styles.time}>{formatDateTime(notif.createdAt)}</Text>
                </View>
                {notif.targetTaskId && (
                  <ArrowRight size={16} color={COLORS.textTertiary} />
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  card: {
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCol: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  body: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  time: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
});
