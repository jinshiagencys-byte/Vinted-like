import { HttpException, HttpStatus } from '@nestjs/common';

/** Erreur 429 avec en-tête Retry-After (R16). */
export class LimiteDebitException extends HttpException {
  constructor(
    public readonly retryAfterSecondes: number,
    code = 'trop_de_requetes',
    message = 'Trop de requêtes. Réessayez plus tard.',
  ) {
    super({ code, message }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
