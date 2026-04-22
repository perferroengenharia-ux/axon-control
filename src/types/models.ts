import type {
  ConnectionMode,
  DeviceCapabilitiesContract,
  DeviceCommandMessage,
  DeviceDiagnosticsContract,
  DeviceEventPayload,
  DeviceScheduleContract,
  DeviceStateContract,
  LastCommandStatus,
  MqttProtocol,
} from '@/src/protocol';

export type {
  AutoResetMode,
  ConnectionMode,
  DeviceCapabilitiesContract as DeviceCapabilities,
  DeviceCommandMessage,
  DeviceCommandPayload,
  DeviceCommandPayloadByType,
  DeviceCommandType as CommandType,
  DeviceDiagnosticsContract as DeviceDiagnostics,
  DeviceErrorPayload,
  DeviceEventPayload as DeviceEvent,
  DeviceScheduleContract as Schedule,
  DeviceStateContract as DeviceState,
  DeviceTransportStatus,
  DrainMode,
  LastCommandStatus,
  MqttProtocol,
  PeripheralState,
  PumpLogicMode,
  ReadyState,
  ResumeMode,
  ScheduleRecurrence,
  ScheduleType,
  WaterLevelState,
  WaterSensorMode,
} from '@/src/protocol';

export type ProvisionMethod = 'ihm-ap' | 'local-network' | 'manual-host' | 'simulation';

export type PreferredConnectionMode = ConnectionMode | 'auto';

export interface MQTTConfig {
  brokerUrl: string;
  port: number;
  protocol: MqttProtocol;
  username?: string;
  password?: string;
  topicPrefix: string;
  deviceId: string;
}

export interface LocalConfig {
  host: string;
  port: number;
  accessPointSsid?: string;
  accessPointPassword?: string;
}

export interface ClimateDevice {
  id: string;
  deviceId: string;
  name: string;
  location: string;
  notes?: string;
  preferredConnectionMode: PreferredConnectionMode;
  mqttConfig: MQTTConfig;
  localConfig: LocalConfig;
  lastSeen?: string | null;
  isFavorite: boolean;
  isSimulation: boolean;
  firmwareVersion?: string;
  seedCapabilities?: DeviceCapabilitiesContract;
}

export interface DeviceSecrets {
  mqttPassword?: string;
  localApPassword?: string;
}

export interface CommandRecord extends DeviceCommandMessage {
  status: LastCommandStatus;
}

export type Command = CommandRecord;

export interface DeviceSnapshot {
  capabilities: DeviceCapabilitiesContract;
  state: DeviceStateContract;
  diagnostics: DeviceDiagnosticsContract;
  commands: CommandRecord[];
  events: DeviceEventPayload[];
}

export interface DeviceSnapshotPatch {
  capabilities?: Partial<DeviceCapabilitiesContract>;
  state?: Partial<DeviceStateContract>;
  diagnostics?: Partial<DeviceDiagnosticsContract>;
  commands?: CommandRecord[];
  events?: DeviceEventPayload[];
}

export interface DeviceSummary extends ClimateDevice {
  snapshot: DeviceSnapshot;
}

export interface ConnectionTestResult {
  ok: boolean;
  mode: ConnectionMode;
  message: string;
  latencyMs?: number;
}

export interface AppPreferences {
  reducedMotion: boolean;
  preferSimulationOnFirstRun: boolean;
}

export interface PersistedAppState {
  devices: ClimateDevice[];
  activeDeviceId: string | null;
  schedules: DeviceScheduleContract[];
  preferences: AppPreferences;
}

export interface OnboardingDraft {
  method: ProvisionMethod;
  name: string;
  location: string;
  notes: string;
  brokerUrl: string;
  brokerPort: number;
  protocol: MqttProtocol;
  mqttUsername: string;
  mqttPassword: string;
  topicPrefix: string;
  host: string;
  localPort: number;
  accessPointSsid: string;
  accessPointPassword: string;
  deviceId: string;
}

export interface DiscoveredDeviceInfo {
  deviceId: string;
  defaultName: string;
  firmwareVersion: string;
  discoveryStatus: string;
  capabilities: DeviceCapabilitiesContract;
}
