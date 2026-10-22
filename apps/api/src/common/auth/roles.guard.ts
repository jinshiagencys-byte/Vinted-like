import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from './role';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequis = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rolesRequis?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const utilisateur = request.utilisateur;

    if (!utilisateur) {
      throw new UnauthorizedException({
        code: 'authentification_requise',
        message: 'Authentification requise.',
      });
    }

    if (!rolesRequis.includes(utilisateur.role)) {
      throw new ForbiddenException({
        code: 'autorisation_refusee',
        message: 'Vous n’avez pas les droits nécessaires pour cette action.',
      });
    }

    return true;
  }
}
