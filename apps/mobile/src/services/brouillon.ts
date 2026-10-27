import { CLES, ecrireSecret, lireSecret, supprimerSecret } from './stockage';

export interface BrouillonInscription {
  email: string;
  telephone: string;
  pseudo: string;
  dateNaissance: string;
}

/**
 * Brouillon conservé dans SecureStore pour reprendre une inscription après
 * une perte réseau. Aucun mot de passe n'est conservé.
 */
export async function sauvegarderBrouillon(brouillon: BrouillonInscription): Promise<void> {
  await ecrireSecret(CLES.brouillon, JSON.stringify(brouillon));
}

export async function lireBrouillon(): Promise<BrouillonInscription | null> {
  const brut = await lireSecret(CLES.brouillon);

  if (!brut) return null;

  try {
    const valeur = JSON.parse(brut) as Partial<BrouillonInscription>;

    if (typeof valeur.email !== 'string' || typeof valeur.pseudo !== 'string') {
      return null;
    }

    return {
      email: valeur.email,
      telephone: typeof valeur.telephone === 'string' ? valeur.telephone : '',
      pseudo: valeur.pseudo,
      dateNaissance: typeof valeur.dateNaissance === 'string' ? valeur.dateNaissance : '',
    };
  } catch {
    return null;
  }
}

export async function effacerBrouillon(): Promise<void> {
  await supprimerSecret(CLES.brouillon);
}
