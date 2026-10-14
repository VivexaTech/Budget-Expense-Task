import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  SlidersHorizontal,
  Plus,
  ClipboardList,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  CalendarCheck,
  TrendingUp,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { TaskCard } from '@/components/TaskCard';
import { IncomeTaskCard } from '@/components/IncomeTaskCard';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { MonthSelectorModal } from '@/components/MonthSelectorModal';
import { TaskCompletionModal } from '@/components/TaskCompletionModal';
import { RecordIncomePaymentModal } from '@/components/RecordIncomePaymentModal';
import { PinVerificationModal } from '@/components/PinVerificationModal';
import { getInvoiceById, generateAndShareInvoicePdf } from '@/services/invoiceService';
import {
  FinancialTask,
  TaskStatus,
  IncomeTask,
  calculateCompanyExpenseOutflows,
} from '@/types';
import { subscribeToTasksForMonth, recalculateTaskEligibility } from '@/services/taskService';
import { subscribeToBudget, syncBudgetTarget } from '@/services/budgetService';
import { subscribeToMonthIncome } from '@/services/incomeService';
import { subscribeToMonthExpenses } from '@/services/expenseService';
import {
  subscribeToIncomeTasks,
  calculateIncomeCollectionMetrics,
} from '@/services/incomeTaskService';
import { callBackendApi } from '@/services/apiClient';
import { formatCurrency } from '@/utils/formatters';

type MainSection = 'EXPENSE' | 'INCOME';
type ExpenseTabType = 'ALL' | 'PENDING' | 'READY_TO_COMPLETE' | 'COMPLETED';
type IncomeTabType = 'ALL' | 'OVERDUE_TODAY' | 'PENDING' | 'COMPLETED';
type SortType = 'DUE_DATE' | 'AMOUNT_DESC' | 'TITLE';

