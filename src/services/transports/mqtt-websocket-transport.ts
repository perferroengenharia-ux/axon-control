import type { ClimateDevice, ConnectionTestResult, Schedule } from '@/src/types';
import {
  PROTOCOL_SCHEMA_VERSION,
  buildMqttTopics,
  detectMqttTopicKey,
  parseCapabilitiesPayload,
  parseCommandAckPayload,
  parseErrorsPayload,
  parseEventsPayload,
  parseSchedulesPayload,
  parseStatePayload,
  parseStatusPayload,
  serializeProtocolPayload,
  type DeviceCapabilitiesPayload,
  type DeviceCommandMessage,
  type DeviceDiagnosticsPayload,
  type MqttTopicContract,
} from '@/src/protocol';
import {
  createCapabilitiesPatch,
  createCommandAckPatch,
  createDeviceCommandMessage,
  createDiagnosticsPatch,
  createErrorsPatch,
  createEventsPatch,
  fromProtocolSchedules,
  createSchedulesPayload,
  createStatePatch,
  createStatusPatch,
  getChangedCapabilityFields,
  toProtocolSchedules,
} from '@/src/services/device-service';
import { isoNow } from '@/src/utils/date';

import type {
  DeviceTransportAdapter,
  TransportSession,
  TransportStartContext,
} from './types';

type MqttConnect = typeof import('mqtt').connect;
type MqttClientInstance = ReturnType<MqttConnect>;
type MqttModuleCandidate = {
  connect?: MqttConnect;
  default?: MqttModuleCandidate;
  'module.exports'?: MqttModuleCandidate;
};

interface ActiveMqttSession {
  client: MqttClientInstance;
  context: TransportStartContext;
  topics: MqttTopicContract;
  connected: boolean;
  pendingCommands: Map<string, DeviceCommandMessage>;
}

const activeSessions = new Map<string, ActiveMqttSession>();

function normalizeBrokerUrl(device: ClimateDevice) {
  const raw = device.mqttConfig.brokerUrl.trim();

  if (!raw) {
    throw new Error('Broker MQTT nao informado.');
  }

  const websocketProtocol = device.mqttConfig.protocol;
  const adaptedRaw = raw.replace(/^mqtts?:\/\//i, `${websocketProtocol}://`);
  const withProtocol = /^wss?:\/\//i.test(adaptedRaw)
    ? adaptedRaw
    : `${websocketProtocol}://${adaptedRaw}`;
  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(
      'Broker MQTT invalido. Use algo como b11f6b00.ala.eu-central-1.emqxsl.com/mqtt.',
    );
  }

  url.protocol = `${device.mqttConfig.protocol}:`;
  url.port = String(device.mqttConfig.port);

  if (
    (url.protocol === 'ws:' || url.protocol === 'wss:') &&
    (!url.pathname || url.pathname === '/')
  ) {
    url.pathname = '/mqtt';
  }

  return url.toString();
}

async function loadMqttModule() {
  const loaded = (await import('mqtt')) as MqttModuleCandidate;
  const candidates = [
    loaded,
    loaded.default,
    loaded['module.exports'],
    loaded.default?.default,
    loaded.default?.['module.exports'],
  ];
  const mqtt = candidates.find(
    (candidate): candidate is { connect: MqttConnect } =>
      typeof candidate?.connect === 'function',
  );

  if (!mqtt) {
    throw new Error(
      'Biblioteca MQTT carregada sem funcao connect. Reinicie o Expo/Web para limpar o bundle antigo.',
    );
  }

  return mqtt;
}

function createConnectOptions(
  device: ClimateDevice,
  reconnectPeriod: number,
  connectTimeout = 4000,
) {
  return {
    username: device.mqttConfig.username?.trim() || undefined,
    password: device.mqttConfig.password || undefined,
    reconnectPeriod,
    connectTimeout,
    protocolVersion: 4 as const,
    clean: true,
    clientId: `axon-app-${device.deviceId
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-12)}-${Math.random().toString(16).slice(2, 8)}`,
  };
}

function formatMqttError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function buildWaitingCommandPatch(device: ClimateDevice) {
  return {
    diagnostics: {
      firmwareVersion: device.firmwareVersion ?? 'desconhecida',
      connectionSummary: 'Comando entregue ao broker MQTT. Aguardando confirmacao da IHM.',
      transportStatus: 'connected' as const,
      lastSyncAt: isoNow(),
      lastErrorMessage: null,
    },
  };
}

function publishMqttMessage(
  client: MqttClientInstance,
  topic: string,
  payload: string,
  description: string,
) {
  return new Promise<void>((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (error?: Error | null) => {
      if (error) {
        reject(new Error(`${description}: ${error.message}`));
        return;
      }

      resolve();
    });
  });
}

