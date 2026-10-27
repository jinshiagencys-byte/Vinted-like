import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Role } from './role';
import { IS_PUBLIC_KEY } from './public.decorator';

interface JwtPayload {
  sub?: string;
  role?: string;
  emailVerifie?: boolean;
  ver?: number;
  sid?: string;
}

const roles: Role[] = ['membre', 'moderateur', 'admin', 'systeme'];

function estRole(valeur: unknown): valeur is Role {
  return typeof valeur === 'string' && roles.includes(valeur as Role);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const estPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (estPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'authentification_requise',
        message: 'Jeton d’accès manquant.',
      });
    }

    const token = authorization.slice('Bearer '.length).trim();
    const kidAttendu = this.config.get<string>('JWT_KID');

    try {
      const decode = this.jwtService.decode(token, { complete: true });
      if (!decode || typeof decode === 'string') {
        throw new Error('Jeton illisible');
      }

      if (kidAttendu && decode.header.kid !== kidAttendu) {
        throw new Error('Clé de signature inconnue');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (!payload.sub || !estRole(payload.role)) {
        throw new Error('Claims obligatoires absents');
      }

      request.utilisateur = {
        id: payload.sub,
        role: payload.role,
        emailVerifie: payload.emailVerifie === true,
        versionSecurite: typeof payload.ver === 'number' ? payload.ver : 0,
        ...(typeof payload.sid === 'string' ? { appareilId: payload.sid } : {}),
      };

      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'authentification_requise',
        message: 'Jeton d’accès invalide ou expiré.',
      });
    }
  }
}
