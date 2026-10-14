import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  TrendingUp,
  Wallet,
  Clock,
  ArrowRight,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { TaskCard } from '@/components/TaskCard';
import { EmptyState } from '@/components/EmptyState';
import { MonthSelectorModal } from '@/components/MonthSelectorModal';
import { FAB } from '@/components/FAB';
import { AddActionModal } from '@/components/AddActionModal';
import { TaskCompletionModal } from '@/components/TaskCompletionModal';
import { StatusBadge } from '@/components/StatusBadge';
import {
  formatCurrency,
  formatReadableDate,
  formatDateTime,
} from '@/utils/formatters';
import { FinancialTask, ExpenseGroup, IncomeEntry, ActivityLog, MonthlyBudget } from '@/types';
import { subscribeToTasksForMonth, recalculateTaskEligibility } from '@/services/taskService';
import { subscribeToBudget, computeMonthlyTarget, syncBudgetTarget } from '@/services/budgetService';
import { subscribeToMonthIncome } from '@/services/incomeService';
import { subscribeToMonthExpenseGroups } from '@/services/expenseService';
import { subscribeToRecentActivity } from '@/services/activityService';
import { callBackendApi } from '@/services/apiClient';

export default function HomeDashboardScreen() {
  const router = useRouter();
  const { user, isAdmin, isEmployee, selectedMonthKey, setSelectedMonthKey } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedTaskToReview, setSelectedTaskToReview] = useState<FinancialTask | null>(null);

  // Real-time state
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [tasks, setTasks] = useState<FinancialTask[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseGroups, setExpenseGroups] = useState<ExpenseGroup[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

  // Subscriptions
  useEffect(() => {
    const unsubBudget = subscribeToBudget(selectedMonthKey, setBudget);
    const unsubTasks = subscribeToTasksForMonth(selectedMonthKey, setTasks);
    const unsubIncome = subscribeToMonthIncome(selectedMonthKey, setIncomeEntries);
    const unsubGroups = subscribeToMonthExpenseGroups(selectedMonthKey, setExpenseGroups);
    const unsubActivity = subscribeToRecentActivity(6, setRecentActivities);

    return () => {
      unsubBudget();
      unsubTasks();
      unsubIncome();
      unsubGroups();
      unsubActivity();
    };
  }, [selectedMonthKey]);

  // Auto-sync budget target if tasks are present but budget is not yet initialized
  useEffect(() => {
    if (tasks.length > 0 && (!budget || budget.monthlyTarget === 0)) {
      syncBudgetTarget(selectedMonthKey).catch(() => {});
    }
  }, [tasks, budget, selectedMonthKey]);

  // Derived Financial Calculations (Section A)
  const financials = useMemo(() => {
    const openingBalance = Number(budget?.openingBalance || 0);
    const { monthlyTarget } = computeMonthlyTarget(budget, tasks);

    // Sum valid income
    const incomeCollected = incomeEntries
      .filter((i) => i.status === 'VALID')
      .reduce((sum, item) => sum + item.amount, 0);

    // Actual completed tasks amount (company payments disbursed)
    const completedTasksAmount = tasks
      .filter((t) => t.status === 'COMPLETED')
      .reduce((sum, item) => sum + item.amount, 0);

    // Paid employee reimbursed expenses
    const paidExpensesAmount = expenseGroups.reduce(
      (sum, g) => sum + (g.approvedAmount || 0),
      0
    );

    const actualCompanyExpensesPaid = completedTasksAmount + paidExpensesAmount;

    // Available Balance = Opening Balance + Valid Income - Verified Payments - Paid Outflows
    const availableBalance = openingBalance + incomeCollected - actualCompanyExpensesPaid;
    const remainingIncomeTarget = Math.max(0, monthlyTarget - incomeCollected);

    return {
      monthlyTarget,
      incomeCollected,
      actualCompanyExpensesPaid,
      remainingIncomeTarget,
      availableBalance,
      openingBalance,
    };
  }, [budget, incomeEntries, tasks, expenseGroups]);

  // Filter tasks for sections C and D
  const readyTasks = useMemo(
    () => tasks.filter((t) => t.status === 'READY_TO_COMPLETE'),
    [tasks]
  );

  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === 'PENDING'),
    [tasks]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await recalculateTaskEligibility(selectedMonthKey);
      await syncBudgetTarget(selectedMonthKey);
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleReviewTask = (task: FinancialTask) => {
    setSelectedTaskToReview(task);
    setCompleteModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Company Budget"
        showMonthPicker={true}
        onOpenMonthModal={() => setMonthModalVisible(true)}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ============================================================ */}
        {/* SECTION A: MONTHLY FINANCIAL OVERVIEW                        */}
        {/* ============================================================ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Financial Overview</Text>
        </View>

        {/* Hero Card: Available Balance vs Monthly Target */}
        <Card variant="elevated" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroSubtitle}>Available Company Balance</Text>
              <Text
                style={[
                  styles.heroAmount,
                  { color: financials.availableBalance >= 0 ? COLORS.success : COLORS.error },
                ]}
              >
                {formatCurrency(financials.availableBalance)}
              </Text>
              <Text style={styles.openingBalanceText}>
                Includes {formatCurrency(financials.openingBalance)} opening balance
              </Text>
            </View>
            <View style={styles.walletIconCircle}>
              <Wallet size={26} color={COLORS.primary} />
            </View>
          </View>

          {/* SECTION B: TARGET PROGRESS */}
          <View style={styles.targetSection}>
            <ProgressBar
              collected={financials.incomeCollected}
              target={financials.monthlyTarget}
            />
          </View>

          <View style={styles.gridSummary}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Monthly Target</Text>
              <Text style={styles.gridValue}>
                {formatCurrency(financials.monthlyTarget)}
              </Text>
            </View>

            <View style={styles.gridDivider} />

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Income Collected</Text>
              <Text style={[styles.gridValue, { color: COLORS.success }]}>
                {formatCurrency(financials.incomeCollected)}
              </Text>
            </View>

            <View style={styles.gridDivider} />

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Expenses Paid</Text>
              <Text style={[styles.gridValue, { color: COLORS.error }]}>
                {formatCurrency(financials.actualCompanyExpensesPaid)}
              </Text>
            </View>
          </View>
        </Card>

        {/* ============================================================ */}
        {/* SECTION C: READY TO COMPLETE (Financial Eligibility Verified)*/}
        {/* ============================================================ */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <CheckCircle2 size={18} color={COLORS.success} />
            <Text style={styles.sectionTitle}>Ready to Complete</Text>
          </View>
          <Text style={styles.badgeCount}>{readyTasks.length}</Text>
        </View>

        {readyTasks.length === 0 ? (
          <Card variant="outlined" style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No tasks currently ready. As income is collected, pending tasks will automatically be verified and allocated funds.
            </Text>
          </Card>
        ) : (
          readyTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              isAdmin={isAdmin}
              onPress={() => router.push({ pathname: '/task-detail', params: { taskId: t.id } })}
              onReview={() => handleReviewTask(t)}
            />
          ))
        )}

        {/* ============================================================ */}
        {/* SECTION D: UPCOMING PAYMENTS                                */}
        {/* ============================================================ */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Clock size={18} color={COLORS.textSecondary} />
            <Text style={styles.sectionTitle}>Upcoming Payments</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {pendingTasks.length === 0 ? (
          <Card variant="outlined" style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No pending financial payments for this month.
            </Text>
          </Card>
        ) : (
          pendingTasks.slice(0, 4).map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              isAdmin={isAdmin}
              onPress={() => router.push({ pathname: '/task-detail', params: { taskId: t.id } })}
            />
          ))
        )}

        {/* ============================================================ */}
        {/* SECTION E: EMPLOYEE EXPENSES (Grouped by Employee + Month)  */}
        {/* ============================================================ */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Receipt size={18} color={COLORS.textPrimary} />
            <Text style={styles.sectionTitle}>Employee Expenses</Text>
          </View>
        </View>

        {expenseGroups.length === 0 ? (
          <Card variant="outlined" style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No flexible employee expenses submitted for this month.
            </Text>
          </Card>
        ) : (
          expenseGroups.map((group) => (
            <Card
              key={group.id}
              variant="outlined"
              style={styles.groupCard}
              onPress={() =>
                router.push({
                  pathname: '/expense-group-detail',
                  params: {
                    employeeId: group.employeeId,
                    employeeName: group.employeeNameSnapshot,
                    monthKey: group.monthKey,
                  },
                })
              }
            >
              <View style={styles.groupRow}>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.employeeNameSnapshot}</Text>
                  <Text style={styles.groupMeta}>
                    {group.entryCount} {group.entryCount === 1 ? 'entry' : 'entries'} submitted
                  </Text>
                </View>

                <View style={styles.groupAction}>
                  <Text style={styles.groupAmount}>{formatCurrency(group.totalAmount)}</Text>
                  <View style={styles.viewDetailsRow}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <ArrowRight size={14} color={COLORS.primary} />
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}

        {/* ============================================================ */}
        {/* SECTION F: RECENT ACTIVITY                                   */}
        {/* ============================================================ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
            <Text style={styles.seeAllText}>History</Text>
          </TouchableOpacity>
        </View>

        {recentActivities.length === 0 ? (
          <Card variant="outlined" style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent activity logged yet.</Text>
          </Card>
        ) : (
          <Card variant="outlined" style={styles.activityCard}>
            {recentActivities.map((act, idx) => (
              <View
                key={act.id}
                style={[
                  styles.activityItem,
                  idx < recentActivities.length - 1 && styles.activityItemBorder,
                ]}
              >
                <View style={styles.activityTextCol}>
                  <Text style={styles.activityDesc} numberOfLines={2}>
                    {act.description}
                  </Text>
                  <Text style={styles.activityTime}>
                    {formatDateTime(act.timestamp)} • by {act.actorName}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <FAB onPress={() => setActionModalVisible(true)} />

      {/* Quick Action Modal */}
      <AddActionModal
        visible={actionModalVisible}
        isAdmin={isAdmin}
        onClose={() => setActionModalVisible(false)}
        onAddIncome={() => router.push('/add-income')}
        onAddExpense={() => router.push('/add-expense')}
        onCreateTask={() => router.push('/create-task')}
        onConfigureBudget={() => router.push('/configure-budget')}
      />

      {/* Month Selection Modal */}
      <MonthSelectorModal
        visible={monthModalVisible}
        selectedMonthKey={selectedMonthKey}
        onSelectMonth={(m) => setSelectedMonthKey(m)}
        onClose={() => setMonthModalVisible(false)}
      />

      {/* Task Completion Review Modal (Admin) */}
      <TaskCompletionModal
        visible={completeModalVisible}
        task={selectedTaskToReview}
        availableBalance={financials.availableBalance}
        onClose={() => setCompleteModalVisible(false)}
        onSuccess={() => {
          setCompleteModalVisible(false);
          onRefresh();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  badgeCount: {
    ...TYPOGRAPHY.labelSmall,
    backgroundColor: COLORS.primaryLight,
    color: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    fontWeight: '700',
  },
  seeAllText: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.primary,
  },
  heroCard: {
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  heroAmount: {
    ...TYPOGRAPHY.amountHero,
    marginVertical: 4,
  },
  openingBalanceText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
  },
  walletIconCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  gridSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
  },
  gridLabel: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  gridValue: {
    ...TYPOGRAPHY.amountMedium,
    color: COLORS.textPrimary,
  },
  gridDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.divider,
  },
  emptyCard: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  groupCard: {
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  groupMeta: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  groupAction: {
    alignItems: 'flex-end',
  },
  groupAmount: {
    ...TYPOGRAPHY.amountLarge,
    color: COLORS.textPrimary,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  viewDetailsText: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.primary,
    fontWeight: '600',
  },
  activityCard: {
    padding: 0,
    overflow: 'hidden',
  },
  activityItem: {
    padding: SPACING.md,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityTextCol: {
    flex: 1,
  },
  activityDesc: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  activityTime: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
});
