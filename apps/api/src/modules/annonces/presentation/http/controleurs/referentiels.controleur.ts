import { Controller, Get, Headers, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../../../common/auth/public.decorator';
import { ListerReferentiels } from '../../../application/services/lister-referentiels';
import { listerTaillesSchema, rechercherMarquesSchema } from '../schemas/referentiel.schema';

@Controller('referentiels')
@Public()
export class ReferentielsControleur {
  constructor(private readonly referentiels: ListerReferentiels) {}

  @Get('categories')
  async categories(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { donnees, etag } = await this.referentiels.categories();

    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=300');

    if (ifNoneMatch && this.correspond(ifNoneMatch, etag)) {
      response.status(304).end();
      return;
    }

    response.json(donnees);
  }

  @Get('marques')
  async marques(@Query() query: unknown) {
    const { q } = rechercherMarquesSchema.parse(query);
    return this.referentiels.marques(q);
  }

  @Get('tailles')
  tailles(@Query() query: unknown) {
    const { categorieId } = listerTaillesSchema.parse(query);
    return this.referentiels.tailles(categorieId);
  }

  private correspond(entete: string, etag: string): boolean {
    return entete
      .split(',')
      .map((valeur) => valeur.trim())
      .some((valeur) => valeur === etag || valeur === `W/${etag}`);
  }
}
