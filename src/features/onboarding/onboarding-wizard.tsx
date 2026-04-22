import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/src/components/action-button';
import { Field } from '@/src/components/field';
import { InlineNotice } from '@/src/components/inline-notice';
import { SegmentedControl } from '@/src/components/segmented-control';
import { SurfaceCard } from '@/src/components/surface-card';
import { defaultOnboardingDraft } from '@/src/mocks/defaults';
import { colors, radii, spacing, typography } from '@/src/theme';
import type { ClimateDevice, DiscoveredDeviceInfo, OnboardingDraft, ProvisionMethod } from '@/src/types';
import { createId } from '@/src/utils/id';
import { validateOnboardingProvisioning, validateOnboardingStepThree } from '@/src/utils/validation';

import { discoverDeviceFromDraft } from './device-discovery';

const methodOptions: { value: ProvisionMethod; title: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    value: 'ihm-ap',
    title: 'Conectar ao Wi-Fi da IHM',
    description: 'Ideal para equipamento novo, provisionamento inicial e cenarios sem internet.',
    icon: 'wifi',
  },
  {
    value: 'local-network',
    title: 'Adicionar pela rede local',
    description: 'Usa host/IP conhecido na mesma LAN para fallback sem depender do broker.',
    icon: 'hardware-chip',
  },
  {
    value: 'manual-host',
    title: 'Adicionar manualmente por IP/host',
    description: 'Mantem o fluxo simples quando a descoberta automatica nao estiver disponivel.',
    icon: 'globe-outline',
  },
  {
    value: 'simulation',
    title: 'Criar climatizador simulado',
    description: 'Ativa um perfil completo para estudo, onboarding e testes sem hardware real.',
    icon: 'sparkles-outline',
  },
];

interface OnboardingWizardProps {
  onComplete: (device: ClimateDevice) => void;
}

