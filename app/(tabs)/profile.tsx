import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  Shield,
  Users,
  Repeat,
  Sliders,
  Bell,
  LogOut,
  ChevronRight,
  Receipt,
  ArrowDownLeft,
  Smartphone,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import {
  getNotificationEnvironment,
  sendTestNotificationAsync,
} from '@/services/notificationService';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAdmin, isEmployee, logout } = useAuth();
  const [testingNotification, setTestingNotification] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from the company portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (e: any) {
              Alert.alert('Sign out error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      const res = await sendTestNotificationAsync(user?.uid);
      Alert.alert(res.isLocal ? 'Local Notification' : 'Push Notification', res.message);
    } catch (e: any) {
      Alert.alert('Notification Test Error', e.message);
    } finally {
      setTestingNotification(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="My Profile" showMonthPicker={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.roleRow}>
              <StatusBadge status={user?.role || 'employee'} />
              <Text style={styles.employeeIdBadge}>
                ID: {user?.employeeId || 'N/A'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Admin Management Tools */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Admin Controls</Text>
            <Card variant="outlined" style={styles.menuCard}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push('/manage-employees')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: COLORS.primaryLight }]}>
                  <Users size={20} color={COLORS.primary} />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>Employee Directory</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Add employees, assign IDs, manage active status
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push('/configure-budget')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: COLORS.surfaceVariant }]}>
                  <Sliders size={20} color={COLORS.textPrimary} />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>Monthly Budget & Targets</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Configure fixed budget, profit goals, and opening balance
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push('/recurring-tasks')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: COLORS.warningLight }]}>
                  <Repeat size={20} color={COLORS.warningDark} />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>Recurring Monthly Expenses</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Configure templates for recurring payments (rent, bills)
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Push Notification & Device Info */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Device & Notifications</Text>
          <Card variant="outlined" style={styles.menuCard}>
            <View style={styles.notificationInfoRow}>
              <View style={styles.deviceRow}>
                <Smartphone size={20} color={COLORS.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceTitle}>
                    {getNotificationEnvironment().isExpoGo
                      ? 'In-App Notifications (Expo Go Mode)'
                      : 'FCM Push Notifications (Native Build)'}
                  </Text>
                  <Text style={styles.deviceSubtitle}>
                    {getNotificationEnvironment().statusMessage}
                  </Text>
                </View>
              </View>

              <Button
                title={getNotificationEnvironment().isExpoGo ? 'Test Notification' : 'Test FCM Push'}
                size="sm"
                variant="outline"
                loading={testingNotification}
                onPress={handleTestNotification}
                style={{ alignSelf: 'flex-start', marginTop: SPACING.xs }}
              />
            </View>
          </Card>
        </View>

        {/* Sign Out Button */}
        <View style={styles.logoutSection}>
          <Button
            title="Sign Out"
            variant="danger"
            size="lg"
            onPress={handleLogout}
            icon={<LogOut size={18} color={COLORS.surface} style={{ marginRight: 6 }} />}
          />
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.surface,
  },
  profileDetails: {
    flex: 1,
  },
  userName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  userEmail: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  employeeIdBadge: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  section: {
    marginTop: SPACING.xl,
  },
  sectionHeader: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  menuItemSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 58,
  },
  notificationInfoRow: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  deviceTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  deviceSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutSection: {
    marginTop: SPACING.xxl,
  },
});
