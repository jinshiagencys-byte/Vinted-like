import { Injectable } from '@nestjs/common';
import { ComptesQueryService } from '../../../comptes/application/services/comptes-query.service';
import type { ComptesQueryPort } from '../../domain/ports';

@Injectable()
export class ComptesQueryAdapter implements ComptesQueryPort {
  constructor(private readonly comptes: ComptesQueryService) {}

  profilVendeur(utilisateurId: string) {
    return this.comptes.profilVendeur(utilisateurId);
  }
}
