import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Repeat, ChevronLeft, Plus, Play, Calendar } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { RecurringTaskTemplate, RecurringTemplateSchema } from '@/types';
import {
  subscribeToRecurringTemplates,
  createRecurringTemplate,
  generateRecurringTasksForMonth,
} from '@/services/taskService';
import { formatCurrency, formatMonthName } from '@/utils/formatters';

export default function RecurringTasksScreen() {
  const router = useRouter();
  const { user, isAdmin, selectedMonthKey } = useAuth();

  const [templates, setTemplates] = useState<RecurringTaskTemplate[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDayStr, setDueDayStr] = useState('5');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const unsub = subscribeToRecurringTemplates(setTemplates);
    return () => unsub();
  }, []);

  const handleCreateTemplate = async () => {
    if (!user || !isAdmin) return;

    const amountNum = parseFloat(amountStr) || 0;
    const dueDay = parseInt(dueDayStr, 10) || 5;

    const validation = RecurringTemplateSchema.safeParse({
      title,
      amount: amountNum,
      dueDayOfMonth: dueDay,
      description: description || undefined,
    });

    if (!validation.success) {
      Alert.alert('Validation Error', validation.error.issues[0]?.message);
      return;
    }

    setLoading(true);
    try {
      await createRecurringTemplate(
        {
          title,
          amount: amountNum,
          dueDayOfMonth: dueDay,
          description,
        },
        user
      );
      setTitle('');
      setAmountStr('');
      setDescription('');
      setShowAddForm(false);
      Alert.alert('Template Saved', `Recurring task template "${title}" added.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerRun = async () => {
    setGenerating(true);
    try {
      const res = await generateRecurringTasksForMonth(selectedMonthKey);
      if (res.success) {
        Alert.alert(
          'Generation Complete',
          res.data?.message || `Tasks generated for ${formatMonthName(selectedMonthKey)}.`
        );
      } else {
        Alert.alert('Error', res.error || 'Failed to generate recurring tasks.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Recurring Monthly Tasks</Text>
          <Text style={styles.headerSubtitle}>Automated payment templates</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAddForm(!showAddForm)}
          style={styles.addBtn}
        >
          <Plus size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Trigger Generation Banner */}
        <Card variant="elevated" style={styles.triggerCard}>
          <View style={styles.triggerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.triggerTitle}>
                Generate for {formatMonthName(selectedMonthKey)}
              </Text>
              <Text style={styles.triggerSub}>
                Idempotently creates any missing recurring tasks for this month.
              </Text>
            </View>
            <Button
              title="Run Now"
              size="sm"
              variant="primary"
              loading={generating}
              onPress={handleTriggerRun}
              icon={<Play size={14} color={COLORS.surface} style={{ marginRight: 4 }} />}
            />
          </View>
        </Card>

        {/* Add Template Modal / Collapsible Form */}
        {showAddForm && (
          <Card variant="outlined" style={styles.formCard}>
            <Text style={styles.formTitle}>New Recurring Expense Template</Text>
            <Input
              label="Template Title *"
              placeholder="e.g. Office Rent"
              value={title}
              onChangeText={setTitle}
            />
            <Input
              label="Amount (₹) *"
              placeholder="e.g. 20000"
              keyboardType="numeric"
              value={amountStr}
              onChangeText={setAmountStr}
              containerStyle={{ marginTop: SPACING.sm }}
            />
            <Input
              label="Due Day of Month (1 - 28) *"
              placeholder="e.g. 5"
              keyboardType="numeric"
              value={dueDayStr}
              onChangeText={setDueDayStr}
              containerStyle={{ marginTop: SPACING.sm }}
            />
            <Input
              label="Description (Optional)"
              placeholder="e.g. Landlord account IMPS transfer"
              value={description}
              onChangeText={setDescription}
              containerStyle={{ marginTop: SPACING.sm }}
            />
            <View style={styles.formActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setShowAddForm(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Template"
                variant="primary"
                size="sm"
                loading={loading}
                onPress={handleCreateTemplate}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Active Recurring Templates ({templates.length})</Text>

        {templates.length === 0 ? (
          <EmptyState
            icon={<Repeat size={48} color={COLORS.textTertiary} />}
            title="No Recurring Templates"
            description="Add templates for expenses that recur every month such as rent, software, and utility bills."
            actionTitle="Add First Template"
            onActionPress={() => setShowAddForm(true)}
          />
        ) : (
          templates.map((tpl) => (
            <Card key={tpl.id} variant="outlined" style={styles.templateCard}>
              <View style={styles.templateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateTitle}>{tpl.title}</Text>
                  <Text style={styles.templateDay}>
                    Due on the {tpl.dueDayOfMonth}th of every month
                  </Text>
                  {tpl.description ? (
                    <Text style={styles.templateDesc}>{tpl.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.templateAmount}>{formatCurrency(tpl.amount)}</Text>
              </View>
            </Card>
          ))
        )}

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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  triggerCard: {
    padding: SPACING.lg,
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.lg,
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  triggerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
  },
  triggerSub: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  formCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  formTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  formActionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  templateCard: {
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  templateTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  templateDay: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  templateDesc: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  templateAmount: {
    ...TYPOGRAPHY.amountLarge,
    color: COLORS.textPrimary,
  },
});
