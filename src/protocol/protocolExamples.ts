import { PROTOCOL_SCHEMA_VERSION } from './common';
import type { DeviceCapabilitiesPayload } from './deviceCapabilities';
import type { DeviceCommandAckPayload, DeviceCommandMessage } from './commandTypes';
import type {
  DeviceDiagnosticsPayload,
  DeviceStatePayload,
  DeviceStatusPayload,
} from './deviceState';
import type { DeviceErrorsPayload, DeviceEventsPayload } from './messages';
import { buildMqttTopics } from './mqttTopics';
import { serializeProtocolPayload } from './serialization';
import type { DeviceSchedulesPayload } from './scheduleContract';

export const protocolExampleTopics = buildMqttTopics('axon/devices', 'esp32-clima-001');

export const exampleStatusPayload: DeviceStatusPayload = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:00.000Z',
  source: 'ihm',
  status: {
    deviceOnline: true,
    connectionMode: 'cloud',
    lastSeen: '2026-04-22T14:00:00.000Z',
    readyState: 'running',
  },
};

export const exampleStatePayload: DeviceStatePayload = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:01.000Z',
  source: 'ihm',
  state: {
    deviceOnline: true,
    connectionMode: 'cloud',
    inverterRunning: true,
    freqCurrentHz: 34,
    freqTargetHz: 36,
    pumpState: 'on',
    swingState: 'off',
    drainState: 'off',
    waterLevelState: 'ok',
    lastSeen: '2026-04-22T14:00:01.000Z',
    lastCommandStatus: 'applied',
    lastErrorCode: null,
    readyState: 'running',
  },
};

export const exampleCapabilitiesPayload: DeviceCapabilitiesPayload = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:02.000Z',
  source: 'ihm',
  capabilities: {
    fMinHz: 18,
    fMaxHz: 60,
    pumpAvailable: true,
    swingAvailable: true,
    drainAvailable: true,
    waterSensorEnabled: true,
    drainMode: 'timed',
    drainTimeSec: 45,
    drainReturnDelaySec: 15,
    pumpLogicMode: 'linked',
    waterSensorMode: 'normal',
    preWetSec: 8,
    dryPanelSec: 20,
    dryPanelFreqHz: 22,
    resumeMode: 'resume-last-state',
    autoResetMode: 'enabled',
  },
};

export const examplePowerOnCommand: DeviceCommandMessage<'power-on'> = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:03.000Z',
  source: 'app',
  id: 'cmd-001',
  type: 'power-on',
  payload: {},
};

export const exampleSetFrequencyCommand: DeviceCommandMessage<'set-frequency'> = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:04.000Z',
  source: 'app',
  id: 'cmd-002',
  type: 'set-frequency',
  payload: {
    freqTargetHz: 40,
  },
};

export const examplePowerOffCommand: DeviceCommandMessage<'power-off'> = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:04.500Z',
  source: 'app',
  id: 'cmd-003',
  type: 'power-off',
  payload: {},
};

export const examplePumpOnCommand: DeviceCommandMessage<'set-pump'> = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:04.600Z',
  source: 'app',
  id: 'cmd-004',
  type: 'set-pump',
  payload: {
    enabled: true,
  },
};

export const examplePumpOffCommand: DeviceCommandMessage<'set-pump'> = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:04.700Z',
  source: 'app',
  id: 'cmd-005',
  type: 'set-pump',
  payload: {
    enabled: false,
  },
};

export const exampleSwingOnCommand: DeviceCommandMessage<'set-swing'> = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:04.800Z',
  source: 'app',
  id: 'cmd-006',
  type: 'set-swing',
  payload: {
    enabled: true,
  },
};

export const exampleSwingOffCommand: DeviceCommandMessage<'set-swing'> = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:04.900Z',
  source: 'app',
  id: 'cmd-007',
  type: 'set-swing',
  payload: {
    enabled: false,
  },
};

export const exampleStartDrainCommand: DeviceCommandMessage<'run-drain'> = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:05.000Z',
  source: 'app',
  id: 'cmd-008',
  type: 'run-drain',
  payload: {
    reason: 'manual',
  },
};

export const exampleCommandAckPayload: DeviceCommandAckPayload = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:05.000Z',
  source: 'ihm',
  id: 'cmd-002',
  type: 'set-frequency',
  accepted: true,
  applied: true,
  status: 'applied',
  state: exampleStatePayload.state,
  error: null,
};

export const exampleDiagnosticsPayload: DeviceDiagnosticsPayload = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:06.000Z',
  source: 'ihm',
  diagnostics: {
    firmwareVersion: 'fw-0.9.4',
    connectionSummary: 'IHM sincronizada via broker MQTT.',
    transportStatus: 'connected',
    lastSyncAt: '2026-04-22T14:00:06.000Z',
    lastErrorMessage: null,
  },
};

export const exampleEventsPayload: DeviceEventsPayload = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:07.000Z',
  source: 'ihm',
  events: [
    {
      id: 'evt-001',
      deviceId: 'esp32-clima-001',
      level: 'info',
      title: 'Frequencia aplicada',
      message: 'A IHM confirmou a nova frequencia alvo de 40 Hz.',
      createdAt: '2026-04-22T14:00:07.000Z',
      code: 'FREQ_APPLIED',
    },
  ],
};

export const exampleErrorsPayload: DeviceErrorsPayload = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:08.000Z',
  source: 'ihm',
  errors: [
    {
      id: 'err-001',
      deviceId: 'esp32-clima-001',
      code: 'WATER_LOW',
      message: 'Sensor detectou falta de agua durante a operacao.',
      createdAt: '2026-04-22T14:00:08.000Z',
      recoverable: true,
    },
  ],
};

export const exampleSchedulesPayload: DeviceSchedulesPayload = {
  schema: PROTOCOL_SCHEMA_VERSION,
  deviceId: 'esp32-clima-001',
  timestamp: '2026-04-22T14:00:09.000Z',
  source: 'app',
  revision: 'local-001',
  schedules: [
    {
      id: 'sch-001',
      deviceId: 'esp32-clima-001',
      type: 'power-on',
      recurrence: 'daily',
      enabled: true,
      time: '07:30',
      daysOfWeek: [1, 2, 3, 4, 5],
      oneShotDate: null,
      createdAt: '2026-04-22T13:00:00.000Z',
      updatedAt: '2026-04-22T13:30:00.000Z',
    },
  ],
};

export const protocolJsonExamples = {
  status: serializeProtocolPayload(exampleStatusPayload, true),
  state: serializeProtocolPayload(exampleStatePayload, true),
  capabilities: serializeProtocolPayload(exampleCapabilitiesPayload, true),
  commandPowerOn: serializeProtocolPayload(examplePowerOnCommand, true),
  commandPowerOff: serializeProtocolPayload(examplePowerOffCommand, true),
  commandSetFrequency: serializeProtocolPayload(exampleSetFrequencyCommand, true),
  commandPumpOn: serializeProtocolPayload(examplePumpOnCommand, true),
  commandPumpOff: serializeProtocolPayload(examplePumpOffCommand, true),
  commandSwingOn: serializeProtocolPayload(exampleSwingOnCommand, true),
  commandSwingOff: serializeProtocolPayload(exampleSwingOffCommand, true),
  commandStartDrain: serializeProtocolPayload(exampleStartDrainCommand, true),
  schedules: serializeProtocolPayload(exampleSchedulesPayload, true),
  events: serializeProtocolPayload(exampleEventsPayload, true),
  errors: serializeProtocolPayload(exampleErrorsPayload, true),
};
