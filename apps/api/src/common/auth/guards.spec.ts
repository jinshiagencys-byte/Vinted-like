import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ProprietaireGuard } from './proprietaire.guard';
import { RolesGuard } from './roles.guard';

function contexte(request: Partial<Request>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class Test {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('refuse un rôle non autorisé', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => ['admin']),
    } as unknown as Reflector;
    const request: Partial<Request> = {
      utilisateur: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'membre',
        emailVerifie: true,
        versionSecurite: 1,
      },
    };

    expect(() => new RolesGuard(reflector).canActivate(contexte(request))).toThrow(
      ForbiddenException,
    );
  });

  it('laisse passer un rôle autorisé', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => ['membre']),
    } as unknown as Reflector;
    const request: Partial<Request> = {
      utilisateur: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'membre',
        emailVerifie: true,
        versionSecurite: 1,
      },
    };

    expect(new RolesGuard(reflector).canActivate(contexte(request))).toBe(true);
  });
});

describe('ProprietaireGuard', () => {
  it('refuse une route sans règle de propriété configurée', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => undefined),
    } as unknown as Reflector;

    expect(() => new ProprietaireGuard(reflector).canActivate(contexte({}))).toThrow(
      ForbiddenException,
    );
  });

  it('renvoie 404 pour la ressource d’un autre membre', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => ({
        champ: 'utilisateurId',
        source: 'params',
      })),
    } as unknown as Reflector;
    const request: Partial<Request> = {
      params: { utilisateurId: 'autre' },
      utilisateur: {
        id: 'moi',
        role: 'membre',
        emailVerifie: true,
        versionSecurite: 1,
      },
    };

    expect(() => new ProprietaireGuard(reflector).canActivate(contexte(request))).toThrow(
      NotFoundException,
    );
  });

  it('laisse passer le propriétaire', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => ({
        champ: 'utilisateurId',
        source: 'params',
      })),
    } as unknown as Reflector;
    const request: Partial<Request> = {
      params: { utilisateurId: 'moi' },
      utilisateur: {
        id: 'moi',
        role: 'membre',
        emailVerifie: true,
        versionSecurite: 1,
      },
    };

    expect(new ProprietaireGuard(reflector).canActivate(contexte(request))).toBe(true);
  });
});
