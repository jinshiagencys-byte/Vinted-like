import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import { PolitiqueSuppression } from '../../domain/policies/politique-suppression';
import type {
  CommandesPort,
  HacheurMotDePasse,
  LitigesPort,
  PortefeuillePort,
  UtilisateurRepository,
} from '../../domain/ports';
import {
  COMMANDES_PORT,
  HACHEUR_MOT_DE_PASSE,
  LITIGES_PORT,
  PORTEFEUILLE_PORT,
  UTILISATEUR_REPOSITORY,
} from '../../domain/ports';
import { MotDePasse } from '../../domain/value-objects/mot-de-passe';

@Injectable()
export class SupprimerCompte {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(HACHEUR_MOT_DE_PASSE) private readonly hacheur: HacheurMotDePasse,
    @Inject(COMMANDES_PORT) private readonly commandes: CommandesPort,
    @Inject(LITIGES_PORT) private readonly litiges: LitigesPort,
    @Inject(PORTEFEUILLE_PORT) private readonly portefeuille: PortefeuillePort,
    private readonly politique: PolitiqueSuppression,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(utilisateurId: string, motDePasse: string): Promise<void> {
    const utilisateur = await this.utilisateurs.trouverParId(utilisateurId);

    if (!utilisateur || utilisateur.supprimeLe || !utilisateur.motDePasseHash) {
      throw new DomainError('ressource_introuvable', 'Compte introuvable.', 404);
    }

    const valide = await this.hacheur.verifier(
      utilisateur.motDePasseHash,
      MotDePasse.creer(motDePasse),
    );

    if (!valide) {
      throw new DomainError('mot_de_passe_incorrect', 'Le mot de passe est incorrect.', 401);
    }

    let contexte;

    try {
      const [commandesEnCours, litigesOuverts, soldeNonNul] = await Promise.all([
        this.commandes.compterEnCours(utilisateurId),
        this.litiges.compterOuverts(utilisateurId),
        this.portefeuille.soldeNonNul(utilisateurId),
      ]);
      contexte = { commandesEnCours, litigesOuverts, soldeNonNul };
    } catch {
      throw new DomainError(
        'fournisseur_indisponible',
        'La suppression est momentanément indisponible. Réessayez plus tard.',
        503,
      );
    }

    const decision = this.politique.peutSupprimer(contexte);

    if (!decision.autorise) {
      throw new DomainError(
        'suppression_impossible',
        'Votre compte ne peut pas être supprimé pour le moment.',
        409,
        { raisons: decision.raisons },
      );
    }

    const supprimeLe = new Date();
    const suffixe = randomBytes(4).toString('hex');
    const nouvelleVersion = utilisateur.versionSecurite + 1;

    await this.utilisateurs.anonymiser(utilisateurId, {
      email: `supprime+${randomUUID()}@invalid.secondevie`,
      pseudo: `membre-${suffixe}`,
      pseudoNormalise: `membre-${suffixe}`,
      supprimeLe,
      versionSecurite: nouvelleVersion,
    });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enregistrer(tx, {
        type: 'compte.supprime',
        agregatType: 'utilisateur',
        agregatId: utilisateurId,
        payload: { utilisateurId, supprimeLe: supprimeLe.toISOString() },
      });
    });
  }
}
