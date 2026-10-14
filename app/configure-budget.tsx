import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Sliders, X, Info } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { BudgetConfigSchema, FinancialTask } from '@/types';
import { getBudgetForMonth, saveBudgetConfiguration, syncBudgetTarget } from '@/services/budgetService';
import { recalculateTaskEligibility } from '@/services/taskService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { formatCurrency, formatMonthName } from '@/utils/formatters';

export default function ConfigureBudgetScreen() {
  const router = useRouter();
  const { user, isAdmin, selectedMonthKey } = useAuth();

  const [fixedBudgetStr, setFixedBudgetStr] = useState('0');
  const [additionalExpStr, setAdditionalExpStr] = useState('0');
  const [profitTargetStr, setProfitTargetStr] = useState('0');
  const [openingBalanceStr, setOpeningBalanceStr] = useState('0');
  const [isOverridden, setIsOverridden] = useState(false);
  const [overrideTargetStr, setOverrideTargetStr] = useState('0');
  const [overrideReason, setOverrideReason] = useState('');

  const [tasksTotal, setTasksTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadExistingBudget();
  }, [selectedMonthKey]);

  const loadExistingBudget = async () => {
    try {
      // Query active tasks for this month
      const tasksQuery = query(collection(db, 'tasks'), where('monthKey', '==', selectedMonthKey));
      const tasksSnap = await getDocs(tasksQuery);
      let taskSum = 0;
      tasksSnap.forEach((d) => {
        const t = d.data() as FinancialTask;
        if (t.status !== 'CANCELLED') {
          taskSum += Number(t.amount || 0);
        }
      });
      setTasksTotal(taskSum);

      const b = await getBudgetForMonth(selectedMonthKey);
      if (b) {
        // If fixedExpenseBudget is 0 but tasks exist, prefill with taskSum
        const fixed = Number(b.fixedExpenseBudget) > 0 ? Number(b.fixedExpenseBudget) : taskSum;
        setFixedBudgetStr(String(fixed));
        setAdditionalExpStr(String(b.additionalExpectedExpenses || 0));
        setProfitTargetStr(String(b.profitTarget || 0));
        setOpeningBalanceStr(String(b.openingBalance || 0));
        setIsOverridden(!!b.isOverridden);
        if (b.isOverridden) {
          setOverrideTargetStr(String(b.monthlyTarget || 0));
          setOverrideReason(b.overrideReason || '');
        }
      } else if (taskSum > 0) {
        setFixedBudgetStr(String(taskSum));
      }
    } catch (e) {
      console.warn('Error loading budget:', e);
    }
  };

  const fixedVal = parseFloat(fixedBudgetStr) || 0;
  const addVal = parseFloat(additionalExpStr) || 0;
  const profitVal = parseFloat(profitTargetStr) || 0;
  const openingVal = parseFloat(openingBalanceStr) || 0;
  // Effective fixed expenses ensures task amounts are accounted for without double counting
  const effectiveFixed = fixedVal > 0 ? Math.max(fixedVal, tasksTotal) : tasksTotal;
  const calculatedSum = effectiveFixed + addVal + profitVal;
  const finalTarget = isOverridden ? parseFloat(overrideTargetStr) || 0 : calculatedSum;

  const handleSave = async () => {
    if (!user || !isAdmin) return;
    setErrorMessage(null);

    const validation = BudgetConfigSchema.safeParse({
      fixedExpenseBudget: fixedVal,
      additionalExpectedExpenses: addVal,
      profitTarget: profitVal,
      openingBalance: openingVal,
      isOverridden,
      overrideTarget: isOverridden ? parseFloat(overrideTargetStr) || 0 : undefined,
      overrideReason: overrideReason || undefined,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || 'Please check input values.');
      return;
    }

    setLoading(true);
    try {
      await saveBudgetConfiguration(
        selectedMonthKey,
        {
          fixedExpenseBudget: fixedVal,
          additionalExpectedExpenses: addVal,
          profitTarget: profitVal,
          openingBalance: openingVal,
          isOverridden,
          overrideTarget: isOverridden ? parseFloat(overrideTargetStr) || 0 : undefined,
          overrideReason,
        },
        user
      );

      // Immediately re-evaluate eligibility of all tasks for this month
      await recalculateTaskEligibility(selectedMonthKey);

      Alert.alert(
        'Budget Configured',
        `Monthly Target set to ${formatCurrency(finalTarget)} with opening balance of ${formatCurrency(openingVal)}.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to save budget configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Sliders size={22} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Budget Configuration</Text>
            <Text style={styles.headerSubtitle}>{formatMonthName(selectedMonthKey)}</Text>
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

          {/* Formula Breakdown Card */}
          <Card variant="elevated" style={styles.calcCard}>
            <Text style={styles.calcTitle}>Derived Monthly Target</Text>
            <Text style={styles.calcHero}>{formatCurrency(finalTarget)}</Text>
            <View style={styles.formulaRow}>
              <Text style={styles.formulaText}>
                Fixed ({formatCurrency(fixedVal)}) + Expected ({formatCurrency(addVal)}) + Profit ({formatCurrency(profitVal)})
              </Text>
            </View>
          </Card>

          <Input
            label="Opening Cash Balance (₹) *"
            placeholder="e.g. 50000"
            keyboardType="numeric"
            value={openingBalanceStr}
            onChangeText={setOpeningBalanceStr}
            helperText="Cash on hand at the start of this budget period."
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Input
            label="Fixed Expense Budget (₹) *"
            placeholder="e.g. 70000"
            keyboardType="numeric"
            value={fixedBudgetStr}
            onChangeText={setFixedBudgetStr}
            helperText="Office rent, utilities, salaries, and recurring obligations."
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Input
            label="Additional Expected Expenses (₹)"
            placeholder="e.g. 10000"
            keyboardType="numeric"
            value={additionalExpStr}
            onChangeText={setAdditionalExpStr}
            helperText="Anticipated flexible employee expenses or equipment."
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Input
            label="Desired Profit Target (₹)"
            placeholder="e.g. 20000"
            keyboardType="numeric"
            value={profitTargetStr}
            onChangeText={setProfitTargetStr}
            helperText="Company net savings or retained profit goal."
            containerStyle={{ marginTop: SPACING.md }}
          />

          {/* Manual Override Option */}
          <View style={styles.overrideSection}>
            <View style={styles.overrideToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.overrideLabel}>Manual Target Override</Text>
                <Text style={styles.overrideSub}>
                  Directly specify target instead of using the automatic formula.
                </Text>
              </View>
              <Switch
                value={isOverridden}
                onValueChange={setIsOverridden}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
              />
            </View>

            {isOverridden && (
              <View style={{ marginTop: SPACING.md }}>
                <Input
                  label="Override Target Amount (₹) *"
                  keyboardType="numeric"
                  value={overrideTargetStr}
                  onChangeText={setOverrideTargetStr}
                />
                <Input
                  label="Reason for Override"
                  placeholder="e.g. Special capital expansion month"
                  value={overrideReason}
                  onChangeText={setOverrideReason}
                  containerStyle={{ marginTop: SPACING.sm }}
                />
              </View>
            )}
          </View>

          <Button
            title="Save Monthly Budget"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSave}
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
    backgroundColor: COLORS.primaryLight,
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
  calcCard: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  calcTitle: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.primary,
  },
  calcHero: {
    ...TYPOGRAPHY.amountHero,
    color: COLORS.primaryDark,
    marginVertical: SPACING.xs,
  },
  formulaRow: {
    marginTop: 4,
  },
  formulaText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  overrideSection: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  overrideToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overrideLabel: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  overrideSub: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
    maxWidth: 240,
  },
  submitBtn: {
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
});
