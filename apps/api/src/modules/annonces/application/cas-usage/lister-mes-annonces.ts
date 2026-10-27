import { Inject, Injectable } from '@nestjs/common';
import type { AnnonceAvecPhotos } from '../../domain/entities';
import type { StatutAnnonce } from '../../domain/enums';
import { ANNONCE_REPOSITORY } from '../../domain/ports';
import type { AnnonceRepository, PageAnnonces } from '../../domain/ports';

export interface ListerMesAnnoncesCommande {
  statut?: StatutAnnonce;
  curseur?: string;
  limite: number;
}

@Injectable()
export class ListerMesAnnonces {
  constructor(@Inject(ANNONCE_REPOSITORY) private readonly annonces: AnnonceRepository) {}

  executer(
    vendeurId: string,
    commande: ListerMesAnnoncesCommande,
  ): Promise<PageAnnonces<AnnonceAvecPhotos>> {
    return this.annonces.listerParVendeur(vendeurId, commande);
  }
}
