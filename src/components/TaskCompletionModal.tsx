import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
} from 'react-native';
import { CheckCircle2, X, AlertCircle } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { FinancialTask } from '@/types';
import { formatCurrency, formatDueDate } from '@/utils/formatters';
import { Button } from './Button';
import { Input } from './Input';
import { confirmTaskCompletion } from '@/services/taskService';
import { useAuth } from '@/context/AuthContext';

interface TaskCompletionModalProps {
  visible: boolean;
  task: FinancialTask | null;
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  visible,
  task,
  availableBalance,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [paymentNotes, setPaymentNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!task) return null;

  const handleConfirm = async () => {
    if (availableBalance < task.amount) {
      setError(
        `Insufficient available company balance (₹${availableBalance.toLocaleString('en-IN')}) to complete this ₹${task.amount.toLocaleString('en-IN')} task.`
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await confirmTaskCompletion(task.id, paymentNotes, task.monthKey, user || undefined);
      if (res.success) {
        setPaymentNotes('');
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to complete task.');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <CheckCircle2 size={24} color={COLORS.success} />
                  <Text style={styles.title}>Review & Confirm Payment</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.body}>
                <View style={styles.summaryCard}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskAmount}>{formatCurrency(task.amount)}</Text>
                  <Text style={styles.taskDue}>{formatDueDate(task.dueDate)}</Text>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Required Amount:</Text>
                    <Text style={styles.infoValue}>{formatCurrency(task.amount)}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Current Available Balance:</Text>
                    <Text style={[styles.infoValue, { color: availableBalance >= task.amount ? COLORS.success : COLORS.error }]}>
                      {formatCurrency(availableBalance)}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Allocated to this Task:</Text>
                    <Text style={styles.infoValue}>{formatCurrency(task.allocatedAmount || task.amount)}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Eligibility Status:</Text>
                    <Text style={[styles.infoValue, { color: COLORS.success }]}>
                      Financially Verified
                    </Text>
                  </View>
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <AlertCircle size={16} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Input
                  label="Payment Notes / Transaction Reference (Optional)"
                  placeholder="e.g. Paid via ICICI Bank IMPS Ref #992817"
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                  containerStyle={{ marginTop: SPACING.md }}
                />

                <Text style={styles.disclaimer}>
                  Confirming this action marks the payment as disbursed from company funds and deducts the amount from available balance.
                </Text>
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={onClose}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Confirm Payment"
                  variant="primary"
                  loading={loading}
                  onPress={handleConfirm}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(32, 33, 36, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxHeight: '85%',
    padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
  },
  body: {
    maxHeight: 380,
  },
  summaryCard: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  taskTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
    textAlign: 'center',
  },
  taskAmount: {
    ...TYPOGRAPHY.amountHero,
    color: COLORS.primaryDark,
    marginVertical: SPACING.xs,
  },
  taskDue: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  infoGrid: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
    flex: 1,
  },
  disclaimer: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
});
