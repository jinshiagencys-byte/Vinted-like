import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { logger } from '../observability/logger';
import { DomainError } from './domain-error';
import { AllExceptionsFilter } from './all-exceptions.filter';

function hote(traceId = 'trace-test-1234') {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status };
  const request = { traceId };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('normalise une erreur métier', () => {
    const { host, status, json } = hote();
    const filtre = new AllExceptionsFilter();

    filtre.catch(
      new DomainError('regle_metier_violee', 'Règle refusée.', 422, {
        raison: 'test',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({
      code: 'regle_metier_violee',
      message: 'Règle refusée.',
      details: { raison: 'test' },
      traceId: 'trace-test-1234',
    });
  });

  it('normalise une HttpException', () => {
    const { host, status, json } = hote();
    const filtre = new AllExceptionsFilter();

    filtre.catch(new BadRequestException('Entrée invalide'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'validation_echec',
        message: 'Entrée invalide',
        traceId: 'trace-test-1234',
      }),
    );
  });

  it('ne divulgue pas une exception inconnue', () => {
    const { host, status, json } = hote();
    const logErreur = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const filtre = new AllExceptionsFilter();

    filtre.catch(new Error('secret interne'), host);

    expect(logErreur).toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      code: 'erreur_interne',
      message: 'Une erreur interne est survenue.',
      traceId: 'trace-test-1234',
    });
  });
});
