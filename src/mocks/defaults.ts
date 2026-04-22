import type {
  AppPreferences,
  ClimateDevice,
  DeviceCapabilities,
  DeviceDiagnostics,
  DeviceSnapshot,
  DeviceState,
  OnboardingDraft,
  PersistedAppState,
} from '@/src/types';
import { createId } from '@/src/utils/id';
import { isoNow } from '@/src/utils/date';

export const defaultCapabilities: DeviceCapabilities = {
  fMinHz: 18,
  fMaxHz: 60,
  pumpAvailable: true,
  swingAvailable: true,
  drainAvailable: true,
  waterSensorEnabled: true,
  drainMode: 'timed',
  drainTimeSec: 45,
  drainReturnDelaySec: 15,
  pumpLogicMode: 'linked',
  waterSensorMode: 'normal',
  preWetSec: 8,
  dryPanelSec: 20,
  dryPanelFreqHz: 22,
  resumeMode: 'resume-last-state',
  autoResetMode: 'enabled',
};

export const defaultState: DeviceState = {
  deviceOnline: true,
  connectionMode: 'simulation',
  inverterRunning: true,
  freqCurrentHz: 32,
  freqTargetHz: 32,
  pumpState: 'on',
  swingState: 'off',
  drainState: 'off',
  waterLevelState: 'ok',
  lastSeen: isoNow(),
  lastCommandStatus: 'idle',
  lastErrorCode: null,
  readyState: 'running',
};

export const defaultDiagnostics: DeviceDiagnostics = {
  firmwareVersion: 'sim-1.2.0',
  connectionSummary: 'Simulador local ativo para onboarding e testes.',
  transportStatus: 'connected',
  lastSyncAt: isoNow(),
  lastErrorMessage: null,
};

export function createDefaultSnapshot(): DeviceSnapshot {
  return {
    capabilities: { ...defaultCapabilities },
    state: { ...defaultState },
    diagnostics: { ...defaultDiagnostics },
    commands: [],
    events: [
      {
        id: createId('evt'),
        deviceId: 'sim-001',
        level: 'info',
        title: 'Simulador pronto',
        message: 'Use este dispositivo para explorar as telas sem hardware real.',
        createdAt: isoNow(),
      },
    ],
  };
}

export function createSimulationDevice(): ClimateDevice {
  return {
    id: createId('dev'),
    deviceId: 'sim-001',
    name: 'Climatizador Simulado',
    location: 'Laboratorio',
    notes: 'Perfil de treino e demonstracao.',
    preferredConnectionMode: 'simulation',
    mqttConfig: {
      brokerUrl: 'wss://broker.example.com/mqtt',
      port: 443,
      protocol: 'wss',
      username: 'demo',
      password: 'demo',
      topicPrefix: 'axon/devices',
      deviceId: 'sim-001',
    },
    localConfig: {
      host: '192.168.4.1',
      port: 8080,
      accessPointSsid: 'AXON-IHM-SETUP',
      accessPointPassword: '12345678',
    },
    lastSeen: isoNow(),
    isFavorite: true,
    isSimulation: true,
    firmwareVersion: 'sim-1.2.0',
    seedCapabilities: { ...defaultCapabilities },
  };
}

export const defaultPreferences: AppPreferences = {
  reducedMotion: false,
  preferSimulationOnFirstRun: true,
};

export function createInitialPersistedState(): PersistedAppState {
  const simulationDevice = createSimulationDevice();

  return {
    devices: [simulationDevice],
    activeDeviceId: simulationDevice.id,
    schedules: [],
    preferences: { ...defaultPreferences },
  };
}

export const defaultOnboardingDraft: OnboardingDraft = {
  method: 'ihm-ap',
  name: '',
  location: '',
  notes: '',
  brokerUrl: 'broker.example.com',
  brokerPort: 443,
  protocol: 'wss',
  mqttUsername: '',
  mqttPassword: '',
  topicPrefix: 'axon/devices',
  host: '192.168.4.1',
  localPort: 8080,
  accessPointSsid: 'AXON-IHM-SETUP',
  accessPointPassword: '',
  deviceId: '',
};
