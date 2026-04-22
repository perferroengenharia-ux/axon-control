import { useMemo } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ActionButton } from '@/src/components/action-button';
import { EmptyState } from '@/src/components/empty-state';
import { InfoPair } from '@/src/components/info-pair';
import { InlineNotice } from '@/src/components/inline-notice';
import { LoadingState } from '@/src/components/loading-state';
import { PageHeader } from '@/src/components/page-header';
import { Screen } from '@/src/components/screen';
import { SurfaceCard } from '@/src/components/surface-card';
import { DeviceCard } from '@/src/features/devices/device-card';
import { useAppStore } from '@/src/store';
import { colors, spacing, typography } from '@/src/theme';

export default function DevicesScreen() {
  const router = useRouter();
  const { state, setActiveDevice, removeDevice, toggleFavorite, clearGlobalError } = useAppStore();

  const summaries = useMemo(
    () =>
      state.devices.map((device) => ({
        ...device,
        snapshot: state.snapshots[device.id],
      })),
    [state.devices, state.snapshots],
  );

  const onlineCount = summaries.filter((device) => device.snapshot?.state.deviceOnline).length;
  const favoriteCount = summaries.filter((device) => device.isFavorite).length;

  const requestRemove = (deviceId: string) => {
    const confirmRemoval = () => removeDevice(deviceId);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Remover este climatizador do cadastro local?')) {
        confirmRemoval();
      }
      return;
    }

    Alert.alert('Remover climatizador', 'Esta acao remove o cadastro local e os agendamentos associados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: confirmRemoval },
    ]);
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Cadastro local"
        title="Meus climatizadores"
        subtitle="Gerencie varias IHMs, escolha o dispositivo ativo e mantenha um simulador pronto para treino e demonstracao."
        actions={<ActionButton label="Adicionar" onPress={() => router.push('/device/add')} />}
      />

      {state.lastGlobalError ? (
        <InlineNotice
          title="Atencao de comunicacao"
          message={state.lastGlobalError}
          tone="warning"
          action={<ActionButton label="Fechar" onPress={clearGlobalError} variant="ghost" />}
        />
      ) : null}

      {!state.hydrated ? (
        <LoadingState description="Sincronizando cadastro local e retomando a sessao dos climatizadores." />
      ) : null}

      <View style={styles.statsRow}>
        <SurfaceCard style={styles.statCard}>
          <Text style={styles.statValue}>{summaries.length}</Text>
          <Text style={styles.statLabel}>Climatizadores cadastrados</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.statCard}>
          <Text style={styles.statValue}>{onlineCount}</Text>
          <Text style={styles.statLabel}>Respondendo agora</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.statCard}>
          <Text style={styles.statValue}>{favoriteCount}</Text>
          <Text style={styles.statLabel}>Favoritos</Text>
        </SurfaceCard>
      </View>

      <SurfaceCard
        title="Estrutura de comunicacao"
        subtitle="Cloud usa MQTT via WebSocket para cobrir web e mobile. O fallback local usa Wi-Fi com host/IP manual ou AP da IHM, sem depender de Bluetooth nesta primeira versao.">
        <View style={styles.infoGrid}>
          <InfoPair label="Cloud" value="MQTT sobre WS/WSS" />
          <InfoPair label="Fallback" value="HTTP local com polling leve" />
          <InfoPair label="Descoberta" value="Manual + AP da IHM + futura extensao" />
          <InfoPair label="Seguranca" value="Credenciais mais sensiveis fora do storage comum" />
        </View>
      </SurfaceCard>

      {state.hydrated && summaries.length === 0 ? (
        <EmptyState
          title="Nenhum climatizador cadastrado"
          description="Use o assistente para provisionar uma IHM real ou crie um dispositivo simulado para explorar todas as telas."
          action={<ActionButton label="Adicionar climatizador" onPress={() => router.push('/device/add')} />}
        />
      ) : state.hydrated ? (
        <View style={styles.list}>
          {summaries.map((device) => (
            <DeviceCard
              key={device.id}
              active={device.id === state.activeDeviceId}
              device={device}
              onSelect={() => setActiveDevice(device.id)}
              onEdit={() => router.push(`/device/${device.id}/edit`)}
              onConnection={() => router.push(`/device/${device.id}/connection`)}
              onRemove={() => requestRemove(device.id)}
              onToggleFavorite={() => toggleFavorite(device.id)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 180,
  },
  statValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.brand,
  },
  statLabel: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
});
