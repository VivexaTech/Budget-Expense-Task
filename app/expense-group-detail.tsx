import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  AlertCircle,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { ExpenseEntry, ExpenseApprovalStatus, ReimbursementStatus } from '@/types';
import { subscribeToGroupExpenses, reviewExpenseEntry } from '@/services/expenseService';
import { formatCurrency, formatDateTime, formatMonthName } from '@/utils/formatters';

export default function ExpenseGroupDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    employeeId: string;
    employeeName: string;
    monthKey: string;
  }>();

  const { user, isAdmin } = useAuth();
  const employeeId = params.employeeId || '';
  const employeeName = params.employeeName || 'Employee';
  const monthKey = params.monthKey || '';

  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId || !monthKey) return;
    const unsub = subscribeToGroupExpenses(employeeId, monthKey, setEntries);
    return () => unsub();
  }, [employeeId, monthKey]);

  // Derived totals
  const totalAmount = useMemo(
    () => entries.reduce((sum, e) => sum + e.amount, 0),
    [entries]
  );

  const approvedAmount = useMemo(
    () =>
      entries
        .filter((e) => e.approvalStatus === 'APPROVED')
        .reduce((sum, e) => sum + e.amount, 0),
    [entries]
  );

  const paidAmount = useMemo(
    () =>
      entries
        .filter((e) => e.reimbursementStatus === 'PAID')
        .reduce((sum, e) => sum + e.amount, 0),
    [entries]
  );

  const handleReview = async (
    entry: ExpenseEntry,
    approvalStatus: ExpenseApprovalStatus,
    reimbursementStatus: ReimbursementStatus
  ) => {
    if (!user) return;
    setReviewingId(entry.id);
    try {
      await reviewExpenseEntry(
        entry.id,
        approvalStatus,
        reimbursementStatus,
        user
      );
    } catch (e: any) {
      Alert.alert('Review Error', e.message);
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Expense Breakdown</Text>
          <Text style={styles.headerSubtitle}>
            {employeeName} • {formatMonthName(monthKey)}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Group Summary Card */}
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Submitted</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(totalAmount)}</Text>
              <Text style={styles.summaryMeta}>
                {entries.length} individual {entries.length === 1 ? 'item' : 'items'}
              </Text>
            </View>

            <View style={styles.statusCol}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Approved:</Text>
                <Text style={[styles.metricValue, { color: COLORS.success }]}>
                  {formatCurrency(approvedAmount)}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Disbursed (Paid):</Text>
                <Text style={[styles.metricValue, { color: COLORS.primary }]}>
                  {formatCurrency(paidAmount)}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Individual Expense Entries List */}
        <Text style={styles.sectionTitle}>Individual Submissions</Text>

        {entries.map((item) => {
          const isSubmitted = item.approvalStatus === 'SUBMITTED';
          const isApproved = item.approvalStatus === 'APPROVED';
          const isPaid = item.reimbursementStatus === 'PAID';
          const isReviewing = reviewingId === item.id;

          return (
            <Card key={item.id} variant="outlined" style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.category && (
                    <Text style={styles.itemCategory}>{item.category}</Text>
                  )}
                </View>
                <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
              </View>

              {item.description ? (
                <Text style={styles.itemDesc}>{item.description}</Text>
              ) : null}

              <View style={styles.badgesRow}>
                <StatusBadge status={item.approvalStatus} />
                <StatusBadge status={item.reimbursementStatus} />
                <Text style={styles.itemTimestamp}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>

              {/* Admin Actions */}
              {isAdmin && (
                <View style={styles.adminActionRow}>
                  {isSubmitted && (
                    <>
                      <Button
                        title="Approve"
                        size="sm"
                        variant="secondary"
                        loading={isReviewing}
                        onPress={() => handleReview(item, 'APPROVED', 'UNPAID')}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Reject"
                        size="sm"
                        variant="danger"
                        loading={isReviewing}
                        onPress={() => handleReview(item, 'REJECTED', 'UNPAID')}
                        style={{ flex: 1 }}
                      />
                    </>
                  )}

                  {isApproved && !isPaid && (
                    <Button
                      title="Disburse / Mark Paid"
                      size="sm"
                      variant="primary"
                      loading={isReviewing}
                      onPress={() => handleReview(item, 'APPROVED', 'PAID')}
                      style={{ flex: 1 }}
                    />
                  )}
                </View>
              )}
            </Card>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  summaryCard: {
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  summaryAmount: {
    ...TYPOGRAPHY.amountHero,
    color: COLORS.textPrimary,
  },
  summaryMeta: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
  },
  statusCol: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  metricRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  metricLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  metricValue: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  itemCard: {
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  itemCategory: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  itemAmount: {
    ...TYPOGRAPHY.amountLarge,
    color: COLORS.textPrimary,
  },
  itemDesc: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    marginVertical: SPACING.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  itemTimestamp: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginLeft: 'auto',
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
  },
});
