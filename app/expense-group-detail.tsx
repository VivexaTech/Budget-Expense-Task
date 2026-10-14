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
  User,
  Building2,
  CheckCircle2,
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

  const companyFundTotal = useMemo(
    () =>
      entries
        .filter((e) => e.paymentSource === 'COMPANY_FUND')
        .reduce((sum, e) => sum + e.amount, 0),
    [entries]
  );

  const selfPaidTotal = useMemo(
    () =>
      entries
        .filter((e) => e.paymentSource === 'SELF' || !e.paymentSource)
        .reduce((sum, e) => sum + e.amount, 0),
    [entries]
  );

  const approvedAmount = useMemo(
    () =>
      entries
        .filter((e) => e.approvalStatus === 'APPROVED')
        .reduce((sum, e) => sum + e.amount, 0),
    [entries]
  );

  const disbursedAmount = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            (e.paymentSource === 'SELF' || !e.paymentSource) &&
            e.reimbursementStatus === 'PAID'
        )
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
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Total Submitted</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(totalAmount)}</Text>
              <Text style={styles.summaryMeta}>
                {entries.length} individual {entries.length === 1 ? 'item' : 'items'}
              </Text>
            </View>

            <View style={styles.statusCol}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Company Fund:</Text>
                <Text style={[styles.metricValue, { color: COLORS.warningDark }]}>
                  {formatCurrency(companyFundTotal)}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>By Self:</Text>
                <Text style={[styles.metricValue, { color: COLORS.primary }]}>
                  {formatCurrency(selfPaidTotal)}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Reimbursed:</Text>
                <Text style={[styles.metricValue, { color: COLORS.success }]}>
                  {formatCurrency(disbursedAmount)}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Individual Expense Entries List */}
        <Text style={styles.sectionTitle}>Individual Submissions</Text>

        {entries.map((item) => {
          const isCompanyFund = item.paymentSource === 'COMPANY_FUND';
          const isSubmitted = item.approvalStatus === 'SUBMITTED';
          const isApproved = item.approvalStatus === 'APPROVED';
          const isRejected = item.approvalStatus === 'REJECTED';
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

              {/* Payment Source Badge & Statuses */}
              <View style={styles.badgesRow}>
                <View
                  style={[
                    styles.sourceBadge,
                    isCompanyFund ? styles.sourceBadgeCompany : styles.sourceBadgeSelf,
                  ]}
                >
                  {isCompanyFund ? (
                    <Building2 size={13} color={COLORS.warningDark} />
                  ) : (
                    <User size={13} color={COLORS.primary} />
                  )}
                  <Text
                    style={[
                      styles.sourceBadgeLabel,
                      { color: isCompanyFund ? COLORS.warningDark : COLORS.primary },
                    ]}
                  >
                    {isCompanyFund ? 'By Company Fund' : 'By Self (Employee Paid)'}
                  </Text>
                </View>

                <StatusBadge status={item.approvalStatus} />

                {!isCompanyFund && (
                  <StatusBadge status={item.reimbursementStatus} />
                )}
              </View>

              {/* Notes / Footnotes based on payment source */}
              {isCompanyFund ? (
                <View style={styles.companyFundNote}>
                  <CheckCircle2 size={13} color={COLORS.warningDark} />
                  <Text style={styles.companyFundNoteText}>
                    Direct company outflow. Deducted from company cash (no reimbursement needed).
                  </Text>
                </View>
              ) : (
                <Text style={styles.itemTimestamp}>
                  Submitted on {formatDateTime(item.createdAt)}
                </Text>
              )}

              {/* Admin Actions */}
              {isAdmin && (
                <View style={styles.adminActionRow}>
                  {/* Both types can be Approved or Rejected when submitted */}
                  {isSubmitted && (
                    <>
                      <Button
                        title="Approve"
                        size="sm"
                        variant="secondary"
                        loading={isReviewing}
                        onPress={() => handleReview(item, 'APPROVED', isCompanyFund ? 'PAID' : 'UNPAID')}
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

                  {/* ONLY Employee-paid items can be disbursed / reimbursed */}
                  {!isCompanyFund && isApproved && !isPaid && (
                    <Button
                      title="Disburse / Reimburse Employee"
                      size="sm"
                      variant="primary"
                      loading={isReviewing}
                      onPress={() => handleReview(item, 'APPROVED', 'PAID')}
                      style={{ flex: 1 }}
                    />
                  )}

                  {/* For company-funded items that are approved, show confirmed status */}
                  {isCompanyFund && isApproved && (
                    <View style={styles.verifiedRow}>
                      <CheckCircle2 size={16} color={COLORS.success} />
                      <Text style={styles.verifiedText}>
                        Approved company expense (funds already deducted)
                      </Text>
                    </View>
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
    borderRadius: RADIUS.full,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  summaryCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
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
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  summaryMeta: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  statusCol: {
    gap: 4,
    alignItems: 'flex-end',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metricLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  metricValue: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '700',
  },
  sectionTitle: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  itemCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemCategory: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemAmount: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  itemDesc: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  sourceBadgeCompany: {
    borderColor: COLORS.warningDark,
    backgroundColor: COLORS.warningLight,
  },
  sourceBadgeSelf: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  sourceBadgeLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
    fontSize: 11,
  },
  companyFundNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  companyFundNoteText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    fontSize: 11,
    flex: 1,
  },
  itemTimestamp: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    fontSize: 11,
    marginTop: 4,
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 4,
  },
  verifiedText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.success,
    fontWeight: '600',
  },
});
