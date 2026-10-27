import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';

export interface ProfilVendeur {
  statut: 'actif' | 'restreint' | 'suspendu' | 'supprime';
  emailVerifie: boolean;
}

/**
 * Port de lecture exposé aux autres modules (M2, M5…). Aucun autre module ne
 * doit lire directement la table `utilisateurs`.
 */
@Injectable()
export class ComptesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async profilVendeur(utilisateurId: string): Promise<ProfilVendeur | null> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { statut: true, emailVerifieLe: true },
    });

    if (!utilisateur) return null;

    return {
      statut: utilisateur.statut,
      emailVerifie: utilisateur.emailVerifieLe !== null,
    };
  }

  async estActifEtVerifie(utilisateurId: string): Promise<boolean> {
    const profil = await this.profilVendeur(utilisateurId);
    return profil !== null && profil.statut === 'actif' && profil.emailVerifie;
  }
}
