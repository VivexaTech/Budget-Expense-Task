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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronDown,
  Briefcase,
  X,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { BillingPreference, Client, ClientCreateSchema, UserProfile } from '@/types';
import { INDIAN_STATES, IndianState } from '@/constants/states';
import {
  createClient,
  updateClient,
  getClient,
  searchDuplicateClients,
} from '@/services/clientService';
import { subscribeToEmployees } from '@/services/authService';

export default function CreateClientScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const { user } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);

  // Form Fields
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [billingPreference, setBillingPreference] = useState<BillingPreference>('ASK_EVERY_TIME');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(user?.employeeId || '');
  const [assignedEmployeeName, setAssignedEmployeeName] = useState(user?.displayName || '');

  // Modals & UI states
  const [showStateModal, setShowStateModal] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Subscribe to employees list
  useEffect(() => {
    const unsub = subscribeToEmployees((empList) => {
      setEmployees(empList);
    });
    return () => unsub();
  }, []);

  // Fetch client if editing
  useEffect(() => {
    if (isEditing && id) {
      getClient(id).then((client) => {
        if (client) {
          setClientName(client.clientName);
          setCompanyName(client.companyName || '');
          setContactPerson(client.contactPerson || '');
          setMobileNumber(client.mobileNumber);
          setEmail(client.email || '');
          setBillingAddress(client.billingAddress || '');
          setCity(client.city || '');
          setState(client.state || 'Maharashtra');
          setPincode(client.pincode || '');
          setGstin(client.gstin || '');
          setClientNotes(client.clientNotes || '');
          setBillingPreference(client.billingPreference);
          setAssignedEmployeeId(client.assignedEmployeeId);
          setAssignedEmployeeName(client.assignedEmployeeName);
        }
        setInitialLoading(false);
      });
    }
  }, [id, isEditing]);

  // Real-time duplicate check when name or mobile changes
  const checkDuplicate = async (nameVal: string, phoneVal: string) => {
    if (!nameVal.trim() && phoneVal.trim().length < 10) {
      setDuplicateWarning(null);
      return;
    }
    const result = await searchDuplicateClients(nameVal, phoneVal, id);
    if (result.matchedClients.length > 0) {
      const match = result.matchedClients[0];
      setDuplicateWarning(
        `Potential match: "${match.clientName}" (${match.mobileNumber})${match.companyName ? ` • ${match.companyName}` : ''}.`
      );
    } else {
      setDuplicateWarning(null);
    }
  };

  const filteredStates = INDIAN_STATES.filter((s) =>
    s.name.toLowerCase().includes(stateSearchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!user) return;
    setErrorMessage(null);

    const cleanMobile = mobileNumber.replace(/\D/g, '');
    const cleanGstin = gstin.trim().toUpperCase();

    // Zod validation
    const validation = ClientCreateSchema.safeParse({
      clientName: clientName.trim(),
      companyName: companyName.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      mobileNumber: cleanMobile,
      email: email.trim() || undefined,
      billingAddress: billingAddress.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim(),
      pincode: pincode.trim() || undefined,
      gstin: cleanGstin || undefined,
      clientNotes: clientNotes.trim() || undefined,
      billingPreference,
      assignedEmployeeId,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || 'Please check input fields.');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && id) {
        await updateClient(
          id,
          {
            clientName: clientName.trim(),
            companyName: companyName.trim() || undefined,
            contactPerson: contactPerson.trim() || undefined,
            mobileNumber: cleanMobile,
            email: email.trim() || undefined,
            billingAddress: billingAddress.trim() || undefined,
            city: city.trim() || undefined,
            state: state.trim(),
            pincode: pincode.trim() || undefined,
            gstin: cleanGstin || undefined,
            clientNotes: clientNotes.trim() || undefined,
            billingPreference,
            assignedEmployeeId,
            assignedEmployeeName,
          },
          user
        );

        Alert.alert('Client Updated', 'Client profile updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await createClient(
          {
            clientName: clientName.trim(),
            companyName: companyName.trim() || undefined,
            contactPerson: contactPerson.trim() || undefined,
            mobileNumber: cleanMobile,
            email: email.trim() || undefined,
            billingAddress: billingAddress.trim() || undefined,
            city: city.trim() || undefined,
            state: state.trim(),
            pincode: pincode.trim() || undefined,
            gstin: cleanGstin || undefined,
            clientNotes: clientNotes.trim() || undefined,
            billingPreference,
            assignedEmployeeId,
            assignedEmployeeName,
          },
          user
        );

        Alert.alert('Client Created', 'Client profile created successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save client.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading client details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Client' : 'New Client Profile'}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {duplicateWarning && (
            <View style={styles.warningBox}>
              <AlertCircle size={16} color="#d97706" />
              <Text style={styles.warningText}>{duplicateWarning}</Text>
            </View>
          )}

          {/* SECTION 1: BASIC DETAILS */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Basic Client Information</Text>

            <Input
              label="Client / Individual Name *"
              placeholder="e.g. Rahul Sharma"
              value={clientName}
              onChangeText={(val) => {
                setClientName(val);
                checkDuplicate(val, mobileNumber);
              }}
              leftIcon={<User size={18} color={COLORS.textSecondary} />}
            />

            <Input
              label="Company / Firm Name (Optional)"
              placeholder="e.g. Apex Enterprises"
              value={companyName}
              onChangeText={setCompanyName}
              leftIcon={<Building2 size={18} color={COLORS.textSecondary} />}
            />

            <Input
              label="Contact Person (Optional)"
              placeholder="e.g. Amit Patil (Accounts)"
              value={contactPerson}
              onChangeText={setContactPerson}
            />

            <Input
              label="Mobile Number *"
              placeholder="10-digit mobile number"
              value={mobileNumber}
              onChangeText={(val) => {
                setMobileNumber(val);
                checkDuplicate(clientName, val);
              }}
              keyboardType="phone-pad"
              maxLength={15}
              leftIcon={<Phone size={18} color={COLORS.textSecondary} />}
            />

            <Input
              label="Email Address (Optional)"
              placeholder="e.g. client@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Mail size={18} color={COLORS.textSecondary} />}
            />
          </View>

          {/* SECTION 2: BILLING & ADDRESS */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Billing & Location (For GST Invoicing)</Text>

            {/* State Picker Button */}
            <View style={styles.pickerField}>
              <Text style={styles.fieldLabel}>State * (Place of Supply)</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowStateModal(true)}
              >
                <MapPin size={18} color={COLORS.primary} />
                <Text style={styles.pickerBtnText}>{state}</Text>
                <ChevronDown size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Input
              label="City (Optional)"
              placeholder="e.g. Mumbai, Pune, Delhi"
              value={city}
              onChangeText={setCity}
            />

            <Input
              label="Billing Address (Optional)"
              placeholder="Building, Street, Landmark"
              value={billingAddress}
              onChangeText={setBillingAddress}
              multiline
              numberOfLines={2}
            />

            <Input
              label="PIN Code (Optional)"
              placeholder="6-digit postal code"
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Input
              label="GSTIN (Optional)"
              placeholder="15-digit GST Number"
              value={gstin}
              onChangeText={(val) => setGstin(val.toUpperCase())}
              autoCapitalize="characters"
              maxLength={15}
            />
          </View>

          {/* SECTION 3: BILLING PREFERENCE & ASSIGNED EMPLOYEE */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Preferences & Assignment</Text>

            <Text style={styles.fieldLabel}>Default Billing Preference</Text>
            <View style={styles.preferenceRow}>
              {[
                { label: 'GST Invoice', val: 'INVOICE_REQUIRED' },
                { label: 'No Invoice', val: 'INVOICE_NOT_REQUIRED' },
                { label: 'Ask Every Time', val: 'ASK_EVERY_TIME' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.val}
                  style={[
                    styles.prefChip,
                    billingPreference === item.val && styles.prefChipActive,
                  ]}
                  onPress={() => setBillingPreference(item.val as BillingPreference)}
                >
                  <Text
                    style={[
                      styles.prefChipText,
                      billingPreference === item.val && styles.prefChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Assigned Employee (Admin can reassign, employee views self) */}
            <View style={[styles.pickerField, { marginTop: SPACING.md }]}>
              <Text style={styles.fieldLabel}>Assigned Employee</Text>
              {user?.role === 'admin' ? (
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowEmployeeModal(true)}
                >
                  <Briefcase size={18} color={COLORS.primary} />
                  <Text style={styles.pickerBtnText}>
                    {assignedEmployeeName} ({assignedEmployeeId})
                  </Text>
                  <ChevronDown size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ) : (
                <View style={[styles.pickerBtn, { backgroundColor: '#f1f5f9' }]}>
                  <Briefcase size={18} color={COLORS.textSecondary} />
                  <Text style={[styles.pickerBtnText, { color: COLORS.textSecondary }]}>
                    {assignedEmployeeName} (You)
                  </Text>
                </View>
              )}
            </View>

            <Input
              label="Client Notes (Optional Internal Remarks)"
              placeholder="Special instructions, reference notes..."
              value={clientNotes}
              onChangeText={setClientNotes}
              multiline
              numberOfLines={3}
              containerStyle={{ marginTop: SPACING.md }}
            />
          </View>

          <Button
            title={loading ? 'Saving Client...' : isEditing ? 'Update Client' : 'Create Client'}
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* State Selector Modal */}
      <Modal visible={showStateModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.stateSearchBar}>
              <Search size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.stateSearchInput}
                placeholder="Search state..."
                value={stateSearchQuery}
                onChangeText={setStateSearchQuery}
              />
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {filteredStates.map((s) => (
                <TouchableOpacity
                  key={s.code}
                  style={[styles.stateItem, state === s.name && styles.stateItemActive]}
                  onPress={() => {
                    setState(s.name);
                    setShowStateModal(false);
                    setStateSearchQuery('');
                  }}
                >
                  <Text
                    style={[styles.stateItemText, state === s.name && styles.stateItemTextActive]}
                  >
                    {s.name} ({s.code})
                  </Text>
                  {state === s.name && <CheckCircle2 size={16} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Employee Selector Modal (Admin Only) */}
      <Modal visible={showEmployeeModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign to Employee</Text>
              <TouchableOpacity onPress={() => setShowEmployeeModal(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {employees.map((emp) => (
                <TouchableOpacity
                  key={emp.employeeId}
                  style={[
                    styles.stateItem,
                    assignedEmployeeId === emp.employeeId && styles.stateItemActive,
                  ]}
                  onPress={() => {
                    setAssignedEmployeeId(emp.employeeId);
                    setAssignedEmployeeName(emp.displayName);
                    setShowEmployeeModal(false);
                  }}
                >
                  <View>
                    <Text
                      style={[
                        styles.stateItemText,
                        assignedEmployeeId === emp.employeeId && styles.stateItemTextActive,
                      ]}
                    >
                      {emp.displayName}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>
                      ID: {emp.employeeId} • {emp.role.toUpperCase()}
                    </Text>
                  </View>
                  {assignedEmployeeId === emp.employeeId && (
                    <CheckCircle2 size={16} color={COLORS.primary} />
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error,
    marginLeft: SPACING.xs,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  warningText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#b45309',
    marginLeft: SPACING.xs,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  pickerField: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#ffffff',
    gap: SPACING.xs,
  },
  pickerBtnText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  preferenceRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: 2,
  },
  prefChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#eff6ff',
  },
  prefChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  prefChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
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
  stateSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height: 40,
    marginVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  stateSearchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stateItemActive: {
    backgroundColor: '#eff6ff',
  },
  stateItemText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  stateItemTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
