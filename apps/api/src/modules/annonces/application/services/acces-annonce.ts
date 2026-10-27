import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import type { AnnonceAvecPhotos } from '../../domain/entities';
import { ANNONCE_REPOSITORY } from '../../domain/ports';
import type { AnnonceRepository } from '../../domain/ports';

/** Charge une annonce appartenant à l'utilisateur ; toute autre situation est un 404. */
@Injectable()
export class AccesAnnonce {
  constructor(@Inject(ANNONCE_REPOSITORY) private readonly annonces: AnnonceRepository) {}

  async proprietaire(id: string, utilisateurId: string): Promise<AnnonceAvecPhotos> {
    const annonce = await this.annonces.trouverParId(id);

    if (!annonce || annonce.vendeurId !== utilisateurId) {
      throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
    }

    return annonce;
  }

  async trouver(id: string): Promise<AnnonceAvecPhotos> {
    const annonce = await this.annonces.trouverParId(id);

    if (!annonce) {
      throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
    }

    return annonce;
  }

  verifierVersion(versionAttendue: number, versionActuelle: number): void {
    if (versionAttendue !== versionActuelle) {
      throw new DomainError(
        'etat_incompatible',
        'L’annonce a été modifiée depuis son chargement. Rechargez-la.',
        409,
        { versionActuelle },
      );
    }
  }
}
