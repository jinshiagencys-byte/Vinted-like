import { SetMetadata } from '@nestjs/common';

export const PROPRIETAIRE_KEY = 'proprietaire';
export type ProprietaireSource = 'params' | 'body' | 'query';

export interface ProprietaireOptions {
  source: ProprietaireSource;
  champ: string;
}

/**
 * Vérifie que la valeur de la requête correspond à l'utilisateur authentifié.
 * Le guard renvoie volontairement 404, jamais 403, pour ne pas révéler
 * l'existence d'une ressource privée (R08).
 */
export const Proprietaire = (
  champ = 'utilisateurId',
  source: ProprietaireSource = 'params',
): MethodDecorator & ClassDecorator => SetMetadata(PROPRIETAIRE_KEY, { champ, source });
