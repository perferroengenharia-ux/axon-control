import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/src/components/action-button';
import { StatusBadge } from '@/src/components/status-badge';
import { colors, radii, spacing, typography } from '@/src/theme';

interface PeripheralTileProps {
  label: string;
  description: string;
  stateLabel: string;
  available: boolean;
  disabledReason?: string;
  actionLabel: string;
  onPress: () => void;
}

export function PeripheralTile({
  label,
  description,
  stateLabel,
  available,
  disabledReason,
  actionLabel,
  onPress,
}: PeripheralTileProps) {
  return (
    <View style={[styles.card, !available ? styles.cardDisabled : null]}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.description}>{available ? description : disabledReason ?? description}</Text>
        </View>
        <StatusBadge
          label={stateLabel}
          tone={!available ? 'warning' : stateLabel === 'Ligado' ? 'success' : 'neutral'}
        />
      </View>
      <ActionButton
        disabled={!available}
        label={available ? actionLabel : 'Indisponivel'}
        onPress={onPress}
        variant={available ? 'ghost' : 'danger'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 220,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardDisabled: {
    opacity: 0.72,
  },
  header: {
    gap: spacing.sm,
  },
  copy: {
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.section,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: typography.body,
    color: colors.textMuted,
    lineHeight: 21,
  },
});