async function publishThroughTransientConnection(
  device: ClimateDevice,
  topic: string,
  payload: string,
  description: string,
) {
  const mqtt = await loadMqttModule();
  const brokerUrl = normalizeBrokerUrl(device);

  await new Promise<void>((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, createConnectOptions(device, 0, 6000));
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finalize = (error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      client.end(false);

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    client.once('connect', () => {
      void publishMqttMessage(client, topic, payload, description)
        .then(() => finalize())
        .catch((error) =>
          finalize(
            error instanceof Error
              ? error
              : new Error('Falha ao publicar na conexao MQTT temporaria.'),
          ),
        );
    });

    client.once('error', (error: Error) => {
      finalize(
        new Error(
          `Falha MQTT WebSocket temporaria: ${formatMqttError(
            error,
            'erro sem detalhe informado pelo broker',
          )}.`,
        ),
      );
    });

    timeoutId = setTimeout(() => {
      finalize(
        new Error(
          `Tempo esgotado ao abrir conexao temporaria para ${description.toLowerCase()} via MQTT WebSocket.`,
        ),
      );
    }, 8000);
  });
}

function tryHandleCommandAck(session: ActiveMqttSession, payload: unknown) {
  try {
    const ack = parseCommandAckPayload(serializeProtocolPayload(payload));
    const pendingCommand = session.pendingCommands.get(ack.id);

    if (pendingCommand) {
      session.pendingCommands.delete(ack.id);
    }

    session.context.onSnapshot(
      createCommandAckPatch(ack, session.context.getSnapshot(), pendingCommand),
    );

    return true;
  } catch {
    return false;
  }
}

