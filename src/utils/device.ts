import type { ClimateDevice, DeviceCapabilities, DeviceSnapshot, DeviceState, ScheduleType } from '@/src/types';

export function clampFrequency(value: number, capabilities: DeviceCapabilities) {
  return Math.min(capabilities.fMaxHz, Math.max(capabilities.fMinHz, Math.round(value)));
}

export function isFeatureAvailable(capabilities: DeviceCapabilities, feature: ScheduleType | 'pump' | 'swing') {
  switch (feature) {
    case 'pump':
      return capabilities.pumpAvailable;
    case 'swing':
      return capabilities.swingAvailable;
    case 'drain-cycle':
      return capabilities.drainAvailable;
    default:
      return true;
  }
}

export function getFeatureExplanation(capabilities: DeviceCapabilities, feature: ScheduleType | 'pump' | 'swing') {
  if (isFeatureAvailable(capabilities, feature)) {
    return undefined;
  }

  switch (feature) {
    case 'pump':
      return 'A bomba esta desabilitada pelos parametros atuais da IHM.';
    case 'swing':
      return 'O swing nao esta disponivel para este climatizador.';
    case 'drain-cycle':
      return 'O dreno nao esta habilitado para este climatizador.';
    default:
      return 'Este recurso nao esta disponivel neste dispositivo.';
  }
}

export function describeWaterLevel(state: DeviceState) {
  switch (state.waterLevelState) {
    case 'ok':
      return 'Agua presente';
    case 'low':
      return 'Falta de agua';
    case 'disabled':
      return 'Sensor desabilitado';
    default:
      return 'Estado desconhecido';
  }
}

export function getConnectionLabel(mode: ClimateDevice['preferredConnectionMode'] | DeviceState['connectionMode']) {
  switch (mode) {
    case 'cloud':
      return 'Cloud MQTT';
    case 'local-lan':
      return 'Wi-Fi local';
    case 'local-ap':
      return 'AP da IHM';
    case 'simulation':
      return 'Simulacao';
    default:
      return 'Auto';
  }
}

export function resolveDeviceOnline(snapshot: DeviceSnapshot) {
  return snapshot.state.deviceOnline && snapshot.state.readyState !== 'offline';
}
