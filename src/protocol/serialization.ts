import {
  AUTO_RESET_MODES,
  DRAIN_MODES,
  PUMP_LOGIC_MODES,
  RESUME_MODES,
  WATER_SENSOR_MODES,
  type DeviceCapabilitiesPayload,
} from './deviceCapabilities';
import {
  DEVICE_COMMAND_TYPES,
  type DeviceCommandAckPayload,
  type DeviceCommandMessage,
} from './commandTypes';
import {
  PROTOCOL_SCHEMA_VERSION,
  PROTOCOL_SOURCES,
  type ProtocolMetadata,
} from './common';
import {
  CONNECTION_MODES,
  LAST_COMMAND_STATUSES,
  PERIPHERAL_STATES,
  READY_STATES,
  type DeviceDiagnosticsPayload,
  type DeviceStatePayload,
  type DeviceStatusPayload,
  WATER_LEVEL_STATES,
} from './deviceState';
import { DEVICE_EVENT_LEVELS, type DeviceErrorsPayload, type DeviceEventsPayload } from './messages';
import { SCHEDULE_RECURRENCES, SCHEDULE_TYPES, type DeviceSchedulesPayload } from './scheduleContract';

type JsonRecord = Record<string, unknown>;

function isObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isNumber);
}

function isEnumValue<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return isString(value) && allowed.includes(value);
}

function assertObject(value: unknown, label: string): JsonRecord {
  if (!isObject(value)) {
    throw new Error(`${label} deve ser um objeto JSON.`);
  }

  return value;
}

function parseProtocolInput(input: unknown, label: string): JsonRecord {
  if (typeof input === 'string') {
    try {
      return assertObject(JSON.parse(input), label);
    } catch (error) {
      throw new Error(
        `${label} contem JSON invalido: ${error instanceof Error ? error.message : 'erro desconhecido.'}`,
      );
    }
  }

  return assertObject(input, label);
}

export function serializeProtocolPayload<T>(payload: T, pretty = false) {
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

export function parseProtocolPayload<T>(
  input: unknown,
  validator: (value: unknown) => value is T,
  label: string,
): T {
  const candidate = parseProtocolInput(input, label);

  if (!validator(candidate)) {
    throw new Error(`${label} nao segue o contrato esperado.`);
  }

  return candidate;
}

export function isProtocolMetadata(value: unknown): value is ProtocolMetadata {
  if (!isObject(value)) {
    return false;
  }

  return (
    value.schema === PROTOCOL_SCHEMA_VERSION &&
    isString(value.deviceId) &&
    isString(value.timestamp) &&
    isEnumValue(value.source, PROTOCOL_SOURCES)
  );
}

function isDeviceStatusContract(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return (
    isBoolean(value.deviceOnline) &&
    isEnumValue(value.connectionMode, Object.values(CONNECTION_MODES)) &&
    (value.lastSeen === null || isString(value.lastSeen)) &&
    isEnumValue(value.readyState, Object.values(READY_STATES))
  );
}

function isDeviceStateContract(value: unknown): boolean {
  if (!isDeviceStatusContract(value) || !isObject(value)) {
    return false;
  }

  return (
    isBoolean(value.inverterRunning) &&
    isNumber(value.freqCurrentHz) &&
    isNumber(value.freqTargetHz) &&
    isEnumValue(value.pumpState, Object.values(PERIPHERAL_STATES)) &&
    isEnumValue(value.swingState, Object.values(PERIPHERAL_STATES)) &&
    isEnumValue(value.drainState, Object.values(PERIPHERAL_STATES)) &&
    isEnumValue(value.waterLevelState, Object.values(WATER_LEVEL_STATES)) &&
    isEnumValue(value.lastCommandStatus, Object.values(LAST_COMMAND_STATUSES)) &&
    (value.lastErrorCode === null || value.lastErrorCode === undefined || isString(value.lastErrorCode))
  );
}

function isDeviceCapabilitiesContract(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNumber(value.fMinHz) &&
    isNumber(value.fMaxHz) &&
    isBoolean(value.pumpAvailable) &&
    isBoolean(value.swingAvailable) &&
    isBoolean(value.drainAvailable) &&
    isBoolean(value.waterSensorEnabled) &&
    isEnumValue(value.drainMode, DRAIN_MODES) &&
    isNumber(value.drainTimeSec) &&
    isNumber(value.drainReturnDelaySec) &&
    isEnumValue(value.pumpLogicMode, PUMP_LOGIC_MODES) &&
    isEnumValue(value.waterSensorMode, WATER_SENSOR_MODES) &&
    isNumber(value.preWetSec) &&
    isNumber(value.dryPanelSec) &&
    isNumber(value.dryPanelFreqHz) &&
    isEnumValue(value.resumeMode, RESUME_MODES) &&
    isEnumValue(value.autoResetMode, AUTO_RESET_MODES)
  );
}

function isDeviceDiagnosticsContract(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.firmwareVersion) &&
    isString(value.connectionSummary) &&
    isEnumValue(value.transportStatus, ['idle', 'connecting', 'connected', 'degraded', 'error'] as const) &&
    (value.lastSyncAt === null || value.lastSyncAt === undefined || isString(value.lastSyncAt)) &&
    (value.lastErrorMessage === null ||
      value.lastErrorMessage === undefined ||
      isString(value.lastErrorMessage))
  );
}

