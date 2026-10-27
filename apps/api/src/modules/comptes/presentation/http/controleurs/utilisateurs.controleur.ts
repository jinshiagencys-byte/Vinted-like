import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../../../../common/auth/public.decorator';
import { ConsulterProfilPublic } from '../../../application/cas-usage/consulter-profil-public';

@Controller('utilisateurs')
export class UtilisateursControleur {
  constructor(private readonly profils: ConsulterProfilPublic) {}

  @Public()
  @Get(':pseudo')
  consulter(@Param('pseudo') pseudo: string) {
    return this.profils.executer(pseudo);
  }
}
