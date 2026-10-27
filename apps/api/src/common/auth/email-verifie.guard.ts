import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/** R06 : les routes qui exigent un e-mail vérifié renvoient 403 sinon. */
@Injectable()
export class EmailVerifieGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.utilisateur) {
      throw new UnauthorizedException({
        code: 'authentification_requise',
        message: 'Authentification requise.',
      });
    }

    if (!request.utilisateur.emailVerifie) {
      throw new ForbiddenException({
        code: 'email_non_verifie',
        message: 'Vérifiez votre e-mail avant de continuer.',
        details: { raison: 'email_non_verifie' },
      });
    }

    return true;
  }
}
