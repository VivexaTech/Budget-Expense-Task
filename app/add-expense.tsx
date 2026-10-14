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
import { ArrowUpRight, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ExpenseEntrySchema } from '@/types';
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
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    setErrorMessage(null);

    const amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, ''));

    const validation = ExpenseEntrySchema.safeParse({
      title,
      amount: amountNum,
      category,
      description: description || undefined,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || 'Please check input fields.');
      return;
    }

    setLoading(true);
    try {
      await submitExpenseEntry(
        {
          title,
          amount: amountNum,
          monthKey: selectedMonthKey,
          category,
          description,
        },
        user
      );

      Alert.alert(
        'Expense Submitted',
        `Successfully submitted ₹${amountNum.toLocaleString('en-IN')} for ${title}. Your expense has been added to your monthly group for administrator review.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to submit expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <ArrowUpRight size={22} color={COLORS.warningDark} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Submit Company Expense</Text>
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
            label="Expense Title *"
            placeholder="e.g. Stationery & Printing Supplies"
            value={title}
            onChangeText={setTitle}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Input
            label="Amount (₹) *"
            placeholder="e.g. 800"
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
            placeholder="e.g. Purchased presentation binders for client meeting"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <View style={styles.infoNote}>
            <Text style={styles.infoNoteText}>
              Note: Flexible expenses are automatically grouped under your monthly expense record. They do not trigger spam notifications and will be reviewed by the administrator.
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
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
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
  },
  infoNoteText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
});
