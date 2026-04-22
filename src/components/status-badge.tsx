import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
}

const toneMap: Record<Tone, { background: string; text: string }> = {
  info: { background: 'rgba(49,67,187,0.2)', text: '#AEB9FF' },
  success: { background: 'rgba(129,195,77,0.18)', text: colors.accent },
  warning: { background: 'rgba(240,180,76,0.18)', text: colors.warning },
  danger: { background: 'rgba(255,123,134,0.18)', text: colors.danger },
  neutral: { background: 'rgba(255,255,255,0.06)', text: colors.textMuted },
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: toneMap[tone].background }]}>
      <Text style={[styles.label, { color: toneMap[tone].text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  label: {
    fontSize: typography.label,
    fontWeight: '700',
  },
});
