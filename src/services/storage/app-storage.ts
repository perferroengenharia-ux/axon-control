import AsyncStorage from '@react-native-async-storage/async-storage';

import { createInitialPersistedState } from '@/src/mocks/defaults';
import type { PersistedAppState } from '@/src/types';

import { storageKeys } from './storage-keys';

export async function saveAppState(state: PersistedAppState) {
  await AsyncStorage.setItem(storageKeys.appState, JSON.stringify(state));
}

export async function loadAppState() {
  const raw = await AsyncStorage.getItem(storageKeys.appState);

  if (!raw) {
    return createInitialPersistedState();
  }

  try {
    return JSON.parse(raw) as PersistedAppState;
  } catch {
    return createInitialPersistedState();
  }
}
