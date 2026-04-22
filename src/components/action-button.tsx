import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ActionButtonProps {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  variant?: Variant;
}

const variantStyles: Record<Variant, { background: string; border: string; text: string }> = {
  primary: { background: colors.brand, border: colors.brand, text: '#FFFFFF' },
  secondary: { background: colors.accent, border: colors.accent, text: '#163015' },
  ghost: { background: 'rgba(255,255,255,0.03)', border: colors.border, text: colors.text },
  danger: { background: 'rgba(255,123,134,0.14)', border: 'rgba(255,123,134,0.28)', text: colors.danger },
};

export function ActionButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  fullWidth,
  variant = 'primary',
}: ActionButtonProps) {
  const palette = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.55 : pressed ? 0.88 : 1,
          width: fullWidth ? '100%' : undefined,
        },
      ]}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={palette.text} /> : icon}
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '700',
  },
});
