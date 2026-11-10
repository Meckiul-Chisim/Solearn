/**
 * Stores the sign-in token on the device.
 * - iOS / Android: encrypted storage via expo-secure-store.
 * - Web: expo-secure-store is not supported, so we fall back to localStorage.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'solearn.token';
const isWeb = Platform.OS === 'web';

export async function getStoredToken(): Promise<string | null> {
  try {
    return isWeb ? window.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  } catch {
    return null; // Storage unavailable: behave as signed out.
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    if (isWeb) window.localStorage.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  } catch {
    // The session still works for this run; the user just signs in again next time.
  }
}

export async function clearToken(): Promise<void> {
  try {
    if (isWeb) window.localStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}