export const mqttWebSocketTransport: DeviceTransportAdapter = {
  mode: 'cloud',

  async start(context) {
    const mqtt = await loadMqttModule();
    const topics = buildMqttTopics(context.device.mqttConfig.topicPrefix, context.device.deviceId);
    const client = mqtt.connect(
      normalizeBrokerUrl(context.device),
      createConnectOptions(context.device, 5000),
    );
    const session: ActiveMqttSession = {
      client,
      context,
      topics,
      connected: false,
      pendingCommands: new Map(),
    };

    activeSessions.set(context.device.id, session);

    client.on('connect', () => {
      session.connected = true;
      client.subscribe([
        topics.status,
        topics.capabilities,
        topics.state,
        topics.events,
        topics.errors,
        topics.schedules,
      ]);

      context.onSnapshot(
        createDiagnosticsPatch({
          schema: PROTOCOL_SCHEMA_VERSION,
          deviceId: context.device.deviceId,
          timestamp: isoNow(),
          source: 'app',
          diagnostics: {
            ...context.getSnapshot().diagnostics,
            connectionSummary: 'Broker MQTT conectado por WebSocket.',
            transportStatus: 'connected',
            lastSyncAt: isoNow(),
            lastErrorMessage: null,
          },
        } satisfies DeviceDiagnosticsPayload),
      );
    });

    client.on('close', () => {
      session.connected = false;
    });

    client.on('message', (topic: string, buffer: Uint8Array | { toString(): string }) => {
      try {
        const raw =
          buffer instanceof Uint8Array ? new TextDecoder().decode(buffer) : buffer.toString();
        const payload = JSON.parse(raw);
        const topicKey = detectMqttTopicKey(topics, topic);

        switch (topicKey) {
          case 'capabilities': {
            const capabilitiesPayload = parseCapabilitiesPayload(
              serializeProtocolPayload(payload as DeviceCapabilitiesPayload),
            );
            const currentSnapshot = context.getSnapshot();
            const changedFields = getChangedCapabilityFields(
              currentSnapshot.capabilities,
              capabilitiesPayload.capabilities,
            );

            if (changedFields.length > 0) {
              console.info(
                `[mqtt] Capabilities atualizadas para ${context.device.deviceId}: ${changedFields.join(', ')}`,
              );
            } else {
              console.info(
                `[mqtt] Snapshot inicial/reconfirmado de capabilities para ${context.device.deviceId}`,
              );
            }

            context.onSnapshot(
              {
                ...createCapabilitiesPatch(capabilitiesPayload),
                diagnostics: {
                  ...currentSnapshot.diagnostics,
                  transportStatus: 'connected',
                  connectionSummary:
                    changedFields.length > 0
                      ? `Capabilities atualizadas pela IHM: ${changedFields.join(', ')}.`
                      : 'Capabilities confirmadas pela IHM.',
                  lastSyncAt: isoNow(),
                  lastErrorMessage: null,
                },
              },
            );
            break;
          }
          case 'status':
            context.onSnapshot({
              ...createStatusPatch(
                parseStatusPayload(serializeProtocolPayload(payload)),
                'cloud',
              ),
              diagnostics: {
                ...context.getSnapshot().diagnostics,
                transportStatus: 'connected',
                connectionSummary: 'Status confirmado pelo broker MQTT.',
                lastSyncAt: isoNow(),
                lastErrorMessage: null,
              },
            });
            break;
          case 'state':
            context.onSnapshot({
              ...createStatePatch(
                parseStatePayload(serializeProtocolPayload(payload)),
                'cloud',
              ),
              diagnostics: {
                ...context.getSnapshot().diagnostics,
                transportStatus: 'connected',
                connectionSummary: 'Estado confirmado pelo broker MQTT.',
                lastSyncAt: isoNow(),
                lastErrorMessage: null,
              },
            });
            break;
          case 'events':
            if (tryHandleCommandAck(session, payload)) {
              break;
            }

            context.onSnapshot(
              createEventsPatch(parseEventsPayload(serializeProtocolPayload(payload))),
            );
            break;
          case 'errors':
            if (tryHandleCommandAck(session, payload)) {
              break;
            }

            context.onSnapshot(
              createErrorsPatch(
                parseErrorsPayload(serializeProtocolPayload(payload)),
                context.getSnapshot(),
              ),
            );
            break;
          case 'schedules': {
            const schedulesPayload = parseSchedulesPayload(serializeProtocolPayload(payload));
            context.onSchedules?.(
              context.device.id,
              fromProtocolSchedules(context.device, schedulesPayload.schedules),
            );
            break;
          }
          default:
            break;
        }
      } catch (error) {
        context.onError?.(
          error instanceof Error ? error.message : 'Falha ao ler payload MQTT.',
        );
      }
    });

    client.on('error', (error: Error) => {
      context.onSnapshot({
        diagnostics: {
          ...context.getSnapshot().diagnostics,
          transportStatus: 'error',
          connectionSummary: 'Erro ao manter conexao MQTT.',
          lastErrorMessage: error.message,
          lastSyncAt: isoNow(),
        },
      });
    });

    return {
      mode: 'cloud',
      refresh: async () => {
        const refreshCommand = createDeviceCommandMessage(
          context.device.deviceId,
          'request-status',
          { includeDiagnostics: true },
        );

        await publishMqttMessage(
          client,
          topics.commands,
          serializeProtocolPayload(refreshCommand),
          'Falha ao solicitar status',
        );
      },
      dispose: async () => {
        session.connected = false;
        session.pendingCommands.clear();

        if (activeSessions.get(context.device.id)?.client === client) {
          activeSessions.delete(context.device.id);
        }

        client.end(true);
      },
    } satisfies TransportSession;
  },

  async testConnection(device) {
    const mqtt = await loadMqttModule();
    let brokerUrl: string;

    try {
      brokerUrl = normalizeBrokerUrl(device);
    } catch (error) {
      return {
        ok: false,
        mode: 'cloud',
        message: formatMqttError(error, 'Configuracao MQTT invalida.'),
      };
    }

    return await new Promise<ConnectionTestResult>((resolve) => {
      const startedAt = Date.now();
      const client = mqtt.connect(brokerUrl, createConnectOptions(device, 0, 6000));
      let settled = false;
      let connected = false;
      const timeout = setTimeout(() => {
        finalize(
          false,
          `Tempo esgotado ao conectar em ${brokerUrl}. Confira se o app esta usando WSS na porta 8084 e o caminho /mqtt.`,
        );
      }, 8000);

      const finalize = (ok: boolean, message: string) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        client.end(false);
        resolve({
          ok,
          mode: 'cloud' as const,
          message,
          latencyMs: ok ? Date.now() - startedAt : undefined,
        });
      };

      client.once('connect', () => {
        connected = true;
        finalize(true, `Broker MQTT respondeu via WebSocket em ${brokerUrl}.`);
      });
      client.once('error', (error: Error) =>
        finalize(
          false,
          `Falha MQTT WebSocket: ${formatMqttError(
            error,
            'erro sem detalhe informado pelo broker',
          )}. Confira usuario/senha do app, ACL, porta 8084 e endpoint /mqtt.`,
        ),
      );
      client.once('close', () => {
        if (!connected) {
          finalize(
            false,
            `Conexao WebSocket encerrada antes do CONNACK em ${brokerUrl}. Verifique se WebSocket/WSS esta habilitado no EMQX e se o caminho /mqtt esta correto.`,
          );
        }
      });
    });
  },

  async sendCommand(device, command) {
    const topics = buildMqttTopics(device.mqttConfig.topicPrefix, device.deviceId);
    const payload = serializeProtocolPayload(command);
    const activeSession = activeSessions.get(device.id);

    if (activeSession?.connected) {
      activeSession.pendingCommands.set(command.id, command);

      await publishMqttMessage(
        activeSession.client,
        topics.commands,
        payload,
        'Falha ao publicar comando MQTT',
      );

      return buildWaitingCommandPatch(device);
    }

    await publishThroughTransientConnection(
      device,
      topics.commands,
      payload,
      'publicar comando MQTT',
    );

    return buildWaitingCommandPatch(device);
  },

  async saveSchedules(device, schedules: Schedule[]) {
    const topics = buildMqttTopics(device.mqttConfig.topicPrefix, device.deviceId);
    const payload = createSchedulesPayload(device.deviceId, toProtocolSchedules(device, schedules));
    const serialized = serializeProtocolPayload(payload);
    const activeSession = activeSessions.get(device.id);

    if (activeSession?.connected) {
      await publishMqttMessage(
        activeSession.client,
        topics.schedules,
        serialized,
        'Falha ao publicar agendamentos MQTT',
      );

      return schedules;
    }

    await publishThroughTransientConnection(
      device,
      topics.schedules,
      serialized,
      'publicar agendamentos MQTT',
    );

    return schedules;
  },
};
