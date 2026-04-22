import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { storageKeys } from './storage-keys';

function getWebStorage() {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage;
}

export async function saveDeviceSecrets(secretMap: Record<string, string>) {
  const raw = JSON.stringify(secretMap);

  if (Platform.OS === 'web') {
    getWebStorage()?.setItem(storageKeys.deviceSecrets, raw);
    return;
  }

  const available = await SecureStore.isAvailableAsync();

  if (!available) {
    return;
  }

  await SecureStore.setItemAsync(storageKeys.deviceSecrets, raw);
}

export async function loadDeviceSecrets() {
  if (Platform.OS === 'web') {
    const raw = getWebStorage()?.getItem(storageKeys.deviceSecrets);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  }

  const available = await SecureStore.isAvailableAsync();

  if (!available) {
    return {};
  }

  const raw = await SecureStore.getItemAsync(storageKeys.deviceSecrets);
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}
