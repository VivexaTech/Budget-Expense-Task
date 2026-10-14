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
import { ArrowUpRight, X, User, Building2, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ExpenseEntrySchema, ExpensePaymentSource } from '@/types';
import { submitExpenseEntry } from '@/services/expenseService';

const EXPENSE_CATEGORIES = [
  'Office Supplies',
  'Travel & Transit',
  'Client Entertainment',
  'Software & Subscriptions',
  'Hardware & Equipment',
  'Meals & Refreshments',
  'Other',
];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { user, selectedMonthKey } = useAuth();

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paymentSource, setPaymentSource] = useState<ExpensePaymentSource>('SELF');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processSubmission = async (amountNum: number) => {
    if (!user) return;
    setLoading(true);
    try {
      await submitExpenseEntry(
        {
          title,
          amount: amountNum,
          monthKey: selectedMonthKey,
          paymentSource,
          category,
          description,
        },
        user
      );

      const successMsg =
        paymentSource === 'COMPANY_FUND'
          ? `Submitted ₹${amountNum.toLocaleString('en-IN')} using Company Funds for "${title}". This amount has been deducted from the company available cash balance.`
          : `Submitted ₹${amountNum.toLocaleString('en-IN')} paid by yourself for "${title}". It has been queued for administrator review and reimbursement.`;

      Alert.alert('Expense Submitted', successMsg, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to submit expense.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!user) return;
    setErrorMessage(null);

    const amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, ''));

    const validation = ExpenseEntrySchema.safeParse({
      title,
      amount: amountNum,
      paymentSource,
      category,
      description: description || undefined,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || 'Please check input fields.');
      return;
    }

    const isCompanyFund = paymentSource === 'COMPANY_FUND';
    const impactExplanation = isCompanyFund
      ? 'Payment Source: BY COMPANY FUND\n• Funds will be deducted from company cash immediately.\n• No employee reimbursement required.'
      : 'Payment Source: BY SELF (EMPLOYEE PAID)\n• You paid personally from personal funds.\n• Company cash will NOT be deducted until approved and reimbursed by admin.';

    Alert.alert(
      'Confirm Expense Submission',
      `Title: ${title}\nAmount: ₹${amountNum.toLocaleString('en-IN')}\nCategory: ${category}\n\n${impactExplanation}\n\nProceed with submission?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Submit',
          onPress: () => processSubmission(amountNum),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <ArrowUpRight size={22} color={COLORS.warningDark} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Submit Expense</Text>
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
              <AlertCircle size={18} color={COLORS.error} />
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

          {/* PAYMENT SOURCE SELECTION */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Payment Source *</Text>
            <Text style={styles.sectionSubtitle}>
              Specify whether this was paid from personal funds or company funds.
            </Text>

            <View style={styles.sourceCardsContainer}>
              {/* Option 1: By Self */}
              <TouchableOpacity
                style={[
                  styles.sourceCard,
                  paymentSource === 'SELF' && styles.sourceCardSelected,
                ]}
                onPress={() => setPaymentSource('SELF')}
                activeOpacity={0.8}
              >
                <View style={styles.sourceCardTop}>
                  <View
                    style={[
                      styles.sourceIconBox,
                      paymentSource === 'SELF' && styles.sourceIconBoxSelected,
                    ]}
                  >
                    <User
                      size={20}
                      color={paymentSource === 'SELF' ? COLORS.primary : COLORS.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sourceCardTitle}>By Self (Employee Paid)</Text>
                    <Text style={styles.sourceBadgeText}>Reimbursable claim</Text>
                  </View>
                  {paymentSource === 'SELF' && (
                    <CheckCircle2 size={20} color={COLORS.primary} />
                  )}
                </View>
                <Text style={styles.sourceCardDesc}>
                  You paid personally with your own money. The admin can verify and reimburse this to you.
                </Text>
              </TouchableOpacity>

              {/* Option 2: By Company Fund */}
              <TouchableOpacity
                style={[
                  styles.sourceCard,
                  paymentSource === 'COMPANY_FUND' && styles.sourceCardSelectedCompany,
                ]}
                onPress={() => setPaymentSource('COMPANY_FUND')}
                activeOpacity={0.8}
              >
                <View style={styles.sourceCardTop}>
                  <View
                    style={[
                      styles.sourceIconBox,
                      paymentSource === 'COMPANY_FUND' && styles.sourceIconBoxSelectedCompany,
                    ]}
                  >
                    <Building2
                      size={20}
                      color={paymentSource === 'COMPANY_FUND' ? COLORS.warningDark : COLORS.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sourceCardTitle}>By Company Fund</Text>
                    <Text style={[styles.sourceBadgeText, { color: COLORS.warningDark }]}>
                      Direct Cash Outflow
                    </Text>
                  </View>
                  {paymentSource === 'COMPANY_FUND' && (
                    <CheckCircle2 size={20} color={COLORS.warningDark} />
                  )}
                </View>
                <Text style={styles.sourceCardDesc}>
                  Paid using company cash, card, or account. Deducts from available company balance immediately.
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Input
            label="Expense Title *"
            placeholder="e.g. Office stationery & printer ink"
            value={title}
            onChangeText={setTitle}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Input
            label="Amount (₹) *"
            placeholder="e.g. 1500"
            keyboardType="numeric"
            value={amountStr}
            onChangeText={setAmountStr}
            containerStyle={{ marginTop: SPACING.md }}
          />

          {/* Category Chips */}
          <View style={styles.categorySection}>
            <Text style={styles.categoryLabel}>Expense Category</Text>
            <View style={styles.categoryChipsRow}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Input
            label="Business Purpose / Description (Optional)"
            placeholder="e.g. Purchased items for monthly team presentation"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <View style={styles.infoNote}>
            <ShieldCheck size={18} color={COLORS.textSecondary} />
            <Text style={styles.infoNoteText}>
              All submitted expenses are audited in real time and grouped under your monthly statement for transparent administrative review.
            </Text>
          </View>

          <Button
            title="Submit Expense"
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
    backgroundColor: COLORS.warningLight,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
    flex: 1,
  },
  sectionContainer: {
    marginTop: SPACING.lg,
  },
  sectionLabel: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  sourceCardsContainer: {
    gap: SPACING.sm,
  },
  sourceCard: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  sourceCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  sourceCardSelectedCompany: {
    borderColor: COLORS.warningDark,
    backgroundColor: COLORS.warningLight,
  },
  sourceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  sourceIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIconBoxSelected: {
    backgroundColor: COLORS.surface,
  },
  sourceIconBoxSelectedCompany: {
    backgroundColor: COLORS.surface,
  },
  sourceCardTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sourceBadgeText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  sourceCardDesc: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  categorySection: {
    marginTop: SPACING.md,
  },
  categoryLabel: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  infoNote: {
    backgroundColor: COLORS.surfaceVariant,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoNoteText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  submitBtn: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
});
