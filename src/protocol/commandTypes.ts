import type { ProtocolMetadata } from './common';
import type { DeviceStateContract, LastCommandStatus } from './deviceState';
import type { DeviceErrorPayload } from './messages';
import type { DeviceScheduleContract } from './scheduleContract';

export const DEVICE_COMMAND_TYPES = {
  powerOn: 'power-on',
  powerOff: 'power-off',
  setFrequency: 'set-frequency',
  setPump: 'set-pump',
  setSwing: 'set-swing',
  runDrain: 'run-drain',
  stopDrain: 'stop-drain',
  requestStatus: 'request-status',
  requestCapabilities: 'request-capabilities',
  syncSchedules: 'sync-schedules',
} as const;

export type DeviceCommandType = (typeof DEVICE_COMMAND_TYPES)[keyof typeof DEVICE_COMMAND_TYPES];

export interface DeviceCommandPayloadByType {
  'power-on': Record<string, never>;
  'power-off': Record<string, never>;
  'set-frequency': { freqTargetHz: number };
  'set-pump': { enabled: boolean };
  'set-swing': { enabled: boolean };
  'run-drain': { reason?: 'manual' | 'schedule' | 'recovery' };
  'stop-drain': { reason?: 'manual' | 'completed' | 'safety' };
  'request-status': { includeDiagnostics?: boolean };
  'request-capabilities': Record<string, never>;
  'sync-schedules': {
    schedules: DeviceScheduleContract[];
    revision?: string;
  };
}

export type DeviceCommandPayload<T extends DeviceCommandType = DeviceCommandType> =
  DeviceCommandPayloadByType[T];

export interface DeviceCommandMessage<T extends DeviceCommandType = DeviceCommandType>
  extends ProtocolMetadata {
  id: string;
  type: T;
  payload: DeviceCommandPayloadByType[T];
}

export interface DeviceCommandAckPayload extends ProtocolMetadata {
  id: string;
  type: DeviceCommandType;
  accepted: boolean;
  applied: boolean;
  status: Extract<LastCommandStatus, 'sending' | 'applied' | 'failed'>;
  state?: DeviceStateContract;
  error?: DeviceErrorPayload | null;
}
