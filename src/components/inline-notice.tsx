import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

type Tone = 'info' | 'success' | 'warning' | 'danger';

interface InlineNoticeProps {
  title: string;
  message: string;
  tone?: Tone;
  action?: ReactNode;
}

const toneStyles = {
  info: { background: 'rgba(49,67,187,0.18)', border: 'rgba(125,141,255,0.34)', title: '#AEB9FF', text: colors.text },
  success: { background: 'rgba(129,195,77,0.14)', border: 'rgba(129,195,77,0.32)', title: colors.accent, text: colors.text },
  warning: { background: 'rgba(240,180,76,0.14)', border: 'rgba(240,180,76,0.3)', title: colors.warning, text: colors.text },
  danger: { background: 'rgba(255,123,134,0.14)', border: 'rgba(255,123,134,0.3)', title: colors.danger, text: colors.text },
};

export function InlineNotice({ title, message, tone = 'info', action }: InlineNoticeProps) {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.wrapper, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.title }]}>{title}</Text>
        <Text style={[styles.message, { color: palette.text }]}>{message}</Text>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  copy: {
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  message: {
    fontSize: typography.body,
    lineHeight: 21,
  },
});
