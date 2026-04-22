import type { ProtocolMetadata } from './common';

export const CONNECTION_MODES = {
  cloud: 'cloud',
  localLan: 'local-lan',
  localAp: 'local-ap',
  simulation: 'simulation',
} as const;

export type ConnectionMode = (typeof CONNECTION_MODES)[keyof typeof CONNECTION_MODES];

export const READY_STATES = {
  ready: 'ready',
  starting: 'starting',
  running: 'running',
  stopping: 'stopping',
  draining: 'draining',
  fault: 'fault',
  offline: 'offline',
} as const;

export type ReadyState = (typeof READY_STATES)[keyof typeof READY_STATES];

export const WATER_LEVEL_STATES = {
  ok: 'ok',
  low: 'low',
  disabled: 'disabled',
  unknown: 'unknown',
} as const;

export type WaterLevelState = (typeof WATER_LEVEL_STATES)[keyof typeof WATER_LEVEL_STATES];

export const LAST_COMMAND_STATUSES = {
  idle: 'idle',
  sending: 'sending',
  applied: 'applied',
  failed: 'failed',
} as const;

export type LastCommandStatus =
  (typeof LAST_COMMAND_STATUSES)[keyof typeof LAST_COMMAND_STATUSES];

export const PERIPHERAL_STATES = {
  on: 'on',
  off: 'off',
  unavailable: 'unavailable',
  unknown: 'unknown',
} as const;

export type PeripheralState = (typeof PERIPHERAL_STATES)[keyof typeof PERIPHERAL_STATES];

export type DeviceTransportStatus = 'idle' | 'connecting' | 'connected' | 'degraded' | 'error';

export interface DeviceStatusContract {
  deviceOnline: boolean;
  connectionMode: ConnectionMode;
  lastSeen: string | null;
  readyState: ReadyState;
}

export interface DeviceStateContract extends DeviceStatusContract {
  inverterRunning: boolean;
  freqCurrentHz: number;
  freqTargetHz: number;
  pumpState: PeripheralState;
  swingState: PeripheralState;
  drainState: PeripheralState;
  waterLevelState: WaterLevelState;
  lastCommandStatus: LastCommandStatus;
  lastErrorCode?: string | null;
}

export interface DeviceDiagnosticsContract {
  firmwareVersion: string;
  connectionSummary: string;
  transportStatus: DeviceTransportStatus;
  lastSyncAt?: string | null;
  lastErrorMessage?: string | null;
}

export interface DeviceStatusPayload extends ProtocolMetadata {
  status: DeviceStatusContract;
}

export interface DeviceStatePayload extends ProtocolMetadata {
  state: DeviceStateContract;
}

export interface DeviceDiagnosticsPayload extends ProtocolMetadata {
  diagnostics: DeviceDiagnosticsContract;
}
