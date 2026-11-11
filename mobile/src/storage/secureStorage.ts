import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// En el navegador no existe el llavero seguro: se usa localStorage (solo para pruebas en web).
const web = Platform.OS === 'web';

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (web) { try { return window.localStorage.getItem(key); } catch { return null; } }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (web) { try { window.localStorage.setItem(key, value); } catch { /* sin almacenamiento */ } return; }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (web) { try { window.localStorage.removeItem(key); } catch { /* sin almacenamiento */ } return; }
    await SecureStore.deleteItemAsync(key);
  },
};