function isDeviceEventPayload(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.deviceId) &&
    isEnumValue(value.level, DEVICE_EVENT_LEVELS) &&
    isString(value.title) &&
    isString(value.message) &&
    isString(value.createdAt) &&
    (value.code === undefined || isString(value.code))
  );
}

function isDeviceErrorPayload(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.deviceId) &&
    isString(value.code) &&
    isString(value.message) &&
    isString(value.createdAt) &&
    (value.recoverable === undefined || isBoolean(value.recoverable))
  );
}

function isDeviceScheduleContract(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.deviceId) &&
    isEnumValue(value.type, Object.values(SCHEDULE_TYPES)) &&
    isEnumValue(value.recurrence, Object.values(SCHEDULE_RECURRENCES)) &&
    isBoolean(value.enabled) &&
    isString(value.time) &&
    isNumberArray(value.daysOfWeek) &&
    (value.oneShotDate === null || value.oneShotDate === undefined || isString(value.oneShotDate)) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

export function isDeviceStatusPayload(value: unknown): value is DeviceStatusPayload {
  return isProtocolMetadata(value) && isObject(value) && isDeviceStatusContract(value.status);
}

export function isDeviceStatePayload(value: unknown): value is DeviceStatePayload {
  return isProtocolMetadata(value) && isObject(value) && isDeviceStateContract(value.state);
}

export function isDeviceCapabilitiesPayload(value: unknown): value is DeviceCapabilitiesPayload {
  return isProtocolMetadata(value) && isObject(value) && isDeviceCapabilitiesContract(value.capabilities);
}

export function isDeviceDiagnosticsPayload(value: unknown): value is DeviceDiagnosticsPayload {
  return isProtocolMetadata(value) && isObject(value) && isDeviceDiagnosticsContract(value.diagnostics);
}

export function isDeviceEventsPayload(value: unknown): value is DeviceEventsPayload {
  return (
    isProtocolMetadata(value) &&
    isObject(value) &&
    Array.isArray(value.events) &&
    value.events.every(isDeviceEventPayload)
  );
}

export function isDeviceErrorsPayload(value: unknown): value is DeviceErrorsPayload {
  return (
    isProtocolMetadata(value) &&
    isObject(value) &&
    Array.isArray(value.errors) &&
    value.errors.every(isDeviceErrorPayload)
  );
}

export function isDeviceSchedulesPayload(value: unknown): value is DeviceSchedulesPayload {
  return (
    isProtocolMetadata(value) &&
    isObject(value) &&
    Array.isArray(value.schedules) &&
    value.schedules.every(isDeviceScheduleContract) &&
    (value.revision === undefined || isString(value.revision)) &&
    (value.timezone === undefined || isString(value.timezone)) &&
    (value.timezoneOffsetMinutes === undefined || isNumber(value.timezoneOffsetMinutes))
  );
}

export function isDeviceCommandMessage(value: unknown): value is DeviceCommandMessage {
  if (!(isProtocolMetadata(value) && isObject(value))) {
    return false;
  }

  return (
    isString(value.id) &&
    isEnumValue(value.type, Object.values(DEVICE_COMMAND_TYPES)) &&
    isObject(value.payload)
  );
}

export function isDeviceCommandAckPayload(value: unknown): value is DeviceCommandAckPayload {
  if (!(isProtocolMetadata(value) && isObject(value))) {
    return false;
  }

  return (
    isString(value.id) &&
    isEnumValue(value.type, Object.values(DEVICE_COMMAND_TYPES)) &&
    isBoolean(value.accepted) &&
    isBoolean(value.applied) &&
    isEnumValue(value.status, ['sending', 'applied', 'failed'] as const) &&
    (value.state === undefined || isDeviceStateContract(value.state)) &&
    (value.error === null || value.error === undefined || isDeviceErrorPayload(value.error))
  );
}

export function parseStatusPayload(input: unknown) {
  return parseProtocolPayload(input, isDeviceStatusPayload, 'StatusPayload');
}

export function parseStatePayload(input: unknown) {
  return parseProtocolPayload(input, isDeviceStatePayload, 'StatePayload');
}

export function parseCapabilitiesPayload(input: unknown) {
  return parseProtocolPayload(input, isDeviceCapabilitiesPayload, 'CapabilitiesPayload');
}

export function parseDiagnosticsPayload(input: unknown) {
  return parseProtocolPayload(input, isDeviceDiagnosticsPayload, 'DiagnosticsPayload');
}

export function parseEventsPayload(input: unknown) {
  return parseProtocolPayload(input, isDeviceEventsPayload, 'EventsPayload');
}

export function parseErrorsPayload(input: unknown) {
  return parseProtocolPayload(input, isDeviceErrorsPayload, 'ErrorsPayload');
}

export function parseSchedulesPayload(input: unknown) {
  return parseProtocolPayload(input, isDeviceSchedulesPayload, 'SchedulesPayload');
}

export function parseCommandMessage(input: unknown) {
  return parseProtocolPayload(input, isDeviceCommandMessage, 'CommandMessage');
}

export function parseCommandAckPayload(input: unknown) {
  return parseProtocolPayload(input, isDeviceCommandAckPayload, 'CommandAckPayload');
}
