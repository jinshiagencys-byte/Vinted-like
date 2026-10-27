import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

const DUREE_URL_MS = 15 * 60 * 1000;

@Injectable()
export class ServiceSignatureExport {
  constructor(private readonly config: ConfigService) {}

  signer(exportId: string, utilisateurId: string): { url: string; expireLe: Date } {
    const expireLe = new Date(Date.now() + DUREE_URL_MS);
    const expiration = Math.floor(expireLe.getTime() / 1_000);
    const signature = this.signature(exportId, utilisateurId, expiration);

    return {
      url: `/v1/moi/export/${exportId}/telecharger?exp=${expiration}&signature=${signature}`,
      expireLe,
    };
  }

  verifier(
    exportId: string,
    utilisateurId: string,
    expiration: number,
    signature: string,
  ): boolean {
    if (!Number.isInteger(expiration) || expiration * 1_000 <= Date.now()) {
      return false;
    }

    const attendue = Buffer.from(this.signature(exportId, utilisateurId, expiration));
    const recue = Buffer.from(signature);

    return attendue.length === recue.length && timingSafeEqual(attendue, recue);
  }

  private signature(exportId: string, utilisateurId: string, expiration: number): string {
    return createHmac('sha256', this.config.getOrThrow<string>('EXPORT_SIGNING_SECRET'))
      .update(`${exportId}:${utilisateurId}:${expiration}`)
      .digest('base64url');
  }
}
