import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { X, CheckCircle, Clock, AlertTriangle, Trash2, AlertCircle } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/services/firebase';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { TaskCompletionModal } from '@/components/TaskCompletionModal';
import { FinancialTask } from '@/types';
import {
  cancelTask,
  calculateAvailableBalanceForMonth,
  recalculateTaskEligibility,
} from '@/services/taskService';
import { formatCurrency, formatDueDate, formatDateTime } from '@/utils/formatters';

export default function TaskDetailScreen() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { user, isAdmin } = useAuth();

  const [task, setTask] = useState<FinancialTask | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Real-time task listener
  useEffect(() => {
    if (!taskId) return;
    const unsub = onSnapshot(doc(db, 'tasks', taskId), (snap) => {
      if (snap.exists()) {
        const t = snap.data() as FinancialTask;
        setTask(t);
        // Refresh available balance for this task's month
        refreshBalance(t.monthKey);
      }
    });

    return () => unsub();
  }, [taskId]);

  const refreshBalance = async (monthKey: string) => {
    setLoadingBalance(true);
    try {
      const { availableBalance: balance } = await calculateAvailableBalanceForMonth(monthKey);
      setAvailableBalance(balance);
    } catch (e) {
      console.warn('Error loading available balance:', e);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleCancel = () => {
    if (!task || !user || !isAdmin) return;

    Alert.alert(
      'Cancel Task',
      `Are you sure you want to cancel "${task.title}"? Any allocated funds will be immediately released to other pending tasks.`,
      [
        { text: 'Keep Task', style: 'cancel' },
        {
          text: 'Cancel Task',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelTask(task.id, task.monthKey, user);
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (!task) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading task details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted = task.status === 'COMPLETED';
  const isCancelled = task.status === 'CANCELLED';
  const isReady = task.status === 'READY_TO_COMPLETE';
  const isPending = task.status === 'PENDING';

  // Task is eligible if already verified READY_TO_COMPLETE OR if live availableBalance is sufficient
  const hasSufficientFunds = availableBalance >= task.amount;
  const canComplete = !isCompleted && !isCancelled && (isReady || hasSufficientFunds);

  // Exact ineligibility reason if not ready/eligible
  const ineligibilityReason = isCompleted
    ? 'This task has already been completed.'
    : isCancelled
    ? 'This task has been cancelled.'
    : !hasSufficientFunds
    ? `Insufficient Available Funds: Task requires ${formatCurrency(task.amount)}, but current available balance is ${formatCurrency(availableBalance)} (Shortfall: ${formatCurrency(task.amount - availableBalance)}). Additional client income must be recorded.`
    : task.eligibilityReason || 'Pending prioritization order with other scheduled obligations.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Task Details</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card variant="elevated" style={styles.mainCard}>
          <View style={styles.badgeRow}>
            <StatusBadge status={task.status} />
            <Text style={styles.typeText}>{task.taskType} OBLIGATION</Text>
          </View>

          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.amount}>{formatCurrency(task.amount)}</Text>
          <Text style={styles.dueDateText}>{formatDueDate(task.dueDate)}</Text>

          {task.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{task.category}</Text>
            </View>
          ) : null}
        </Card>

        {/* Financial Eligibility Details */}
        <Card variant="outlined" style={styles.infoCard}>
          <Text style={styles.cardHeader}>Financial Readiness</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Available Balance:</Text>
            <Text style={[styles.infoValue, { color: hasSufficientFunds ? COLORS.success : COLORS.error }]}>
              {loadingBalance ? 'Calculating...' : formatCurrency(availableBalance)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Allocated Funds:</Text>
            <Text style={styles.infoValue}>
              {formatCurrency(task.allocatedAmount || (isReady ? task.amount : 0))}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Budget Month:</Text>
            <Text style={styles.infoValue}>{task.monthKey}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Readiness Status:</Text>
            <Text style={[styles.infoValue, { color: canComplete ? COLORS.success : COLORS.warningDark }]}>
              {canComplete ? 'Ready to Complete' : isCompleted ? 'Completed' : 'Awaiting Funds'}
            </Text>
          </View>
        </Card>

        {/* Ineligibility Reason Display if Not Eligible */}
        {!canComplete && !isCompleted && !isCancelled && (
          <Card variant="outlined" style={styles.ineligibleCard}>
            <View style={styles.ineligibleHeader}>
              <AlertTriangle size={18} color={COLORS.warningDark} />
              <Text style={styles.ineligibleTitle}>Why is this task not ready?</Text>
            </View>
            <Text style={styles.ineligibleText}>{ineligibilityReason}</Text>
          </Card>
        )}

        {/* Description */}
        {task.description ? (
          <Card variant="outlined" style={styles.infoCard}>
            <Text style={styles.cardHeader}>Description & Notes</Text>
            <Text style={styles.descText}>{task.description}</Text>
          </Card>
        ) : null}

        {/* Completion Metadata if completed */}
        {isCompleted && (
          <Card variant="outlined" style={[styles.infoCard, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={[styles.cardHeader, { color: COLORS.primary }]}>Completion Record</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Completed At:</Text>
              <Text style={styles.infoValue}>{formatDateTime(task.completedAt)}</Text>
            </View>
            {task.paymentNotes ? (
              <View style={{ marginTop: SPACING.xs }}>
                <Text style={styles.infoLabel}>Payment Notes:</Text>
                <Text style={styles.infoValue}>{task.paymentNotes}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {/* Admin Action Buttons */}
        {isAdmin && (
          <View style={styles.actionButtonsCol}>
            {canComplete && (
              <Button
                title="Complete Task"
                variant="primary"
                size="lg"
                onPress={() => setCompleteModalVisible(true)}
                icon={<CheckCircle size={18} color={COLORS.surface} style={{ marginRight: 6 }} />}
              />
            )}

            {!canComplete && !isCompleted && !isCancelled && (
              <Button
                title="Complete Task (Insufficient Balance)"
                variant="outline"
                size="lg"
                disabled
                onPress={() => {}}
                style={styles.disabledBtn}
                textStyle={{ color: COLORS.textTertiary }}
                icon={<AlertCircle size={18} color={COLORS.textTertiary} style={{ marginRight: 6 }} />}
              />
            )}

            {(isPending || isReady) && (
              <Button
                title="Cancel Task"
                variant="outline"
                size="md"
                loading={cancelling}
                onPress={handleCancel}
                textStyle={{ color: COLORS.error }}
                style={{ borderColor: COLORS.error }}
                icon={<Trash2 size={16} color={COLORS.error} style={{ marginRight: 6 }} />}
              />
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Task Completion Modal with Verified Available Balance */}
      <TaskCompletionModal
        visible={completeModalVisible}
        task={task}
        availableBalance={availableBalance}
        onClose={() => setCompleteModalVisible(false)}
        onSuccess={() => {
          setCompleteModalVisible(false);
          refreshBalance(task.monthKey);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  mainCard: {
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  typeText: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textTertiary,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  amount: {
    ...TYPOGRAPHY.amountHero,
    color: COLORS.primaryDark,
    marginVertical: SPACING.xs,
  },
  dueDateText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  categoryPill: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  categoryText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  cardHeader: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  infoValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  reasonBox: {
    backgroundColor: COLORS.surfaceVariant,
    padding: SPACING.sm,
    borderRadius: RADIUS.xs,
    marginTop: SPACING.xs,
  },
  reasonText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  descText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  actionButtonsCol: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  ineligibleCard: {
    padding: SPACING.md,
    backgroundColor: '#FEF9EE',
    borderColor: COLORS.warning,
    marginBottom: SPACING.md,
  },
  ineligibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  ineligibleTitle: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.warningDark,
    fontWeight: '600',
  },
  ineligibleText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  disabledBtn: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceVariant,
    opacity: 0.7,
  },
});
