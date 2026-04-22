import type { ClimateDevice, Schedule } from '@/src/types';
import {
  PROTOCOL_SCHEMA_VERSION,
  buildMqttTopics,
  detectMqttTopicKey,
  parseCapabilitiesPayload,
  parseErrorsPayload,
  parseEventsPayload,
  parseSchedulesPayload,
  parseStatePayload,
  parseStatusPayload,
  serializeProtocolPayload,
  type DeviceCapabilitiesPayload,
  type DeviceDiagnosticsPayload,
} from '@/src/protocol';
import {
  createCapabilitiesPatch,
  createDeviceCommandMessage,
  createDiagnosticsPatch,
  createErrorsPatch,
  createEventsPatch,
  createSchedulesPayload,
  createStatePatch,
  createStatusPatch,
} from '@/src/services/device-service';
import { isoNow } from '@/src/utils/date';

import type { DeviceTransportAdapter } from './types';

type BrowserMqttModule = typeof import('mqtt/dist/mqtt');

function normalizeBrokerUrl(device: ClimateDevice) {
  const raw = device.mqttConfig.brokerUrl.trim();

  if (!raw) {
    throw new Error('Broker MQTT nao informado.');
  }

  const withProtocol = /^wss?:\/\//.test(raw) ? raw : `${device.mqttConfig.protocol}://${raw}`;
  const url = new URL(withProtocol);
  url.protocol = `${device.mqttConfig.protocol}:`;
  url.port = String(device.mqttConfig.port);
  return url.toString();
}

async function loadMqttModule() {
  return (await import('mqtt/dist/mqtt')) as BrowserMqttModule;
}

export const mqttWebSocketTransport: DeviceTransportAdapter = {
  mode: 'cloud',

  async start(context) {
    const mqtt = await loadMqttModule();
    const topics = buildMqttTopics(context.device.mqttConfig.topicPrefix, context.device.deviceId);

    const client = mqtt.connect(normalizeBrokerUrl(context.device), {
      username: context.device.mqttConfig.username,
      password: context.device.mqttConfig.password,
      reconnectPeriod: 5000,
      connectTimeout: 4000,
      clientId: `axon-app-${Math.random().toString(16).slice(2, 8)}`,
    });

    client.on('connect', () => {
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

    client.on('message', (topic: string, buffer: Uint8Array | { toString(): string }) => {
      try {
        const raw =
          buffer instanceof Uint8Array ? new TextDecoder().decode(buffer) : buffer.toString();
        const payload = JSON.parse(raw);
        const topicKey = detectMqttTopicKey(topics, topic);

        switch (topicKey) {
          case 'capabilities':
            context.onSnapshot(
              createCapabilitiesPatch(
                parseCapabilitiesPayload(serializeProtocolPayload(payload as DeviceCapabilitiesPayload)),
              ),
            );
            break;
          case 'status':
            context.onSnapshot({
              ...createStatusPatch(parseStatusPayload(serializeProtocolPayload(payload)), 'cloud'),
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
              ...createStatePatch(parseStatePayload(serializeProtocolPayload(payload)), 'cloud'),
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
            context.onSnapshot(
              createEventsPatch(parseEventsPayload(serializeProtocolPayload(payload))),
            );
            break;
          case 'errors':
            context.onSnapshot(
              createErrorsPatch(
                parseErrorsPayload(serializeProtocolPayload(payload)),
                context.getSnapshot(),
              ),
            );
            break;
          case 'schedules': {
            const schedulesPayload = parseSchedulesPayload(serializeProtocolPayload(payload));
            context.onSchedules?.(context.device.id, schedulesPayload.schedules);
            break;
          }
          default:
            break;
        }
      } catch (error) {
        context.onError?.(error instanceof Error ? error.message : 'Falha ao ler payload MQTT.');
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
        client.publish(topics.commands, serializeProtocolPayload(refreshCommand));
      },
      dispose: async () => {
        client.end(true);
      },
    };
  },

  async testConnection(device) {
    const mqtt = await loadMqttModule();

    return await new Promise((resolve) => {
      const startedAt = Date.now();
      const client = mqtt.connect(normalizeBrokerUrl(device), {
        username: device.mqttConfig.username,
        password: device.mqttConfig.password,
        reconnectPeriod: 0,
        connectTimeout: 4000,
      });

      const finalize = (ok: boolean, message: string) => {
        client.end(true);
        resolve({
          ok,
          mode: 'cloud' as const,
          message,
          latencyMs: ok ? Date.now() - startedAt : undefined,
        });
      };

      client.once('connect', () => finalize(true, 'Broker MQTT respondeu via WebSocket.'));
      client.once('error', (error: Error) => finalize(false, error.message));
    });
  },

  async sendCommand(device, command) {
    const mqtt = await loadMqttModule();
    const topics = buildMqttTopics(device.mqttConfig.topicPrefix, device.deviceId);

    return await new Promise((resolve, reject) => {
      const client = mqtt.connect(normalizeBrokerUrl(device), {
        username: device.mqttConfig.username,
        password: device.mqttConfig.password,
        reconnectPeriod: 0,
        connectTimeout: 4000,
      });

      client.once('connect', () => {
        client.publish(topics.commands, serializeProtocolPayload(command), {}, (error?: Error | null) => {
          client.end(true);

          if (error) {
            reject(error);
            return;
          }

          resolve({
            diagnostics: {
              firmwareVersion: device.firmwareVersion ?? 'desconhecida',
              connectionSummary: 'Comando publicado para o broker MQTT.',
              transportStatus: 'connected',
              lastSyncAt: isoNow(),
              lastErrorMessage: null,
            },
          });
        });
      });

      client.once('error', (error: Error) => {
        client.end(true);
        reject(error);
      });
    });
  },

  async saveSchedules(device, schedules: Schedule[]) {
    const mqtt = await loadMqttModule();
    const topics = buildMqttTopics(device.mqttConfig.topicPrefix, device.deviceId);
    const payload = createSchedulesPayload(device.deviceId, schedules);

    return await new Promise((resolve, reject) => {
      const client = mqtt.connect(normalizeBrokerUrl(device), {
        username: device.mqttConfig.username,
        password: device.mqttConfig.password,
        reconnectPeriod: 0,
        connectTimeout: 4000,
      });

      client.once('connect', () => {
        client.publish(topics.schedules, serializeProtocolPayload(payload), {}, (error?: Error | null) => {
          client.end(true);

          if (error) {
            reject(error);
            return;
          }

          resolve(schedules);
        });
      });

      client.once('error', (error: Error) => {
        client.end(true);
        reject(error);
      });
    });
  },
};
