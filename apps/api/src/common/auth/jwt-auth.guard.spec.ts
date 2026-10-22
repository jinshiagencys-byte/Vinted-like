import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard';

const secret = 'secret-de-test-32-caracteres-minimum';

function contexte(request: Partial<Request>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class Test {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function guard(): JwtAuthGuard {
  const jwt = new JwtService({ secret });
  const config = {
    get: vi.fn((cle: string) => (cle === 'JWT_KID' ? 'test-kid' : undefined)),
  } as unknown as ConfigService;

  return new JwtAuthGuard(jwt, new Reflector(), config);
}

describe('JwtAuthGuard', () => {
  it('refuse une requête sans jeton', async () => {
    await expect(guard().canActivate(contexte({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un jeton invalide', async () => {
    await expect(
      guard().canActivate(contexte({ headers: { authorization: 'Bearer invalide' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepte un jeton signé et expose l’utilisateur', async () => {
    const jwt = new JwtService({ secret });
    const token = jwt.sign(
      {
        sub: '11111111-1111-4111-8111-111111111111',
        role: 'membre',
        emailVerifie: true,
        ver: 3,
      },
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        header: { alg: 'HS256', kid: 'test-kid' },
      },
    );
    const request: Partial<Request> = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard().canActivate(contexte(request))).resolves.toBe(true);
    expect(request.utilisateur).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      role: 'membre',
      emailVerifie: true,
      versionSecurite: 3,
    });
  });
});
