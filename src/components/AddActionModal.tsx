import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  Sliders,
  X,
  CalendarCheck,
  UserPlus,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface AddActionModalProps {
  visible: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onCreateTask: () => void;
  onCreateIncomeTask?: () => void;
  onCreateClient?: () => void;
  onConfigureBudget: () => void;
}

export const AddActionModal: React.FC<AddActionModalProps> = ({
  visible,
  isAdmin,
  onClose,
  onAddIncome,
  onAddExpense,
  onCreateTask,
  onCreateIncomeTask,
  onCreateClient,
  onConfigureBudget,
}) => {
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
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>Quick Actions</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.actionsList}>
                {onCreateIncomeTask && (
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => {
                      onClose();
                      onCreateIncomeTask();
                    }}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: COLORS.successLight }]}>
                      <CalendarCheck size={22} color={COLORS.success} />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionTitle}>New Income Collection Task</Text>
                      <Text style={styles.actionSubtitle}>
                        Schedule receivable from client with due date & milestones
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {onCreateClient && (
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => {
                      onClose();
                      onCreateClient();
                    }}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
                      <UserPlus size={22} color={COLORS.primary} />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionTitle}>New Client Profile</Text>
                      <Text style={styles.actionSubtitle}>
                        Register client account, contact, and billing preferences
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onClose();
                    onAddIncome();
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: COLORS.primaryLight }]}>
                    <ArrowDownLeft size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Direct Income Entry</Text>
                    <Text style={styles.actionSubtitle}>
                      Log money received directly without a prior task
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onClose();
                    onAddExpense();
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: COLORS.warningLight }]}>
                    <ArrowUpRight size={22} color={COLORS.warningDark} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Submit Company Expense</Text>
                    <Text style={styles.actionSubtitle}>
                      Submit an expense for company approval
                    </Text>
                  </View>
                </TouchableOpacity>

                {isAdmin && (
                  <>
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => {
                        onClose();
                        onCreateTask();
                      }}
                    >
                      <View style={[styles.iconCircle, { backgroundColor: COLORS.primaryLight }]}>
                        <ClipboardList size={22} color={COLORS.primary} />
                      </View>
                      <View style={styles.actionTextContainer}>
                        <Text style={styles.actionTitle}>Create Fixed Task</Text>
                        <Text style={styles.actionSubtitle}>
                          Add a company payment (rent, bills, payroll)
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => {
                        onClose();
                        onConfigureBudget();
                      }}
                    >
                      <View style={[styles.iconCircle, { backgroundColor: COLORS.surfaceVariant }]}>
                        <Sliders size={22} color={COLORS.textPrimary} />
                      </View>
                      <View style={styles.actionTextContainer}>
                        <Text style={styles.actionTitle}>Configure Monthly Budget</Text>
                        <Text style={styles.actionSubtitle}>
                          Set fixed budget, profit target, and opening balance
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
  },
  actionsList: {
    gap: SPACING.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  actionSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
