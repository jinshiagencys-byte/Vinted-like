import { Injectable } from '@nestjs/common';
import type { CommandesPort, LitigesPort, PortefeuillePort } from '../../domain/ports';

/**
 * Adaptateurs v1 tant que M5/M7 ne sont pas livrés. Les valeurs neutres
 * autorisent la suppression ; toute indisponibilité doit être traitée en
 * fail-closed par le cas d'usage.
 */
@Injectable()
export class CommandesFakeAdapter implements CommandesPort {
  async compterEnCours(_utilisateurId: string): Promise<number> {
    return 0;
  }
}

@Injectable()
export class LitigesFakeAdapter implements LitigesPort {
  async compterOuverts(_utilisateurId: string): Promise<number> {
    return 0;
  }
}

@Injectable()
export class PortefeuilleFakeAdapter implements PortefeuillePort {
  async soldeNonNul(_utilisateurId: string): Promise<boolean> {
    return false;
  }
}
