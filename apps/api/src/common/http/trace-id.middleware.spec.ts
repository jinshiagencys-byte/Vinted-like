import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { TRACE_ID_HEADER, TraceIdMiddleware } from './trace-id.middleware';

function contexte(traceEntrant?: string) {
  const req = {
    header: vi.fn((nom: string) => (nom === TRACE_ID_HEADER ? traceEntrant : undefined)),
  } as unknown as Request;
  const res = { setHeader: vi.fn() } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe('TraceIdMiddleware', () => {
  it('génère un identifiant de 32 caractères et le renvoie dans l’en-tête', () => {
    const { req, res, next } = contexte();
    new TraceIdMiddleware().use(req, res, next);

    expect(req.traceId).toMatch(/^[a-f0-9]{32}$/);
    expect(res.setHeader).toHaveBeenCalledWith(TRACE_ID_HEADER, req.traceId);
    expect(next).toHaveBeenCalledOnce();
  });

  it('conserve un identifiant entrant valide', () => {
    const { req, res, next } = contexte('trace-test-1234');
    new TraceIdMiddleware().use(req, res, next);

    expect(req.traceId).toBe('trace-test-1234');
    expect(next).toHaveBeenCalledOnce();
  });

  it('remplace un identifiant entrant invalide', () => {
    const { req, res, next } = contexte('x');
    new TraceIdMiddleware().use(req, res, next);

    expect(req.traceId).not.toBe('x');
    expect(req.traceId).toHaveLength(32);
    expect(next).toHaveBeenCalledOnce();
  });
});
