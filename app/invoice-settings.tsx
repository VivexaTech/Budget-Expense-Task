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
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  X,
  Search,
  KeyRound,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { InvoiceSettings } from '@/types';
import { INDIAN_STATES } from '@/constants/states';
import { getInvoiceSettings, updateInvoiceSettings } from '@/services/invoiceService';

export default function InvoiceSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Business profile
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [defaultGstRate, setDefaultGstRate] = useState('18');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // PIN Status & updates
  const [hasGpinConfigured, setHasGpinConfigured] = useState(false);
  const [hasNpinConfigured, setHasNpinConfigured] = useState(false);
  const [newGpin, setNewGpin] = useState('');
  const [newNpin, setNewNpin] = useState('');

  // State Modal
  const [showStateModal, setShowStateModal] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Access Denied', 'Only administrators can configure invoice settings.');
      router.back();
      return;
    }

    getInvoiceSettings().then((settings) => {
      if (settings) {
        setBusinessName(settings.businessName || '');
        setBusinessAddress(settings.businessAddress || '');
        setCity(settings.city || '');
        setState(settings.state || 'Maharashtra');
        setPincode(settings.pincode || '');
        setGstin(settings.gstin || '');
        setContactPhone(settings.contactPhone || '');
        setContactEmail(settings.contactEmail || '');
        setDefaultGstRate(String(settings.defaultGstRate !== undefined ? settings.defaultGstRate : '18'));
        setPaymentTerms(settings.paymentTerms || '');
        setInvoiceNotes(settings.invoiceNotes || '');
        setHasGpinConfigured(!!settings.hasGpinConfigured);
        setHasNpinConfigured(!!settings.hasNpinConfigured);
      }
      setLoading(false);
    });
  }, [user]);

  const filteredStates = INDIAN_STATES.filter((s) =>
    s.name.toLowerCase().includes(stateSearchQuery.toLowerCase())
  );

  const handleSave = async () => {
    if (!businessName.trim() || !businessAddress.trim() || !state.trim()) {
      setErrorMessage('Business Name, Address, and State are required.');
      return;
    }

    if (newGpin && !/^\d{6}$/.test(newGpin.trim())) {
      setErrorMessage('New GPIN must be exactly 6 numeric digits.');
      return;
    }

    if (newNpin && !/^\d{6}$/.test(newNpin.trim())) {
      setErrorMessage('New NPIN must be exactly 6 numeric digits.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        gstin: gstin.trim().toUpperCase(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        defaultGstRate: Number(defaultGstRate) || 18,
        paymentTerms: paymentTerms.trim(),
        invoiceNotes: invoiceNotes.trim(),
      };

      if (newGpin.trim()) {
        payload.gpin = newGpin.trim();
      }

      if (newNpin.trim()) {
        payload.npin = newNpin.trim();
      }

      const res = await updateInvoiceSettings(payload);
      if (res.success) {
        if (newGpin.trim()) setHasGpinConfigured(true);
        if (newNpin.trim()) setHasNpinConfigured(true);
        setNewGpin('');
        setNewNpin('');
        Alert.alert('Settings Saved', 'Invoice business profile and authorization PINs updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        setErrorMessage(res.error || 'Failed to update invoice settings.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading invoice settings...</Text>
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
        <Text style={styles.headerTitle}>Invoice Configuration</Text>
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

          {/* SECTION 1: BUSINESS IDENTITY */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Supplier Business Identity</Text>

            <Input
              label="Business / Company Name *"
              placeholder="e.g. Vivexa Technologies"
              value={businessName}
              onChangeText={setBusinessName}
              leftIcon={<Building2 size={18} color={COLORS.textSecondary} />}
            />

            <Input
              label="Business Address *"
              placeholder="Full registered office address"
              value={businessAddress}
              onChangeText={setBusinessAddress}
              multiline
              numberOfLines={2}
            />

            <View style={styles.pickerField}>
              <Text style={styles.fieldLabel}>State * (Supplier Place of Supply)</Text>
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
              label="City"
              placeholder="e.g. Mumbai"
              value={city}
              onChangeText={setCity}
            />

            <Input
              label="PIN Code"
              placeholder="e.g. 400001"
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Input
              label="GSTIN (15 Digits)"
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={gstin}
              onChangeText={(val) => setGstin(val.toUpperCase())}
              autoCapitalize="characters"
              maxLength={15}
            />

            <Input
              label="Contact Phone"
              placeholder="e.g. +91 9876543210"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              leftIcon={<Phone size={18} color={COLORS.textSecondary} />}
            />

            <Input
              label="Contact Email"
              placeholder="e.g. billing@vivexa.com"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Mail size={18} color={COLORS.textSecondary} />}
            />
          </View>

          {/* SECTION 2: TAX & TERMS */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Tax & Terms</Text>

            <Input
              label="Default GST Rate (%)"
              placeholder="18"
              value={defaultGstRate}
              onChangeText={setDefaultGstRate}
              keyboardType="number-pad"
            />

            <Input
              label="Payment Terms"
              placeholder="e.g. Payment due upon receipt of invoice."
              value={paymentTerms}
              onChangeText={setPaymentTerms}
            />

            <Input
              label="Invoice Notes / Footer Text"
              placeholder="e.g. Thank you for your business."
              value={invoiceNotes}
              onChangeText={setInvoiceNotes}
            />
          </View>

          {/* SECTION 3: TWO-PIN AUTHORIZATION SETUP */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ShieldCheck size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Two-PIN Authorization Security</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Two separate 6-digit PINs authorize invoice generation and strictly determine the invoice type:
            </Text>

            {/* GPIN */}
            <View style={styles.pinConfigBox}>
              <View style={styles.pinConfigHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinConfigTitle}>GPIN (GST Tax Invoice)</Text>
                  <Text style={styles.pinConfigDesc}>
                    Generates Tax Invoice (VTX-YYYY-MM-NNN) with intra/inter-state tax breakdown.
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    hasGpinConfigured ? styles.statusPillActive : styles.statusPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      hasGpinConfigured ? styles.statusPillTextActive : styles.statusPillTextInactive,
                    ]}
                  >
                    {hasGpinConfigured ? 'Active' : 'Unconfigured'}
                  </Text>
                </View>
              </View>

              <Input
                label={hasGpinConfigured ? 'Change GPIN (Enter 6 digits)' : 'Set GPIN (Enter 6 digits)'}
                placeholder="6-digit PIN"
                value={newGpin}
                onChangeText={(val) => setNewGpin(val.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                leftIcon={<KeyRound size={18} color={COLORS.textSecondary} />}
              />
            </View>

            {/* NPIN */}
            <View style={styles.pinConfigBox}>
              <View style={styles.pinConfigHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinConfigTitle}>NPIN (Non-GST Commercial Invoice)</Text>
                  <Text style={styles.pinConfigDesc}>
                    Generates Commercial Invoice (VTN-YYYY-MM-NNN) without tax calculation.
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    hasNpinConfigured ? styles.statusPillActive : styles.statusPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      hasNpinConfigured ? styles.statusPillTextActive : styles.statusPillTextInactive,
                    ]}
                  >
                    {hasNpinConfigured ? 'Active' : 'Unconfigured'}
                  </Text>
                </View>
              </View>

              <Input
                label={hasNpinConfigured ? 'Change NPIN (Enter 6 digits)' : 'Set NPIN (Enter 6 digits)'}
                placeholder="6-digit PIN"
                value={newNpin}
                onChangeText={(val) => setNewNpin(val.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                leftIcon={<KeyRound size={18} color={COLORS.textSecondary} />}
              />
            </View>

            <View style={styles.securityNote}>
              <Text style={styles.securityNoteText}>
                🔒 Security Note: PINs are hashed using cryptographic HMAC-SHA256 with unique salting on the server. Neither admins nor employees can view plaintext PINs in database records.
              </Text>
            </View>
          </View>

          <Button
            title={saving ? 'Saving Settings...' : 'Save Configuration'}
            variant="primary"
            size="lg"
            loading={saving}
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* State Selector Modal */}
      <Modal visible={showStateModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Business State</Text>
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
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    lineHeight: 16,
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
  pinConfigBox: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  pinConfigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  pinConfigTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  pinConfigDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statusPillActive: {
    backgroundColor: '#ecfdf5',
  },
  statusPillInactive: {
    backgroundColor: '#fef3c7',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillTextActive: {
    color: '#059669',
  },
  statusPillTextInactive: {
    color: '#b45309',
  },
  securityNote: {
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: 4,
  },
  securityNoteText: {
    fontSize: 11,
    color: '#1d4ed8',
    lineHeight: 16,
  },
  saveBtn: {
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
