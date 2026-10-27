import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Les jetons ne passent jamais par AsyncStorage. Sur le web (non cible de
 * production), SecureStore n'existe pas : on garde uniquement en mémoire.
 */
const memoire = new Map<string, string>();
const estWeb = Platform.OS === 'web';

export const CLES = {
  acces: 'secondevie.acces',
  refresh: 'secondevie.refresh',
  appareil: 'secondevie.appareil',
  brouillon: 'secondevie.brouillon',
} as const;

export async function lireSecret(cle: string): Promise<string | null> {
  if (estWeb) return memoire.get(cle) ?? null;

  return SecureStore.getItemAsync(cle);
}

export async function ecrireSecret(cle: string, valeur: string): Promise<void> {
  if (estWeb) {
    memoire.set(cle, valeur);
    return;
  }

  await SecureStore.setItemAsync(cle, valeur, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function supprimerSecret(cle: string): Promise<void> {
  if (estWeb) {
    memoire.delete(cle);
    return;
  }

  await SecureStore.deleteItemAsync(cle);
}
