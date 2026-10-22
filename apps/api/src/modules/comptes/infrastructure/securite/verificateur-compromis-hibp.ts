import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { logger } from '../../../../common/observability/logger';
import type { VerificateurMotDePasseCompromis } from '../../domain/ports';
import type { MotDePasse } from '../../domain/value-objects/mot-de-passe';

const HIBP_URL = 'https://api.pwnedpasswords.com/range/';

/**
 * Vérification par k-anonymat : seuls les 5 premiers caractères du SHA-1
 * sont envoyés. Une indisponibilité est fail-open avec alerte (D13/R04).
 */
@Injectable()
export class VerificateurCompromisHibp implements VerificateurMotDePasseCompromis {
  async estCompromis(motDePasse: MotDePasse): Promise<boolean> {
    const sha1 = createHash('sha1').update(motDePasse.reveler()).digest('hex').toUpperCase();
    const prefixe = sha1.slice(0, 5);
    const suffixe = sha1.slice(5);

    try {
      const reponse = await fetch(`${HIBP_URL}${prefixe}`, {
        headers: {
          'Add-Padding': 'true',
          'User-Agent': 'SecondeVie/0.0 (verification-mot-de-passe)',
        },
        signal: AbortSignal.timeout(3_000),
      });

      if (!reponse.ok) {
        throw new Error(`HIBP a répondu ${reponse.status}`);
      }

      const corps = await reponse.text();

      return corps.split('\n').some((ligne) => {
        const [hash, occurrences] = ligne.trim().split(':');
        return hash?.toUpperCase() === suffixe && Number(occurrences) > 0;
      });
    } catch (error: unknown) {
      logger.warn({ err: error }, 'HIBP indisponible — vérification du mot de passe en fail-open');
      return false;
    }
  }
}
