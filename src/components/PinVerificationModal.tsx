import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ShieldCheck, X, AlertCircle, Eye, EyeOff, FileText, CheckCircle2 } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { generateInvoice } from '@/services/invoiceService';
import { Invoice } from '@/types';

interface PinVerificationModalProps {
  visible: boolean;
  taskId: string;
  taskTitle?: string;
  clientName?: string;
  amount?: number;
  onClose: () => void;
  onSuccess: (invoice: Invoice) => void;
}

export const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
  visible,
  taskId,
  taskTitle,
  clientName,
  amount,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 6) {
      setError('Please enter all 6 digits of your authorization PIN.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await generateInvoice(taskId, cleanPin);
      if (res.success && res.invoice) {
        onSuccess(res.invoice);
        onClose();
      } else {
        setError(res.error || 'Failed to authorize and generate invoice.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.container}
            >
              <View style={styles.card}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.iconCircle}>
                    <ShieldCheck size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>Invoice Authorization</Text>
                    <Text style={styles.subtitle}>Enter 6-digit GPIN or NPIN</Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Task Context */}
                {(clientName || amount !== undefined) && (
                  <View style={styles.contextCard}>
                    {clientName ? (
                      <Text style={styles.contextClient} numberOfLines={1}>
                        Client: <Text style={styles.contextBold}>{clientName}</Text>
                      </Text>
                    ) : null}
                    {taskTitle ? (
                      <Text style={styles.contextProject} numberOfLines={1}>
                        Project: {taskTitle}
                      </Text>
                    ) : null}
                    {amount !== undefined ? (
                      <Text style={styles.contextAmount}>
                        Amount: <Text style={styles.contextAmountVal}>{formatCurrency(amount)}</Text>
                      </Text>
                    ) : null}
                  </View>
                )}

                {/* Error Banner */}
                {error && (
                  <View style={styles.errorBox}>
                    <AlertCircle size={16} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Instructions */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>Two-PIN Dual Billing Mode:</Text>
                  <Text style={styles.infoLine}>• <Text style={styles.infoBold}>GPIN (GST PIN)</Text> generates a Tax Invoice (VTX-YYYY-MM-NNN)</Text>
                  <Text style={styles.infoLine}>• <Text style={styles.infoBold}>NPIN (Non-GST PIN)</Text> generates a Commercial Invoice (VTN-YYYY-MM-NNN)</Text>
                </View>

                {/* PIN Input Row */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Enter 6-Digit Authorization PIN</Text>
                  <View style={styles.pinWrapper}>
                    <TextInput
                      style={styles.hiddenInput}
                      value={pin}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/\D/g, '').slice(0, 6);
                        setPin(cleaned);
                        if (error) setError(null);
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      secureTextEntry={!showPin}
                    />

                    {/* Visual PIN boxes */}
                    <View style={styles.dotsRow}>
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const char = pin[index];
                        const isFocused = pin.length === index;
                        return (
                          <View
                            key={index}
                            style={[
                              styles.dotBox,
                              isFocused && styles.dotBoxActive,
                              char ? styles.dotBoxFilled : null,
                            ]}
                          >
                            <Text style={styles.dotText}>
                              {char ? (showPin ? char : '●') : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      onPress={() => setShowPin(!showPin)}
                      style={styles.eyeBtn}
                    >
                      {showPin ? (
                        <EyeOff size={18} color={COLORS.textSecondary} />
                      ) : (
                        <Eye size={18} color={COLORS.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.cancelBtn}
                    disabled={loading}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSubmit}
                    style={[
                      styles.submitBtn,
                      (pin.length !== 6 || loading) && styles.submitBtnDisabled,
                    ]}
                    disabled={pin.length !== 6 || loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <FileText size={18} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.submitBtnText}>Generate Invoice</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight + '25',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  contextCard: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contextClient: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  contextBold: {
    fontWeight: '700',
    color: COLORS.text,
  },
  contextProject: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contextAmount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  contextAmountVal: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 4,
  },
  infoLine: {
    fontSize: 11,
    color: '#3b82f6',
    lineHeight: 16,
  },
  infoBold: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
  inputContainer: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  pinWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0,
    zIndex: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dotBox: {
    width: 44,
    height: 48,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotBoxActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#ffffff',
  },
  dotBoxFilled: {
    borderColor: COLORS.primary,
  },
  dotText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  eyeBtn: {
    marginTop: SPACING.xs,
    padding: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  submitBtn: {
    flex: 2,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitBtnText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: '#ffffff',
  },
});
