import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ActionButton } from '@/src/components/action-button';
import { EmptyState } from '@/src/components/empty-state';
import { InfoPair } from '@/src/components/info-pair';
import { InlineNotice } from '@/src/components/inline-notice';
import { LoadingState } from '@/src/components/loading-state';
import { PageHeader } from '@/src/components/page-header';
import { Screen } from '@/src/components/screen';
import { StatusBadge } from '@/src/components/status-badge';
import { SurfaceCard } from '@/src/components/surface-card';
import { EventFeed } from '@/src/features/dashboard/event-feed';
import { useAppStore } from '@/src/store';
import { colors, radii, spacing, typography } from '@/src/theme';
import { formatDateTime } from '@/src/utils/date';
import { describeWaterLevel, getConnectionLabel } from '@/src/utils/device';

function getStatusTone(online: boolean) {
  return online ? 'success' : 'warning';
}

export default function DashboardScreen() {
  const router = useRouter();
  const { activeDevice, activeSnapshot, sendCommand, state } = useAppStore();

  if (!state.hydrated) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Operacao"
          title="Dashboard"
          subtitle="Estamos restaurando dispositivos e sessoes para montar o painel principal."
        />
        <LoadingState description="Carregando o dispositivo ativo e seus ultimos sinais confirmados." />
      </Screen>
    );
  }

  if (!activeDevice || !activeSnapshot) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Operacao"
          title="Dashboard"
          subtitle="Selecione um climatizador ativo para acompanhar estado, perifericos e eventos confirmados."
        />
        <EmptyState
          title="Selecione um climatizador"
          description="A tela principal depende do dispositivo ativo para mostrar estado real, erros e quick actions."
          action={<ActionButton label="Ir para dispositivos" onPress={() => router.push('/devices')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Status em tempo real"
        title={activeDevice.name}
        subtitle={`Estado confirmado da IHM ${activeDevice.deviceId}. O app prioriza a confirmacao do dispositivo em vez de um estado local otimista.`}
        actions={<ActionButton label="Conexao" onPress={() => router.push(`/device/${activeDevice.id}/connection`)} variant="ghost" />}
      />

      {!activeSnapshot.state.deviceOnline ? (
        <InlineNotice
          title="Dispositivo offline"
          message="Os comandos ficam restritos enquanto a IHM nao confirma conectividade. Revise a tela de conexao ou diagnostico."
          tone="warning"
        />
      ) : null}

      <SurfaceCard
        title="Painel do dispositivo"
        subtitle="Visao rapida de disponibilidade, frequencia e agua."
        accent={
          <StatusBadge
            label={activeSnapshot.state.deviceOnline ? 'Online' : 'Offline'}
            tone={getStatusTone(activeSnapshot.state.deviceOnline)}
          />
        }>
        <View style={styles.metricGrid}>
          <View style={styles.metricTile}>
            <Text style={styles.metricValue}>{activeSnapshot.state.freqCurrentHz} Hz</Text>
            <Text style={styles.metricLabel}>Frequencia atual</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricValue}>{activeSnapshot.state.freqTargetHz} Hz</Text>
            <Text style={styles.metricLabel}>Frequencia alvo</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricValue}>{describeWaterLevel(activeSnapshot.state)}</Text>
            <Text style={styles.metricLabel}>Sensor de agua</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricValue}>{activeSnapshot.state.readyState}</Text>
            <Text style={styles.metricLabel}>Ready state</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoPair label="Modo" value={getConnectionLabel(activeSnapshot.state.connectionMode)} />
          <InfoPair label="Ultima leitura" value={formatDateTime(activeSnapshot.state.lastSeen)} />
          <InfoPair label="Comando" value={activeSnapshot.state.lastCommandStatus} />
          <InfoPair label="Erro" value={activeSnapshot.state.lastErrorCode ?? 'Nenhum'} />
        </View>
      </SurfaceCard>

      <View style={styles.splitGrid}>
        <SurfaceCard title="Quick actions" subtitle="Acionamentos de alto impacto com feedback claro do ultimo comando.">
          <View style={styles.buttonGrid}>
            <ActionButton
              label="Ligar"
              onPress={() => sendCommand({ deviceId: activeDevice.id, type: 'power-on' })}
              disabled={!activeSnapshot.state.deviceOnline}
            />
            <ActionButton
              label="Desligar"
              onPress={() => sendCommand({ deviceId: activeDevice.id, type: 'power-off' })}
              variant="danger"
              disabled={!activeSnapshot.state.deviceOnline}
            />
            <ActionButton
              label={activeSnapshot.state.drainState === 'on' ? 'Parar dreno' : 'Dreno'}
              onPress={() =>
                sendCommand({
                  deviceId: activeDevice.id,
                  type: activeSnapshot.state.drainState === 'on' ? 'stop-drain' : 'run-drain',
                })
              }
              variant="secondary"
              disabled={!activeSnapshot.capabilities.drainAvailable || !activeSnapshot.state.deviceOnline}
            />
            <ActionButton label="Controle fino" onPress={() => router.push('/control')} variant="ghost" />
          </View>
          {!activeSnapshot.capabilities.drainAvailable ? (
            <Text style={styles.helperText}>
              O dreno foi desabilitado pelas capacidades atuais da IHM.
            </Text>
          ) : null}
          {!activeSnapshot.state.deviceOnline ? (
            <Text style={styles.helperText}>
              Os acionamentos permanecem bloqueados ate a IHM voltar a confirmar conectividade.
            </Text>
          ) : null}
        </SurfaceCard>

        <SurfaceCard title="Perifericos" subtitle="O estado exibido reflete o ultimo estado conhecido confirmado pela IHM.">
          <View style={styles.peripheralList}>
            <View style={styles.peripheralRow}>
              <Text style={styles.peripheralLabel}>Bomba</Text>
              <StatusBadge label={activeSnapshot.state.pumpState} tone={activeSnapshot.state.pumpState === 'on' ? 'success' : 'neutral'} />
            </View>
            <View style={styles.peripheralRow}>
              <Text style={styles.peripheralLabel}>Swing</Text>
              <StatusBadge label={activeSnapshot.state.swingState} tone={activeSnapshot.state.swingState === 'on' ? 'success' : 'neutral'} />
            </View>
            <View style={styles.peripheralRow}>
              <Text style={styles.peripheralLabel}>Dreno</Text>
              <StatusBadge label={activeSnapshot.state.drainState} tone={activeSnapshot.state.drainState === 'on' ? 'warning' : 'neutral'} />
            </View>
          </View>
        </SurfaceCard>
      </View>

      <SurfaceCard title="Ultimo erro conhecido" subtitle="Mostrado no dashboard para deixar falhas de comunicacao evidentes.">
        <Text style={styles.errorText}>
          {activeSnapshot.diagnostics.lastErrorMessage ?? 'Nenhuma falha registrada neste momento.'}
        </Text>
      </SurfaceCard>

      <EventFeed events={activeSnapshot.events} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricTile: {
    flex: 1,
    minWidth: 180,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 4,
  },
  metricValue: {
    fontSize: typography.title,
    fontWeight: '800',
    color: colors.text,
  },
  metricLabel: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  splitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  peripheralList: {
    gap: spacing.sm,
  },
  peripheralRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  peripheralLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  errorText: {
    fontSize: typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  helperText: {
    fontSize: typography.label,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
