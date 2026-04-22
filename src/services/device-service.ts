import type {
  ConnectionMode,
  DeviceCapabilitiesPayload,
  DeviceCommandAckPayload,
  DeviceCommandMessage,
  DeviceCommandPayloadByType,
  DeviceCommandType,
  DeviceDiagnosticsPayload,
  DeviceErrorsPayload,
  DeviceEventsPayload,
  DeviceScheduleContract,
  DeviceStatePayload,
  DeviceStatusPayload,
  ProtocolSource,
} from '@/src/protocol';
import { createProtocolMetadata } from '@/src/protocol';
import type { Command, DeviceSnapshot, DeviceSnapshotPatch, LastCommandStatus } from '@/src/types';
import { isoNow } from '@/src/utils/date';
import { createId } from '@/src/utils/id';

type SnapshotPatchSource = DeviceSnapshotPatch;

function buildCommandPayload<T extends DeviceCommandType>(
  type: T,
  payload: Record<string, unknown>,
): DeviceCommandPayloadByType[T] {
  switch (type) {
    case 'set-frequency':
      return {
        freqTargetHz: Number(payload.freqTargetHz ?? 0),
      } as DeviceCommandPayloadByType[T];
    case 'set-pump':
    case 'set-swing':
      return {
        enabled: Boolean(payload.enabled),
      } as DeviceCommandPayloadByType[T];
    case 'run-drain':
      return {
        reason: (payload.reason as 'manual' | 'schedule' | 'recovery' | undefined) ?? 'manual',
      } as DeviceCommandPayloadByType[T];
    case 'stop-drain':
      return {
        reason: (payload.reason as 'manual' | 'completed' | 'safety' | undefined) ?? 'manual',
      } as DeviceCommandPayloadByType[T];
    case 'request-status':
      return {
        includeDiagnostics: Boolean(payload.includeDiagnostics),
      } as DeviceCommandPayloadByType[T];
    case 'sync-schedules':
      return {
        schedules: (payload.schedules as DeviceScheduleContract[] | undefined) ?? [],
        revision: typeof payload.revision === 'string' ? payload.revision : undefined,
      } as DeviceCommandPayloadByType[T];
    default:
      return {} as DeviceCommandPayloadByType[T];
  }
}

export function createDeviceCommandMessage<T extends DeviceCommandType>(
  deviceId: string,
  type: T,
  payload: Record<string, unknown> = {},
  source: ProtocolSource = 'app',
): DeviceCommandMessage<T> {
  return {
    ...createProtocolMetadata(deviceId, isoNow(), source),
    id: createId('cmd'),
    type,
    payload: buildCommandPayload(type, payload),
  };
}

export function createCommandRecord(
  command: DeviceCommandMessage,
  status: LastCommandStatus,
): Command {
  return {
    ...command,
    status,
  };
}

export function createStatusPatch(
  payload: DeviceStatusPayload,
  connectionMode?: ConnectionMode,
): SnapshotPatchSource {
  return {
    state: {
      ...payload.status,
      connectionMode: connectionMode ?? payload.status.connectionMode,
    },
  };
}

export function createStatePatch(
  payload: DeviceStatePayload,
  connectionMode?: ConnectionMode,
): SnapshotPatchSource {
  return {
    state: {
      ...payload.state,
      connectionMode: connectionMode ?? payload.state.connectionMode,
    },
  };
}

export function createCapabilitiesPatch(payload: DeviceCapabilitiesPayload): SnapshotPatchSource {
  return {
    capabilities: payload.capabilities,
  };
}

export function createDiagnosticsPatch(payload: DeviceDiagnosticsPayload): SnapshotPatchSource {
  return {
    diagnostics: payload.diagnostics,
  };
}

export function createEventsPatch(payload: DeviceEventsPayload): SnapshotPatchSource {
  return {
    events: payload.events,
  };
}

export function createErrorsPatch(
  payload: DeviceErrorsPayload,
  currentSnapshot: DeviceSnapshot,
): SnapshotPatchSource {
  const lastError = payload.errors[0];
  const nextEvents = [
    ...payload.errors.map((error) => ({
      id: error.id,
      deviceId: error.deviceId,
      level: 'error' as const,
      title: error.code,
      message: error.message,
      createdAt: error.createdAt,
      code: error.code,
    })),
    ...currentSnapshot.events,
  ].slice(0, 18);

  return {
    diagnostics: {
      ...currentSnapshot.diagnostics,
      transportStatus: payload.errors.length > 0 ? 'degraded' : currentSnapshot.diagnostics.transportStatus,
      lastErrorMessage: lastError?.message ?? currentSnapshot.diagnostics.lastErrorMessage,
      lastSyncAt: payload.timestamp,
      connectionSummary:
        payload.errors.length > 0
          ? 'A IHM reportou erro recente pelo canal de comunicacao.'
          : currentSnapshot.diagnostics.connectionSummary,
    },
    state: {
      ...currentSnapshot.state,
      lastErrorCode: lastError?.code ?? currentSnapshot.state.lastErrorCode,
    },
    events: nextEvents,
  };
}

