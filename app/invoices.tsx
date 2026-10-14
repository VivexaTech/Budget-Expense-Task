import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  FileText,
  Share2,
  Settings,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  User,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Invoice, InvoiceType } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import {
  subscribeToInvoices,
  generateAndShareInvoicePdf,
} from '@/services/invoiceService';

export default function InvoicesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GST' | 'NON_GST'>('ALL');

  useEffect(() => {
    const unsub = subscribeToInvoices((data) => {
      setInvoices(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredInvoices = invoices.filter((inv) => {
    if (typeFilter !== 'ALL' && inv.invoiceType !== typeFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
      const matchClient = inv.clientBillingDetailsSnapshot.clientName.toLowerCase().includes(q);
      const matchCompany = (inv.clientBillingDetailsSnapshot.companyName || '').toLowerCase().includes(q);
      const matchService = inv.serviceName.toLowerCase().includes(q);
      return matchNum || matchClient || matchCompany || matchService;
    }

    return true;
  });

  const totalFilteredAmount = filteredInvoices.reduce(
    (sum, inv) => sum + Number(inv.totalInvoiceAmount || 0),
    0
  );

  const handleSharePdf = async (invoice: Invoice) => {
    setSharingId(invoice.id);
    try {
      await generateAndShareInvoicePdf(invoice);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate PDF.');
    } finally {
      setSharingId(null);
    }
  };

  const renderInvoiceItem = ({ item }: { item: Invoice }) => {
    const isGst = item.invoiceType === 'GST';
    const isSharing = sharingId === item.id;
    const client = item.clientBillingDetailsSnapshot;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <View style={styles.numBadgeRow}>
              <View style={[styles.badge, isGst ? styles.badgeGst : styles.badgeNonGst]}>
                <Text style={[styles.badgeText, isGst ? styles.badgeGstText : styles.badgeNonGstText]}>
                  {isGst ? 'GST INVOICE' : 'NON-GST'}
                </Text>
              </View>
              <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
            </View>
            <Text style={styles.invoiceDate}>Date: {item.invoiceDate} • Month: {item.invoiceMonth}</Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.invoiceTotal}>{formatCurrency(item.totalInvoiceAmount)}</Text>
            <View style={styles.paidPill}>
              <Text style={styles.paidPillText}>PAID</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Client & Service */}
        <View style={styles.clientSection}>
          <View style={styles.metaRow}>
            <User size={13} color={COLORS.textSecondary} />
            <Text style={styles.clientNameText} numberOfLines={1}>
              {client.clientName}{client.companyName ? ` (${client.companyName})` : ''}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <FileText size={13} color={COLORS.textSecondary} />
            <Text style={styles.serviceText} numberOfLines={1}>
              {item.serviceName}
            </Text>
          </View>
        </View>

        {/* Tax breakdown for GST */}
        {isGst && (
          <View style={styles.taxBreakdownBox}>
            <Text style={styles.taxBreakdownText}>
              Taxable: {formatCurrency(item.taxableAmount)} •{' '}
              {item.isSameStateSupply
                ? `CGST: ${formatCurrency(item.cgstAmount)} + SGST: ${formatCurrency(item.sgstAmount)}`
                : `IGST (${item.igstRate}%): ${formatCurrency(item.igstAmount)}`}
            </Text>
          </View>
        )}

        {/* Footer: Share PDF Button */}
        <View style={styles.cardFooter}>
          <Text style={styles.posText}>Place of Supply: {client.state}</Text>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => handleSharePdf(item)}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Share2 size={13} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.shareBtnText}>Share / PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Invoices Directory</Text>
          <Text style={styles.headerSubtitle}>
            {filteredInvoices.length} invoices • {formatCurrency(totalFilteredAmount)}
          </Text>
        </View>

        {user?.role === 'admin' && (
          <TouchableOpacity
            onPress={() => router.push('/invoice-settings')}
            style={styles.settingsBtn}
          >
            <Settings size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search invoice #, client, service..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.tabChip, typeFilter === 'ALL' && styles.tabChipActive]}
          onPress={() => setTypeFilter('ALL')}
        >
          <Text style={[styles.tabChipText, typeFilter === 'ALL' && styles.tabChipTextActive]}>
            All ({invoices.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, typeFilter === 'GST' && styles.tabChipActive]}
          onPress={() => setTypeFilter('GST')}
        >
          <Text style={[styles.tabChipText, typeFilter === 'GST' && styles.tabChipTextActive]}>
            GST (VTX)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, typeFilter === 'NON_GST' && styles.tabChipActive]}
          onPress={() => setTypeFilter('NON_GST')}
        >
          <Text style={[styles.tabChipText, typeFilter === 'NON_GST' && styles.tabChipTextActive]}>
            Non-GST (VTN)
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading invoices...</Text>
        </View>
      ) : filteredInvoices.length === 0 ? (
        <View style={styles.centerBox}>
          <FileText size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No Invoices Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No invoices match your search query.'
              : 'Invoices will appear here once generated from completed collection tasks.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoiceItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  settingsBtn: {
    padding: SPACING.xs,
  },
  searchSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height: 40,
    gap: SPACING.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
  },
  tabChipActive: {
    backgroundColor: COLORS.primary,
  },
  tabChipText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  numBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGst: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  badgeNonGst: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  badgeGstText: {
    color: '#065f46',
  },
  badgeNonGstText: {
    color: '#475569',
  },
  invoiceNumber: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  invoiceDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  invoiceTotal: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '800',
    color: COLORS.text,
  },
  paidPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  paidPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: SPACING.xs,
  },
  clientSection: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clientNameText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  serviceText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    flex: 1,
  },
  taxBreakdownBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: 6,
    marginTop: 6,
  },
  taxBreakdownText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  posText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});
