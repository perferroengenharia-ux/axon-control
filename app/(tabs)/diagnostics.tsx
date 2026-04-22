import { useState } from 'react';
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
import { useAppStore } from '@/src/store';
import { colors, radii, spacing, typography } from '@/src/theme';
import { formatDateTime } from '@/src/utils/date';

export default function DiagnosticsScreen() {
  const router = useRouter();
  const { activeDevice, activeSnapshot, state, testConnection } = useAppStore();
  const [testing, setTesting] = useState(false);

  if (!state.hydrated) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Suporte tecnico"
          title="Diagnostico"
          subtitle="Restaurando o contexto do app para mostrar firmware, eventos e saude da comunicacao."
        />
        <LoadingState description="Carregando capacidades, historico e ultimo estado conhecido." />
      </Screen>
    );
  }

  if (!activeDevice || !activeSnapshot) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Suporte tecnico"
          title="Diagnostico"
          subtitle="Selecione um climatizador para investigar firmware, comunicacao, eventos e contratos operacionais."
        />
        <EmptyState
          title="Sem dispositivo ativo"
          description="A tela de diagnostico depende do climatizador selecionado para mostrar capacidades atuais e erros recentes."
          action={<ActionButton label="Abrir dispositivos" onPress={() => router.push('/devices')} />}
        />
      </Screen>
    );
  }

  const lastTest = state.connectionTests[activeDevice.id];

  return (
    <Screen>
      <PageHeader
        eyebrow="Suporte tecnico"
        title={`Diagnostico de ${activeDevice.name}`}
        subtitle="Visao de firmware, capacidades, transporte e historico recente para reduzir ambiguidade em falhas de comunicacao."
        actions={<ActionButton label="Conexao" onPress={() => router.push(`/device/${activeDevice.id}/connection`)} variant="ghost" />}
      />

      <SurfaceCard
        title="Comunicacao"
        subtitle="O app diferencia cloud MQTT e fallback local Wi-Fi de forma explicita.">
        <View style={styles.infoGrid}>
          <InfoPair label="Transporte" value={activeSnapshot.diagnostics.transportStatus} />
          <InfoPair label="Firmware" value={activeSnapshot.diagnostics.firmwareVersion} />
          <InfoPair label="Ultimo sync" value={formatDateTime(activeSnapshot.diagnostics.lastSyncAt)} />
          <InfoPair label="Ultima leitura" value={formatDateTime(activeSnapshot.state.lastSeen)} />
        </View>
        <Text style={styles.bodyText}>{activeSnapshot.diagnostics.connectionSummary}</Text>
        <View style={styles.actions}>
          <ActionButton
            label="Testar conexao"
            loading={testing}
            onPress={async () => {
              setTesting(true);
              try {
                await testConnection(activeDevice.id);
              } finally {
                setTesting(false);
              }
            }}
          />
          <ActionButton label="Tela de conexao" onPress={() => router.push(`/device/${activeDevice.id}/connection`)} variant="ghost" />
        </View>
        {lastTest ? (
          <InlineNotice
            title={lastTest.ok ? 'Teste concluido' : 'Teste com falha'}
            message={`${lastTest.message}${lastTest.latencyMs ? ` Latencia: ${lastTest.latencyMs} ms.` : ''}`}
            tone={lastTest.ok ? 'success' : 'danger'}
          />
        ) : null}
      </SurfaceCard>

      {activeSnapshot.diagnostics.lastErrorMessage ? (
        <InlineNotice
          title="Ultimo erro"
          message={activeSnapshot.diagnostics.lastErrorMessage}
          tone="danger"
        />
      ) : null}

      <SurfaceCard title="Capacidades atuais" subtitle="Esses campos dirigem os limites e bloqueios da UI sem expor uma tela completa de parametros avancados.">
        <View style={styles.infoGrid}>
          <InfoPair label="fMinHz" value={String(activeSnapshot.capabilities.fMinHz)} />
          <InfoPair label="fMaxHz" value={String(activeSnapshot.capabilities.fMaxHz)} />
          <InfoPair label="Pump" value={String(activeSnapshot.capabilities.pumpAvailable)} />
          <InfoPair label="Swing" value={String(activeSnapshot.capabilities.swingAvailable)} />
          <InfoPair label="Drain" value={String(activeSnapshot.capabilities.drainAvailable)} />
          <InfoPair label="Water sensor" value={String(activeSnapshot.capabilities.waterSensorEnabled)} />
          <InfoPair label="Drain mode" value={activeSnapshot.capabilities.drainMode} />
          <InfoPair label="Drain time" value={`${activeSnapshot.capabilities.drainTimeSec}s`} />
          <InfoPair label="Return delay" value={`${activeSnapshot.capabilities.drainReturnDelaySec}s`} />
          <InfoPair label="Pump logic" value={activeSnapshot.capabilities.pumpLogicMode} />
          <InfoPair label="Water mode" value={activeSnapshot.capabilities.waterSensorMode} />
          <InfoPair label="Pre-wet" value={`${activeSnapshot.capabilities.preWetSec}s`} />
          <InfoPair label="Dry panel" value={`${activeSnapshot.capabilities.dryPanelSec}s`} />
          <InfoPair label="Dry freq" value={`${activeSnapshot.capabilities.dryPanelFreqHz}Hz`} />
          <InfoPair label="Resume" value={activeSnapshot.capabilities.resumeMode} />
          <InfoPair label="Auto reset" value={activeSnapshot.capabilities.autoResetMode} />
        </View>
      </SurfaceCard>

      <View style={styles.splitGrid}>
        <SurfaceCard title="Ultimos comandos" subtitle="Historico local de comandos enviados pelo app.">
          <View style={styles.list}>
            {activeSnapshot.commands.length === 0 ? (
              <Text style={styles.bodyText}>Nenhum comando foi enviado para este climatizador nesta sessao.</Text>
            ) : (
              activeSnapshot.commands.slice(0, 6).map((command) => (
                <View key={command.id} style={styles.listItem}>
                  <Text style={styles.listTitle}>{command.type}</Text>
                  <StatusBadge label={command.status} tone={command.status === 'failed' ? 'danger' : 'info'} />
                </View>
              ))
            )}
          </View>
        </SurfaceCard>

        <SurfaceCard title="Ultimos eventos" subtitle="Sinais recentes recebidos do dispositivo ou do simulador.">
          <View style={styles.list}>
            {activeSnapshot.events.length === 0 ? (
              <Text style={styles.bodyText}>Ainda nao chegaram eventos para este climatizador.</Text>
            ) : (
              activeSnapshot.events.slice(0, 6).map((event) => (
                <View key={event.id} style={styles.listItemStack}>
                  <Text style={styles.listTitle}>{event.title}</Text>
                  <Text style={styles.bodyText}>{event.message}</Text>
                  <Text style={styles.caption}>{formatDateTime(event.createdAt)}</Text>
                </View>
              ))
            )}
          </View>
        </SurfaceCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bodyText: {
    fontSize: typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  splitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  listItemStack: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  listTitle: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  caption: {
    fontSize: typography.label,
    color: colors.textMuted,
  },
});
