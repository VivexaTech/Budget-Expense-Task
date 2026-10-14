import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '@/constants/theme';
import { FinancialTask } from '@/types';
import { formatCurrency, formatDueDate } from '@/utils/formatters';
import { StatusBadge } from './StatusBadge';
import { Card } from './Card';
import { Button } from './Button';

interface TaskCardProps {
  task: FinancialTask;
  isAdmin: boolean;
  onPress?: () => void;
  onReview?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isAdmin,
  onPress,
  onReview,
}) => {
  const isReady = task.status === 'READY_TO_COMPLETE';
  const isCompleted = task.status === 'COMPLETED';
  const isCancelled = task.status === 'CANCELLED';

  // Check if overdue
  const todayStr = new Date().toISOString().substring(0, 10);
  const isOverdue = !isCompleted && !isCancelled && task.dueDate < todayStr;

  return (
    <Card
      variant={isReady ? 'elevated' : 'outlined'}
      style={[
        styles.card,
        isReady && styles.readyBorder,
        isOverdue && styles.overdueBorder,
      ]}
      onPress={onPress}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {task.title}
          </Text>
          {task.category && (
            <Text style={styles.category}>{task.category}</Text>
          )}
        </View>
        <Text style={styles.amount}>
          {formatCurrency(task.amount)}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.metaRow}>
          {isOverdue ? (
            <View style={styles.overdueBadge}>
              <AlertTriangle size={14} color={COLORS.error} />
              <Text style={styles.overdueText}>{formatDueDate(task.dueDate)}</Text>
            </View>
          ) : (
            <View style={styles.dueBadge}>
              <Clock size={14} color={COLORS.textSecondary} />
              <Text style={styles.dueText}>{formatDueDate(task.dueDate)}</Text>
            </View>
          )}
          <StatusBadge status={task.status} />
        </View>

        {isAdmin && isReady && onReview && (
          <Button
            title="Review & Pay"
            size="sm"
            variant="primary"
            onPress={onReview}
            style={styles.reviewBtn}
          />
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md + 2,
    marginVertical: SPACING.xs,
  },
  readyBorder: {
    borderColor: COLORS.success,
    borderWidth: 1.5,
    backgroundColor: '#FBFDFB',
  },
  overdueBorder: {
    borderColor: COLORS.error,
    borderWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  category: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  amount: {
    ...TYPOGRAPHY.amountLarge,
    color: COLORS.textPrimary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overdueText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
    fontWeight: '600',
  },
  reviewBtn: {
    minHeight: 32,
    paddingHorizontal: SPACING.md,
  },
});
