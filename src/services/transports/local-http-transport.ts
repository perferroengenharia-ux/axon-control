import type {
  ClimateDevice,
  ConnectionMode,
  DeviceSnapshot,
  DeviceSnapshotPatch,
  Schedule,
} from '@/src/types';
import {
  LOCAL_API_ENDPOINTS,
  parseCapabilitiesPayload,
  parseCommandAckPayload,
  parseDiagnosticsPayload,
  parseErrorsPayload,
  parseEventsPayload,
  parseSchedulesPayload,
  parseStatePayload,
  parseStatusPayload,
  serializeProtocolPayload,
  type LocalCapabilitiesResponse,
  type LocalCommandResponse,
  type LocalConnectionTestResponse,
  type LocalDiagnosticsResponse,
  type LocalErrorsResponse,
  type LocalEventsResponse,
  type LocalSchedulesResponse,
  type LocalStateResponse,
  type LocalStatusResponse,
} from '@/src/protocol';
import {
  createCapabilitiesPatch,
  createCommandRecord,
  createDiagnosticsPatch,
  createErrorsPatch,
  createEventsPatch,
  createStatePatch,
  createStatusPatch,
  createSchedulesPayload,
  fromProtocolSchedules,
  getChangedCapabilityFields,
  toProtocolSchedules,
} from '@/src/services/device-service';
import { isoNow } from '@/src/utils/date';

import type { DeviceTransportAdapter, TransportSession, TransportStartContext } from './types';

function getLocalMode(device: ClimateDevice): ConnectionMode {
  return device.preferredConnectionMode === 'local-ap' ? 'local-ap' : 'local-lan';
}

function buildBaseUrl(device: ClimateDevice) {
  const host = device.localConfig.host.startsWith('http')
    ? device.localConfig.host
    : `http://${device.localConfig.host}`;
  return `${host}:${device.localConfig.port}`;
}

