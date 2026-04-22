import type { DeviceCapabilitiesPayload } from './deviceCapabilities';
import type { DeviceCommandAckPayload, DeviceCommandMessage } from './commandTypes';
import type {
  DeviceDiagnosticsPayload,
  DeviceStatePayload,
  DeviceStatusPayload,
} from './deviceState';
import type { DeviceErrorsPayload, DeviceEventsPayload } from './messages';
import type { DeviceSchedulesPayload } from './scheduleContract';

export interface LocalApiEndpointContract {
  status: string;
  state: string;
  capabilities: string;
  commands: string;
  events: string;
  errors: string;
  schedules: string;
  diagnostics: string;
  connectionTest: string;
}

export const LOCAL_API_ENDPOINTS: LocalApiEndpointContract = {
  status: '/api/v1/status',
  state: '/api/v1/state',
  capabilities: '/api/v1/capabilities',
  commands: '/api/v1/commands',
  events: '/api/v1/events',
  errors: '/api/v1/errors',
  schedules: '/api/v1/schedules',
  diagnostics: '/api/v1/diagnostics',
  connectionTest: '/api/v1/ping',
};

export interface LocalCommandRequest {
  command: DeviceCommandMessage;
}

export interface LocalConnectionTestResponse {
  ok: boolean;
  message: string;
  timestamp: string;
  deviceId?: string;
}

export type LocalStatusResponse = DeviceStatusPayload;
export type LocalStateResponse = DeviceStatePayload;
export type LocalCapabilitiesResponse = DeviceCapabilitiesPayload;
export type LocalCommandResponse = DeviceCommandAckPayload;
export type LocalEventsResponse = DeviceEventsPayload;
export type LocalErrorsResponse = DeviceErrorsPayload;
export type LocalSchedulesResponse = DeviceSchedulesPayload;
export type LocalDiagnosticsResponse = DeviceDiagnosticsPayload;
