import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ActionButton } from '@/src/components/action-button';
import { EmptyState } from '@/src/components/empty-state';
import { InlineNotice } from '@/src/components/inline-notice';
import { LoadingState } from '@/src/components/loading-state';
import { PageHeader } from '@/src/components/page-header';
import { Screen } from '@/src/components/screen';
import { ConnectionForm } from '@/src/features/connection/connection-form';
import { useAppStore } from '@/src/store';
import type { ClimateDevice, ConnectionMode } from '@/src/types';
import { validateLocalConfig, validateMqttConfig } from '@/src/utils/validation';

export default function ConnectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { state, upsertDevice, testConnection } = useAppStore();

  const device = useMemo(
    () => state.devices.find((entry) => entry.id === params.id) ?? null,
    [params.id, state.devices],
  );
  const [draft, setDraft] = useState<ClimateDevice | null>(device);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'danger'; message: string } | null>(null);
  const [testingMode, setTestingMode] = useState<ConnectionMode | null>(null);

  useEffect(() => {
    setDraft(device);
  }, [device]);

  if (!state.hydrated) {
    return (
      <Screen>
        <PageHeader eyebrow="Conectividade" title="Carregando configuracoes" subtitle="Estamos restaurando o cadastro antes de abrir os detalhes de conexao." />
        <LoadingState description="Buscando as configuracoes salvas deste climatizador." />
      </Screen>
    );
  }

  if (!device || !draft) {
    return (
      <Screen>
        <PageHeader eyebrow="Conectividade" title="Climatizador nao encontrado" subtitle="O cadastro pode ter sido removido antes da abertura desta tela." />
        <EmptyState
          title="Nao foi possivel carregar"
          description="Volte para a lista de climatizadores e abra novamente a configuracao de conexao."
          action={<ActionButton label="Ir para dispositivos" onPress={() => router.replace('/devices')} />}
        />
      </Screen>
    );
  }

  const requiresCloud =
    draft.preferredConnectionMode === 'cloud' || draft.preferredConnectionMode === 'auto';
  const requiresLocal =
    draft.preferredConnectionMode === 'local-lan' ||
    draft.preferredConnectionMode === 'local-ap' ||
    draft.preferredConnectionMode === 'auto';
  const mqttErrors =
    draft.preferredConnectionMode === 'simulation' || !requiresCloud
      ? []
      : validateMqttConfig(draft.mqttConfig);
  const localErrors =
    !requiresLocal || draft.preferredConnectionMode === 'simulation'
      ? []
      : validateLocalConfig(draft.localConfig);
  const hasErrors = mqttErrors.length > 0 || localErrors.length > 0;

  const runTest = async (mode: ConnectionMode) => {
    setTestingMode(mode);
    setFeedback(null);

    try {
      const result = await testConnection(draft.id, mode, draft);
      if (!result) {
        return;
      }

      setFeedback({
        tone: result.ok ? 'success' : 'danger',
        message: `${result.message}${result.latencyMs ? ` Latencia: ${result.latencyMs} ms.` : ''}`,
      });
    } finally {
      setTestingMode(null);
    }
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Conectividade"
        title={`Conexao de ${draft.name}`}
        subtitle="Cloud usa MQTT sobre WebSocket/WSS. O fallback local usa HTTP simples com polling leve para reduzir falhas multiplataforma."
      />

      <InlineNotice
        title="Decisao tecnica adotada"
        message="No modo local, a implementacao padrao usa HTTP + polling leve. Isso simplifica compatibilidade entre Android, iOS e web. No web, endpoints locais podem exigir CORS configurado na IHM."
      />

      {feedback ? (
        <InlineNotice
          title="Resultado do teste"
          message={feedback.message}
          tone={feedback.tone}
        />
      ) : null}

      {(mqttErrors.length > 0 || localErrors.length > 0) && draft.preferredConnectionMode !== 'simulation' ? (
        <InlineNotice
          title="Campos a revisar"
          message={[...mqttErrors, ...localErrors].join(' ')}
          tone="warning"
        />
      ) : null}

      <ConnectionForm value={draft} onChange={setDraft} />

      <ActionButton
        label="Salvar configuracoes"
        disabled={hasErrors}
        onPress={() => {
          upsertDevice({ device: draft });
          router.back();
        }}
      />

      <ActionButton
        label="Testar cloud MQTT"
        variant="ghost"
        loading={testingMode === 'cloud'}
        onPress={() => void runTest('cloud')}
      />
      <ActionButton
        label="Testar local"
        variant="ghost"
        loading={testingMode === 'local-lan' || testingMode === 'local-ap'}
        onPress={() => void runTest(draft.preferredConnectionMode === 'local-ap' ? 'local-ap' : 'local-lan')}
      />
    </Screen>
  );
}
