import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

interface LoadingStateProps {
  title?: string;
  description?: string;
}

export function LoadingState({
  title = 'Carregando dados do app',
  description = 'Estamos preparando dispositivos, agendamentos e configuracoes locais.',
}: LoadingStateProps) {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.section,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    maxWidth: 520,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
