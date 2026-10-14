import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Bell, Calendar } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { formatMonthName, shiftMonthKey } from '@/utils/formatters';
import { StatusBadge } from './StatusBadge';

interface HeaderProps {
  title?: string;
  showMonthPicker?: boolean;
  onOpenMonthModal?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Company Budget',
  showMonthPicker = true,
  onOpenMonthModal,
  showBack = false,
}) => {
  const router = useRouter();
  const { role, selectedMonthKey, setSelectedMonthKey } = useAuth();

  const handlePrevMonth = () => {
    setSelectedMonthKey(shiftMonthKey(selectedMonthKey, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonthKey(shiftMonthKey(selectedMonthKey, 1));
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.iconButton}
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.rightGroup}>
          {role && <StatusBadge status={role} />}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications')}
            accessibilityLabel="Notifications"
          >
            <Bell size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {showMonthPicker && (
        <View style={styles.monthSelectorBar}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={styles.monthNavButton}
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenMonthModal}
            style={styles.monthPill}
          >
            <Calendar size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.monthPillText}>
              {formatMonthName(selectedMonthKey)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNextMonth}
            style={styles.monthNavButton}
            accessibilityLabel="Next month"
          >
            <ChevronRight size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  monthSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceVariant,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
  },
  monthPillText: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.primary,
  },
});
