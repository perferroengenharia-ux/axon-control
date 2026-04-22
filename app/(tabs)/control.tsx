import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ActionButton } from '@/src/components/action-button';
import { EmptyState } from '@/src/components/empty-state';
import { Field } from '@/src/components/field';
import { FrequencySlider } from '@/src/components/frequency-slider';
import { InlineNotice } from '@/src/components/inline-notice';
import { LoadingState } from '@/src/components/loading-state';
import { PageHeader } from '@/src/components/page-header';
import { Screen } from '@/src/components/screen';
import { StatusBadge } from '@/src/components/status-badge';
import { SurfaceCard } from '@/src/components/surface-card';
import { PeripheralTile } from '@/src/features/control/peripheral-tile';
import { useAppStore } from '@/src/store';
import { colors, spacing, typography } from '@/src/theme';
import { getFeatureExplanation } from '@/src/utils/device';

export default function ControlScreen() {
  const router = useRouter();
  const { activeDevice, activeSnapshot, sendCommand, state } = useAppStore();
  const [draftFrequency, setDraftFrequency] = useState('0');

  useEffect(() => {
    if (activeSnapshot) {
      setDraftFrequency(String(activeSnapshot.state.freqTargetHz));
    }
  }, [activeSnapshot?.state.freqTargetHz, activeSnapshot]);

  if (!state.hydrated) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Comandos"
          title="Controle"
          subtitle="Preparando dispositivo ativo, limites de frequencia e perifericos."
        />
        <LoadingState description="Carregando a sessao que abastece o painel de controle." />
      </Screen>
    );
  }

  if (!activeDevice || !activeSnapshot) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Comandos"
          title="Controle"
          subtitle="Selecione um climatizador ativo para liberar liga/desliga, frequencia e perifericos."
        />
        <EmptyState
          title="Sem dispositivo ativo"
          description="Abra a aba de dispositivos e escolha uma IHM para habilitar o controle."
          action={<ActionButton label="Ir para dispositivos" onPress={() => router.push('/devices')} />}
        />
      </Screen>
    );
  }

  const online = activeSnapshot.state.deviceOnline;

  return (
    <Screen>
      <PageHeader
        eyebrow="Controle principal"
        title={`Controle de ${activeDevice.name}`}
        subtitle="Os comandos sao validados pela camada de dominio, respeitam fMin/fMax e so consideram sucesso apos confirmacao do dispositivo."
      />

      {!online ? (
        <InlineNotice
          title="Comandos restritos"
          message="A IHM esta offline. O app nao trata estado local otimista como verdade final e bloqueia comandos ate nova confirmacao."
          tone="warning"
        />
      ) : null}

      {activeSnapshot.state.waterLevelState === 'disabled' ? (
        <InlineNotice
          title="Sensor de nivel desabilitado"
          message="O firmware informou que a leitura de agua esta desativada. O dashboard e o diagnostico mostram isso explicitamente."
          tone="info"
        />
      ) : null}

      <SurfaceCard title="Liga / desliga" subtitle="Use as acoes principais para iniciar ou parar o climatizador.">
        <View style={styles.powerRow}>
          <View style={styles.powerStatus}>
            <Text style={styles.powerValue}>{activeSnapshot.state.inverterRunning ? 'Ligado' : 'Desligado'}</Text>
            <Text style={styles.powerHint}>Status do comando: {activeSnapshot.state.lastCommandStatus}</Text>
          </View>
          <StatusBadge
            label={activeSnapshot.state.readyState}
            tone={activeSnapshot.state.readyState === 'fault' ? 'danger' : 'info'}
          />
        </View>
        <View style={styles.buttonGrid}>
          <ActionButton
            label="Ligar"
            onPress={() => sendCommand({ deviceId: activeDevice.id, type: 'power-on' })}
            disabled={!online}
          />
          <ActionButton
            label="Desligar"
            onPress={() => sendCommand({ deviceId: activeDevice.id, type: 'power-off' })}
            disabled={!online}
            variant="danger"
          />
        </View>
      </SurfaceCard>

      <SurfaceCard
        title="Frequencia do inversor"
        subtitle={`Faixa operacional confirmada pela IHM: ${activeSnapshot.capabilities.fMinHz} a ${activeSnapshot.capabilities.fMaxHz} Hz.`}>
        <FrequencySlider
          value={Number(draftFrequency) || activeSnapshot.state.freqTargetHz}
          min={activeSnapshot.capabilities.fMinHz}
          max={activeSnapshot.capabilities.fMaxHz}
          onChange={(value) => setDraftFrequency(String(value))}
        />
        <View style={styles.frequencyRow}>
          <Field
            label="Frequencia alvo"
            value={draftFrequency}
            onChangeText={setDraftFrequency}
            keyboardType="number-pad"
            helper={`Atual: ${activeSnapshot.state.freqCurrentHz} Hz`}
            style={styles.numericField}
          />
          <ActionButton
            label="Aplicar frequencia"
            onPress={() =>
              sendCommand({
                deviceId: activeDevice.id,
                type: 'set-frequency',
                payload: { freqTargetHz: Number(draftFrequency) || activeSnapshot.state.freqTargetHz },
              })
            }
            disabled={!online}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard
        title="Perifericos"
        subtitle="Bomba, swing e dreno obedecem as capacidades operacionais recebidas da IHM.">
        <View style={styles.peripheralGrid}>
          <PeripheralTile
            label="Bomba"
            description="Aciona ou desliga a bomba de acordo com a logica habilitada."
            stateLabel={activeSnapshot.state.pumpState === 'on' ? 'Ligado' : 'Desligado'}
            available={activeSnapshot.capabilities.pumpAvailable}
            disabledReason={getFeatureExplanation(activeSnapshot.capabilities, 'pump')}
            actionLabel={activeSnapshot.state.pumpState === 'on' ? 'Desligar bomba' : 'Ligar bomba'}
            onPress={() =>
              sendCommand({
                deviceId: activeDevice.id,
                type: 'set-pump',
                payload: { enabled: activeSnapshot.state.pumpState !== 'on' },
              })
            }
          />
          <PeripheralTile
            label="Swing"
            description="Controla o swing conforme o hardware e parametros do dispositivo."
            stateLabel={activeSnapshot.state.swingState === 'on' ? 'Ligado' : 'Desligado'}
            available={activeSnapshot.capabilities.swingAvailable}
            disabledReason={getFeatureExplanation(activeSnapshot.capabilities, 'swing')}
            actionLabel={activeSnapshot.state.swingState === 'on' ? 'Desligar swing' : 'Ligar swing'}
            onPress={() =>
              sendCommand({
                deviceId: activeDevice.id,
                type: 'set-swing',
                payload: { enabled: activeSnapshot.state.swingState !== 'on' },
              })
            }
          />
          <PeripheralTile
            label="Dreno"
            description="Executa a rotina de dreno quando o firmware permitir."
            stateLabel={activeSnapshot.state.drainState === 'on' ? 'Executando' : 'Parado'}
            available={activeSnapshot.capabilities.drainAvailable}
            disabledReason={getFeatureExplanation(activeSnapshot.capabilities, 'drain-cycle')}
            actionLabel={activeSnapshot.state.drainState === 'on' ? 'Parar dreno' : 'Executar dreno'}
            onPress={() =>
              sendCommand({
                deviceId: activeDevice.id,
                type: activeSnapshot.state.drainState === 'on' ? 'stop-drain' : 'run-drain',
              })
            }
          />
        </View>
      </SurfaceCard>

      <SurfaceCard title="Feedback de comando" subtitle="Idle, sending, applied e failed ficam visiveis para reduzir ambiguidades operacionais.">
        <Text style={styles.feedbackText}>Status atual: {activeSnapshot.state.lastCommandStatus}</Text>
        <Text style={styles.feedbackText}>
          Ultimo erro: {activeSnapshot.diagnostics.lastErrorMessage ?? 'Nenhum erro conhecido.'}
        </Text>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  powerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  powerStatus: {
    gap: 4,
  },
  powerValue: {
    fontSize: typography.title,
    fontWeight: '800',
    color: colors.text,
  },
  powerHint: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  numericField: {
    minWidth: 180,
  },
  peripheralGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  feedbackText: {
    fontSize: typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
