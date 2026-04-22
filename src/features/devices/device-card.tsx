import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/src/components/action-button';
import { InfoPair } from '@/src/components/info-pair';
import { StatusBadge } from '@/src/components/status-badge';
import { SurfaceCard } from '@/src/components/surface-card';
import { colors, spacing, typography } from '@/src/theme';
import type { DeviceSummary } from '@/src/types';
import { formatRelativeMinuteWindow } from '@/src/utils/date';
import { describeWaterLevel, getConnectionLabel } from '@/src/utils/device';

interface DeviceCardProps {
  device: DeviceSummary;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onConnection: () => void;
  onRemove: () => void;
  onToggleFavorite: () => void;
}

function getTone(device: DeviceSummary) {
  if (!device.snapshot.state.deviceOnline) {
    return 'warning';
  }

  if (device.snapshot.state.lastCommandStatus === 'failed') {
    return 'danger';
  }

  return 'success';
}

export function DeviceCard({
  device,
  active,
  onSelect,
  onEdit,
  onConnection,
  onRemove,
  onToggleFavorite,
}: DeviceCardProps) {
  return (
    <SurfaceCard
      title={device.name}
      subtitle={`${device.location} - ${device.deviceId}`}
      accent={
        <View style={styles.headerAccent}>
          {device.isFavorite ? <Ionicons color={colors.accent} name="star" size={18} /> : null}
          <StatusBadge
            label={device.snapshot.state.deviceOnline ? 'Online' : 'Offline'}
            tone={getTone(device)}
          />
        </View>
      }>
      <View style={styles.metrics}>
        <InfoPair label="Modo" value={getConnectionLabel(device.snapshot.state.connectionMode)} />
        <InfoPair label="Pronto" value={device.snapshot.state.readyState} />
        <InfoPair label="Freq atual" value={`${device.snapshot.state.freqCurrentHz} Hz`} />
        <InfoPair label="Agua" value={describeWaterLevel(device.snapshot.state)} />
        <InfoPair label="Ultima leitura" value={formatRelativeMinuteWindow(device.snapshot.state.lastSeen)} />
      </View>

      <View style={styles.highlight}>
        <View style={styles.highlightBox}>
          <Text style={styles.highlightLabel}>Alvo</Text>
          <Text style={styles.highlightValue}>{device.snapshot.state.freqTargetHz} Hz</Text>
        </View>
        <View style={styles.highlightBox}>
          <Text style={styles.highlightLabel}>Erro recente</Text>
          <Text style={styles.highlightValue}>
            {device.snapshot.state.lastErrorCode ? device.snapshot.state.lastErrorCode : 'Nenhum'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <ActionButton
          label={active ? 'Ativo' : 'Selecionar'}
          onPress={onSelect}
          variant={active ? 'secondary' : 'primary'}
        />
        <ActionButton
          label={device.isFavorite ? 'Desfavoritar' : 'Favoritar'}
          onPress={onToggleFavorite}
          variant="ghost"
        />
        <ActionButton label="Conexao" onPress={onConnection} variant="ghost" />
        <ActionButton label="Editar" onPress={onEdit} variant="ghost" />
        <ActionButton label="Remover" onPress={onRemove} variant="danger" />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  headerAccent: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  highlight: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  highlightBox: {
    flex: Platform.OS === 'web' ? 1 : undefined,
    minWidth: 170,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 4,
  },
  highlightLabel: {
    fontSize: typography.label,
    color: colors.textMuted,
  },
  highlightValue: {
    fontSize: typography.section,
    fontWeight: '800',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
