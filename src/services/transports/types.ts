import type {
  ClimateDevice,
  ConnectionMode,
  ConnectionTestResult,
  DeviceEvent,
  DeviceSnapshot,
  DeviceSnapshotPatch,
  Schedule,
} from '@/src/types';
import type { DeviceCommandMessage } from '@/src/protocol';

export interface TransportStartContext {
  device: ClimateDevice;
  getSnapshot: () => DeviceSnapshot;
  getSchedules: () => Schedule[];
  onSnapshot: (snapshot: DeviceSnapshotPatch) => void;
  onSchedules?: (deviceId: string, schedules: Schedule[]) => void;
  onEvent?: (event: DeviceEvent) => void;
  onError?: (message: string) => void;
}

export interface TransportSession {
  mode: ConnectionMode;
  refresh: () => Promise<void>;
  dispose: () => Promise<void>;
}

export interface DeviceTransportAdapter {
  mode: ConnectionMode;
  start: (context: TransportStartContext) => Promise<TransportSession>;
  testConnection: (device: ClimateDevice) => Promise<ConnectionTestResult>;
  sendCommand: (
    device: ClimateDevice,
    command: DeviceCommandMessage,
  ) => Promise<DeviceSnapshotPatch>;
  saveSchedules: (device: ClimateDevice, schedules: Schedule[]) => Promise<Schedule[]>;
}
