import { defaultCapabilities } from '@/src/mocks/defaults';
import type { DiscoveredDeviceInfo, OnboardingDraft } from '@/src/types';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function discoverDeviceFromDraft(draft: OnboardingDraft): Promise<DiscoveredDeviceInfo> {
  await wait(1200);

  if (draft.method !== 'simulation' && (draft.host.includes('fail') || draft.deviceId.includes('fail'))) {
    throw new Error('Nao foi possivel ler os dados basicos da IHM. Verifique a conectividade e tente novamente.');
  }

  return {
    deviceId:
      draft.deviceId.trim() ||
      (draft.method === 'simulation'
        ? `sim-${Math.floor(100 + Math.random() * 900)}`
        : `esp32-${Math.floor(100 + Math.random() * 900)}`),
    defaultName:
      draft.method === 'simulation'
        ? 'Climatizador Simulado'
        : draft.method === 'ihm-ap'
          ? 'IHM em provisionamento'
          : 'Climatizador ESP32-S3',
    firmwareVersion: draft.method === 'simulation' ? 'sim-1.2.0' : 'fw-0.9.4',
    discoveryStatus:
      draft.method === 'simulation'
        ? 'Simulacao pronta'
        : draft.method === 'ihm-ap'
          ? 'Conectado ao AP da IHM'
          : 'Leitura realizada via rede local',
    capabilities:
      draft.method === 'simulation'
        ? { ...defaultCapabilities }
        : {
            ...defaultCapabilities,
            swingAvailable: draft.method !== 'manual-host',
            drainAvailable: true,
            fMaxHz: draft.method === 'local-network' ? 55 : 60,
          },
  };
}
