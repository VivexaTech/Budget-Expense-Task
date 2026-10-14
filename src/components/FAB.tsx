import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

interface FABProps {
  onPress: () => void;
  style?: ViewStyle;
}

export const FAB: React.FC<FABProps> = ({ onPress, style }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.fab, style]}
      accessibilityLabel="Add new item"
    >
      <Plus size={26} color={COLORS.surface} strokeWidth={2.5} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: SPACING.xl,
    bottom: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.elevation3,
  },
});
