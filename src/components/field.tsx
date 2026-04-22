import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

interface FieldProps extends TextInputProps {
  label: string;
  helper?: string;
  error?: string;
}

export function Field({ label, helper, error, style, ...props }: FieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#7E8CB5"
        style={[styles.input, props.multiline ? styles.multiline : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.label,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body,
  },
  multiline: {
    minHeight: 96,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  helper: {
    fontSize: typography.label,
    color: colors.textMuted,
  },
  error: {
    fontSize: typography.label,
    color: colors.danger,
  },
});
