import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { X, CheckCircle2, Calendar, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { Input } from './Input';
import { Button } from './Button';
import { IncomeTask, PaymentMode, Invoice } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { useAuth } from '@/context/AuthContext';
import { recordIncomeTaskPayment } from '@/services/incomeTaskService';
import { PinVerificationModal } from './PinVerificationModal';
import { generateAndShareInvoicePdf } from '@/services/invoiceService';

interface RecordIncomePaymentModalProps {
  visible: boolean;
  task: IncomeTask | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_MODES: { label: string; value: PaymentMode }[] = [
  { label: 'UPI / GPay', value: 'UPI' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank Transfer (NEFT/IMPS)', value: 'BANK_TRANSFER' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Other', value: 'OTHER' },
];

export const RecordIncomePaymentModal: React.FC<RecordIncomePaymentModalProps> = ({
  visible,
  task,
  onClose,
  onSuccess,
}) => {
  const { user, selectedMonthKey } = useAuth();

  const [amountStr, setAmountStr] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [nextDueDate, setNextDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [completedTaskData, setCompletedTaskData] = useState<{
    id: string;
    clientName: string;
    projectName: string;
    amount: number;
  } | null>(null);

  useEffect(() => {
    if (task) {
      setAmountStr(String(task.remainingAmount));
      setPaymentMode('UPI');
      setNextDueDate(task.dueDate);
      setNotes('');
      setErrorMessage(null);
      setShowPinModal(false);
      setCompletedTaskData(null);
    }
  }, [task]);

  if (!task) return null;

  const remaining = Number(task.remainingAmount);
  const enteredAmount = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
  const isPartial = enteredAmount > 0 && enteredAmount < remaining;
  const remainingAfterPayment = Math.max(0, remaining - enteredAmount);

  // Quick amount chips
  const setQuickAmount = (amt: number) => {
    setAmountStr(String(Math.min(remaining, Math.max(0, amt))));
  };

  // Quick next date chips
  const setQuickNextDate = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    setNextDueDate(d.toISOString().split('T')[0]);
  };

  const handleRecord = async () => {
    if (!user) return;
    setErrorMessage(null);

    if (isNaN(enteredAmount) || enteredAmount <= 0) {
      setErrorMessage('Please enter a valid positive payment amount.');
      return;
    }

    if (enteredAmount > remaining) {
      setErrorMessage(
        `Payment cannot exceed the remaining balance of ${formatCurrency(remaining)}.`
      );
      return;
    }

    if (isPartial && !nextDueDate) {
      setErrorMessage('Please specify the next promised payment due date for the remaining balance.');
      return;
    }

    Alert.alert(
      'Confirm Payment Recording',
      `Record payment of ${formatCurrency(enteredAmount)} from ${task.clientName}?\n\n• Payment Mode: ${paymentMode}\n• Remaining Balance After: ${formatCurrency(remainingAfterPayment)}${isPartial ? `\n• Next Due Date: ${nextDueDate}` : '\n• Status: Fully Settled & Completed'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Payment',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await recordIncomeTaskPayment(
                task.id,
                {
                  amount: enteredAmount,
                  paymentMode,
                  notes: notes?.trim() || '',
                  ...(isPartial && nextDueDate ? { nextDueDate } : {}),
                },
                user,
                selectedMonthKey
              );

              if (res.task.status === 'COMPLETED') {
                Alert.alert(
                  'Collection Completed',
                  `Successfully recorded full payment of ${formatCurrency(enteredAmount)} from ${task.clientName}.\n\nWould you like to generate an invoice now?`,
                  [
                    {
                      text: 'Skip for Now',
                      style: 'cancel',
                      onPress: () => {
                        onClose();
                        onSuccess();
                      },
                    },
                    {
                      text: 'Generate Invoice',
                      onPress: () => {
                        setCompletedTaskData({
                          id: task.id,
                          clientName: task.clientName,
                          projectName: task.projectName,
                          amount: res.task.expectedAmount,
                        });
                        setShowPinModal(true);
                      },
                    },
                  ]
                );
              } else {
                Alert.alert(
                  'Payment Recorded',
                  `Successfully recorded ${formatCurrency(enteredAmount)} from ${task.clientName}. Remaining balance: ${formatCurrency(res.task.remainingAmount)}.`,
                  [{ text: 'OK', onPress: () => { onClose(); onSuccess(); } }]
                );
              }
            } catch (e: any) {
              setErrorMessage(e.message || 'Failed to record payment.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Modal
        visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Record Client Payment</Text>
                  <Text style={styles.subtitle}>{task.clientName} • {task.projectName}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {errorMessage && (
                  <View style={styles.errorBox}>
                    <AlertCircle size={16} color={COLORS.error} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Task Balance Summary */}
                <View style={styles.balanceSummaryCard}>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Expected Total:</Text>
                    <Text style={styles.balanceValue}>{formatCurrency(task.expectedAmount)}</Text>
                  </View>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Already Received:</Text>
                    <Text style={[styles.balanceValue, { color: COLORS.success }]}>
                      {formatCurrency(task.receivedAmount)}
                    </Text>
                  </View>
                  <View style={[styles.balanceRow, styles.balanceRowTotal]}>
                    <Text style={styles.balanceRemainingLabel}>Current Outstanding:</Text>
                    <Text style={styles.balanceRemainingValue}>
                      {formatCurrency(task.remainingAmount)}
                    </Text>
                  </View>
                </View>

                {/* Amount Input */}
                <Input
                  label="Amount Received (₹) *"
                  placeholder="e.g. 10000"
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={setAmountStr}
                  containerStyle={{ marginTop: SPACING.md }}
                />

                {/* Quick Amount Chips */}
                <View style={styles.quickAmountRow}>
                  <TouchableOpacity
                    style={styles.quickChip}
                    onPress={() => setQuickAmount(remaining)}
                  >
                    <Text style={styles.quickChipText}>Full Balance ({formatCurrency(remaining)})</Text>
                  </TouchableOpacity>
                  {remaining > 5000 && (
                    <TouchableOpacity
                      style={styles.quickChip}
                      onPress={() => setQuickAmount(Math.round(remaining / 2))}
                    >
                      <Text style={styles.quickChipText}>50%</Text>
                    </TouchableOpacity>
                  )}
                  {remaining > 10000 && (
                    <TouchableOpacity
                      style={styles.quickChip}
                      onPress={() => setQuickAmount(Math.round(remaining / 4))}
                    >
                      <Text style={styles.quickChipText}>25%</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Remaining after this payment preview */}
                {enteredAmount > 0 && enteredAmount <= remaining && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewText}>
                      Balance Remaining After Payment:{' '}
                      <Text style={{ fontWeight: '700', color: remainingAfterPayment === 0 ? COLORS.success : COLORS.warningDark }}>
                        {formatCurrency(remainingAfterPayment)}
                      </Text>
                      {remainingAfterPayment === 0 ? ' (Task will be marked COMPLETED)' : ' (PARTIALLY PAID)'}
                    </Text>
                  </View>
                )}

                {/* Payment Mode Selector */}
                <Text style={styles.fieldLabel}>Payment Mode *</Text>
                <View style={styles.paymentModesGrid}>
                  {PAYMENT_MODES.map((pm) => {
                    const isSelected = paymentMode === pm.value;
                    return (
                      <TouchableOpacity
                        key={pm.value}
                        style={[
                          styles.paymentModeChip,
                          isSelected && styles.paymentModeChipSelected,
                        ]}
                        onPress={() => setPaymentMode(pm.value)}
                      >
                        <Text
                          style={[
                            styles.paymentModeChipText,
                            isSelected && styles.paymentModeChipTextSelected,
                          ]}
                        >
                          {pm.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Next promised due date (if partial payment) */}
                {isPartial && (
                  <View style={styles.partialSection}>
                    <Text style={styles.fieldLabel}>Next Promised Due Date *</Text>
                    <Text style={styles.fieldHelper}>
                      Specify when the client promised to settle the remaining {formatCurrency(remainingAfterPayment)}.
                    </Text>
                    <Input
                      label="Next Due Date *"
                      placeholder="YYYY-MM-DD (e.g. 2026-10-25)"
                      value={nextDueDate}
                      onChangeText={setNextDueDate}
                      containerStyle={{ marginTop: SPACING.xs }}
                    />
                    <View style={styles.quickAmountRow}>
                      <TouchableOpacity
                        style={styles.quickChip}
                        onPress={() => setQuickNextDate(3)}
                      >
                        <Text style={styles.quickChipText}>+3 Days</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickChip}
                        onPress={() => setQuickNextDate(7)}
                      >
                        <Text style={styles.quickChipText}>+1 Week</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickChip}
                        onPress={() => setQuickNextDate(14)}
                      >
                        <Text style={styles.quickChipText}>+2 Weeks</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Input
                  label="Payment Reference / Notes (Optional)"
                  placeholder="e.g. Transaction ID, UTR #, or Cheque number"
                  value={notes}
                  onChangeText={setNotes}
                  containerStyle={{ marginTop: SPACING.md }}
                />

                <View style={styles.infoNote}>
                  <ShieldCheck size={16} color={COLORS.textSecondary} />
                  <Text style={styles.infoNoteText}>
                    This payment will immediately create an official company Income Entry, increase company available cash balance, and evaluate pending expense tasks.
                  </Text>
                </View>

                <Button
                  title={loading ? 'Processing Payment...' : 'Record Payment'}
                  variant="primary"
                  size="lg"
                  loading={loading}
                  onPress={handleRecord}
                  style={styles.submitBtn}
                />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

    {showPinModal && completedTaskData && (
      <PinVerificationModal
        visible={showPinModal}
        taskId={completedTaskData.id}
        taskTitle={completedTaskData.projectName}
        clientName={completedTaskData.clientName}
        amount={completedTaskData.amount}
        onClose={() => {
          setShowPinModal(false);
          onClose();
          onSuccess();
        }}
        onSuccess={async (invoice) => {
          setShowPinModal(false);
          onClose();
          onSuccess();
          Alert.alert(
            'Invoice Generated!',
            `Invoice ${invoice.invoiceNumber} has been generated successfully.`,
            [
              { text: 'Close', style: 'cancel' },
              {
                text: 'Share / View PDF',
                onPress: async () => {
                  try {
                    await generateAndShareInvoicePdf(invoice);
                  } catch (err: any) {
                    Alert.alert('Error', err.message || 'Failed to open PDF.');
                  }
                },
              },
            ]
          );
        }}
      />
    )}
  </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(32, 33, 36, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
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
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  subtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
  },
  scrollArea: {
    maxHeight: 550,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  balanceSummaryCard: {
    backgroundColor: COLORS.surfaceVariant,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceRowTotal: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  balanceLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  balanceValue: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  balanceRemainingLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  balanceRemainingValue: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.primary,
    fontWeight: '800',
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickChipText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  previewBox: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },
  previewText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
  },
  fieldLabel: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  fieldHelper: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  paymentModesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  paymentModeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  paymentModeChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  paymentModeChipText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  paymentModeChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  partialSection: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warningDark,
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceVariant,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoNoteText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.errorLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
    flex: 1,
  },
  submitBtn: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
});
