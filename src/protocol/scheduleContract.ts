import type { ProtocolMetadata } from './common';

export const SCHEDULE_TYPES = {
  powerOn: 'power-on',
  powerOff: 'power-off',
  drainCycle: 'drain-cycle',
} as const;

export type ScheduleType = (typeof SCHEDULE_TYPES)[keyof typeof SCHEDULE_TYPES];

export const SCHEDULE_RECURRENCES = {
  oneShot: 'one-shot',
  daily: 'daily',
  weekly: 'weekly',
} as const;

export type ScheduleRecurrence =
  (typeof SCHEDULE_RECURRENCES)[keyof typeof SCHEDULE_RECURRENCES];

export interface DeviceScheduleContract {
  id: string;
  deviceId: string;
  type: ScheduleType;
  recurrence: ScheduleRecurrence;
  enabled: boolean;
  time: string;
  daysOfWeek: number[];
  oneShotDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSchedulesPayload extends ProtocolMetadata {
  schedules: DeviceScheduleContract[];
  revision?: string;
}
