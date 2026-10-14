import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowDownLeft, X, Check, CreditCard, Banknote, Landmark } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { PaymentMode, IncomeEntrySchema } from '@/types';
import { submitIncomeEntry } from '@/services/incomeService';

const PAYMENT_MODES: { label: string; value: PaymentMode }[] = [
  { label: 'UPI / Google Pay', value: 'UPI' },
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Other', value: 'OTHER' },
];

export default function AddIncomeScreen() {
  const router = useRouter();
  const { user, selectedMonthKey } = useAuth();

  const [amountStr, setAmountStr] = useState('');
  const [collectedFrom, setCollectedFrom] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    setErrorMessage(null);

    const amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, ''));

    const validation = IncomeEntrySchema.safeParse({
      amount: amountNum,
      collectedFrom,
      workDescription,
      paymentMode,
      notes: notes || undefined,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || 'Please check input fields.');
      return;
    }

    setLoading(true);
    try {
      await submitIncomeEntry(
        {
          amount: amountNum,
          collectedFrom,
          workDescription,
          paymentMode,
          monthKey: selectedMonthKey,
          notes,
        },
        user
      );

      Alert.alert(
        'Income Recorded',
        `Successfully logged ₹${amountNum.toLocaleString('en-IN')} received from ${collectedFrom}. Available company balance and task readiness have been updated.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to submit income entry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <ArrowDownLeft size={22} color={COLORS.success} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Record Income</Text>
            <Text style={styles.headerSubtitle}>Month: {selectedMonthKey}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Auto-filled Employee Identity */}
          <View style={styles.identityCard}>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Submitting Employee:</Text>
              <Text style={styles.identityValue}>{user?.displayName} ({user?.employeeId})</Text>
            </View>
          </View>

          <Input
            label="Income Amount (₹) *"
            placeholder="e.g. 35000"
            keyboardType="numeric"
            value={amountStr}
            onChangeText={setAmountStr}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Input
            label="Collected From (Client / Payer) *"
            placeholder="e.g. Acme Corporation Pvt Ltd"
            value={collectedFrom}
            onChangeText={setCollectedFrom}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Input
            label="Work Description / Service Rendered *"
            placeholder="e.g. Q4 Website Development & Hosting Milestone"
            value={workDescription}
            onChangeText={setWorkDescription}
            containerStyle={{ marginTop: SPACING.md }}
          />

          {/* Payment Mode Selector */}
          <View style={styles.modeSection}>
            <Text style={styles.modeLabel}>Payment Mode</Text>
            <View style={styles.modeChipsRow}>
              {PAYMENT_MODES.map((mode) => {
                const isSelected = paymentMode === mode.value;
                return (
                  <TouchableOpacity
                    key={mode.value}
                    style={[styles.modeChip, isSelected && styles.modeChipSelected]}
                    onPress={() => setPaymentMode(mode.value)}
                  >
                    <Text
                      style={[
                        styles.modeChipText,
                        isSelected && styles.modeChipTextSelected,
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Input
            label="Internal Notes (Optional)"
            placeholder="e.g. Check received, deposited in bank"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Button
            title="Save Income Entry"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
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
  headerLeft: {
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
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
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
  identityCard: {
    backgroundColor: COLORS.surfaceVariant,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identityLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  identityValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  errorBox: {
    backgroundColor: COLORS.errorLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
  },
  modeSection: {
    marginTop: SPACING.md,
  },
  modeLabel: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  modeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  modeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modeChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  modeChipText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modeChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
});
