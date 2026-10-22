import { DomainError } from '../../../../common/errors/domain-error';
import type { MotDePasse } from '../value-objects/mot-de-passe';
import type { VerificateurMotDePasseCompromis } from '../ports';

/**
 * R04 : vérifie la compromission via le port HIBP. Le port est fail-open :
 * une indisponibilité renvoie false et ne bloque pas l'inscription.
 * Les contrôles de longueur et de composition sont faits par l'objet-valeur.
 */
export class PolitiqueMotDePasse {
  constructor(private readonly verificateurCompromis: VerificateurMotDePasseCompromis) {}

  async valider(motDePasse: MotDePasse): Promise<void> {
    const compromis = await this.verificateurCompromis.estCompromis(motDePasse);

    if (compromis) {
      throw new DomainError(
        'mot_de_passe_compromis',
        'Ce mot de passe est apparu dans une fuite connue. Choisissez-en un autre.',
        422,
      );
    }
  }
}
