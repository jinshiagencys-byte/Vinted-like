import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import { AccesAnnonce } from '../services/acces-annonce';
import { PublierAnnonce, type PublicationResultat } from './publier-annonce';

@Injectable()
export class RepublierAnnonce {
  constructor(
    private readonly acces: AccesAnnonce,
    private readonly publier: PublierAnnonce,
  ) {}

  async executer(
    utilisateurId: string,
    annonceId: string,
    version: number,
  ): Promise<PublicationResultat> {
    const annonce = await this.acces.proprietaire(annonceId, utilisateurId);

    if (annonce.statut !== 'archivee') {
      throw new DomainError(
        'etat_incompatible',
        'Seule une annonce archivée peut être republiée.',
        409,
        { statutActuel: annonce.statut },
      );
    }

    // Réutilisation volontaire du même identifiant et de la même référence
    // (M2-Q2) : le cycle de publication est identique à une première mise en ligne.
    return this.publier.executer(utilisateurId, annonceId, version);
  }
}
