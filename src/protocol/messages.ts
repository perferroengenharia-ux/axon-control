import type { ProtocolMetadata } from './common';

export const DEVICE_EVENT_LEVELS = ['info', 'warning', 'error'] as const;
export type DeviceEventLevel = (typeof DEVICE_EVENT_LEVELS)[number];

export interface DeviceEventPayload {
  id: string;
  deviceId: string;
  level: DeviceEventLevel;
  title: string;
  message: string;
  createdAt: string;
  code?: string;
}

export interface DeviceErrorPayload {
  id: string;
  deviceId: string;
  code: string;
  message: string;
  createdAt: string;
  recoverable?: boolean;
}

export interface DeviceEventsPayload extends ProtocolMetadata {
  events: DeviceEventPayload[];
}

export interface DeviceErrorsPayload extends ProtocolMetadata {
  errors: DeviceErrorPayload[];
}
