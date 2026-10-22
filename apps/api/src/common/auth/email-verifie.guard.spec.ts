import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { EmailVerifieGuard } from './email-verifie.guard';

function contexte(request: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('EmailVerifieGuard', () => {
  const guard = new EmailVerifieGuard();

  it('refuse une requête non authentifiée', () => {
    expect(() => guard.canActivate(contexte({}))).toThrow(UnauthorizedException);
  });

  it('refuse un e-mail non vérifié', () => {
    expect(() =>
      guard.canActivate(
        contexte({
          utilisateur: {
            id: '11111111-1111-4111-8111-111111111111',
            role: 'membre',
            emailVerifie: false,
            versionSecurite: 1,
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('laisse passer un e-mail vérifié', () => {
    expect(
      guard.canActivate(
        contexte({
          utilisateur: {
            id: '11111111-1111-4111-8111-111111111111',
            role: 'membre',
            emailVerifie: true,
            versionSecurite: 1,
          },
        }),
      ),
    ).toBe(true);
  });
});
