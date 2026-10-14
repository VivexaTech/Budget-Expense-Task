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
import { ClipboardList, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { TaskCreateSchema } from '@/types';
import { createFixedTask } from '@/services/taskService';

const TASK_CATEGORIES = [
  'Office Rent',
  'Utilities & Bills',
  'Employee Salaries',
  'Software & Cloud',
  'Legal & Taxes',
  'Marketing & Ads',
  'General Operations',
];

export default function CreateTaskScreen() {
  const router = useRouter();
  const { user, isAdmin, selectedMonthKey } = useAuth();

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState(`${selectedMonthKey}-15`);
  const [category, setCategory] = useState(TASK_CATEGORIES[0]);
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user || !isAdmin) return;
    setErrorMessage(null);

    const amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, ''));

    const validation = TaskCreateSchema.safeParse({
      title,
      amount: amountNum,
      dueDate,
      category,
      description: description || undefined,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || 'Please check input fields.');
      return;
    }

    setLoading(true);
    try {
      await createFixedTask(
        {
          title,
          amount: amountNum,
          dueDate,
          monthKey: selectedMonthKey,
          category,
          description,
        },
        user
      );

      Alert.alert(
        'Task Created',
        `Task "${title}" for ₹${amountNum.toLocaleString('en-IN')} has been scheduled. The financial engine has evaluated available balance for immediate readiness.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to create task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <ClipboardList size={22} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Create Fixed Task</Text>
            <Text style={styles.headerSubtitle}>Month: {selectedMonthKey}</Text>
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

          <Input
            label="Task / Payment Title *"
            placeholder="e.g. Office Rent or Internet Bill"
            value={title}
            onChangeText={setTitle}
          />

          <Input
            label="Required Amount (₹) *"
            placeholder="e.g. 20000"
            keyboardType="numeric"
            value={amountStr}
            onChangeText={setAmountStr}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Input
            label="Due Date (YYYY-MM-DD) *"
            placeholder="e.g. 2026-10-15"
            value={dueDate}
            onChangeText={setDueDate}
            helperText="Tasks become eligible in due date priority order as income is recorded."
            containerStyle={{ marginTop: SPACING.md }}
          />

          {/* Category Chips */}
          <View style={styles.categorySection}>
            <Text style={styles.categoryLabel}>Expense Category</Text>
            <View style={styles.categoryChipsRow}>
              {TASK_CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Input
            label="Description / Vendor Details (Optional)"
            placeholder="e.g. Landlord account details or invoice number"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            containerStyle={{ marginTop: SPACING.md }}
          />

          <Button
            title="Create Task"
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
    backgroundColor: COLORS.primaryLight,
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
  categorySection: {
    marginTop: SPACING.md,
  },
  categoryLabel: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
});
