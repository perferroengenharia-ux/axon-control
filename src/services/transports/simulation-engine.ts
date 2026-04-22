import type { DeviceCommandMessage, DeviceCommandPayloadByType } from '@/src/protocol';
import { createCommandRecord } from '@/src/services/device-service';
import type { DeviceSnapshot, LastCommandStatus, Schedule } from '@/src/types';
import { getLatestCommandId, updateCommandStatus, upsertCommand } from '@/src/utils/commands';
import { isoNow } from '@/src/utils/date';

import { createDefaultSnapshot } from '@/src/mocks/defaults';

function nextCommandStatus(previous: LastCommandStatus): LastCommandStatus {
  if (previous === 'sending') {
    return Math.random() > 0.12 ? 'applied' : 'failed';
  }

  return previous;
}

class SimulationEngine {
  private snapshots = new Map<string, DeviceSnapshot>();

  getSnapshot(deviceId: string) {
    const snapshot = this.snapshots.get(deviceId);

    if (snapshot) {
      return snapshot;
    }

    const next = createDefaultSnapshot();
    next.events = next.events.map((event) => ({ ...event, deviceId }));
    this.snapshots.set(deviceId, next);
    return next;
  }

  tick(deviceId: string, schedules: Schedule[]) {
    const snapshot = this.getSnapshot(deviceId);
    const now = isoNow();
    const desiredFreq = snapshot.state.freqTargetHz;
    const delta = desiredFreq - snapshot.state.freqCurrentHz;
    const step = Math.abs(delta) < 1 ? delta : Math.sign(delta) * 1;
    const nextFreq = Math.max(0, snapshot.state.freqCurrentHz + step);
    const nextOnline = Math.random() > 0.015;
    const shouldToggleWater = Math.random() > 0.985;

    const previousCommandStatus = snapshot.state.lastCommandStatus;
    const nextStatus = nextCommandStatus(previousCommandStatus);

    snapshot.state = {
      ...snapshot.state,
      deviceOnline: nextOnline,
      freqCurrentHz: nextFreq,
      lastSeen: nextOnline ? now : snapshot.state.lastSeen,
      lastCommandStatus: nextStatus,
      readyState: !nextOnline
        ? 'offline'
        : snapshot.state.drainState === 'on'
          ? 'draining'
          : snapshot.state.inverterRunning
            ? 'running'
            : 'ready',
      waterLevelState: !snapshot.capabilities.waterSensorEnabled
        ? 'disabled'
        : shouldToggleWater
          ? snapshot.state.waterLevelState === 'low'
            ? 'ok'
            : 'low'
          : snapshot.state.waterLevelState,
    };

    snapshot.diagnostics = {
      ...snapshot.diagnostics,
      transportStatus: nextOnline ? 'connected' : 'degraded',
      lastSyncAt: now,
      lastErrorMessage:
        snapshot.state.lastCommandStatus === 'failed'
          ? 'Falha simulada de confirmacao do ultimo comando.'
          : null,
    };

    if (previousCommandStatus === 'sending' && nextStatus !== previousCommandStatus) {
      const latestCommandId = getLatestCommandId(snapshot.commands);
      if (latestCommandId) {
        snapshot.commands = updateCommandStatus(snapshot.commands, latestCommandId, nextStatus);
      }
    }

    const activeDrainSchedule = schedules.find(
      (schedule) => schedule.enabled && schedule.type === 'drain-cycle',
    );

    if (activeDrainSchedule && Math.random() > 0.992 && snapshot.capabilities.drainAvailable) {
      snapshot.state.drainState = 'on';
      snapshot.state.readyState = 'draining';
    } else if (snapshot.state.drainState === 'on' && Math.random() > 0.85) {
      snapshot.state.drainState = 'off';
    }

    this.snapshots.set(deviceId, snapshot);
    return snapshot;
  }

  applyCommand(deviceId: string, command: DeviceCommandMessage) {
    const snapshot = this.getSnapshot(deviceId);

    snapshot.state.lastCommandStatus = 'sending';
    snapshot.commands = upsertCommand(snapshot.commands, createCommandRecord(command, 'sending'));

    switch (command.type) {
      case 'power-on':
        snapshot.state.inverterRunning = true;
        snapshot.state.readyState = 'starting';
        break;
      case 'power-off':
        snapshot.state.inverterRunning = false;
        snapshot.state.readyState = 'stopping';
        snapshot.state.freqTargetHz = snapshot.capabilities.fMinHz;
        break;
      case 'set-frequency':
        snapshot.state.freqTargetHz = Number(
          (command.payload as DeviceCommandPayloadByType['set-frequency']).freqTargetHz ??
            snapshot.state.freqTargetHz,
        );
        snapshot.state.readyState = snapshot.state.inverterRunning ? 'running' : 'ready';
        break;
      case 'set-pump':
        snapshot.state.pumpState = (
          command.payload as DeviceCommandPayloadByType['set-pump']
        ).enabled
          ? 'on'
          : 'off';
        break;
      case 'set-swing':
        snapshot.state.swingState = (
          command.payload as DeviceCommandPayloadByType['set-swing']
        ).enabled
          ? 'on'
          : 'off';
        break;
      case 'run-drain':
        snapshot.state.drainState = 'on';
        snapshot.state.readyState = 'draining';
        break;
      case 'stop-drain':
        snapshot.state.drainState = 'off';
        snapshot.state.readyState = snapshot.state.inverterRunning ? 'running' : 'ready';
        break;
      default:
        break;
    }

    snapshot.events = [
      {
        id: `evt-${Date.now()}`,
        deviceId,
        level: 'info' as const,
        title: 'Comando processado no simulador',
        message: `Comando ${command.type} enviado para o dispositivo simulado.`,
        createdAt: isoNow(),
        code: 'SIM_COMMAND',
      },
      ...snapshot.events,
    ].slice(0, 18);

    this.snapshots.set(deviceId, snapshot);
    return snapshot;
  }
}

export const simulationEngine = new SimulationEngine();
