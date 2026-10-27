import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../observability/logger';
import { DomainError } from './domain-error';
import { LimiteDebitException } from './limite-debit.exception';

interface ErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
}

const codeParStatut: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'validation_echec',
  [HttpStatus.UNAUTHORIZED]: 'authentification_requise',
  [HttpStatus.FORBIDDEN]: 'autorisation_refusee',
  [HttpStatus.NOT_FOUND]: 'ressource_introuvable',
  [HttpStatus.CONFLICT]: 'etat_incompatible',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'regle_metier_violee',
  [HttpStatus.TOO_MANY_REQUESTS]: 'trop_de_requetes',
  [HttpStatus.BAD_GATEWAY]: 'fournisseur_indisponible',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'fournisseur_indisponible',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'erreur_interne';
    let message = 'Une erreur interne est survenue.';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof DomainError) {
      status = exception.httpStatus;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'validation_echec';
      message = 'La requête est invalide.';
      details = {
        champs: exception.issues.map((issue) => ({
          champ: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = codeParStatut[status] ?? 'erreur_interne';
      const body = exception.getResponse();

      if (exception instanceof LimiteDebitException) {
        response.setHeader('Retry-After', String(exception.retryAfterSecondes));
      }

      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const objet = body as Record<string, unknown>;
        if (typeof objet.code === 'string') code = objet.code;
        if (typeof objet.message === 'string') message = objet.message;
        if (Array.isArray(objet.message)) message = objet.message.join(', ');
        if (objet.details && typeof objet.details === 'object') {
          details = objet.details as Record<string, unknown>;
        }
      }
    } else {
      logger.error(
        { err: exception, traceId: request.traceId },
        'Exception non gérée par le filtre',
      );
    }

    const body: ErrorBody = {
      code,
      message,
      ...(details ? { details } : {}),
      traceId: request.traceId ?? 'inconnu',
    };

    response.status(status).json(body);
  }
}
