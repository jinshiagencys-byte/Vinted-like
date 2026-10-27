import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { UtilisateurRepository } from '../../../domain/ports';
import { UTILISATEUR_REPOSITORY } from '../../../domain/ports';

/**
 * Vérifie que le jeton d'accès n'a pas été invalidé par une suspension ou un
 * changement de mot de passe (versionSecurite, R07/R10/R12).
 */
@Injectable()
export class VersionSecuriteGuard implements CanActivate {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authentifie = request.utilisateur;

    if (!authentifie) {
      throw new UnauthorizedException({
        code: 'authentification_requise',
        message: 'Authentification requise.',
      });
    }

    const utilisateur = await this.utilisateurs.trouverParId(authentifie.id);

    if (
      !utilisateur ||
      utilisateur.supprimeLe !== null ||
      (utilisateur.statut !== 'actif' && utilisateur.statut !== 'restreint') ||
      utilisateur.versionSecurite !== authentifie.versionSecurite
    ) {
      throw new UnauthorizedException({
        code: 'session_invalide',
        message: 'Votre session a expiré. Reconnectez-vous.',
      });
    }

    return true;
  }
}
