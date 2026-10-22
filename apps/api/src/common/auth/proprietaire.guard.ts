import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PROPRIETAIRE_KEY, type ProprietaireOptions } from './proprietaire.decorator';

@Injectable()
export class ProprietaireGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<ProprietaireOptions>(PROPRIETAIRE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      throw new ForbiddenException({
        code: 'autorisation_refusee',
        message: 'Règle de propriété non configurée pour cette route.',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const utilisateur = request.utilisateur;

    if (!utilisateur) {
      throw new UnauthorizedException({
        code: 'authentification_requise',
        message: 'Authentification requise.',
      });
    }

    const conteneur = request[options.source] as Record<string, unknown> | undefined;
    const valeur = conteneur?.[options.champ];

    if (typeof valeur !== 'string' || valeur !== utilisateur.id) {
      throw new NotFoundException({
        code: 'ressource_introuvable',
        message: 'Ressource introuvable.',
      });
    }

    return true;
  }
}
