import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import type { ProfilRepository, UtilisateurRepository } from '../../domain/ports';
import { PROFIL_REPOSITORY, UTILISATEUR_REPOSITORY } from '../../domain/ports';

export interface ProfilPublic {
  pseudo: string;
  avatarUrl: string | null;
  bio: string | null;
  noteMoyenne: number;
  nbVentes: number;
  nbAchats: number;
  membreDepuis: string;
}

@Injectable()
export class ConsulterProfilPublic {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(PROFIL_REPOSITORY) private readonly profils: ProfilRepository,
  ) {}

  async executer(pseudo: string): Promise<ProfilPublic> {
    const utilisateur = await this.utilisateurs.trouverParPseudoNormalise(
      pseudo.trim().toLowerCase(),
    );

    if (
      !utilisateur ||
      utilisateur.supprimeLe !== null ||
      utilisateur.statut === 'supprime' ||
      utilisateur.statut === 'suspendu'
    ) {
      throw new DomainError('ressource_introuvable', 'Profil introuvable.', 404);
    }

    const profil = await this.profils.trouverParUtilisateurId(utilisateur.id);

    if (!profil || profil.visibilite !== 'public') {
      throw new DomainError('ressource_introuvable', 'Profil introuvable.', 404);
    }

    return {
      pseudo: utilisateur.pseudo,
      avatarUrl: profil.avatarUrl,
      bio: profil.bio,
      noteMoyenne: utilisateur.noteMoyenne,
      nbVentes: utilisateur.nbVentes,
      nbAchats: utilisateur.nbAchats,
      membreDepuis: utilisateur.creeLe.toISOString(),
    };
  }
}
