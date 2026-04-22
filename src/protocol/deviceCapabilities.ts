import type { ProtocolMetadata } from './common';

export const DRAIN_MODES = ['timed', 'until-sensor', 'hybrid', 'disabled'] as const;
export type DrainMode = (typeof DRAIN_MODES)[number];

export const PUMP_LOGIC_MODES = ['linked', 'independent', 'forced-on', 'forced-off'] as const;
export type PumpLogicMode = (typeof PUMP_LOGIC_MODES)[number];

export const WATER_SENSOR_MODES = ['normal', 'inverted', 'disabled'] as const;
export type WaterSensorMode = (typeof WATER_SENSOR_MODES)[number];

export const RESUME_MODES = ['resume-last-state', 'always-off', 'always-on'] as const;
export type ResumeMode = (typeof RESUME_MODES)[number];

export const AUTO_RESET_MODES = ['enabled', 'disabled'] as const;
export type AutoResetMode = (typeof AUTO_RESET_MODES)[number];

export interface DeviceCapabilitiesContract {
  fMinHz: number;
  fMaxHz: number;
  pumpAvailable: boolean;
  swingAvailable: boolean;
  drainAvailable: boolean;
  waterSensorEnabled: boolean;
  drainMode: DrainMode;
  drainTimeSec: number;
  drainReturnDelaySec: number;
  pumpLogicMode: PumpLogicMode;
  waterSensorMode: WaterSensorMode;
  preWetSec: number;
  dryPanelSec: number;
  dryPanelFreqHz: number;
  resumeMode: ResumeMode;
  autoResetMode: AutoResetMode;
}

export interface DeviceCapabilitiesPayload extends ProtocolMetadata {
  capabilities: DeviceCapabilitiesContract;
}
