import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import {
  Building2,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  CreditCard,
  User,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { Card } from './Card';
import { Button } from './Button';
import { IncomeTask } from '@/types';
import { formatCurrency, formatReadableDate } from '@/utils/formatters';

interface IncomeTaskCardProps {
  task: IncomeTask;
  todayStr: string; // YYYY-MM-DD
  onRecordPayment: (task: IncomeTask) => void;
  canRecordPayment: boolean;
}

export const IncomeTaskCard: React.FC<IncomeTaskCardProps> = ({
  task,
  todayStr,
  onRecordPayment,
  canRecordPayment,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  const isCompleted = task.status === 'COMPLETED';
  const isCancelled = task.status === 'CANCELLED';
  const isOverdue = !isCompleted && !isCancelled && task.dueDate < todayStr;
  const isDueToday = !isCompleted && !isCancelled && task.dueDate === todayStr;

  const percentCollected = task.expectedAmount > 0
    ? Math.min(100, Math.round((task.receivedAmount / task.expectedAmount) * 100))
    : 0;

  const handleCall = () => {
    if (task.clientPhone) {
      Linking.openURL(`tel:${task.clientPhone}`).catch(() => {});
    }
  };

  return (
    <Card
      variant="outlined"
      style={[
        styles.card,
        isOverdue && styles.cardOverdue,
        isDueToday && styles.cardDueToday,
      ]}
    >
      {/* Top Header: Client Name, Project, and Status */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.clientRow}>
            <Text style={styles.clientName}>{task.clientName}</Text>
            {task.clientPhone ? (
              <TouchableOpacity onPress={handleCall} style={styles.phoneChip}>
                <Phone size={12} color={COLORS.primary} />
                <Text style={styles.phoneText}>{task.clientPhone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.projectName}>{task.projectName}</Text>
        </View>

        {/* Status Badges */}
        <View style={styles.badgesCol}>
          {isCompleted && (
            <View style={[styles.statusBadge, styles.badgeCompleted]}>
              <CheckCircle2 size={12} color={COLORS.success} />
              <Text style={[styles.statusBadgeText, { color: COLORS.success }]}>SETTLED</Text>
            </View>
          )}

          {isOverdue && (
            <View style={[styles.statusBadge, styles.badgeOverdue]}>
              <AlertCircle size={12} color={COLORS.error} />
              <Text style={[styles.statusBadgeText, { color: COLORS.error }]}>OVERDUE</Text>
            </View>
          )}

          {isDueToday && (
            <View style={[styles.statusBadge, styles.badgeDueToday]}>
              <Clock size={12} color={COLORS.warningDark} />
              <Text style={[styles.statusBadgeText, { color: COLORS.warningDark }]}>DUE TODAY</Text>
            </View>
          )}

          {!isCompleted && !isCancelled && !isOverdue && !isDueToday && (
            <View style={[styles.statusBadge, styles.badgePending]}>
              <Text style={[styles.statusBadgeText, { color: COLORS.textSecondary }]}>
                {task.status === 'PARTIALLY_PAID' ? 'PARTIAL' : 'PENDING'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Progress Bar & Amount Row */}
      <View style={styles.amountSection}>
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Remaining Receivable</Text>
            <Text
              style={[
                styles.remainingAmount,
                isCompleted && { color: COLORS.success },
                isOverdue && { color: COLORS.error },
              ]}
            >
              {formatCurrency(task.remainingAmount)}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>Collected / Expected</Text>
            <Text style={styles.collectedRatio}>
              {formatCurrency(task.receivedAmount)} / {formatCurrency(task.expectedAmount)}
            </Text>
          </View>
        </View>

        {/* Visual Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${percentCollected}%`,
                backgroundColor: isCompleted ? COLORS.success : COLORS.primary,
              },
            ]}
          />
        </View>
        <Text style={styles.percentText}>{percentCollected}% Collected</Text>
      </View>

      {/* Schedule & Metadata */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Calendar size={13} color={isOverdue ? COLORS.error : COLORS.textTertiary} />
          <Text
            style={[
              styles.metaText,
              isOverdue && { color: COLORS.error, fontWeight: '700' },
              isDueToday && { color: COLORS.warningDark, fontWeight: '700' },
            ]}
          >
            Due: {task.dueDate}
          </Text>
        </View>

        <View style={styles.metaItem}>
          <User size={13} color={COLORS.textTertiary} />
          <Text style={styles.metaText}>By: {task.createdByName || 'Staff'}</Text>
        </View>
      </View>

      {task.notes ? (
        <Text style={styles.notesText} numberOfLines={2}>
          Note: {task.notes}
        </Text>
      ) : null}

      {/* Payment History Toggle & List */}
      {task.payments && task.payments.length > 0 && (
        <View style={styles.historySection}>
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Text style={styles.historyToggleText}>
              Payment History ({task.payments.length})
            </Text>
            {showHistory ? (
              <ChevronUp size={16} color={COLORS.primary} />
            ) : (
              <ChevronDown size={16} color={COLORS.primary} />
            )}
          </TouchableOpacity>

          {showHistory && (
            <View style={styles.paymentsList}>
              {task.payments.map((p, idx) => (
                <View key={p.id || idx} style={styles.paymentItem}>
                  <View style={styles.paymentItemHeader}>
                    <Text style={styles.paymentAmount}>{formatCurrency(p.amount)}</Text>
                    <Text style={styles.paymentMode}>{p.paymentMode}</Text>
                  </View>
                  <Text style={styles.paymentDate}>
                    Received by {p.receivedByName || 'Agent'} on {p.date.split('T')[0]}
                  </Text>
                  {p.nextDueDate && (
                    <Text style={styles.paymentNextDate}>
                      Promised next date: {p.nextDueDate}
                    </Text>
                  )}
                  {p.notes ? (
                    <Text style={styles.paymentNotes}>Note: {p.notes}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      {!isCompleted && !isCancelled && canRecordPayment && (
        <View style={styles.actionRow}>
          <Button
            title="Record Payment"
            variant="primary"
            size="sm"
            onPress={() => onRecordPayment(task)}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  cardOverdue: {
    borderColor: COLORS.error,
    backgroundColor: '#FFF8F8',
  },
  cardDueToday: {
    borderColor: COLORS.warningDark,
    backgroundColor: '#FFFDF5',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  clientName: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  phoneText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '500',
  },
  projectName: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  badgeCompleted: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successLight,
  },
  badgeOverdue: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  badgeDueToday: {
    borderColor: COLORS.warningDark,
    backgroundColor: COLORS.warningLight,
  },
  badgePending: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceVariant,
  },
  statusBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 10,
    fontWeight: '700',
  },
  amountSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  amountLabel: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  remainingAmount: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  collectedRatio: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  percentText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  notesText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  historySection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyToggleText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontWeight: '600',
  },
  paymentsList: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  paymentItem: {
    backgroundColor: COLORS.surfaceVariant,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  paymentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentAmount: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.success,
    fontWeight: '700',
  },
  paymentMode: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  paymentDate: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  paymentNextDate: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.warningDark,
    fontWeight: '600',
    marginTop: 1,
  },
  paymentNotes: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
