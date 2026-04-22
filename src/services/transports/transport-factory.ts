import type { ClimateDevice, DeviceSnapshot } from '@/src/types';

import { localHttpTransport } from './local-http-transport';
import { mqttWebSocketTransport } from './mqtt-websocket-transport';
import { simulationTransport } from './simulation-transport';
import type { DeviceTransportAdapter } from './types';

export function resolveDeviceMode(device: ClimateDevice, snapshot?: DeviceSnapshot) {
  if (device.isSimulation || device.preferredConnectionMode === 'simulation') {
    return 'simulation';
  }

  if (device.preferredConnectionMode === 'local-ap') {
    return 'local-ap';
  }

  if (device.preferredConnectionMode === 'local-lan') {
    return 'local-lan';
  }

  if (device.preferredConnectionMode === 'cloud') {
    return 'cloud';
  }

  if (snapshot?.state.connectionMode === 'local-ap' || snapshot?.state.connectionMode === 'local-lan') {
    return snapshot.state.connectionMode;
  }

  return 'cloud';
}

export function getTransportAdapter(device: ClimateDevice, snapshot?: DeviceSnapshot): DeviceTransportAdapter {
  const mode = resolveDeviceMode(device, snapshot);

  switch (mode) {
    case 'simulation':
      return simulationTransport;
    case 'local-ap':
    case 'local-lan':
      return localHttpTransport;
    default:
      return mqttWebSocketTransport;
  }
}
