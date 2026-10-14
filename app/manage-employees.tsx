import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, ChevronLeft, Plus, UserPlus, KeyRound, Mail } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { StatusBadge } from '@/components/StatusBadge';
import { UserProfile, CreateEmployeeSchema } from '@/types';
import {
  subscribeToEmployees,
  createEmployeeAccount,
  toggleEmployeeAccountStatus,
  sendEmployeePasswordReset,
} from '@/services/authService';

export default function ManageEmployeesScreen() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeToEmployees(setEmployees);
    return () => unsub();
  }, []);

  const handleCreateEmployee = async () => {
    if (!user || !isAdmin) return;

    const validation = CreateEmployeeSchema.safeParse({
      displayName,
      employeeId,
      email,
      password,
      role,
    });

    if (!validation.success) {
      Alert.alert('Validation Error', validation.error.issues[0]?.message);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createEmployeeAccount({
        displayName,
        employeeId,
        email,
        password,
        role,
      });

      Alert.alert(
        'Account Provisioned',
        `Successfully created ${role} account for ${created.displayName} (${created.employeeId}). Administrator session preserved.`
      );

      // Reset form
      setDisplayName('');
      setEmployeeId('');
      setEmail('');
      setPassword('');
      setShowAddForm(false);
    } catch (e: any) {
      Alert.alert('Creation Failed', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (emp: UserProfile, active: boolean) => {
    if (!user) return;
    try {
      await toggleEmployeeAccountStatus(emp.uid, active, user);
    } catch (e: any) {
      Alert.alert('Status Error', e.message);
    }
  };

  const handleResetPassword = async (emp: UserProfile) => {
    Alert.alert(
      'Reset Password',
      `Send password reset email to ${emp.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            try {
              await sendEmployeePasswordReset(emp.email);
              Alert.alert('Email Sent', `Password reset instructions sent to ${emp.email}`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Employee Directory</Text>
          <Text style={styles.headerSubtitle}>Role management & credentials</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAddForm(!showAddForm)}
          style={styles.addBtn}
        >
          <Plus size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showAddForm && (
          <Card variant="outlined" style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <UserPlus size={20} color={COLORS.primary} />
              <Text style={styles.formTitle}>Provision New Employee</Text>
            </View>

            <Input
              label="Full Name *"
              placeholder="e.g. Rahul Sharma"
              value={displayName}
              onChangeText={setDisplayName}
            />

            <Input
              label="Employee ID *"
              placeholder="e.g. EMP-104"
              value={employeeId}
              onChangeText={setEmployeeId}
              containerStyle={{ marginTop: SPACING.sm }}
            />

            <Input
              label="Company Email Address *"
              placeholder="rahul@company.internal"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              containerStyle={{ marginTop: SPACING.sm }}
            />

            <Input
              label="Temporary Password *"
              placeholder="Min 6 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              containerStyle={{ marginTop: SPACING.sm }}
            />

            {/* Role Selector */}
            <View style={styles.roleSelector}>
              <Text style={styles.roleLabel}>Account Role</Text>
              <View style={styles.roleChipsRow}>
                <TouchableOpacity
                  style={[styles.roleChip, role === 'employee' && styles.roleChipSelected]}
                  onPress={() => setRole('employee')}
                >
                  <Text style={[styles.roleChipText, role === 'employee' && styles.roleChipTextSelected]}>
                    Employee (Standard)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleChip, role === 'admin' && styles.roleChipSelected]}
                  onPress={() => setRole('admin')}
                >
                  <Text style={[styles.roleChipText, role === 'admin' && styles.roleChipTextSelected]}>
                    Admin (Full Authority)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setShowAddForm(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Create Account"
                variant="primary"
                size="sm"
                loading={submitting}
                onPress={handleCreateEmployee}
                style={{ flex: 1.5 }}
              />
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>All Accounts ({employees.length})</Text>

        {employees.map((emp) => (
          <Card key={emp.uid} variant="outlined" style={styles.employeeCard}>
            <View style={styles.employeeHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.empName}>{emp.displayName}</Text>
                  <StatusBadge status={emp.role} />
                </View>
                <Text style={styles.empEmail}>{emp.email}</Text>
                <Text style={styles.empId}>Employee ID: {emp.employeeId}</Text>
              </View>

              <View style={styles.activeSwitchCol}>
                <Text style={styles.switchLabel}>
                  {emp.active ? 'Active' : 'Inactive'}
                </Text>
                <Switch
                  value={emp.active}
                  onValueChange={(val) => handleToggleActive(emp, val)}
                  trackColor={{ false: COLORS.border, true: COLORS.success }}
                />
              </View>
            </View>

            <View style={styles.empFooter}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => handleResetPassword(emp)}
              >
                <KeyRound size={14} color={COLORS.primary} />
                <Text style={styles.resetBtnText}>Send Password Reset</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

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
  formCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  formTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  roleSelector: {
    marginTop: SPACING.md,
  },
  roleLabel: {
    ...TYPOGRAPHY.labelMedium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  roleChipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  roleChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  roleChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  roleChipText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  roleChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
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
  employeeCard: {
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  employeeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  empName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  empEmail: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  empId: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  activeSwitchCol: {
    alignItems: 'center',
  },
  switchLabel: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  empFooter: {
    marginTop: SPACING.md,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
    flexDirection: 'row',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  resetBtnText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
