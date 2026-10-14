import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileText,
  History,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { MonthSelectorModal } from '@/components/MonthSelectorModal';
import { ActivityLog, DashboardFinancials } from '@/types';
import {
  subscribeToAllActivity,
  generateMonthlyReportData,
} from '@/services/activityService';
import { exportMonthlyFinancialReport } from '@/services/exportService';
import { formatCurrency, formatDateTime, formatMonthName } from '@/utils/formatters';

export default function ActivityScreen() {
  const { user, isAdmin, selectedMonthKey, setSelectedMonthKey } = useAuth();

  const [viewMode, setViewMode] = useState<'ACTIVITY' | 'REPORT'>('ACTIVITY');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [monthModalVisible, setMonthModalVisible] = useState(false);

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [report, setReport] = useState<DashboardFinancials | null>(null);

  const handleExportReport = async () => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only administrators can export monthly financial reports.');
      return;
    }
    setExporting(true);
    try {
      const res = await exportMonthlyFinancialReport(selectedMonthKey);
      if (res.totalRecords === 0) {
        Alert.alert(
          'Export Completed (Empty Month)',
          `No income or expense records were found for ${formatMonthName(selectedMonthKey)}. An empty template was generated.`
        );
      } else {
        Alert.alert(
          'Report Exported',
          `Successfully exported ${res.totalRecords} records for ${formatMonthName(selectedMonthKey)}:\n\n• Income Records: ${res.incomeCount} (₹${res.totalIncomeAmount.toLocaleString('en-IN')})\n• Expense Records: ${res.expenseCount} (₹${res.totalExpenseAmount.toLocaleString('en-IN')})`
        );
      }
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Failed to export report.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const unsub = subscribeToAllActivity(setActivities);
    loadReport();
    return () => unsub();
  }, [selectedMonthKey]);

  const loadReport = async () => {
    try {
      const rep = await generateMonthlyReportData(selectedMonthKey);
      setReport(rep);
    } catch (e) {
      console.warn('Report load error:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReport();
    setRefreshing(false);
  };

  const getActivityIcon = (action: string) => {
    if (action.includes('INCOME')) {
      return <ArrowDownLeft size={16} color={COLORS.success} />;
    }
    if (action.includes('EXPENSE')) {
      return <ArrowUpRight size={16} color={COLORS.warningDark} />;
    }
    if (action.includes('TASK_COMPLETED')) {
      return <CheckCircle2 size={16} color={COLORS.primary} />;
    }
    return <FileText size={16} color={COLORS.textSecondary} />;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Activity & Reports"
        showMonthPicker={true}
        onOpenMonthModal={() => setMonthModalVisible(true)}
      />

      <View style={styles.container}>
        {/* Toggle View Bar */}
        <View style={styles.viewToggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'ACTIVITY' && styles.toggleBtnActive]}
            onPress={() => setViewMode('ACTIVITY')}
          >
            <History size={16} color={viewMode === 'ACTIVITY' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.toggleText, viewMode === 'ACTIVITY' && styles.toggleTextActive]}>
              Audit Feed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'REPORT' && styles.toggleBtnActive]}
            onPress={() => setViewMode('REPORT')}
          >
            <FileText size={16} color={viewMode === 'REPORT' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.toggleText, viewMode === 'REPORT' && styles.toggleTextActive]}>
              Monthly Report
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        >
          {viewMode === 'ACTIVITY' ? (
            /* AUDIT ACTIVITY FEED */
            activities.length === 0 ? (
              <EmptyState
                icon={<History size={48} color={COLORS.textTertiary} />}
                title="No Activity Yet"
                description="Financial entries and task status transitions will be permanently audited here."
              />
            ) : (
              <Card variant="outlined" style={styles.card}>
                {activities.map((act, index) => (
                  <View
                    key={act.id || index}
                    style={[
                      styles.auditItem,
                      index < activities.length - 1 && styles.auditItemBorder,
                    ]}
                  >
                    <View style={styles.iconCircle}>
                      {getActivityIcon(act.action)}
                    </View>
                    <View style={styles.auditContent}>
                      <Text style={styles.auditDesc}>{act.description}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.auditTime}>{formatDateTime(act.timestamp)}</Text>
                        <Text style={styles.auditDot}>•</Text>
                        <Text style={styles.auditActor}>{act.actorName} ({act.actorRole})</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            )
          ) : (
            /* MONTHLY FINANCIAL REPORT */
            report && (
              <View style={styles.reportContainer}>
                {/* Admin Export CSV Action */}
                {isAdmin && (
                  <Card variant="outlined" style={styles.exportActionCard}>
                    <View style={styles.exportActionRow}>
                      <View style={styles.exportIconBox}>
                        <FileSpreadsheet size={20} color={COLORS.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exportActionTitle}>Export Monthly Statement</Text>
                        <Text style={styles.exportActionSubtitle}>
                          Download full CSV with payment sources & income details
                        </Text>
                      </View>
                      <Button
                        title={exporting ? 'Exporting...' : 'Export CSV'}
                        size="sm"
                        variant="primary"
                        loading={exporting}
                        onPress={handleExportReport}
                      />
                    </View>
                  </Card>
                )}

                <Card variant="elevated" style={styles.reportHeaderCard}>
                  <Text style={styles.reportPeriodTitle}>
                    {formatMonthName(selectedMonthKey)} Executive Summary
                  </Text>
                  <Text style={styles.reportPeriodSubtitle}>
                    Official financial overview and target reconciliation
                  </Text>

                  <View style={styles.progressBox}>
                    <ProgressBar
                      collected={report.incomeCollected}
                      target={report.monthlyIncomeTarget}
                    />
                  </View>
                </Card>

                <Card variant="outlined" style={styles.reportCard}>
                  <Text style={styles.cardHeaderTitle}>Inflow & Target Metrics</Text>
                  
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Monthly Income Target</Text>
                    <Text style={styles.reportRowValue}>{formatCurrency(report.monthlyIncomeTarget)}</Text>
                  </View>

                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Total Income Collected</Text>
                    <Text style={[styles.reportRowValue, { color: COLORS.success }]}>
                      {formatCurrency(report.incomeCollected)}
                    </Text>
                  </View>

                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Target Remaining to Collect</Text>
                    <Text style={styles.reportRowValue}>{formatCurrency(report.remainingIncomeTarget)}</Text>
                  </View>

                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Opening Cash Balance</Text>
                    <Text style={styles.reportRowValue}>{formatCurrency(report.openingBalance)}</Text>
                  </View>
                </Card>

                <Card variant="outlined" style={styles.reportCard}>
                  <Text style={styles.cardHeaderTitle}>Outflow & Task Metrics</Text>

                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Actual Expenses Disbursed</Text>
                    <Text style={[styles.reportRowValue, { color: COLORS.error }]}>
                      {formatCurrency(report.actualCompanyExpensesPaid)}
                    </Text>
                  </View>

                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Pending Expenses Submitted</Text>
                    <Text style={styles.reportRowValue}>{formatCurrency(report.pendingExpensesSubmitted)}</Text>
                  </View>

                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Ready Tasks (Covered)</Text>
                    <Text style={[styles.reportRowValue, { color: COLORS.primary }]}>
                      {formatCurrency(report.totalOutstandingReadyTasksAmount)}
                    </Text>
                  </View>

                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Pending Tasks (Awaiting Funds)</Text>
                    <Text style={styles.reportRowValue}>{formatCurrency(report.totalOutstandingPendingTasksAmount)}</Text>
                  </View>
                </Card>

                <Card variant="elevated" style={[styles.reportCard, styles.balanceCard]}>
                  <View style={styles.reportRow}>
                    <Text style={styles.balanceLabel}>Available Net Company Cash</Text>
                    <Text
                      style={[
                        styles.balanceValue,
                        { color: report.availableCompanyBalance >= 0 ? COLORS.success : COLORS.error },
                      ]}
                    >
                      {formatCurrency(report.availableCompanyBalance)}
                    </Text>
                  </View>
                  <Text style={styles.balanceFootnote}>
                    Calculated as Opening Balance + Verified Income − Completed Fixed Tasks − Reimbursed Employee Expenses.
                  </Text>
                </Card>
              </View>
            )
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      </View>

      <MonthSelectorModal
        visible={monthModalVisible}
        selectedMonthKey={selectedMonthKey}
        onSelectMonth={(m) => setSelectedMonthKey(m)}
        onClose={() => setMonthModalVisible(false)}
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
  viewToggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceVariant,
    gap: SPACING.xs,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primaryLight,
  },
  toggleText: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  auditItem: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  auditItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  auditContent: {
    flex: 1,
  },
  auditDesc: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  auditTime: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
  },
  auditDot: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
  },
  auditActor: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  reportContainer: {
    gap: SPACING.md,
  },
  reportHeaderCard: {
    padding: SPACING.lg,
  },
  reportPeriodTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  reportPeriodSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressBox: {
    marginTop: SPACING.md,
  },
  reportCard: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cardHeaderTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.xs,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportRowLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  reportRowValue: {
    ...TYPOGRAPHY.amountMedium,
    color: COLORS.textPrimary,
  },
  balanceCard: {
    backgroundColor: COLORS.surface,
  },
  balanceLabel: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  balanceValue: {
    ...TYPOGRAPHY.amountLarge,
  },
  balanceFootnote: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  exportActionCard: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.success,
  },
  exportActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  exportIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportActionTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  exportActionSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});
