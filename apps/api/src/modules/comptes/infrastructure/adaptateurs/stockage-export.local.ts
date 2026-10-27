import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { StockageExport } from '../../domain/ports';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stockage local des archives d'export ; remplaçable par S3/MinIO. */
@Injectable()
export class StockageExportLocal implements StockageExport {
  private readonly repertoire: string;

  constructor(config: ConfigService) {
    this.repertoire = resolve(config.get<string>('EXPORT_DIR', '.exports'));
  }

  async ecrire(exportId: string, contenu: string): Promise<void> {
    this.verifierId(exportId);
    await mkdir(this.repertoire, { recursive: true });
    await writeFile(join(this.repertoire, `${exportId}.json`), contenu, {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  async lire(exportId: string): Promise<string | null> {
    this.verifierId(exportId);

    try {
      return await readFile(join(this.repertoire, `${exportId}.json`), 'utf8');
    } catch {
      return null;
    }
  }

  private verifierId(exportId: string): void {
    if (!UUID.test(exportId)) {
      throw new Error('Identifiant d’export invalide');
    }
  }
}
