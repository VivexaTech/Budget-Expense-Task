import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowDownLeft,
  X,
  Calendar,
  Phone,
  Briefcase,
  User,
  Info,
  CheckCircle2,
  Building2,
  Search,
  ChevronDown,
  Tag,
  Percent,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { BillingPreference, Client, CreateIncomeTaskSchema } from '@/types';
import { createIncomeTask } from '@/services/incomeTaskService';
import { subscribeToClients } from '@/services/clientService';
import { calculateDiscount } from '@/utils/gstCalculator';
import { formatCurrency } from '@/utils/formatters';

export default function CreateIncomeTaskScreen() {
  const router = useRouter();
  const { user, selectedMonthKey } = useAuth();

  // Existing clients
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Form states
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [projectName, setProjectName] = useState('');

  // Financials & Discounts
  const [originalAmountStr, setOriginalAmountStr] = useState('');
  const [discountType, setDiscountType] = useState<'NONE' | 'FIXED' | 'PERCENTAGE'>('NONE');
  const [discountValueStr, setDiscountValueStr] = useState('');

  // Invoice preference
  const [invoicePreference, setInvoicePreference] = useState<BillingPreference>('ASK_EVERY_TIME');

  // Dates
  const todayStr = new Date().toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState(`${selectedMonthKey}-15`);
  const [reminderDate, setReminderDate] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToClients(user, (data) => {
      setClients(data);
    });
    return () => unsub();
  }, [user]);

  // Discount calculation
  const originalAmountNum = parseFloat(originalAmountStr.replace(/[^0-9.]/g, '')) || 0;
  const discountValNum = parseFloat(discountValueStr.replace(/[^0-9.]/g, '')) || 0;

  const discountCalculation = calculateDiscount({
    originalAmount: originalAmountNum,
    discountType,
    discountValue: discountValNum,
  });

  const finalReceivableAmount = discountCalculation.finalAmount;

  const handleSelectClient = (c: Client) => {
    setSelectedClientId(c.id);
    setClientName(c.clientName);
    setClientPhone(c.mobileNumber);
    setInvoicePreference(c.billingPreference);
    setShowClientModal(false);
    setClientSearchQuery('');
  };

  const handleClearClientSelection = () => {
    setSelectedClientId(null);
    setClientName('');
    setClientPhone('');
    setInvoicePreference('ASK_EVERY_TIME');
  };

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

  const filteredClients = clients.filter((c) => {
    const q = clientSearchQuery.toLowerCase();
    return (
      c.clientName.toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      c.mobileNumber.includes(q)
    );
  });

  const handleSubmit = () => {
    if (!user) return;
    setErrorMessage(null);

    if (finalReceivableAmount <= 0) {
      setErrorMessage('Total expected billable amount must be greater than zero.');
      return;
    }

    const validation = CreateIncomeTaskSchema.safeParse({
      clientName: clientName.trim(),
      clientPhone: clientPhone || undefined,
      projectName: projectName.trim(),
      expectedAmount: finalReceivableAmount,
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
      `Client: ${clientName.trim()}\nProject: ${projectName.trim()}\nBillable Amount: ${formatCurrency(finalReceivableAmount)}${discountCalculation.discountAmount > 0 ? ` (After ${formatCurrency(discountCalculation.discountAmount)} discount)` : ''}\nDue Date: ${dueDate}\n\nNote: This task tracks expected receivable income. It will NOT affect your company cash balance until actual payments are recorded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Task',
          onPress: async () => {
            setLoading(true);
            try {
              await createIncomeTask(
                {
                  clientId: selectedClientId || undefined,
                  clientName: clientName.trim(),
                  clientPhone: clientPhone.trim() || undefined,
                  projectName: projectName.trim(),
                  originalAmount: originalAmountNum > 0 ? originalAmountNum : finalReceivableAmount,
                  discountType: discountType !== 'NONE' ? discountType : undefined,
                  discountValue: discountValNum > 0 ? discountValNum : undefined,
                  discountAmount: discountCalculation.discountAmount,
                  expectedAmount: finalReceivableAmount,
                  dueDate,
                  reminderDate: reminderDate || undefined,
                  notes,
                  monthKey: selectedMonthKey,
                  invoicePreference,
                },
                user
              );

              Alert.alert(
                'Collection Task Created',
                `Income collection task for "${clientName}" (${formatCurrency(finalReceivableAmount)}) scheduled for ${dueDate}.`,
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

          {/* SECTION 1: CLIENT DETAILS */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Client & Organization</Text>
              {clients.length > 0 && (
                <TouchableOpacity
                  style={styles.chooseClientBtn}
                  onPress={() => setShowClientModal(true)}
                >
                  <User size={13} color={COLORS.primary} />
                  <Text style={styles.chooseClientText}>
                    {selectedClientId ? 'Change Client' : 'Select Client'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedClientId ? (
              <View style={styles.selectedClientCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedClientName}>{clientName}</Text>
                  {clientPhone ? <Text style={styles.selectedClientPhone}>{clientPhone}</Text> : null}
                </View>
                <TouchableOpacity onPress={handleClearClientSelection}>
                  <X size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
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
              </>
            )}

            <Input
              label="Project / Service Name *"
              placeholder="e.g. Website Development Milestone 1"
              value={projectName}
              onChangeText={setProjectName}
              containerStyle={{ marginTop: SPACING.md }}
            />
          </View>

          {/* SECTION 2: FINANCIALS & DISCOUNT */}
          <View style={styles.formSection}>
            <Text style={styles.sectionHeading}>Pricing & Discounts</Text>

            <Input
              label="Original Amount (₹) *"
              placeholder="e.g. 40000"
              keyboardType="numeric"
              value={originalAmountStr}
              onChangeText={setOriginalAmountStr}
            />

            {/* Discount Type Selector */}
            <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Discount Type</Text>
            <View style={styles.discountRow}>
              {[
                { label: 'No Discount', val: 'NONE' },
                { label: '₹ Fixed Off', val: 'FIXED' },
                { label: '% Percentage', val: 'PERCENTAGE' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.val}
                  style={[
                    styles.discountChip,
                    discountType === item.val && styles.discountChipActive,
                  ]}
                  onPress={() => setDiscountType(item.val as any)}
                >
                  <Text
                    style={[
                      styles.discountChipText,
                      discountType === item.val && styles.discountChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {discountType !== 'NONE' && (
              <Input
                label={discountType === 'FIXED' ? 'Discount Amount (₹)' : 'Discount Percentage (%)'}
                placeholder={discountType === 'FIXED' ? 'e.g. 2000' : 'e.g. 10'}
                keyboardType="numeric"
                value={discountValueStr}
                onChangeText={setDiscountValueStr}
                containerStyle={{ marginTop: SPACING.sm }}
              />
            )}

            {/* Live Calculation Preview Card */}
            {originalAmountNum > 0 && (
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Original Quote:</Text>
                  <Text style={styles.previewVal}>{formatCurrency(originalAmountNum)}</Text>
                </View>

                {discountCalculation.discountAmount > 0 && (
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: COLORS.success }]}>Discount Applied:</Text>
                    <Text style={[styles.previewVal, { color: COLORS.success }]}>
                      -{formatCurrency(discountCalculation.discountAmount)}
                    </Text>
                  </View>
                )}

                <View style={[styles.previewRow, styles.previewRowTotal]}>
                  <Text style={styles.previewTotalLabel}>Final Billable Amount:</Text>
                  <Text style={styles.previewTotalVal}>{formatCurrency(finalReceivableAmount)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* SECTION 3: INVOICE PREFERENCE */}
          <View style={styles.formSection}>
            <Text style={styles.sectionHeading}>Invoice Requirement</Text>
            <View style={styles.prefGrid}>
              {[
                { label: 'GST Invoice Required', val: 'INVOICE_REQUIRED' },
                { label: 'No Invoice Required', val: 'INVOICE_NOT_REQUIRED' },
                { label: 'Ask When Settled', val: 'ASK_EVERY_TIME' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.val}
                  style={[
                    styles.prefBtn,
                    invoicePreference === item.val && styles.prefBtnActive,
                  ]}
                  onPress={() => setInvoicePreference(item.val as BillingPreference)}
                >
                  <Text
                    style={[
                      styles.prefBtnText,
                      invoicePreference === item.val && styles.prefBtnTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* SECTION 4: SCHEDULE & DATES */}
          <View style={styles.formSection}>
            <Text style={styles.sectionHeading}>Schedule & Deadlines</Text>

            <Input
              label="Payment Due Date (YYYY-MM-DD) *"
              placeholder="e.g. 2026-10-18"
              value={dueDate}
              onChangeText={setDueDate}
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
              placeholder="e.g. 50% advance received, balance on delivery"
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
            title={loading ? 'Creating Task...' : 'Create Collection Task'}
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Client Picker Modal */}
      <Modal visible={showClientModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client Account</Text>
              <TouchableOpacity onPress={() => setShowClientModal(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBar}>
              <Search size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search clients..."
                value={clientSearchQuery}
                onChangeText={setClientSearchQuery}
              />
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {filteredClients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.clientPickItem}
                  onPress={() => handleSelectClient(c)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientPickName}>{c.clientName}</Text>
                    {c.companyName ? (
                      <Text style={styles.clientPickCompany}>{c.companyName}</Text>
                    ) : null}
                    <Text style={styles.clientPickPhone}>{c.mobileNumber} • {c.state}</Text>
                  </View>
                  {selectedClientId === c.id && (
                    <CheckCircle2 size={18} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.successLight + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error,
    fontWeight: '500',
  },
  identityCard: {
    backgroundColor: '#ffffff',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identityLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  identityValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  formSection: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionHeading: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  chooseClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  chooseClientText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  selectedClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: SPACING.xs,
  },
  selectedClientName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  selectedClientPhone: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  discountRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  discountChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#eff6ff',
  },
  discountChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  discountChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  previewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  previewVal: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  previewRowTotal: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  previewTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  previewTotalVal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  prefGrid: {
    gap: SPACING.xs,
    marginTop: 4,
  },
  prefBtn: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  prefBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#eff6ff',
  },
  prefBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  prefBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    flexWrap: 'wrap',
  },
  quickDateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.sm,
  },
  quickDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  infoBoxText: {
    fontSize: 11,
    color: '#1d4ed8',
    lineHeight: 16,
    flex: 1,
  },
  submitBtn: {
    marginBottom: SPACING.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height: 40,
    marginVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  clientPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  clientPickName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  clientPickCompany: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  clientPickPhone: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
