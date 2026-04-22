import { StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/src/components/status-badge';
import { SurfaceCard } from '@/src/components/surface-card';
import { colors, radii, spacing, typography } from '@/src/theme';
import type { DeviceEvent } from '@/src/types';
import { formatDateTime } from '@/src/utils/date';

interface EventFeedProps {
  events: DeviceEvent[];
}

function getTone(level: DeviceEvent['level']) {
  switch (level) {
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

export function EventFeed({ events }: EventFeedProps) {
  return (
    <SurfaceCard
      title="Ultimos eventos"
      subtitle="A UI sempre prioriza os sinais mais recentes confirmados pela IHM ou pelo simulador.">
      <View style={styles.list}>
        {events.length === 0 ? (
          <Text style={styles.message}>
            Ainda nao ha eventos confirmados para este climatizador.
          </Text>
        ) : (
          events.slice(0, 6).map((event) => (
            <View key={event.id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.title}>{event.title}</Text>
                <StatusBadge label={event.level} tone={getTone(event.level)} />
              </View>
              <Text style={styles.message}>{event.message}</Text>
              <Text style={styles.date}>{formatDateTime(event.createdAt)}</Text>
            </View>
          ))
        )}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  item: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: typography.body,
    color: colors.textMuted,
    lineHeight: 21,
  },
  date: {
    fontSize: typography.label,
    color: colors.textMuted,
  },
});
