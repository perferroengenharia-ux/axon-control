import {
  useCallback,
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import { createDefaultSnapshot, defaultPreferences } from '@/src/mocks/defaults';
import { createCommandRecord, createDeviceCommandMessage } from '@/src/services/device-service';
import { loadAppState, loadDeviceSecrets, saveAppState, saveDeviceSecrets } from '@/src/services/storage';
import { getTransportAdapter, mqttWebSocketTransport, type TransportSession } from '@/src/services/transports';
import type {
  AppPreferences,
  ClimateDevice,
  CommandType,
  ConnectionMode,
  ConnectionTestResult,
  DeviceEvent,
  DeviceSnapshot,
  DeviceSnapshotPatch,
  PersistedAppState,
  Schedule,
} from '@/src/types';
import { upsertCommand, updateCommandStatus } from '@/src/utils/commands';
import { isoNow } from '@/src/utils/date';
import { clampFrequency, getFeatureExplanation, isFeatureAvailable } from '@/src/utils/device';
import { createId } from '@/src/utils/id';

type SnapshotMap = Record<string, DeviceSnapshot>;
type ConnectionTestMap = Record<string, ConnectionTestResult | undefined>;

interface AppStoreState extends PersistedAppState {
  hydrated: boolean;
  snapshots: SnapshotMap;
  connectionTests: ConnectionTestMap;
  lastGlobalError: string | null;
}

type AppStoreAction =
  | {
      type: 'hydrate';
      payload: PersistedAppState;
      connectionTests?: ConnectionTestMap;
    }
  | { type: 'upsert-device'; payload: ClimateDevice }
  | { type: 'remove-device'; deviceId: string }
  | { type: 'set-active-device'; deviceId: string | null }
  | { type: 'toggle-favorite'; deviceId: string }
  | { type: 'set-schedules'; payload: Schedule[] }
  | { type: 'merge-device-schedules'; deviceId: string; schedules: Schedule[] }
  | { type: 'set-preferences'; payload: Partial<AppPreferences> }
  | { type: 'merge-snapshot'; deviceId: string; patch: DeviceSnapshotPatch }
  | { type: 'set-connection-test'; deviceId: string; result: ConnectionTestResult }
  | { type: 'set-global-error'; message: string | null };

interface SendCommandInput {
  deviceId: string;
  type: CommandType;
  payload?: Record<string, unknown>;
}

interface UpsertDeviceInput {
  device: ClimateDevice;
  setActive?: boolean;
}

interface AppStoreContextValue {
  state: AppStoreState;
  activeDevice: ClimateDevice | null;
  activeSnapshot: DeviceSnapshot | null;
  upsertDevice: (input: UpsertDeviceInput) => void;
  removeDevice: (deviceId: string) => void;
  setActiveDevice: (deviceId: string) => void;
  toggleFavorite: (deviceId: string) => void;
  sendCommand: (input: SendCommandInput) => Promise<void>;
  saveSchedules: (deviceId: string, nextSchedules: Schedule[]) => Promise<void>;
  upsertSchedule: (schedule: Schedule) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
  testConnection: (
    deviceId: string,
    mode?: ConnectionMode,
    overrideDevice?: ClimateDevice,
  ) => Promise<ConnectionTestResult | null>;
  setPreferences: (payload: Partial<AppPreferences>) => void;
  clearGlobalError: () => void;
}

const AppStoreContext = createContext<AppStoreContextValue | undefined>(undefined);

const initialState: AppStoreState = {
  devices: [],
  activeDeviceId: null,
  schedules: [],
  preferences: { ...defaultPreferences },
  hydrated: false,
  snapshots: {},
  connectionTests: {},
  lastGlobalError: null,
};

function getInitialConnectionMode(device: ClimateDevice): ConnectionMode {
  if (device.isSimulation || device.preferredConnectionMode === 'simulation') {
    return 'simulation';
  }

  if (device.preferredConnectionMode === 'local-ap') {
    return 'local-ap';
  }

  if (device.preferredConnectionMode === 'local-lan') {
    return 'local-lan';
  }

  return 'cloud';
}

function buildInitialSnapshot(device: ClimateDevice): DeviceSnapshot {
  const base = createDefaultSnapshot();
  const isSimulation = device.isSimulation;
  const capabilities = device.seedCapabilities ?? base.capabilities;
  const initialConnectionMode = getInitialConnectionMode(device);

  return normalizeSnapshot({
    ...base,
    capabilities,
    state: {
      ...base.state,
      deviceOnline: isSimulation,
      connectionMode: initialConnectionMode,
      inverterRunning: isSimulation,
      freqCurrentHz: isSimulation ? base.state.freqCurrentHz : 0,
      freqTargetHz: isSimulation ? base.state.freqTargetHz : 0,
      pumpState: isSimulation ? base.state.pumpState : 'unknown',
      swingState: isSimulation ? base.state.swingState : 'unknown',
      drainState: isSimulation ? base.state.drainState : 'unknown',
      waterLevelState: !capabilities.waterSensorEnabled
        ? 'disabled'
        : isSimulation
          ? base.state.waterLevelState
          : 'unknown',
      readyState: isSimulation ? 'running' : 'offline',
      lastSeen: device.lastSeen ?? null,
    },
    diagnostics: {
      ...base.diagnostics,
      firmwareVersion: device.firmwareVersion ?? 'desconhecida',
      connectionSummary: isSimulation
        ? 'Dispositivo em modo simulacao.'
        : initialConnectionMode === 'cloud'
          ? 'Aguardando sincronizacao com a IHM pela nuvem.'
          : 'Aguardando sincronizacao com a IHM pela rede local.',
      transportStatus: isSimulation ? 'connected' : 'idle',
      lastSyncAt: isSimulation ? isoNow() : null,
    },
    events: [
      {
        id: createId('evt'),
        deviceId: device.deviceId,
        level: 'info',
        title: isSimulation ? 'Simulador pronto' : 'Cadastro concluido',
        message: isSimulation
          ? 'Use este dispositivo para explorar as telas sem hardware real.'
          : 'O climatizador foi cadastrado e aguarda a primeira sincronizacao com a IHM.',
        createdAt: isoNow(),
      },
    ],
  });
}

function normalizeSnapshot(snapshot: DeviceSnapshot, patch?: DeviceSnapshotPatch): DeviceSnapshot {
  const next = {
    ...snapshot,
    state: {
      ...snapshot.state,
    },
  };

  if (!next.capabilities.waterSensorEnabled) {
    next.state.waterLevelState = 'disabled';
  }

  next.state.freqTargetHz = clampFrequency(next.state.freqTargetHz, next.capabilities);

  const commandStatus = patch?.state?.lastCommandStatus;
  if (commandStatus === 'applied' || commandStatus === 'failed') {
    const pendingCommand = next.commands.find((command) => command.status === 'sending');
    if (pendingCommand) {
      next.commands = updateCommandStatus(next.commands, pendingCommand.id, commandStatus);
    }
  }

  return next;
}

function mergeSnapshot(current: DeviceSnapshot, patch: DeviceSnapshotPatch): DeviceSnapshot {
  return normalizeSnapshot({
    capabilities: {
      ...current.capabilities,
      ...(patch.capabilities ?? {}),
    },
    state: {
      ...current.state,
      ...(patch.state ?? {}),
    },
    diagnostics: {
      ...current.diagnostics,
      ...(patch.diagnostics ?? {}),
    },
    commands: patch.commands ?? current.commands,
    events: patch.events ?? current.events,
  }, patch);
}

function stripSensitiveData(devices: ClimateDevice[]) {
  return devices.map((device) => ({
    ...device,
    mqttConfig: {
      ...device.mqttConfig,
      password: undefined,
    },
    localConfig: {
      ...device.localConfig,
      accessPointPassword: undefined,
    },
  }));
}

function buildSecretMap(devices: ClimateDevice[]) {
  return devices.reduce<Record<string, string>>((accumulator, device) => {
    if (device.mqttConfig.password) {
      accumulator[`${device.id}:mqttPassword`] = device.mqttConfig.password;
    }

    if (device.localConfig.accessPointPassword) {
      accumulator[`${device.id}:localApPassword`] = device.localConfig.accessPointPassword;
    }

    return accumulator;
  }, {});
}

function rehydrateDevices(devices: ClimateDevice[], secretMap: Record<string, string>) {
  return devices.map((device) => ({
    ...device,
    mqttConfig: {
      ...device.mqttConfig,
      password: secretMap[`${device.id}:mqttPassword`] ?? device.mqttConfig.password,
    },
    localConfig: {
      ...device.localConfig,
      accessPointPassword:
        secretMap[`${device.id}:localApPassword`] ?? device.localConfig.accessPointPassword,
    },
  }));
}

function buildSnapshotMap(devices: ClimateDevice[]) {
  return devices.reduce<SnapshotMap>((accumulator, device) => {
    accumulator[device.id] = buildInitialSnapshot(device);
    return accumulator;
  }, {});
}

function mergeSchedulesForDevice(
  currentSchedules: Schedule[],
  deviceId: string,
  nextDeviceSchedules: Schedule[],
) {
  return [
    ...currentSchedules.filter((schedule) => schedule.deviceId !== deviceId),
    ...nextDeviceSchedules,
  ];
}

function reducer(state: AppStoreState, action: AppStoreAction): AppStoreState {
  switch (action.type) {
    case 'hydrate': {
      return {
        ...action.payload,
        hydrated: true,
        snapshots: buildSnapshotMap(action.payload.devices),
        connectionTests: action.connectionTests ?? {},
        lastGlobalError: null,
      };
    }
    case 'upsert-device': {
      const exists = state.devices.some((device) => device.id === action.payload.id);
      const devices = exists
        ? state.devices.map((device) => (device.id === action.payload.id ? action.payload : device))
        : [action.payload, ...state.devices];

      return {
        ...state,
        devices,
        snapshots: {
          ...state.snapshots,
          [action.payload.id]: state.snapshots[action.payload.id] ?? buildInitialSnapshot(action.payload),
        },
      };
    }
    case 'remove-device': {
      const devices = state.devices.filter((device) => device.id !== action.deviceId);
      const schedules = state.schedules.filter((schedule) => schedule.deviceId !== action.deviceId);
      const snapshots = { ...state.snapshots };
      const connectionTests = { ...state.connectionTests };

      delete snapshots[action.deviceId];
      delete connectionTests[action.deviceId];

      return {
        ...state,
        devices,
        schedules,
        snapshots,
        connectionTests,
        activeDeviceId:
          state.activeDeviceId === action.deviceId ? devices[0]?.id ?? null : state.activeDeviceId,
      };
    }
    case 'set-active-device':
      return {
        ...state,
        activeDeviceId: action.deviceId,
      };
    case 'toggle-favorite':
      return {
        ...state,
        devices: state.devices.map((device) =>
          device.id === action.deviceId ? { ...device, isFavorite: !device.isFavorite } : device,
        ),
      };
    case 'set-schedules':
      return {
        ...state,
        schedules: action.payload,
      };
    case 'merge-device-schedules':
      return {
        ...state,
        schedules: mergeSchedulesForDevice(state.schedules, action.deviceId, action.schedules),
      };
    case 'set-preferences':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
        },
      };
    case 'merge-snapshot':
      if (state.devices.length === 0) {
        return state;
      }

      return {
        ...state,
        snapshots: {
          ...state.snapshots,
          [action.deviceId]: mergeSnapshot(
            state.snapshots[action.deviceId] ??
              buildInitialSnapshot(
                state.devices.find((device) => device.id === action.deviceId) ?? state.devices[0],
              ),
            action.patch,
          ),
        },
      };
    case 'set-connection-test':
      return {
        ...state,
        connectionTests: {
          ...state.connectionTests,
          [action.deviceId]: action.result,
        },
      };
    case 'set-global-error':
      return {
        ...state,
        lastGlobalError: action.message,
      };
    default:
      return state;
  }
}

