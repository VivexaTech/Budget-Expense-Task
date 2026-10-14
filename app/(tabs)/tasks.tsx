import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, SlidersHorizontal, Plus, ClipboardList } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { TaskCard } from '@/components/TaskCard';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { MonthSelectorModal } from '@/components/MonthSelectorModal';
import { TaskCompletionModal } from '@/components/TaskCompletionModal';
import { FinancialTask, TaskStatus } from '@/types';
import { subscribeToTasksForMonth, recalculateTaskEligibility } from '@/services/taskService';
import { subscribeToBudget, syncBudgetTarget } from '@/services/budgetService';
import { subscribeToMonthIncome } from '@/services/incomeService';
import { subscribeToMonthExpenseGroups } from '@/services/expenseService';
import { callBackendApi } from '@/services/apiClient';

type TabType = 'ALL' | 'PENDING' | 'READY_TO_COMPLETE' | 'COMPLETED';
type SortType = 'DUE_DATE' | 'AMOUNT_DESC' | 'TITLE';

export default function TasksScreen() {
  const router = useRouter();
  const { user, isAdmin, selectedMonthKey, setSelectedMonthKey } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('DUE_DATE');
  const [refreshing, setRefreshing] = useState(false);
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedTaskToReview, setSelectedTaskToReview] = useState<FinancialTask | null>(null);

  const [tasks, setTasks] = useState<FinancialTask[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [paidExpenses, setPaidExpenses] = useState(0);

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
    const unsubGroups = subscribeToMonthExpenseGroups(selectedMonthKey, (groups) => {
      const paidSum = groups.reduce((sum, g) => sum + (g.approvedAmount || 0), 0);
      setPaidExpenses(paidSum);
    });

    return () => {
      unsubTasks();
      unsubBudget();
      unsubIncome();
      unsubGroups();
    };
  }, [selectedMonthKey]);

  // Available balance
  const completedTasksAmount = useMemo(() => {
    return tasks
      .filter((t) => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [tasks]);

  const availableBalance = openingBalance + totalIncome - completedTasksAmount - paidExpenses;

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let result = tasks.slice();

    // Tab filter
    if (activeTab !== 'ALL') {
      result = result.filter((t) => t.status === activeTab);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q))
      );
    }

    // Sort
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
  }, [tasks, activeTab, searchQuery, sortBy]);

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

  const counts = useMemo(() => {
    return {
      all: tasks.length,
      pending: tasks.filter((t) => t.status === 'PENDING').length,
      ready: tasks.filter((t) => t.status === 'READY_TO_COMPLETE').length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    };
  }, [tasks]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Tasks & Payments"
        showMonthPicker={true}
        onOpenMonthModal={() => setMonthModalVisible(true)}
      />

      <View style={styles.container}>
        {/* Search & Sort Bar */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchInputWrapper}>
            <Search size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search tasks..."
              placeholderTextColor={COLORS.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              // Cycle sort
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

        {/* Filter Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'ALL' && styles.tabItemActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
              All ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'PENDING' && styles.tabItemActive]}
            onPress={() => setActiveTab('PENDING')}
          >
            <Text style={[styles.tabText, activeTab === 'PENDING' && styles.tabTextActive]}>
              Pending ({counts.pending})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'READY_TO_COMPLETE' && styles.tabItemActive]}
            onPress={() => setActiveTab('READY_TO_COMPLETE')}
          >
            <Text style={[styles.tabText, activeTab === 'READY_TO_COMPLETE' && styles.tabTextActive]}>
              Ready ({counts.ready})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'COMPLETED' && styles.tabItemActive]}
            onPress={() => setActiveTab('COMPLETED')}
          >
            <Text style={[styles.tabText, activeTab === 'COMPLETED' && styles.tabTextActive]}>
              Done ({counts.completed})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Task List */}
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
          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={48} color={COLORS.textTertiary} />}
              title="No Tasks Found"
              description={
                searchQuery
                  ? 'No tasks matched your search query.'
                  : activeTab === 'READY_TO_COMPLETE'
                  ? 'No tasks are currently ready for payment.'
                  : 'No tasks scheduled for this period.'
              }
              actionTitle={isAdmin ? 'Create Fixed Task' : undefined}
              onActionPress={isAdmin ? () => router.push('/create-task') : undefined}
            />
          ) : (
            filteredTasks.map((t) => (
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
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      </View>

      {/* Admin Floating Add Task */}
      {isAdmin && (
        <FAB onPress={() => router.push('/create-task')} />
      )}

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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
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
    height: 42,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  sortButton: {
    width: 42,
    height: 42,
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
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: SPACING.lg,
  },
});