export default function TasksScreen() {
  const router = useRouter();
  const { user, isAdmin, selectedMonthKey, setSelectedMonthKey } = useAuth();

  // Top Priority Toggle: Expense Tasks (Primary) vs Income Collections (Secondary)
  const [activeSection, setActiveSection] = useState<MainSection>('EXPENSE');

  // Sub-tabs
  const [expenseTab, setExpenseTab] = useState<ExpenseTabType>('ALL');
  const [incomeTab, setIncomeFilterTab] = useState<IncomeTabType>('ALL');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('DUE_DATE');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedTaskToReview, setSelectedTaskToReview] = useState<FinancialTask | null>(null);

  const [recordPaymentModalVisible, setRecordPaymentModalVisible] = useState(false);
  const [selectedIncomeTaskToPay, setSelectedIncomeTaskToPay] = useState<IncomeTask | null>(null);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedTaskForInvoice, setSelectedTaskForInvoice] = useState<IncomeTask | null>(null);

  const handleOpenInvoiceModal = (task: IncomeTask) => {
    setSelectedTaskForInvoice(task);
    setPinModalVisible(true);
  };

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      const inv = await getInvoiceById(invoiceId);
      if (inv) {
        await generateAndShareInvoicePdf(inv);
      } else {
        Alert.alert('Invoice', 'Invoice record could not be loaded.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to open invoice PDF.');
    }
  };

  // Expense task metrics
  const [tasks, setTasks] = useState<FinancialTask[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [paidExpenses, setPaidExpenses] = useState(0);

  // Income tasks state
  const [incomeTasks, setIncomeTasks] = useState<IncomeTask[]>([]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Subscriptions
  useEffect(() => {
    const unsubTasks = subscribeToTasksForMonth(selectedMonthKey, setTasks);
    const unsubBudget = subscribeToBudget(selectedMonthKey, (b) => {
      setOpeningBalance(Number(b?.openingBalance || 0));
    });
    const unsubIncome = subscribeToMonthIncome(selectedMonthKey, (items) => {
      const validSum = items
        .filter((i) => i.status === 'VALID')
        .reduce((sum, i) => sum + i.amount, 0);
      setTotalIncome(validSum);
    });
    const unsubExpenses = subscribeToMonthExpenses(selectedMonthKey, (entries) => {
      const outflowSum = calculateCompanyExpenseOutflows(entries);
      setPaidExpenses(outflowSum);
    });

    let unsubIncomeTasks = () => {};
    if (user) {
      unsubIncomeTasks = subscribeToIncomeTasks(user, setIncomeTasks);
    }

    return () => {
      unsubTasks();
      unsubBudget();
      unsubIncome();
      unsubExpenses();
      unsubIncomeTasks();
    };
  }, [selectedMonthKey, user]);

  // Derived Available balance for expense tasks
  const completedTasksAmount = useMemo(() => {
    return tasks
      .filter((t) => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [tasks]);

  const availableBalance = openingBalance + totalIncome - completedTasksAmount - paidExpenses;

  // Income Collection Metrics
  const incomeMetrics = useMemo(() => {
    return calculateIncomeCollectionMetrics(incomeTasks, todayStr);
  }, [incomeTasks, todayStr]);

  // Filtered Expense Tasks
  const filteredExpenseTasks = useMemo(() => {
    let result = tasks.slice();

    if (expenseTab !== 'ALL') {
      result = result.filter((t) => t.status === expenseTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'DUE_DATE') {
        return a.dueDate.localeCompare(b.dueDate);
      } else if (sortBy === 'AMOUNT_DESC') {
        return b.amount - a.amount;
      } else {
        return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [tasks, expenseTab, searchQuery, sortBy]);

  // Filtered Income Tasks
  const filteredIncomeTasks = useMemo(() => {
    let result = incomeTasks.slice();

    if (incomeTab === 'OVERDUE_TODAY') {
      result = result.filter(
        (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate <= todayStr
      );
    } else if (incomeTab === 'PENDING') {
      result = result.filter(
        (t) => t.status === 'PENDING' || t.status === 'PARTIALLY_PAID'
      );
    } else if (incomeTab === 'COMPLETED') {
      result = result.filter((t) => t.status === 'COMPLETED');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.clientName.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'DUE_DATE') {
        return a.dueDate.localeCompare(b.dueDate);
      } else if (sortBy === 'AMOUNT_DESC') {
        return b.remainingAmount - a.remainingAmount;
      } else {
        return a.clientName.localeCompare(b.clientName);
      }
    });

    return result;
  }, [incomeTasks, incomeTab, searchQuery, sortBy, todayStr]);

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

  const expenseCounts = useMemo(() => {
    return {
      all: tasks.length,
      pending: tasks.filter((t) => t.status === 'PENDING').length,
      ready: tasks.filter((t) => t.status === 'READY_TO_COMPLETE').length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    };
  }, [tasks]);

  const handleOpenRecordPayment = (task: IncomeTask) => {
    setSelectedIncomeTaskToPay(task);
    setRecordPaymentModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Tasks & Schedules"
        showMonthPicker={true}
        onOpenMonthModal={() => setMonthModalVisible(true)}
      />

      <View style={styles.container}>
        {/* ============================================================ */}
        {/* PRIMARY PRIORITY SEGMENT SWITCHER                           */}
        {/* ============================================================ */}
        <View style={styles.prioritySegmentContainer}>
          <TouchableOpacity
            style={[
              styles.prioritySegmentBtn,
              activeSection === 'EXPENSE' && styles.prioritySegmentBtnActiveExpense,
            ]}
            onPress={() => setActiveSection('EXPENSE')}
            activeOpacity={0.8}
          >
            <View style={styles.segmentIconRow}>
              <ArrowUpRight
                size={16}
                color={activeSection === 'EXPENSE' ? COLORS.primary : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.prioritySegmentTitle,
                  activeSection === 'EXPENSE' && styles.prioritySegmentTitleActive,
                ]}
              >
                Expense Tasks (Priority #1)
              </Text>
            </View>
            <Text style={styles.prioritySegmentSubtitle}>
              {expenseCounts.ready} Ready • {expenseCounts.pending} Pending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.prioritySegmentBtn,
              activeSection === 'INCOME' && styles.prioritySegmentBtnActiveIncome,
            ]}
            onPress={() => setActiveSection('INCOME')}
            activeOpacity={0.8}
          >
            <View style={styles.segmentIconRow}>
              <ArrowDownLeft
                size={16}
                color={activeSection === 'INCOME' ? COLORS.success : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.prioritySegmentTitle,
                  activeSection === 'INCOME' && styles.prioritySegmentTitleActive,
                ]}
              >
                Client Collections (Secondary)
              </Text>
              {incomeMetrics.overdueCount > 0 && (
                <View style={styles.alertDot}>
                  <Text style={styles.alertDotText}>{incomeMetrics.overdueCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.prioritySegmentSubtitle}>
              {incomeMetrics.dueTodayCount} Due Today • {formatCurrency(incomeMetrics.totalOutstandingCollections)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search & Sort Bar */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchInputWrapper}>
            <Search size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              placeholder={
                activeSection === 'EXPENSE'
                  ? 'Search expense tasks...'
                  : 'Search client or project...'
              }
              placeholderTextColor={COLORS.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              setSortBy((curr) =>
                curr === 'DUE_DATE'
                  ? 'AMOUNT_DESC'
                  : curr === 'AMOUNT_DESC'
                  ? 'TITLE'
                  : 'DUE_DATE'
              );
            }}
          >
            <SlidersHorizontal size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* SUB-TABS: EXPENSE VS INCOME                                 */}
        {/* ============================================================ */}
        {activeSection === 'EXPENSE' ? (
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabItem, expenseTab === 'ALL' && styles.tabItemActive]}
              onPress={() => setExpenseTab('ALL')}
            >
              <Text style={[styles.tabText, expenseTab === 'ALL' && styles.tabTextActive]}>
                All ({expenseCounts.all})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, expenseTab === 'PENDING' && styles.tabItemActive]}
              onPress={() => setExpenseTab('PENDING')}
            >
              <Text style={[styles.tabText, expenseTab === 'PENDING' && styles.tabTextActive]}>
                Pending ({expenseCounts.pending})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, expenseTab === 'READY_TO_COMPLETE' && styles.tabItemActive]}
              onPress={() => setExpenseTab('READY_TO_COMPLETE')}
            >
              <Text
                style={[
                  styles.tabText,
                  expenseTab === 'READY_TO_COMPLETE' && styles.tabTextActive,
                  { color: expenseCounts.ready > 0 ? COLORS.primary : COLORS.textSecondary },
                ]}
              >
                Ready ({expenseCounts.ready})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, expenseTab === 'COMPLETED' && styles.tabItemActive]}
              onPress={() => setExpenseTab('COMPLETED')}
            >
              <Text style={[styles.tabText, expenseTab === 'COMPLETED' && styles.tabTextActive]}>
                Done ({expenseCounts.completed})
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabItem, incomeTab === 'ALL' && styles.tabItemActive]}
              onPress={() => setIncomeFilterTab('ALL')}
            >
              <Text style={[styles.tabText, incomeTab === 'ALL' && styles.tabTextActive]}>
                All ({incomeTasks.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, incomeTab === 'OVERDUE_TODAY' && styles.tabItemActive]}
              onPress={() => setIncomeFilterTab('OVERDUE_TODAY')}
            >
              <Text
                style={[
                  styles.tabText,
                  incomeTab === 'OVERDUE_TODAY' && styles.tabTextActive,
                  incomeMetrics.overdueCount > 0 && { color: COLORS.error, fontWeight: '700' },
                ]}
              >
                Urgent ({incomeMetrics.dueTodayCount + incomeMetrics.overdueCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, incomeTab === 'PENDING' && styles.tabItemActive]}
              onPress={() => setIncomeFilterTab('PENDING')}
            >
              <Text style={[styles.tabText, incomeTab === 'PENDING' && styles.tabTextActive]}>
                Active ({incomeMetrics.pendingTasksCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, incomeTab === 'COMPLETED' && styles.tabItemActive]}
              onPress={() => setIncomeFilterTab('COMPLETED')}
            >
              <Text style={[styles.tabText, incomeTab === 'COMPLETED' && styles.tabTextActive]}>
                Settled ({incomeMetrics.completedTasksCount})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================ */}
        {/* CONTENT LIST                                                 */}
        {/* ============================================================ */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        >
          {activeSection === 'INCOME' && (
            /* Collection Summary Metrics Banner */
            <View style={styles.incomeMetricsCard}>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Due Today</Text>
                  <Text style={[styles.metricValue, { color: COLORS.warningDark }]}>
                    {formatCurrency(incomeMetrics.amountDueToday)}
                  </Text>
                  <Text style={styles.metricSub}>{incomeMetrics.dueTodayCount} client payments</Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Overdue</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: incomeMetrics.amountOverdue > 0 ? COLORS.error : COLORS.textPrimary },
                    ]}
                  >
                    {formatCurrency(incomeMetrics.amountOverdue)}
                  </Text>
                  <Text style={styles.metricSub}>{incomeMetrics.overdueCount} delayed payments</Text>
                </View>
              </View>

              <View style={[styles.metricsGrid, { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Total Outstanding</Text>
                  <Text style={[styles.metricValue, { color: COLORS.primary }]}>
                    {formatCurrency(incomeMetrics.totalOutstandingCollections)}
                  </Text>
                  <Text style={styles.metricSub}>Receivable portfolio</Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Collected This Month</Text>
                  <Text style={[styles.metricValue, { color: COLORS.success }]}>
                    {formatCurrency(incomeMetrics.amountCollectedThisMonth)}
                  </Text>
                  <Text style={styles.metricSub}>Credited to balance</Text>
                </View>
              </View>
            </View>
          )}

          {activeSection === 'EXPENSE' ? (
            /* EXPENSE TASKS LIST */
            filteredExpenseTasks.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={48} color={COLORS.textTertiary} />}
                title="No Expense Tasks Found"
                description={
                  searchQuery
                    ? 'No tasks matched your search query.'
                    : expenseTab === 'READY_TO_COMPLETE'
                    ? 'No tasks are currently ready for payment.'
                    : 'No expense obligations scheduled for this period.'
                }
                actionTitle={isAdmin ? 'Create Fixed Task' : undefined}
                onActionPress={isAdmin ? () => router.push('/create-task') : undefined}
              />
            ) : (
              filteredExpenseTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  isAdmin={isAdmin}
                  onPress={() =>
                    router.push({
                      pathname: '/task-detail',
                      params: { taskId: t.id },
                    })
                  }
                  onReview={() => {
                    setSelectedTaskToReview(t);
                    setCompleteModalVisible(true);
                  }}
                />
              ))
            )
          ) : (
            /* INCOME COLLECTION TASKS LIST */
            filteredIncomeTasks.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck size={48} color={COLORS.textTertiary} />}
                title="No Collection Tasks Found"
                description={
                  searchQuery
                    ? 'No collection tasks matched your search.'
                    : incomeTab === 'OVERDUE_TODAY'
                    ? 'No client payments due today or overdue.'
                    : 'No collection tasks currently scheduled.'
                }
                actionTitle="New Collection Task"
                onActionPress={() => router.push('/create-income-task')}
              />
            ) : (
              filteredIncomeTasks.map((it) => (
                <IncomeTaskCard
                  key={it.id}
                  task={it}
                  todayStr={todayStr}
                  canRecordPayment={true}
                  onRecordPayment={handleOpenRecordPayment}
                  onGenerateInvoice={handleOpenInvoiceModal}
                  onViewInvoice={handleViewInvoice}
                />
              ))
            )
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      {/* Floating Action Button */}
      <FAB
        onPress={() => {
          if (activeSection === 'INCOME') {
            router.push('/create-income-task');
          } else {
            router.push('/create-task');
          }
        }}
      />

      {/* Month Selector Modal */}
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
        availableBalance={availableBalance}
        onClose={() => setCompleteModalVisible(false)}
        onSuccess={() => {
          setCompleteModalVisible(false);
          onRefresh();
        }}
      />

      {/* Record Income Payment Modal */}
      <RecordIncomePaymentModal
        visible={recordPaymentModalVisible}
        task={selectedIncomeTaskToPay}
        onClose={() => setRecordPaymentModalVisible(false)}
        onSuccess={() => {
          onRefresh();
        }}
      />

      {/* Invoice PIN Verification Modal */}
      {selectedTaskForInvoice && (
        <PinVerificationModal
          visible={pinModalVisible}
          taskId={selectedTaskForInvoice.id}
          taskTitle={selectedTaskForInvoice.projectName}
          clientName={selectedTaskForInvoice.clientName}
          amount={selectedTaskForInvoice.expectedAmount}
          onClose={() => {
            setPinModalVisible(false);
            setSelectedTaskForInvoice(null);
          }}
          onSuccess={async (invoice) => {
            setPinModalVisible(false);
            setSelectedTaskForInvoice(null);
            onRefresh();
            Alert.alert(
              'Invoice Generated!',
              `Invoice ${invoice.invoiceNumber} has been generated successfully.`,
              [
                { text: 'Close', style: 'cancel' },
                {
                  text: 'Share / View PDF',
                  onPress: () => generateAndShareInvoicePdf(invoice),
                },
              ]
            );
          }}
        />
      )}
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
  prioritySegmentContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  prioritySegmentBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  prioritySegmentBtnActiveExpense: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  prioritySegmentBtnActiveIncome: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successLight,
  },
  segmentIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prioritySegmentTitle: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textSecondary,
    fontWeight: '700',
    flex: 1,
  },
  prioritySegmentTitleActive: {
    color: COLORS.textPrimary,
  },
  prioritySegmentSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 10,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  alertDot: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  alertDotText: {
    color: COLORS.surface,
    fontSize: 9,
    fontWeight: '700',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  incomeMetricsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  metricValue: {
    ...TYPOGRAPHY.labelMedium,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  metricSub: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 10,
    color: COLORS.textTertiary,
    marginTop: 1,
  },
  listContent: {
    padding: SPACING.md,
  },
});