function buildDeviceFromDraft(draft: OnboardingDraft, discovered: DiscoveredDeviceInfo | null): ClimateDevice {
  const deviceId =
    discovered?.deviceId || draft.deviceId.trim() || `device-${Math.floor(Math.random() * 1000)}`;
  const isSimulation = draft.method === 'simulation';

  return {
    id: createId('dev'),
    deviceId,
    name: draft.name.trim() || discovered?.defaultName || 'Novo climatizador',
    location: draft.location.trim(),
    notes: draft.notes.trim(),
    preferredConnectionMode: isSimulation
      ? 'simulation'
      : draft.method === 'ihm-ap'
        ? 'local-ap'
        : 'auto',
    mqttConfig: {
      brokerUrl: draft.brokerUrl.trim(),
      port: draft.brokerPort,
      protocol: draft.protocol,
      username: draft.mqttUsername.trim(),
      password: draft.mqttPassword,
      topicPrefix: draft.topicPrefix.trim(),
      deviceId,
    },
    localConfig: {
      host: draft.host.trim(),
      port: draft.localPort,
      accessPointSsid: draft.accessPointSsid.trim(),
      accessPointPassword: draft.accessPointPassword,
    },
    lastSeen: null,
    isFavorite: false,
    isSimulation,
    firmwareVersion: discovered?.firmwareVersion,
    seedCapabilities: discovered?.capabilities,
  };
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(defaultOnboardingDraft);
  const [discovered, setDiscovered] = useState<DiscoveredDeviceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const stepThreeErrors = useMemo(() => validateOnboardingStepThree(draft), [draft]);
  const stepFourErrors = useMemo(() => validateOnboardingProvisioning(draft), [draft]);

  return (
    <View style={styles.wrapper}>
      <SurfaceCard
        title="Assistente de cadastro"
        subtitle="Fluxo guiado para provisionar, registrar e revisar os dados de comunicacao com a IHM."
        accent={<Text style={styles.stepIndicator}>Etapa {step + 1} de 5</Text>}>
        <View style={styles.progress}>
          {Array.from({ length: 5 }).map((_, index) => (
            <View key={index} style={[styles.progressStep, index <= step ? styles.progressStepActive : null]} />
          ))}
        </View>
      </SurfaceCard>

      {step === 0 ? (
        <SurfaceCard title="1. Escolha o metodo" subtitle="Priorize o fluxo por Wi-Fi local da IHM e mantenha o manual como fallback simples.">
          <View style={styles.methodGrid}>
            {methodOptions.map((option) => {
              const selected = draft.method === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDraft({ ...draft, method: option.value })}
                  style={[styles.methodCard, selected ? styles.methodCardSelected : null]}>
                  <Ionicons
                    color={selected ? '#FFFFFF' : colors.brand}
                    name={option.icon}
                    size={22}
                  />
                  <Text style={[styles.methodTitle, selected ? styles.methodTitleSelected : null]}>
                    {option.title}
                  </Text>
                  <Text style={[styles.methodDescription, selected ? styles.methodDescriptionSelected : null]}>
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ActionButton label="Continuar" onPress={() => setStep(1)} />
        </SurfaceCard>
      ) : null}

      {step === 1 ? (
        <SurfaceCard title="2. Ler dados basicos" subtitle="O app tenta obter identificacao, firmware e capacidades iniciais antes de salvar o climatizador.">
          {draft.method !== 'simulation' ? (
            <>
              <Field
                label="Host ou IP local"
                value={draft.host}
                onChangeText={(host) => setDraft({ ...draft, host })}
                placeholder="192.168.4.1"
              />
              <Field
                label="Porta local"
                value={String(draft.localPort)}
                onChangeText={(value) => setDraft({ ...draft, localPort: Number(value) || 0 })}
                keyboardType="number-pad"
              />
              <Field
                label="deviceId conhecido"
                value={draft.deviceId}
                onChangeText={(deviceId) => setDraft({ ...draft, deviceId })}
                placeholder="Opcional"
              />
            </>
          ) : (
            <InlineNotice
              title="Modo simulacao"
              message="A leitura basica sera gerada automaticamente com capacidades completas para explorar todas as telas."
            />
          )}

          {error ? <InlineNotice title="Falha na leitura" message={error} tone="danger" /> : null}
          {successMessage ? <InlineNotice title="Leitura concluida" message={successMessage} tone="success" /> : null}

          {discovered ? (
            <View style={styles.discoveryBox}>
              <Text style={styles.discoveryLabel}>deviceId: {discovered.deviceId}</Text>
              <Text style={styles.discoveryValue}>Nome padrao: {discovered.defaultName}</Text>
              <Text style={styles.discoveryValue}>Firmware: {discovered.firmwareVersion}</Text>
              <Text style={styles.discoveryValue}>Status da leitura: {discovered.discoveryStatus}</Text>
            </View>
          ) : null}

          <View style={styles.rowActions}>
            <ActionButton label="Voltar" onPress={() => setStep(0)} variant="ghost" />
            <ActionButton
              label="Tentar leitura"
              loading={loading}
              onPress={async () => {
                setLoading(true);
                setError(null);
                setSuccessMessage(null);

                try {
                  const result = await discoverDeviceFromDraft(draft);
                  setDiscovered(result);
                  setDraft((current) => ({
                    ...current,
                    deviceId: result.deviceId,
                    name: current.name || result.defaultName,
                  }));
                  setSuccessMessage('Dados basicos carregados com sucesso. Voce pode seguir ou repetir a leitura.');
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Falha ao ler a IHM.');
                } finally {
                  setLoading(false);
                }
              }}
            />
            <ActionButton
              label="Avancar"
              onPress={() => setStep(2)}
              variant="secondary"
              disabled={!discovered && draft.method !== 'manual-host'}
            />
          </View>
        </SurfaceCard>
      ) : null}

      {step === 2 ? (
        <SurfaceCard title="3. Identificacao amigavel" subtitle="Esses campos organizam a lista de climatizadores no app sem depender do protocolo do firmware.">
          <Field
            label="Nome do climatizador"
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            placeholder="Ex.: Climatizador do escritorio"
          />
          <Field
            label="Local / ambiente"
            value={draft.location}
            onChangeText={(location) => setDraft({ ...draft, location })}
            placeholder="Ex.: Sala de reunioes"
          />
          <Field
            label="Observacao"
            value={draft.notes}
            onChangeText={(notes) => setDraft({ ...draft, notes })}
            multiline
            placeholder="Opcional"
          />
          {stepThreeErrors.length > 0 ? (
            <InlineNotice title="Campos pendentes" message={stepThreeErrors.join(' ')} tone="warning" />
          ) : null}
          <View style={styles.rowActions}>
            <ActionButton label="Voltar" onPress={() => setStep(1)} variant="ghost" />
            <ActionButton
              label="Avancar"
              onPress={() => setStep(3)}
              variant="secondary"
              disabled={stepThreeErrors.length > 0}
            />
          </View>
        </SurfaceCard>
      ) : null}

      {step === 3 ? (
        <SurfaceCard title="4. Provisionamento de rede e cloud" subtitle="Os contratos sao editaveis depois, mas o cadastro ja fica funcional para cloud, LAN e simulacao.">
          <SegmentedControl
            value={draft.protocol}
            options={[
              { label: 'WS', value: 'ws' },
              { label: 'WSS', value: 'wss' },
            ]}
            onChange={(protocol) => setDraft({ ...draft, protocol })}
          />
          <Field
            label="Broker MQTT"
            value={draft.brokerUrl}
            onChangeText={(brokerUrl) => setDraft({ ...draft, brokerUrl })}
            placeholder="broker.example.com/mqtt"
          />
          <Field
            label="Porta MQTT"
            value={String(draft.brokerPort)}
            onChangeText={(value) => setDraft({ ...draft, brokerPort: Number(value) || 0 })}
            keyboardType="number-pad"
          />
          <Field
            label="Usuario MQTT"
            value={draft.mqttUsername}
            onChangeText={(mqttUsername) => setDraft({ ...draft, mqttUsername })}
          />
          <Field
            label="Senha MQTT"
            value={draft.mqttPassword}
            onChangeText={(mqttPassword) => setDraft({ ...draft, mqttPassword })}
            secureTextEntry
          />
          <Field
            label="Prefixo de topicos"
            value={draft.topicPrefix}
            onChangeText={(topicPrefix) => setDraft({ ...draft, topicPrefix })}
          />
          <Field
            label="SSID do Wi-Fi da IHM"
            value={draft.accessPointSsid}
            onChangeText={(accessPointSsid) => setDraft({ ...draft, accessPointSsid })}
          />
          <Field
            label="Senha do Wi-Fi da IHM"
            value={draft.accessPointPassword}
            onChangeText={(accessPointPassword) => setDraft({ ...draft, accessPointPassword })}
            secureTextEntry
          />
          {stepFourErrors.length > 0 ? (
            <InlineNotice title="Campos a revisar" message={stepFourErrors.join(' ')} tone="warning" />
          ) : null}
          <View style={styles.rowActions}>
            <ActionButton label="Voltar" onPress={() => setStep(2)} variant="ghost" />
            <ActionButton
              label="Avancar"
              onPress={() => setStep(4)}
              variant="secondary"
              disabled={stepFourErrors.length > 0}
            />
          </View>
        </SurfaceCard>
      ) : null}

      {step === 4 ? (
        <SurfaceCard title="5. Revisar e concluir" subtitle="O cadastro fica salvo localmente e preparado para futura sincronizacao de estado e agendamentos.">
          <View style={styles.review}>
            <Text style={styles.reviewTitle}>{draft.name}</Text>
            <Text style={styles.reviewText}>deviceId: {draft.deviceId || discovered?.deviceId || 'a definir'}</Text>
            <Text style={styles.reviewText}>Local: {draft.location}</Text>
            <Text style={styles.reviewText}>Metodo: {draft.method}</Text>
            <Text style={styles.reviewText}>Broker: {draft.brokerUrl}:{draft.brokerPort}</Text>
            <Text style={styles.reviewText}>Host local: {draft.host}:{draft.localPort}</Text>
            <Text style={styles.reviewText}>Topicos: {draft.topicPrefix}</Text>
          </View>
          <InlineNotice
            title="Pronto para salvar"
            message="Se o protocolo do firmware mudar, voce podera ajustar os contratos centralizados sem refazer o cadastro."
            tone="info"
          />
          <View style={styles.rowActions}>
            <ActionButton label="Voltar" onPress={() => setStep(3)} variant="ghost" />
            <ActionButton
              label="Salvar climatizador"
              onPress={() => onComplete(buildDeviceFromDraft(draft, discovered))}
            />
          </View>
        </SurfaceCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  stepIndicator: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: typography.label,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressStep: {
    flex: 1,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceStrong,
  },
  progressStepActive: {
    backgroundColor: colors.accent,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  methodCard: {
    flex: 1,
    minWidth: 220,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  methodCardSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  methodTitle: {
    fontSize: typography.section,
    fontWeight: '700',
    color: colors.text,
  },
  methodTitleSelected: {
    color: '#FFFFFF',
  },
  methodDescription: {
    fontSize: typography.body,
    color: colors.textMuted,
    lineHeight: 21,
  },
  methodDescriptionSelected: {
    color: 'rgba(255,255,255,0.84)',
  },
  discoveryBox: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  discoveryLabel: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  discoveryValue: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  review: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  reviewTitle: {
    fontSize: typography.title,
    fontWeight: '800',
    color: colors.text,
  },
  reviewText: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
});
