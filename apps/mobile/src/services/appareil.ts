import { Platform } from 'react-native';
import type { AppareilDemande, Plateforme } from '@secondevie/contracts';
import { CLES, ecrireSecret, lireSecret } from './stockage';

function identifiantAleatoire(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function plateformeCourante(): Plateforme {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/** Identifiant stable de l'installation, conservé dans SecureStore. */
export async function identifiantAppareil(): Promise<string> {
  const existant = await lireSecret(CLES.appareil);

  if (existant) return existant;

  const nouveau = identifiantAleatoire();
  await ecrireSecret(CLES.appareil, nouveau);
  return nouveau;
}

export async function appareilDemande(): Promise<AppareilDemande> {
  return {
    deviceId: await identifiantAppareil(),
    plateforme: plateformeCourante(),
  };
}
