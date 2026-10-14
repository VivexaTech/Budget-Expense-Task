import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';

interface ProgressBarProps {
  collected: number;
  target: number;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  collected,
  target,
  style,
}) => {
  const percentage = target > 0 ? (collected / target) * 100 : 0;
  const clampedVisualPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <View style={[styles.container, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.amountLabel}>
          {formatCurrency(collected)} of {formatCurrency(target)} collected
        </Text>
        <Text style={styles.percentageLabel}>
          {percentage.toFixed(1)}%
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${clampedVisualPercentage}%` },
            percentage >= 100 && styles.fillComplete,
          ]}
        />
      </View>
      {percentage > 100 && (
        <Text style={styles.exceededNote}>
          Target exceeded by {formatCurrency(collected - target)}!
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACING.xs,
  },
  amountLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  percentageLabel: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  fillComplete: {
    backgroundColor: COLORS.success,
  },
  exceededNote: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.success,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
});
