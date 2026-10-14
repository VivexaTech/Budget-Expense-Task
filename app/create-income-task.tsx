import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowDownLeft, X, Calendar, Phone, Briefcase, User, Info, CheckCircle2 } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { CreateIncomeTaskSchema } from '@/types';
import { createIncomeTask } from '@/services/incomeTaskService';
import { formatCurrency } from '@/utils/formatters';

export default function CreateIncomeTaskScreen() {
  const router = useRouter();
  const { user, selectedMonthKey } = useAuth();

  // Form states
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [projectName, setProjectName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  
  // Default due date: today or 15th of selected month
  const todayStr = new Date().toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState(`${selectedMonthKey}-15`);
  const [reminderDate, setReminderDate] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Due Date Helpers
  const setQuickDueDate = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    const dateFormatted = d.toISOString().split('T')[0];
    setDueDate(dateFormatted);
  };

  const setEndOfMonthDueDate = () => {
    const [year, month] = selectedMonthKey.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    setDueDate(`${selectedMonthKey}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleSubmit = () => {
    if (!user) return;
    setErrorMessage(null);

    const expectedAmount = parseFloat(amountStr.replace(/[^0-9.]/g, ''));

    const validation = CreateIncomeTaskSchema.safeParse({
      clientName,
      clientPhone: clientPhone || undefined,
      projectName,
      expectedAmount,
      dueDate,
      reminderDate: reminderDate || undefined,
      notes: notes || undefined,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || 'Please check input fields.');
      return;
    }

    Alert.alert(
      'Confirm Income Task',
      `Client: ${clientName.trim()}\nProject: ${projectName.trim()}\nExpected Amount: ${formatCurrency(expectedAmount)}\nDue Date: ${dueDate}\n\nNote: This task tracks expected receivable income. It will NOT affect your company cash balance until actual payments are recorded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Task',
          onPress: async () => {
            setLoading(true);
            try {
              await createIncomeTask(
                {
                  clientName,
                  clientPhone,
                  projectName,
                  expectedAmount,
                  dueDate,
                  reminderDate: reminderDate || undefined,
                  notes,
                  monthKey: selectedMonthKey,
                },
                user
              );

              Alert.alert(
                'Collection Task Created',
                `Income collection task for "${clientName}" (${formatCurrency(expectedAmount)}) scheduled for ${dueDate}.`,
                [{ text: 'Done', onPress: () => router.back() }]
              );
            } catch (e: any) {
              setErrorMessage(e.message || 'Failed to create collection task.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <ArrowDownLeft size={22} color={COLORS.success} />
          </View>
          <View>
            <Text style={styles.headerTitle}>New Income Task</Text>
            <Text style={styles.headerSubtitle}>Client Collection & Receivables</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Submitting User Badge */}
          <View style={styles.identityCard}>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Assigned Agent:</Text>
              <Text style={styles.identityValue}>
                {user?.displayName} ({user?.employeeId})
              </Text>
            </View>
          </View>

          {/* Client Details */}
          <View style={styles.formSection}>
            <Text style={styles.sectionHeading}>Client & Project Details</Text>

            <Input
              label="Client or Organization Name *"
              placeholder="e.g. Acme Technologies Ltd"
              value={clientName}
              onChangeText={setClientName}
            />

            <Input
              label="Client Phone / Contact (Optional)"
              placeholder="e.g. +91 98765 43210"
              keyboardType="phone-pad"
              value={clientPhone}
              onChangeText={setClientPhone}
              containerStyle={{ marginTop: SPACING.md }}
            />

            <Input
              label="Project / Service Name *"
              placeholder="e.g. Website Development Milestone 1"
              value={projectName}
              onChangeText={setProjectName}
              containerStyle={{ marginTop: SPACING.md }}
            />
          </View>

          {/* Financials & Dates */}
          <View style={styles.formSection}>
            <Text style={styles.sectionHeading}>Payment Terms & Schedule</Text>

            <Input
              label="Expected Amount (₹) *"
              placeholder="e.g. 40000"
              keyboardType="numeric"
              value={amountStr}
              onChangeText={setAmountStr}
            />

            <Input
              label="Payment Due Date (YYYY-MM-DD) *"
              placeholder="e.g. 2026-10-18"
              value={dueDate}
              onChangeText={setDueDate}
              containerStyle={{ marginTop: SPACING.md }}
            />

            {/* Quick date chips */}
            <View style={styles.quickDateRow}>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => setQuickDueDate(3)}
              >
                <Text style={styles.quickDateText}>+3 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => setQuickDueDate(7)}
              >
                <Text style={styles.quickDateText}>+1 Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => setQuickDueDate(14)}
              >
                <Text style={styles.quickDateText}>+2 Weeks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={setEndOfMonthDueDate}
              >
                <Text style={styles.quickDateText}>End of Month</Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Reminder Date (Optional, YYYY-MM-DD)"
              placeholder="e.g. 2026-10-16"
              value={reminderDate}
              onChangeText={setReminderDate}
              containerStyle={{ marginTop: SPACING.md }}
            />

            <Input
              label="Payment Terms / Notes (Optional)"
              placeholder="e.g. 50% advance received, balance on UAT delivery"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              containerStyle={{ marginTop: SPACING.md }}
            />
          </View>

          <View style={styles.infoBox}>
            <Info size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
            <Text style={styles.infoBoxText}>
              Income collection tasks help track promised receivables. Uncollected amounts will never be counted as actual company revenue or cash balance until payments are explicitly recorded.
            </Text>
          </View>

          <Button
            title="Create Collection Task"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  identityCard: {
    backgroundColor: COLORS.surfaceVariant,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.lg,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identityLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  identityValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  formSection: {
    marginBottom: SPACING.lg,
  },
  sectionHeading: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  quickDateChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickDateText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: COLORS.errorLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  infoBoxText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
});
