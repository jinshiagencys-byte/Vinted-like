import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import type { AnnonceAvecPhotos } from '../../domain/entities';
import { COMPTES_QUERY } from '../../domain/ports';
import type { ComptesQueryPort } from '../../domain/ports';
import { peutVoir, roleActeur } from '../../domain/politiques/politique-visibilite';
import type { RoleActeur } from '../../domain/politiques/politique-visibilite';
import { AccesAnnonce } from '../services/acces-annonce';

export interface ActeurHttp {
  id?: string;
  role?: 'membre' | 'moderateur' | 'admin' | 'systeme';
}

export interface VueAnnonce extends AnnonceAvecPhotos {
  roleActeur: RoleActeur;
}

@Injectable()
export class ConsulterAnnonce {
  constructor(
    private readonly acces: AccesAnnonce,
    @Inject(COMPTES_QUERY) private readonly comptes: ComptesQueryPort,
  ) {}

  async executer(id: string, acteur: ActeurHttp = {}): Promise<VueAnnonce> {
    const annonce = await this.acces.trouver(id);
    const vendeur = await this.comptes.profilVendeur(annonce.vendeurId);
    const statutVendeur = vendeur?.statut ?? 'supprime';

    if (!peutVoir(annonce, statutVendeur, acteur)) {
      throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
    }

    const role = roleActeur(annonce, acteur);

    if (role === 'public') {
      return { ...annonce, motifRefus: null, roleActeur: role };
    }

    return { ...annonce, roleActeur: role };
  }
}