async function loadPersistedState() {
  const [persisted, secrets] = await Promise.all([loadAppState(), loadDeviceSecrets()]);
  return {
    ...persisted,
    devices: rehydrateDevices(persisted.devices, secrets),
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sessionRef = useRef<Map<string, TransportSession>>(new Map());
  const sessionDevicesRef = useRef(state.devices);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    sessionDevicesRef.current = state.devices;
  }, [state.devices]);

  const activeDevice = useMemo(
    () => state.devices.find((device) => device.id === state.activeDeviceId) ?? null,
    [state.devices, state.activeDeviceId],
  );

  const activeSnapshot = useMemo(
    () => (activeDevice ? state.snapshots[activeDevice.id] ?? buildInitialSnapshot(activeDevice) : null),
    [activeDevice, state.snapshots],
  );

  const sessionConfigSignature = useMemo(
    () =>
      state.devices
        .map((device) =>
          [
            device.id,
            device.deviceId,
            device.preferredConnectionMode,
            device.isSimulation,
            device.mqttConfig.brokerUrl,
            device.mqttConfig.port,
            device.mqttConfig.protocol,
            device.mqttConfig.username ?? '',
            device.mqttConfig.password ?? '',
            device.mqttConfig.topicPrefix,
            device.localConfig.host,
            device.localConfig.port,
            device.localConfig.accessPointSsid ?? '',
            device.localConfig.accessPointPassword ?? '',
          ].join('|'),
        )
        .sort()
        .join('||'),
    [state.devices],
  );

  const getSnapshotForDevice = useCallback((deviceId: string) => {
    const currentState = stateRef.current;
    const device = currentState.devices.find((entry) => entry.id === deviceId);
    if (!device) {
      return createDefaultSnapshot();
    }

    return currentState.snapshots[deviceId] ?? buildInitialSnapshot(device);
  }, []);

  const applyPatch = useCallback((deviceId: string, patch: DeviceSnapshotPatch) => {
    dispatch({ type: 'merge-snapshot', deviceId, patch });
  }, []);

  const reportTransportError = useCallback((deviceId: string, message: string) => {
    const current = getSnapshotForDevice(deviceId);

    dispatch({
      type: 'merge-snapshot',
      deviceId,
      patch: {
        state: {
          ...current.state,
          deviceOnline: false,
          readyState: 'offline',
          lastCommandStatus:
            current.state.lastCommandStatus === 'sending' ? 'failed' : current.state.lastCommandStatus,
          lastErrorCode: 'TRANSPORT',
        },
        diagnostics: {
          ...current.diagnostics,
          transportStatus: 'error',
          lastErrorMessage: message,
          lastSyncAt: isoNow(),
        },
      },
    });

    dispatch({ type: 'set-global-error', message });
  }, [getSnapshotForDevice]);

  useEffect(() => {
    void (async () => {
      const persisted = await loadPersistedState();
      dispatch({ type: 'hydrate', payload: persisted });
    })();
  }, []);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    const payload: PersistedAppState = {
      devices: stripSensitiveData(state.devices),
      activeDeviceId: state.activeDeviceId,
      schedules: state.schedules,
      preferences: state.preferences,
    };

    void Promise.all([saveAppState(payload), saveDeviceSecrets(buildSecretMap(state.devices))]);
  }, [state.devices, state.activeDeviceId, state.schedules, state.preferences, state.hydrated]);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    let disposed = false;
    const sessions = sessionRef.current;

    const startSessionForDevice = async (device: ClimateDevice) => {
      const currentSnapshot = getSnapshotForDevice(device.id);

      let sessionDevice = device;

      if (!device.isSimulation && device.preferredConnectionMode === 'auto') {
        const cloudProbe = await mqttWebSocketTransport.testConnection({
          ...device,
          preferredConnectionMode: 'cloud',
        });

        dispatch({ type: 'set-connection-test', deviceId: device.id, result: cloudProbe });

        sessionDevice = {
          ...device,
          preferredConnectionMode: cloudProbe.ok ? 'cloud' : 'local-lan',
        };
      }

      const adapter = getTransportAdapter(sessionDevice, currentSnapshot);
      const session = await adapter.start({
        device: sessionDevice,
        getSnapshot: () => getSnapshotForDevice(device.id),
        getSchedules: () => stateRef.current.schedules.filter((schedule) => schedule.deviceId === device.id),
        onSnapshot: (patch) => applyPatch(device.id, patch),
        onSchedules: (resolvedDeviceId, schedules) =>
          dispatch({ type: 'merge-device-schedules', deviceId: resolvedDeviceId, schedules }),
        onError: (message) => reportTransportError(device.id, message),
      });

      if (disposed) {
        await session.dispose();
        return;
      }

      sessions.set(device.id, session);
      applyPatch(device.id, {
        state: {
          ...getSnapshotForDevice(device.id).state,
          connectionMode: session.mode,
        },
      });
    };

    const startAllSessions = async () => {
      const previousSessions = Array.from(sessions.values());
      sessions.clear();
      await Promise.allSettled(previousSessions.map((session) => session.dispose()));
      await Promise.all(
        sessionDevicesRef.current.map(async (device) => {
          try {
            await startSessionForDevice(device);
          } catch (error) {
            reportTransportError(
              device.id,
              error instanceof Error ? error.message : 'Falha ao iniciar sessao.',
            );
          }
        }),
      );
    };

    void startAllSessions();

    return () => {
      disposed = true;
      const currentSessions = Array.from(sessions.values());
      sessions.clear();
      void Promise.allSettled(currentSessions.map((session) => session.dispose()));
    };
  }, [state.hydrated, sessionConfigSignature, applyPatch, getSnapshotForDevice, reportTransportError]);

  const upsertDevice = ({ device, setActive }: UpsertDeviceInput) => {
    dispatch({ type: 'upsert-device', payload: device });

    if (setActive) {
      startTransition(() => {
        dispatch({ type: 'set-active-device', deviceId: device.id });
      });
    }
  };

  const removeDevice = (deviceId: string) => {
    dispatch({ type: 'remove-device', deviceId });
  };

  const setActiveDevice = (deviceId: string) => {
    startTransition(() => {
      dispatch({ type: 'set-active-device', deviceId });
    });
  };

  const toggleFavorite = (deviceId: string) => {
    dispatch({ type: 'toggle-favorite', deviceId });
  };

  const saveSchedules = async (deviceId: string, nextSchedules: Schedule[]) => {
    dispatch({ type: 'set-schedules', payload: nextSchedules });

    const device = stateRef.current.devices.find((entry) => entry.id === deviceId);
    if (!device) {
      return;
    }

    try {
      const adapter = getTransportAdapter(device, getSnapshotForDevice(deviceId));
      const savedSchedules = await adapter.saveSchedules(
        device,
        nextSchedules.filter((schedule) => schedule.deviceId === deviceId),
      );
      dispatch({ type: 'merge-device-schedules', deviceId, schedules: savedSchedules });
      applyPatch(deviceId, {
        diagnostics: {
          ...getSnapshotForDevice(deviceId).diagnostics,
          lastSyncAt: isoNow(),
          lastErrorMessage: null,
        },
      });
    } catch (error) {
      reportTransportError(
        deviceId,
        error instanceof Error ? error.message : 'Falha ao sincronizar agendamentos.',
      );
    }
  };

  const upsertSchedule = async (schedule: Schedule) => {
    const nextSchedules = [
      ...stateRef.current.schedules.filter((entry) => entry.id !== schedule.id),
      schedule,
    ];
    await saveSchedules(schedule.deviceId, nextSchedules);
  };

  const deleteSchedule = async (scheduleId: string) => {
    const schedule = stateRef.current.schedules.find((entry) => entry.id === scheduleId);

    if (!schedule) {
      return;
    }

    const nextSchedules = stateRef.current.schedules.filter((entry) => entry.id !== scheduleId);
    await saveSchedules(schedule.deviceId, nextSchedules);
  };

  const testConnection = async (
    deviceId: string,
    mode?: ConnectionMode,
    overrideDevice?: ClimateDevice,
  ) => {
    const device = overrideDevice ?? stateRef.current.devices.find((entry) => entry.id === deviceId);
    if (!device) {
      return null;
    }

    const effectiveDevice =
      mode && mode !== device.preferredConnectionMode ? { ...device, preferredConnectionMode: mode } : device;

    const adapter = getTransportAdapter(effectiveDevice, getSnapshotForDevice(deviceId));
    const result = await adapter.testConnection(effectiveDevice);
    dispatch({ type: 'set-connection-test', deviceId, result });
    return result;
  };

  const sendCommand = async ({ deviceId, type, payload = {} }: SendCommandInput) => {
    const device = stateRef.current.devices.find((entry) => entry.id === deviceId);
    const current = getSnapshotForDevice(deviceId);
    const nextPayload = { ...payload };

    if (!device) {
      return;
    }

    if (!current.state.deviceOnline && !device.isSimulation) {
      reportTransportError(deviceId, 'Dispositivo offline. Comando bloqueado ate nova sincronizacao.');
      return;
    }

    if (type === 'set-frequency') {
      nextPayload.freqTargetHz = clampFrequency(
        Number(payload.freqTargetHz ?? current.state.freqTargetHz),
        current.capabilities,
      );
    }

    if (type === 'set-pump' && !isFeatureAvailable(current.capabilities, 'pump')) {
      reportTransportError(deviceId, getFeatureExplanation(current.capabilities, 'pump') ?? 'Bomba indisponivel.');
      return;
    }

    if (type === 'set-swing' && !isFeatureAvailable(current.capabilities, 'swing')) {
      reportTransportError(deviceId, getFeatureExplanation(current.capabilities, 'swing') ?? 'Swing indisponivel.');
      return;
    }

    if ((type === 'run-drain' || type === 'stop-drain') && !isFeatureAvailable(current.capabilities, 'drain-cycle')) {
      reportTransportError(
        deviceId,
        getFeatureExplanation(current.capabilities, 'drain-cycle') ?? 'Dreno indisponivel.',
      );
      return;
    }

    const command = createDeviceCommandMessage(device.deviceId, type, nextPayload);
    const pendingCommand = createCommandRecord(command, 'sending');

    applyPatch(deviceId, {
      state: {
        ...current.state,
        lastCommandStatus: 'sending',
        lastErrorCode: null,
      },
      commands: upsertCommand(current.commands, pendingCommand),
    });

    try {
      const adapter = getTransportAdapter(device, getSnapshotForDevice(deviceId));
      const patch = await adapter.sendCommand(device, command);
      const connectionMode = getSnapshotForDevice(deviceId).state.connectionMode;
      const resolvedStatus =
        connectionMode === 'cloud'
          ? 'sending'
          : patch.commands?.find((entry) => entry.id === command.id)?.status ??
            patch.state?.lastCommandStatus ??
            'applied';

      applyPatch(deviceId, {
        ...patch,
        state:
          connectionMode === 'cloud'
            ? {
                ...getSnapshotForDevice(deviceId).state,
                connectionMode,
                freqTargetHz:
                  type === 'set-frequency'
                    ? Number(
                        nextPayload.freqTargetHz ?? getSnapshotForDevice(deviceId).state.freqTargetHz,
                      )
                    : getSnapshotForDevice(deviceId).state.freqTargetHz,
                lastSeen: patch.state?.lastSeen ?? getSnapshotForDevice(deviceId).state.lastSeen,
                lastCommandStatus: 'sending',
              }
            : {
                ...getSnapshotForDevice(deviceId).state,
                ...(patch.state ?? {}),
                connectionMode,
                lastCommandStatus: resolvedStatus,
              },
        commands: upsertCommand(
          getSnapshotForDevice(deviceId).commands,
          createCommandRecord(command, resolvedStatus),
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar comando.';
      applyPatch(deviceId, {
        state: {
          ...getSnapshotForDevice(deviceId).state,
          lastCommandStatus: 'failed',
          lastErrorCode: 'COMMAND',
        },
        diagnostics: {
          ...getSnapshotForDevice(deviceId).diagnostics,
          lastErrorMessage: message,
          lastSyncAt: isoNow(),
          transportStatus: 'error',
        },
        events: [
          {
            id: createId('evt'),
            deviceId: device.deviceId,
            level: 'error',
            title: 'Falha de comando',
            message,
            createdAt: isoNow(),
          } satisfies DeviceEvent,
          ...getSnapshotForDevice(deviceId).events,
        ].slice(0, 18),
        commands: upsertCommand(
          getSnapshotForDevice(deviceId).commands,
          createCommandRecord(command, 'failed'),
        ),
      });
    }
  };

  const setPreferences = (payload: Partial<AppPreferences>) => {
    dispatch({ type: 'set-preferences', payload });
  };

  const clearGlobalError = () => {
    dispatch({ type: 'set-global-error', message: null });
  };

  const value: AppStoreContextValue = {
    state,
    activeDevice,
    activeSnapshot,
    upsertDevice,
    removeDevice,
    setActiveDevice,
    toggleFavorite,
    sendCommand,
    saveSchedules,
    upsertSchedule,
    deleteSchedule,
    testConnection,
    setPreferences,
    clearGlobalError,
  };

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);

  if (!context) {
    throw new Error('useAppStore must be used within AppStoreProvider');
  }

  return context;
}

export function useDeviceSchedules(deviceId?: string | null) {
  const {
    state: { schedules },
  } = useAppStore();

  return useMemo(
    () => schedules.filter((schedule) => schedule.deviceId === deviceId),
    [deviceId, schedules],
  );
}

export function useDeviceSummary(deviceId?: string | null) {
  const { state } = useAppStore();

  return useMemo(() => {
    const device = state.devices.find((entry) => entry.id === deviceId);
    if (!device) {
      return null;
    }

    return {
      ...device,
      snapshot: state.snapshots[device.id] ?? buildInitialSnapshot(device),
    };
  }, [deviceId, state.devices, state.snapshots]);
}
