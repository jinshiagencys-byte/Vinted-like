import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { OutboxService } from '../../../../../common/outbox/outbox.service';
import type { CreerUtilisateur, InscriptionAtomique } from '../../../domain/ports';
import { versUtilisateur } from './mappers';

@Injectable()
export class InscriptionPrismaRepository implements InscriptionAtomique {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async creer(
    donnees: CreerUtilisateur,
    verification: { codeHash: string; expireLe: Date },
  ): Promise<{ utilisateur: ReturnType<typeof versUtilisateur>; verificationId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const utilisateur = await tx.utilisateur.create({
        data: {
          email: donnees.email,
          telephone: donnees.telephone ?? null,
          motDePasseHash: donnees.motDePasseHash,
          pseudo: donnees.pseudo,
          pseudoNormalise: donnees.pseudoNormalise,
          nomComplet: donnees.nomComplet ?? null,
          dateNaissance: donnees.dateNaissance,
          pays: donnees.pays ?? 'FR',
          role: donnees.role ?? 'membre',
        },
      });

      await tx.profil.create({ data: { utilisateurId: utilisateur.id } });

      const code = await tx.verification.create({
        data: {
          utilisateurId: utilisateur.id,
          type: 'email',
          codeHash: verification.codeHash,
          expireLe: verification.expireLe,
        },
      });

      await this.outbox.enregistrer(tx, {
        type: 'compte.cree',
        agregatType: 'utilisateur',
        agregatId: utilisateur.id,
        payload: {
          utilisateurId: utilisateur.id,
          pseudo: utilisateur.pseudo,
          creeLe: utilisateur.creeLe.toISOString(),
        },
      });

      return { utilisateur: versUtilisateur(utilisateur), verificationId: code.id };
    });
  }
}
