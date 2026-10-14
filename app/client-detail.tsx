import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Edit2,
  Archive,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Briefcase,
  FileText,
  DollarSign,
  Clock,
  AlertCircle,
  Plus,
  Share2,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatReadableDate } from '@/utils/formatters';
import { Client, ClientMetrics, IncomeTask, Invoice } from '@/types';
import {
  getClient,
  toggleClientStatus,
  calculateClientMetrics,
  getClientTasks,
} from '@/services/clientService';
import {
  getInvoicesForClient,
  generateAndShareInvoicePdf,
} from '@/services/invoiceService';
import { PinVerificationModal } from '@/components/PinVerificationModal';

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
  const [tasks, setTasks] = useState<IncomeTask[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Active sub-tab: 'TASKS' | 'INVOICES'
  const [activeTab, setActiveTab] = useState<'TASKS' | 'INVOICES'>('TASKS');

  // PIN verification modal state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedTaskForInvoice, setSelectedTaskForInvoice] = useState<IncomeTask | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      const [clientData, metricsData, tasksData, invoicesData] = await Promise.all([
        getClient(id),
        calculateClientMetrics(id),
        getClientTasks(id),
        getInvoicesForClient(id),
      ]);
      setClient(clientData);
      setMetrics(metricsData);
      setTasks(tasksData);
      setInvoices(invoicesData);
    } catch (err) {
      console.error('[ClientDetail] loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleToggleStatus = () => {
    if (!client || !user) return;
    const newStatus = client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'Activate' : 'Archive';

    Alert.alert(
      `${actionLabel} Client`,
      `Are you sure you want to ${actionLabel.toLowerCase()} "${client.clientName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          style: newStatus === 'INACTIVE' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await toggleClientStatus(client.id, newStatus, user);
              setClient((prev) => (prev ? { ...prev, status: newStatus } : null));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update client status.');
            }
          },
        },
      ]
    );
  };

  const handleSharePdf = async (invoice: Invoice) => {
    try {
      await generateAndShareInvoicePdf(invoice);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to share PDF.');
    }
  };

  if (loading || !client) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading client profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isInactive = client.status === 'INACTIVE';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {client.clientName}
          </Text>
          <Text style={styles.headerSubtitle}>
            {client.companyName || 'Client Profile'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/create-client', params: { id: client.id } })}
          style={styles.iconBtn}
        >
          <Edit2 size={18} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleToggleStatus} style={styles.iconBtn}>
          <Archive size={18} color={isInactive ? COLORS.success : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <User size={28} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.clientTitle}>{client.clientName}</Text>
                {isInactive ? (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Archived</Text>
                  </View>
                ) : (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </View>
              {client.companyName ? (
                <Text style={styles.companySub}>{client.companyName}</Text>
              ) : null}
              {client.contactPerson ? (
                <Text style={styles.contactSub}>Attn: {client.contactPerson}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Contact Details */}
          <View style={styles.metaGrid}>
            <TouchableOpacity
              style={styles.metaItem}
              onPress={() => Linking.openURL(`tel:${client.mobileNumber}`).catch(() => {})}
            >
              <Phone size={15} color={COLORS.primary} />
              <Text style={styles.phoneLink}>{client.mobileNumber}</Text>
            </TouchableOpacity>

            {client.email ? (
              <TouchableOpacity
                style={styles.metaItem}
                onPress={() => Linking.openURL(`mailto:${client.email}`).catch(() => {})}
              >
                <Mail size={15} color={COLORS.textSecondary} />
                <Text style={styles.emailText} numberOfLines={1}>{client.email}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.metaItem}>
              <MapPin size={15} color={COLORS.textSecondary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {client.billingAddress ? `${client.billingAddress}, ` : ''}
                {client.city ? `${client.city}, ` : ''}
                {client.state}
                {client.pincode ? ` - ${client.pincode}` : ''}
              </Text>
            </View>

            {client.gstin ? (
              <View style={styles.gstinBadge}>
                <Text style={styles.gstinText}>GSTIN: {client.gstin}</Text>
              </View>
            ) : null}
          </View>

          {/* Assignment & Preference */}
          <View style={styles.assignmentRow}>
            <View style={styles.assignPill}>
              <Briefcase size={12} color="#1d4ed8" />
              <Text style={styles.assignPillText}>
                Assigned: {client.assignedEmployeeName}
              </Text>
            </View>
            <View style={styles.prefPill}>
              <Text style={styles.prefPillText}>
                {client.billingPreference === 'INVOICE_REQUIRED'
                  ? 'GST Invoice Required'
                  : client.billingPreference === 'INVOICE_NOT_REQUIRED'
                  ? 'No Invoice Required'
                  : 'Ask Every Time'}
              </Text>
            </View>
          </View>

          {client.clientNotes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>Client Notes:</Text>
              <Text style={styles.notesText}>{client.clientNotes}</Text>
            </View>
          ) : null}
        </View>

        {/* Business Metrics Grid */}
        {metrics && (
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Business</Text>
              <Text style={styles.metricVal}>
                {formatCurrency(metrics.totalBusinessValue)}
              </Text>
              <Text style={styles.metricSub}>{metrics.totalTasksCount} collections</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Collected</Text>
              <Text style={[styles.metricVal, { color: COLORS.success }]}>
                {formatCurrency(metrics.totalAmountCollected)}
              </Text>
              <Text style={styles.metricSub}>{metrics.paidTasksCount} settled</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Outstanding</Text>
              <Text
                style={[
                  styles.metricVal,
                  { color: metrics.totalOutstandingAmount > 0 ? COLORS.error : COLORS.textPrimary },
                ]}
              >
                {formatCurrency(metrics.totalOutstandingAmount)}
              </Text>
              <Text style={styles.metricSub}>
                {metrics.partiallyPaidTasksCount + metrics.pendingTasksCount} pending
              </Text>
            </View>
          </View>
        )}

        {/* Action Button: Create Task for this client */}
        <TouchableOpacity
          style={styles.createTaskBtn}
          onPress={() => router.push('/create-income-task')}
        >
          <Plus size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.createTaskBtnText}>New Collection Task for {client.clientName}</Text>
        </TouchableOpacity>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'TASKS' && styles.tabBtnActive]}
            onPress={() => setActiveTab('TASKS')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'TASKS' && styles.tabBtnTextActive]}>
              Collections ({tasks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'INVOICES' && styles.tabBtnActive]}
            onPress={() => setActiveTab('INVOICES')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'INVOICES' && styles.tabBtnTextActive]}>
              Invoices ({invoices.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Tasks / Collections */}
        {activeTab === 'TASKS' && (
          <View style={styles.tabContent}>
            {tasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Clock size={32} color={COLORS.border} />
                <Text style={styles.emptyCardText}>No collections recorded yet</Text>
              </View>
            ) : (
              tasks.map((t) => {
                const isTaskSettled = t.status === 'COMPLETED';
                const hasInvoice = !!t.invoiceId;

                return (
                  <View key={t.id} style={styles.taskCard}>
                    <View style={styles.taskHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskTitle}>{t.projectName}</Text>
                        <Text style={styles.taskMeta}>Due: {t.dueDate} • Month: {t.monthKey}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          isTaskSettled ? styles.statusSettled : styles.statusPending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: isTaskSettled ? COLORS.success : COLORS.warningDark },
                          ]}
                        >
                          {isTaskSettled ? 'SETTLED' : t.status === 'PARTIALLY_PAID' ? 'PARTIAL' : 'PENDING'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.amountRow}>
                      <View>
                        <Text style={styles.amountLabel}>Expected</Text>
                        <Text style={styles.amountVal}>{formatCurrency(t.expectedAmount)}</Text>
                      </View>
                      <View>
                        <Text style={styles.amountLabel}>Received</Text>
                        <Text style={[styles.amountVal, { color: COLORS.success }]}>
                          {formatCurrency(t.receivedAmount)}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.amountLabel}>Balance</Text>
                        <Text
                          style={[
                            styles.amountVal,
                            { color: t.remainingAmount > 0 ? COLORS.error : COLORS.textSecondary },
                          ]}
                        >
                          {formatCurrency(t.remainingAmount)}
                        </Text>
                      </View>
                    </View>

                    {/* Invoice Action Bar */}
                    {isTaskSettled && (
                      <View style={styles.invoiceActionRow}>
                        {hasInvoice ? (
                          <View style={styles.hasInvoiceBox}>
                            <View style={styles.invoiceNumBadge}>
                              <FileText size={12} color="#065f46" />
                              <Text style={styles.invoiceNumText}>{t.invoiceNumber}</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.shareInvoiceBtn}
                              onPress={async () => {
                                const inv = invoices.find((i) => i.id === t.invoiceId);
                                if (inv) {
                                  handleSharePdf(inv);
                                } else {
                                  Alert.alert('Info', `Invoice ${t.invoiceNumber} is generated.`);
                                }
                              }}
                            >
                              <Share2 size={13} color={COLORS.primary} />
                              <Text style={styles.shareInvoiceText}>View PDF</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.generateInvoiceBtn}
                            onPress={() => {
                              setSelectedTaskForInvoice(t);
                              setPinModalVisible(true);
                            }}
                          >
                            <FileText size={14} color="#ffffff" style={{ marginRight: 4 }} />
                            <Text style={styles.generateInvoiceBtnText}>Generate Invoice</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Tab 2: Invoices */}
        {activeTab === 'INVOICES' && (
          <View style={styles.tabContent}>
            {invoices.length === 0 ? (
              <View style={styles.emptyCard}>
                <FileText size={32} color={COLORS.border} />
                <Text style={styles.emptyCardText}>No invoices generated for this client yet</Text>
              </View>
            ) : (
              invoices.map((inv) => (
                <View key={inv.id} style={styles.invoiceCard}>
                  <View style={styles.invoiceCardHeader}>
                    <View>
                      <View style={styles.invBadgeRow}>
                        <View
                          style={[
                            styles.typeBadge,
                            inv.invoiceType === 'GST' ? styles.typeGst : styles.typeNonGst,
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              inv.invoiceType === 'GST' ? styles.typeGstText : styles.typeNonGstText,
                            ]}
                          >
                            {inv.invoiceType === 'GST' ? 'GST INVOICE' : 'NON-GST'}
                          </Text>
                        </View>
                        <Text style={styles.invoiceNumTitle}>{inv.invoiceNumber}</Text>
                      </View>
                      <Text style={styles.invoiceDateText}>Date: {inv.invoiceDate}</Text>
                    </View>

                    <Text style={styles.invoiceAmountText}>
                      {formatCurrency(inv.totalInvoiceAmount)}
                    </Text>
                  </View>

                  <View style={styles.invoiceDivider} />

                  <View style={styles.invoiceBottomRow}>
                    <Text style={styles.serviceText} numberOfLines={1}>
                      {inv.serviceName}
                    </Text>
                    <TouchableOpacity
                      style={styles.downloadPdfBtn}
                      onPress={() => handleSharePdf(inv)}
                    >
                      <Share2 size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.downloadPdfText}>Share / PDF</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* PIN Verification Modal */}
      {selectedTaskForInvoice && (
        <PinVerificationModal
          visible={pinModalVisible}
          taskId={selectedTaskForInvoice.id}
          taskTitle={selectedTaskForInvoice.projectName}
          clientName={client.clientName}
          amount={selectedTaskForInvoice.expectedAmount}
          onClose={() => {
            setPinModalVisible(false);
            setSelectedTaskForInvoice(null);
          }}
          onSuccess={async (invoice) => {
            setPinModalVisible(false);
            setSelectedTaskForInvoice(null);
            loadData();
            Alert.alert(
              'Invoice Generated!',
              `Invoice ${invoice.invoiceNumber} has been generated successfully.`,
              [
                { text: 'Close', style: 'cancel' },
                {
                  text: 'Share / View PDF',
                  onPress: () => handleSharePdf(invoice),
                },
              ]
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: SPACING.xs,
    marginRight: SPACING.xs,
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
  iconBtn: {
    padding: SPACING.xs,
    marginLeft: 4,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  clientTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  companySub: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  contactSub: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  activeBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  inactiveBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: SPACING.sm,
  },
  metaGrid: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneLink: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emailText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text,
  },
  addressText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    flex: 1,
  },
  gstinBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 2,
  },
  gstinText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  assignmentRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  assignPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  assignPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  prefPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  prefPillText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#cbd5e1',
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  notesText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: 2,
  },
  metricSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  createTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  createTaskBtnText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: '#ffffff',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: COLORS.primary,
  },
  tabBtnText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabContent: {
    gap: SPACING.sm,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCardText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  taskMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusSettled: {
    backgroundColor: '#ecfdf5',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  amountLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  amountVal: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  invoiceActionRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  hasInvoiceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceNumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  invoiceNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  shareInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  shareInvoiceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  generateInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  generateInvoiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  invoiceCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  invoiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeGst: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  typeNonGst: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  typeGstText: {
    color: '#065f46',
  },
  typeNonGstText: {
    color: '#475569',
  },
  invoiceNumTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  invoiceDateText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  invoiceAmountText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '800',
    color: COLORS.text,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: SPACING.xs,
  },
  invoiceBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
  },
  downloadPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  downloadPdfText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
});