export function createCommandAckPatch(
  ack: DeviceCommandAckPayload,
  currentSnapshot: DeviceSnapshot,
  fallbackCommand?: DeviceCommandMessage,
): SnapshotPatchSource {
  const commandRecord =
    fallbackCommand && fallbackCommand.id === ack.id
      ? createCommandRecord(fallbackCommand, ack.status)
      : undefined;

  return {
    state: ack.state
      ? {
          ...ack.state,
          lastCommandStatus: ack.status,
          lastErrorCode: ack.error?.code ?? ack.state.lastErrorCode ?? null,
        }
      : {
          ...currentSnapshot.state,
          lastCommandStatus: ack.status,
          lastErrorCode: ack.error?.code ?? currentSnapshot.state.lastErrorCode,
        },
    diagnostics: {
      ...currentSnapshot.diagnostics,
      lastSyncAt: ack.timestamp,
      lastErrorMessage: ack.error?.message ?? null,
      connectionSummary: ack.accepted
        ? 'A IHM confirmou o processamento do ultimo comando.'
        : 'A IHM rejeitou o ultimo comando enviado.',
      transportStatus: ack.accepted ? 'connected' : 'degraded',
    },
    commands: commandRecord ? [commandRecord] : currentSnapshot.commands,
  };
}

export function createSchedulesPayload(deviceId: string, schedules: DeviceScheduleContract[]) {
  return {
    ...createProtocolMetadata(deviceId, isoNow(), 'app'),
    schedules,
    revision: `local-${schedules.length}`,
  };
}

export function createStatusPayloadFromSnapshot(
  deviceId: string,
  snapshot: DeviceSnapshot,
  source: ProtocolSource,
  timestamp = isoNow(),
): DeviceStatusPayload {
  return {
    ...createProtocolMetadata(deviceId, timestamp, source),
    status: {
      deviceOnline: snapshot.state.deviceOnline,
      connectionMode: snapshot.state.connectionMode,
      lastSeen: snapshot.state.lastSeen,
      readyState: snapshot.state.readyState,
    },
  };
}

export function createStatePayloadFromSnapshot(
  deviceId: string,
  snapshot: DeviceSnapshot,
  source: ProtocolSource,
  timestamp = isoNow(),
): DeviceStatePayload {
  return {
    ...createProtocolMetadata(deviceId, timestamp, source),
    state: snapshot.state,
  };
}

export function createCapabilitiesPayloadFromSnapshot(
  deviceId: string,
  snapshot: DeviceSnapshot,
  source: ProtocolSource,
  timestamp = isoNow(),
): DeviceCapabilitiesPayload {
  return {
    ...createProtocolMetadata(deviceId, timestamp, source),
    capabilities: snapshot.capabilities,
  };
}

export function createDiagnosticsPayloadFromSnapshot(
  deviceId: string,
  snapshot: DeviceSnapshot,
  source: ProtocolSource,
  timestamp = isoNow(),
): DeviceDiagnosticsPayload {
  return {
    ...createProtocolMetadata(deviceId, timestamp, source),
    diagnostics: snapshot.diagnostics,
  };
}

export function createEventsPayloadFromSnapshot(
  deviceId: string,
  snapshot: DeviceSnapshot,
  source: ProtocolSource,
  timestamp = isoNow(),
): DeviceEventsPayload {
  return {
    ...createProtocolMetadata(deviceId, timestamp, source),
    events: snapshot.events,
  };
}

export function createErrorsPayloadFromSnapshot(
  deviceId: string,
  snapshot: DeviceSnapshot,
  source: ProtocolSource,
  timestamp = isoNow(),
): DeviceErrorsPayload {
  const errors =
    snapshot.state.lastErrorCode || snapshot.diagnostics.lastErrorMessage
      ? [
          {
            id: createId('err'),
            deviceId,
            code: snapshot.state.lastErrorCode ?? 'DEVICE_ERROR',
            message: snapshot.diagnostics.lastErrorMessage ?? 'Erro informado pela IHM.',
            createdAt: timestamp,
            recoverable: true,
          },
        ]
      : [];

  return {
    ...createProtocolMetadata(deviceId, timestamp, source),
    errors,
  };
}

export interface DeviceProtocolBundle {
  status: DeviceStatusPayload;
  state: DeviceStatePayload;
  capabilities: DeviceCapabilitiesPayload;
  diagnostics: DeviceDiagnosticsPayload;
  events: DeviceEventsPayload;
  errors: DeviceErrorsPayload;
}

export function createProtocolBundleFromSnapshot(
  deviceId: string,
  snapshot: DeviceSnapshot,
  source: ProtocolSource,
  timestamp = isoNow(),
): DeviceProtocolBundle {
  return {
    status: createStatusPayloadFromSnapshot(deviceId, snapshot, source, timestamp),
    state: createStatePayloadFromSnapshot(deviceId, snapshot, source, timestamp),
    capabilities: createCapabilitiesPayloadFromSnapshot(deviceId, snapshot, source, timestamp),
    diagnostics: createDiagnosticsPayloadFromSnapshot(deviceId, snapshot, source, timestamp),
    events: createEventsPayloadFromSnapshot(deviceId, snapshot, source, timestamp),
    errors: createErrorsPayloadFromSnapshot(deviceId, snapshot, source, timestamp),
  };
}
