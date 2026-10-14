import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Search,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Filter,
  Briefcase,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Client, ClientStatus, UserProfile } from '@/types';
import { subscribeToClients } from '@/services/clientService';
import { subscribeToEmployees } from '@/services/authService';

export default function ClientsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!user) return;

    const unsubClients = subscribeToClients(user, (data) => {
      setClients(data);
      setLoading(false);
    });

    let unsubEmps = () => {};
    if (user.role === 'admin') {
      unsubEmps = subscribeToEmployees((empList) => {
        setEmployees(empList);
      });
    }

    return () => {
      unsubClients();
      unsubEmps();
    };
  }, [user]);

  const filteredClients = clients.filter((c) => {
    // Status filter
    if (statusFilter !== 'ALL' && c.status !== statusFilter) {
      return false;
    }

    // Employee filter (Admin only)
    if (
      user?.role === 'admin' &&
      selectedEmployeeFilter !== 'ALL' &&
      c.assignedEmployeeId !== selectedEmployeeFilter
    ) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.clientName.toLowerCase().includes(q);
      const matchCompany = (c.companyName || '').toLowerCase().includes(q);
      const matchPhone = (c.mobileNumber || '').includes(q);
      const matchCity = (c.city || '').toLowerCase().includes(q);
      return matchName || matchCompany || matchPhone || matchCity;
    }

    return true;
  });

  const handleCall = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {});
    }
  };

  const renderClientItem = ({ item }: { item: Client }) => {
    const isInactive = item.status === 'INACTIVE';

    return (
      <TouchableOpacity
        style={[styles.clientCard, isInactive && styles.clientCardInactive]}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/client-detail', params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <User size={20} color={COLORS.primary} />
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.clientName} numberOfLines={1}>
                {item.clientName}
              </Text>
              {isInactive && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>Archived</Text>
                </View>
              )}
            </View>
            {item.companyName ? (
              <View style={styles.metaRow}>
                <Building2 size={12} color={COLORS.textSecondary} />
                <Text style={styles.companyText} numberOfLines={1}>
                  {item.companyName}
                </Text>
              </View>
            ) : null}
          </View>
          <ChevronRight size={18} color={COLORS.textSecondary} />
        </View>

        <View style={styles.cardDivider} />

        {/* Details grid */}
        <View style={styles.detailsGrid}>
          <TouchableOpacity
            style={styles.detailItem}
            onPress={() => handleCall(item.mobileNumber)}
          >
            <Phone size={13} color={COLORS.primary} />
            <Text style={styles.phoneText}>{item.mobileNumber}</Text>
          </TouchableOpacity>

          <View style={styles.detailItem}>
            <MapPin size={13} color={COLORS.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.city ? `${item.city}, ` : ''}{item.state}
            </Text>
          </View>
        </View>

        {/* Footer info: Assigned employee & Billing Preference */}
        <View style={styles.cardFooter}>
          <View style={styles.assignedBadge}>
            <Briefcase size={12} color="#1d4ed8" />
            <Text style={styles.assignedText} numberOfLines={1}>
              {item.assignedEmployeeName || 'Assigned Agent'}
            </Text>
          </View>

          <View style={styles.preferenceBadge}>
            <Text style={styles.preferenceText}>
              {item.billingPreference === 'INVOICE_REQUIRED'
                ? 'GST Invoice'
                : item.billingPreference === 'INVOICE_NOT_REQUIRED'
                ? 'No Invoice'
                : 'Ask on Billing'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Clients Directory</Text>
          <Text style={styles.headerSubtitle}>
            {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/create-client')}
          style={styles.addBtn}
        >
          <Plus size={18} color="#ffffff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, company, mobile, city..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabChip, statusFilter === 'ACTIVE' && styles.tabChipActive]}
            onPress={() => setStatusFilter('ACTIVE')}
          >
            <Text
              style={[styles.tabChipText, statusFilter === 'ACTIVE' && styles.tabChipTextActive]}
            >
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, statusFilter === 'ALL' && styles.tabChipActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text
              style={[styles.tabChipText, statusFilter === 'ALL' && styles.tabChipTextActive]}
            >
              All Clients
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, statusFilter === 'INACTIVE' && styles.tabChipActive]}
            onPress={() => setStatusFilter('INACTIVE')}
          >
            <Text
              style={[styles.tabChipText, statusFilter === 'INACTIVE' && styles.tabChipTextActive]}
            >
              Archived
            </Text>
          </TouchableOpacity>
        </View>

        {/* Employee Filter (Admin Only) */}
        {user?.role === 'admin' && employees.length > 0 && (
          <View style={styles.employeeFilterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.empScroll}>
              <TouchableOpacity
                style={[
                  styles.empChip,
                  selectedEmployeeFilter === 'ALL' && styles.empChipActive,
                ]}
                onPress={() => setSelectedEmployeeFilter('ALL')}
              >
                <Text
                  style={[
                    styles.empChipText,
                    selectedEmployeeFilter === 'ALL' && styles.empChipTextActive,
                  ]}
                >
                  All Employees
                </Text>
              </TouchableOpacity>

              {employees.map((emp) => (
                <TouchableOpacity
                  key={emp.employeeId}
                  style={[
                    styles.empChip,
                    selectedEmployeeFilter === emp.employeeId && styles.empChipActive,
                  ]}
                  onPress={() => setSelectedEmployeeFilter(emp.employeeId)}
                >
                  <Text
                    style={[
                      styles.empChipText,
                      selectedEmployeeFilter === emp.employeeId && styles.empChipTextActive,
                    ]}
                  >
                    {emp.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading client accounts...</Text>
        </View>
      ) : filteredClients.length === 0 ? (
        <View style={styles.centerBox}>
          <User size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No Clients Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No clients matched your search query.'
              : 'Add your first client profile to manage billing and collections.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={() => router.push('/create-client')}
          >
            <Plus size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.emptyAddBtnText}>Add Client</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          renderItem={renderClientItem}
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
  headerTitleContainer: {
    flex: 1,
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addBtnText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
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
  filterSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginVertical: 4,
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
  employeeFilterRow: {
    marginTop: 6,
    paddingBottom: 4,
  },
  empScroll: {
    gap: SPACING.xs,
  },
  empChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  empChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  empChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  empChipTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  clientCard: {
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
  clientCardInactive: {
    opacity: 0.7,
    backgroundColor: '#f8fafc',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clientName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  inactiveBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  companyText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: SPACING.sm,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  phoneText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  detailText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
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
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    maxWidth: '60%',
  },
  assignedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  preferenceBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  preferenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
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
    marginBottom: SPACING.lg,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  emptyAddBtnText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },
});
