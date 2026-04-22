import type { DeviceCommandMessage } from '@/src/protocol';
import {
  parseCapabilitiesPayload,
  parseDiagnosticsPayload,
  parseErrorsPayload,
  parseEventsPayload,
  parseStatePayload,
  parseStatusPayload,
  serializeProtocolPayload,
} from '@/src/protocol';
import {
  createCapabilitiesPatch,
  createDiagnosticsPatch,
  createErrorsPatch,
  createEventsPatch,
  createProtocolBundleFromSnapshot,
  createStatePatch,
  createStatusPatch,
} from '@/src/services/device-service';
import type { DeviceSnapshot, Schedule } from '@/src/types';

import { simulationEngine } from './simulation-engine';
import type { DeviceTransportAdapter } from './types';

function createSimulationPatch(deviceId: string, snapshot: DeviceSnapshot, current: DeviceSnapshot) {
  const bundle = createProtocolBundleFromSnapshot(deviceId, snapshot, 'simulation');
  const status = parseStatusPayload(serializeProtocolPayload(bundle.status));
  const state = parseStatePayload(serializeProtocolPayload(bundle.state));
  const capabilities = parseCapabilitiesPayload(serializeProtocolPayload(bundle.capabilities));
  const diagnostics = parseDiagnosticsPayload(serializeProtocolPayload(bundle.diagnostics));
  const events = parseEventsPayload(serializeProtocolPayload(bundle.events));
  const errors = parseErrorsPayload(serializeProtocolPayload(bundle.errors));

  return {
    ...createCapabilitiesPatch(capabilities),
    ...createStatusPatch(status, 'simulation'),
    ...createStatePatch(state, 'simulation'),
    ...createDiagnosticsPatch(diagnostics),
    ...createEventsPatch(events),
    ...(errors.errors.length > 0 ? createErrorsPatch(errors, current) : {}),
    commands: snapshot.commands,
  };
}

export const simulationTransport: DeviceTransportAdapter = {
  mode: 'simulation',

  async start(context) {
    const initialSnapshot = simulationEngine.getSnapshot(context.device.deviceId);
    context.onSnapshot(createSimulationPatch(context.device.deviceId, initialSnapshot, context.getSnapshot()));

    const timer = setInterval(() => {
      const snapshot = simulationEngine.tick(context.device.deviceId, context.getSchedules());
      context.onSnapshot(createSimulationPatch(context.device.deviceId, snapshot, context.getSnapshot()));
    }, 1800);

    return {
      mode: 'simulation',
      refresh: async () => {
        const snapshot = simulationEngine.tick(context.device.deviceId, context.getSchedules());
        context.onSnapshot(createSimulationPatch(context.device.deviceId, snapshot, context.getSnapshot()));
      },
      dispose: async () => {
        clearInterval(timer);
      },
    };
  },

  async testConnection(device) {
    return {
      ok: true,
      mode: 'simulation',
      message: `Simulacao ativa para ${device.name}.`,
      latencyMs: 20,
    };
  },

  async sendCommand(device, command: DeviceCommandMessage) {
    const snapshot = simulationEngine.applyCommand(device.deviceId, command);
    return createSimulationPatch(device.deviceId, snapshot, snapshot);
  },

  async saveSchedules(_device, schedules: Schedule[]) {
    return schedules;
  },
};
