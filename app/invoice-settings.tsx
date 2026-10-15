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
import { InvoiceSettings, InvoiceTemplateId } from '@/types';
import { INDIAN_STATES } from '@/constants/states';
import { getInvoiceSettings, updateInvoiceSettings } from '@/services/invoiceService';
import { Palette, Check } from 'lucide-react-native';

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<InvoiceTemplateId>('CORPORATE');

  // Neutral PIN Status & updates
  const [hasAuthorizationPinConfigured, setHasAuthorizationPinConfigured] = useState(false);
  const [hasAlternativePinConfigured, setHasAlternativePinConfigured] = useState(false);
  const [allowAlternativeInvoiceType, setAllowAlternativeInvoiceType] = useState(false);
  const [newAuthorizationPin, setNewAuthorizationPin] = useState('');
  const [newAlternativePin, setNewAlternativePin] = useState('');

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
        if (settings.selectedTemplateId) {
          setSelectedTemplateId(settings.selectedTemplateId);
        }
        setHasAuthorizationPinConfigured(Boolean(settings.hasAuthorizationPinConfigured ?? settings.hasGpinConfigured));
        setHasAlternativePinConfigured(Boolean(settings.hasAlternativePinConfigured ?? settings.hasNpinConfigured));
        setAllowAlternativeInvoiceType(Boolean(settings.allowAlternativeInvoiceType));
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

    if (newAuthorizationPin && !/^\d{6}$/.test(newAuthorizationPin.trim())) {
      setErrorMessage('Authorization PIN must be exactly 6 numeric digits.');
      return;
    }

    if (newAlternativePin && !/^\d{6}$/.test(newAlternativePin.trim())) {
      setErrorMessage('Alternative Authorization PIN must be exactly 6 numeric digits.');
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
        selectedTemplateId,
      };

      if (newAuthorizationPin.trim()) {
        payload.authorizationPin = newAuthorizationPin.trim();
        payload.gpin = newAuthorizationPin.trim(); // Backward compat
      }

      if (newAlternativePin.trim()) {
        payload.alternativePin = newAlternativePin.trim();
        payload.npin = newAlternativePin.trim(); // Backward compat
      }

      const res = await updateInvoiceSettings(payload);
      if (res.success) {
        if (newAuthorizationPin.trim()) setHasAuthorizationPinConfigured(true);
        if (newAlternativePin.trim()) setHasAlternativePinConfigured(true);
        setNewAuthorizationPin('');
        setNewAlternativePin('');
        Alert.alert('Settings Saved', 'Invoice business profile and authorization settings updated successfully.', [
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

          {/* SECTION 2.5: INVOICE TEMPLATE DESIGN */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Palette size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Invoice Layout Template</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Select the default PDF layout format used when issuing company invoices:
            </Text>

            <View style={{ gap: 10, marginTop: 8 }}>
              {[
                {
                  id: 'CORPORATE' as InvoiceTemplateId,
                  name: 'Professional Corporate',
                  desc: 'Structured formal grid, corporate blue border, and signature verification box.',
                  color: '#1A73E8',
                },
                {
                  id: 'MINIMAL' as InvoiceTemplateId,
                  name: 'Clean Minimalist',
                  desc: 'Airy monochrome typography, sleek spacing, and uncluttered layout.',
                  color: '#202124',
                },
                {
                  id: 'MODERN_BLUE' as InvoiceTemplateId,
                  name: 'Modern Gradient Blue',
                  desc: 'High-contrast header banner, pill status badges, and rounded summary cards.',
                  color: '#0066CC',
                },
                {
                  id: 'CLASSIC_GST' as InvoiceTemplateId,
                  name: 'Classic GST Format',
                  desc: 'Standard Indian GST statutory compliance format with HSN/SAC breakdown table.',
                  color: '#1E3A8A',
                },
              ].map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <TouchableOpacity
                    key={tpl.id}
                    onPress={() => setSelectedTemplateId(tpl.id)}
                    style={[
                      styles.templateOptionCard,
                      isSelected && { borderColor: tpl.color, backgroundColor: `${tpl.color}0D` },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.templateColorDot, { backgroundColor: tpl.color }]} />
                        <Text style={[styles.templateName, isSelected && { color: tpl.color }]}>{tpl.name}</Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: tpl.color }]}>
                          <Check size={14} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.templateDesc}>{tpl.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SECTION 3: INVOICE AUTHORIZATION PIN SETUP */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ShieldCheck size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Invoice Authorization Security</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Configure your secure 6-digit PIN required to authorize and issue official client invoices:
            </Text>

            {/* Primary Authorization PIN */}
            <View style={styles.pinConfigBox}>
              <View style={styles.pinConfigHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinConfigTitle}>Invoice Authorization PIN</Text>
                  <Text style={styles.pinConfigDesc}>
                    Required by team members to generate and lock invoices for completed tasks.
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    hasAuthorizationPinConfigured ? styles.statusPillActive : styles.statusPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      hasAuthorizationPinConfigured ? styles.statusPillTextActive : styles.statusPillTextInactive,
                    ]}
                  >
                    {hasAuthorizationPinConfigured ? 'Active' : 'Unconfigured'}
                  </Text>
                </View>
              </View>

              <Input
                label={hasAuthorizationPinConfigured ? 'Change Authorization PIN (6 digits)' : 'Set Authorization PIN (6 digits)'}
                placeholder="6-digit PIN"
                value={newAuthorizationPin}
                onChangeText={(val) => setNewAuthorizationPin(val.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                leftIcon={<KeyRound size={18} color={COLORS.textSecondary} />}
              />
            </View>

            {/* Alternative Authorization PIN (Only rendered if permitted by Super Admin) */}
            {allowAlternativeInvoiceType && gstin.trim().length > 0 && (
              <View style={styles.pinConfigBox}>
                <View style={styles.pinConfigHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pinConfigTitle}>Alternative Authorization PIN</Text>
                    <Text style={styles.pinConfigDesc}>
                      Secondary authorization PIN for alternative invoice workflows.
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      hasAlternativePinConfigured ? styles.statusPillActive : styles.statusPillInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        hasAlternativePinConfigured ? styles.statusPillTextActive : styles.statusPillTextInactive,
                      ]}
                    >
                      {hasAlternativePinConfigured ? 'Active' : 'Unconfigured'}
                    </Text>
                  </View>
                </View>

                <Input
                  label={hasAlternativePinConfigured ? 'Change Alternative PIN (6 digits)' : 'Set Alternative PIN (6 digits)'}
                  placeholder="6-digit PIN"
                  value={newAlternativePin}
                  onChangeText={(val) => setNewAlternativePin(val.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  leftIcon={<KeyRound size={18} color={COLORS.textSecondary} />}
                />
              </View>
            )}

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
  templateOptionCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  templateColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  templateName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  templateDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
