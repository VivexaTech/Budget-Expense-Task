import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { format, subMonths, addMonths } from 'date-fns';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatMonthName, getCurrentMonthKey } from '@/utils/formatters';

interface MonthSelectorModalProps {
  visible: boolean;
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  onClose: () => void;
}

export const MonthSelectorModal: React.FC<MonthSelectorModalProps> = ({
  visible,
  selectedMonthKey,
  onSelectMonth,
  onClose,
}) => {
  // Generate a list of recent and upcoming months (e.g. past 12 months + next 6 months)
  const currentMonthDate = new Date();
  const months: string[] = [];

  for (let i = 12; i >= 1; i--) {
    months.push(format(subMonths(currentMonthDate, i), 'yyyy-MM'));
  }
  months.push(format(currentMonthDate, 'yyyy-MM'));
  for (let i = 1; i <= 6; i++) {
    months.push(format(addMonths(currentMonthDate, i), 'yyyy-MM'));
  }

  const currentMonthKey = getCurrentMonthKey();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Text style={styles.title}>Select Reporting Period</Text>
              <Text style={styles.subtitle}>
                Financial calculations and tasks are tracked by calendar month.
              </Text>

              <ScrollView style={styles.scrollList} contentContainerStyle={styles.listContainer}>
                {months.map((mKey) => {
                  const isSelected = mKey === selectedMonthKey;
                  const isCurrent = mKey === currentMonthKey;

                  return (
                    <TouchableOpacity
                      key={mKey}
                      style={[
                        styles.monthItem,
                        isSelected && styles.monthItemSelected,
                      ]}
                      onPress={() => {
                        onSelectMonth(mKey);
                        onClose();
                      }}
                    >
                      <View>
                        <Text
                          style={[
                            styles.monthText,
                            isSelected && styles.monthTextSelected,
                          ]}
                        >
                          {formatMonthName(mKey)}
                        </Text>
                        {isCurrent && (
                          <Text style={styles.currentBadge}>Current Month</Text>
                        )}
                      </View>
                      {isSelected && (
                        <View style={styles.checkmarkDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(32, 33, 36, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxHeight: '75%',
    padding: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  subtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  scrollList: {
    marginTop: SPACING.xs,
  },
  listContainer: {
    gap: SPACING.xs,
  },
  monthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthItemSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  monthText: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  monthTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  currentBadge: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.primary,
    marginTop: 2,
  },
  checkmarkDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
});
