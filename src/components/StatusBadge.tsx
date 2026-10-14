import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface StatusBadgeProps {
  status: string;
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, style }) => {
  const normalized = status.toUpperCase();

  const getBadgeConfig = () => {
    switch (normalized) {
      case 'READY_TO_COMPLETE':
        return {
          label: 'Ready to Complete',
          bg: COLORS.badgeReadyBg,
          text: COLORS.badgeReady,
          border: COLORS.success,
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          bg: COLORS.badgeCompletedBg,
          text: COLORS.badgeCompleted,
          border: COLORS.primary,
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          bg: COLORS.badgeCancelledBg,
          text: COLORS.badgeCancelled,
          border: COLORS.error,
        };
      case 'APPROVED':
        return {
          label: 'Approved',
          bg: COLORS.successLight,
          text: COLORS.success,
          border: COLORS.success,
        };
      case 'REJECTED':
        return {
          label: 'Rejected',
          bg: COLORS.errorLight,
          text: COLORS.error,
          border: COLORS.error,
        };
      case 'SUBMITTED':
        return {
          label: 'Submitted',
          bg: COLORS.warningLight,
          text: COLORS.warningDark,
          border: COLORS.warning,
        };
      case 'PAID':
        return {
          label: 'Paid',
          bg: COLORS.successLight,
          text: COLORS.success,
          border: COLORS.success,
        };
      case 'UNPAID':
        return {
          label: 'Unpaid',
          bg: COLORS.surfaceVariant,
          text: COLORS.textSecondary,
          border: COLORS.borderDark,
        };
      case 'ADMIN':
        return {
          label: 'Admin',
          bg: COLORS.primaryLight,
          text: COLORS.primary,
          border: COLORS.primary,
        };
      case 'EMPLOYEE':
        return {
          label: 'Employee',
          bg: COLORS.surfaceVariant,
          text: COLORS.textSecondary,
          border: COLORS.border,
        };
      case 'PENDING':
      default:
        return {
          label: 'Pending',
          bg: COLORS.badgePendingBg,
          text: COLORS.badgePending,
          border: COLORS.borderDark,
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.border },
        style,
      ]}
    >
      <Text style={[styles.badgeText, { color: config.text }]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs - 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
});