async function fetchJson<T>(device: ClimateDevice, path: string, init?: RequestInit) {
  const response = await fetch(`${buildBaseUrl(device)}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchOptionalJson<T>(device: ClimateDevice, path: string) {
  try {
    return await fetchJson<T>(device, path);
  } catch (error) {
    if (error instanceof Error && /^HTTP 404$|^HTTP 405$/.test(error.message)) {
      return null;
    }

    throw error;
  }
}

function buildOfflinePatch(message: string, previous: DeviceSnapshot): DeviceSnapshotPatch {
  return {
    state: {
      ...previous.state,
      deviceOnline: false,
      readyState: 'offline',
      lastCommandStatus: previous.state.lastCommandStatus,
      lastErrorCode: 'LOCAL_HTTP',
    },
    diagnostics: {
      ...previous.diagnostics,
      transportStatus: 'error',
      connectionSummary: 'Falha ao conectar nos endpoints HTTP locais da IHM.',
      lastErrorMessage: message,
      lastSyncAt: previous.diagnostics.lastSyncAt,
    },
  };
}

async function refreshLocalSnapshot(
  device: ClimateDevice,
  previous: DeviceSnapshot,
): Promise<DeviceSnapshotPatch> {
  try {
    const [
      statusResponse,
      capabilitiesResponse,
      stateResponse,
      diagnosticsResponse,
      eventsResponse,
      errorsResponse,
    ] = await Promise.all([
      fetchJson<LocalStatusResponse>(device, LOCAL_API_ENDPOINTS.status),
      fetchJson<LocalCapabilitiesResponse>(device, LOCAL_API_ENDPOINTS.capabilities),
      fetchJson<LocalStateResponse>(device, LOCAL_API_ENDPOINTS.state),
      fetchJson<LocalDiagnosticsResponse>(device, LOCAL_API_ENDPOINTS.diagnostics),
      fetchOptionalJson<LocalEventsResponse>(device, LOCAL_API_ENDPOINTS.events),
      fetchOptionalJson<LocalErrorsResponse>(device, LOCAL_API_ENDPOINTS.errors),
    ]);
    const capabilitiesPayload = parseCapabilitiesPayload(capabilitiesResponse);
    const changedCapabilityFields = getChangedCapabilityFields(
      previous.capabilities,
      capabilitiesPayload.capabilities,
    );

    if (changedCapabilityFields.length > 0) {
      console.info(
        `[local-http] Capabilities atualizadas para ${device.deviceId}: ${changedCapabilityFields.join(', ')}`,
      );
    }

    return {
      ...createCapabilitiesPatch(capabilitiesPayload),
      ...createStatusPatch(parseStatusPayload(statusResponse), getLocalMode(device)),
      ...createStatePatch(parseStatePayload(stateResponse), getLocalMode(device)),
      ...createDiagnosticsPatch({
        ...parseDiagnosticsPayload(diagnosticsResponse),
        diagnostics: {
          ...diagnosticsResponse.diagnostics,
          connectionSummary:
            changedCapabilityFields.length > 0
              ? `Capabilities locais atualizadas pela IHM: ${changedCapabilityFields.join(', ')}.`
              : 'Sincronizado pela rede local da IHM.',
          transportStatus: 'connected',
          lastSyncAt: isoNow(),
        },
      }),
      ...(eventsResponse ? createEventsPatch(parseEventsPayload(eventsResponse)) : {}),
      ...(errorsResponse ? createErrorsPatch(parseErrorsPayload(errorsResponse), previous) : {}),
    };
  } catch (error) {
    return buildOfflinePatch(error instanceof Error ? error.message : 'Erro desconhecido.', previous);
  }
}

async function startPolling(context: TransportStartContext): Promise<TransportSession> {
  await Promise.resolve();

  const poll = async () => {
    const patch = await refreshLocalSnapshot(context.device, context.getSnapshot());
    context.onSnapshot(patch);
  };

  await poll();
  const timer = setInterval(poll, 5000);

  return {
    mode: getLocalMode(context.device),
    refresh: poll,
    dispose: async () => {
      clearInterval(timer);
    },
  };
}

export const localHttpTransport: DeviceTransportAdapter = {
  mode: 'local-lan',
  start: startPolling,

  async testConnection(device) {
    const startedAt = Date.now();

    try {
      const response = await fetchJson<LocalConnectionTestResponse>(
        device,
        LOCAL_API_ENDPOINTS.connectionTest,
      );

      return {
        ok: response.ok,
        mode: getLocalMode(device),
        message: response.message || 'IHM local respondeu ao teste HTTP.',
        latencyMs: response.ok ? Date.now() - startedAt : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        mode: getLocalMode(device),
        message:
          error instanceof Error ? error.message : 'Nao foi possivel validar o endpoint local.',
      };
    }
  },

  async sendCommand(device, command) {
    const response = await fetchJson<LocalCommandResponse>(device, LOCAL_API_ENDPOINTS.commands, {
      method: 'POST',
      body: serializeProtocolPayload({ command }),
    });
    const ack = parseCommandAckPayload(response);

    return {
      state: ack.state
        ? {
            ...ack.state,
            connectionMode: getLocalMode(device),
            lastCommandStatus: ack.status,
            lastErrorCode: ack.error?.code ?? ack.state.lastErrorCode ?? null,
          }
        : undefined,
      commands: [createCommandRecord(command, ack.status)],
      diagnostics: {
        firmwareVersion: device.firmwareVersion ?? 'desconhecida',
        connectionSummary: ack.accepted
          ? 'Comando confirmado via HTTP local.'
          : 'A IHM rejeitou o comando enviado pela rede local.',
        transportStatus: ack.accepted ? 'connected' : 'degraded',
        lastSyncAt: isoNow(),
        lastErrorMessage: ack.error?.message ?? null,
      },
      events: ack.error
        ? [
            {
              id: ack.error.id,
              deviceId: ack.error.deviceId,
              level: 'error',
              title: ack.error.code,
              message: ack.error.message,
              createdAt: ack.error.createdAt,
              code: ack.error.code,
            },
          ]
        : undefined,
    };
  },

  async saveSchedules(device, schedules: Schedule[]) {
    const payload = createSchedulesPayload(device.deviceId, toProtocolSchedules(device, schedules));
    const response = await fetchJson<LocalSchedulesResponse>(
      device,
      LOCAL_API_ENDPOINTS.schedules,
      {
        method: 'POST',
        body: serializeProtocolPayload(payload),
      },
    );

    return fromProtocolSchedules(device, parseSchedulesPayload(response).schedules);
  },
};
