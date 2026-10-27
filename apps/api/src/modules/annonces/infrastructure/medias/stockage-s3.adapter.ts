import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StockageObjetPort } from '../../domain/ports';

@Injectable()
export class StockageS3Adapter implements StockageObjetPort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly basePublique: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT');
    const accessKeyId = config.getOrThrow<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = config.getOrThrow<string>('S3_SECRET_ACCESS_KEY');

    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.basePublique = config.getOrThrow<string>('S3_PUBLIC_BASE_URL').replace(/\/$/, '');
    this.client = new S3Client({
      region: config.get<string>('S3_REGION') ?? 'eu-west-1',
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async urlTeleversement(
    cle: string,
    mimeType: string,
    tailleOctets: number,
    expireSecondes: number,
  ): Promise<{ url: string; expireLe: Date; method: 'PUT'; headers: Record<string, string> }> {
    const commande = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cle,
      ContentType: mimeType,
      ContentLength: tailleOctets,
    });
    const url = await getSignedUrl(this.client, commande, { expiresIn: expireSecondes });

    return {
      url,
      expireLe: new Date(Date.now() + expireSecondes * 1000),
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
    };
  }

  async head(cle: string): Promise<{ tailleOctets: number; mimeType: string } | null> {
    try {
      const resultat = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: cle }),
      );

      return {
        tailleOctets: resultat.ContentLength ?? 0,
        mimeType: resultat.ContentType ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  async lire(cle: string): Promise<Buffer> {
    const resultat = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: cle }),
    );

    if (!resultat.Body) {
      throw new Error('Objet S3 vide.');
    }

    const octets = await resultat.Body.transformToByteArray();
    return Buffer.from(octets);
  }

  async ecrire(cle: string, contenu: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: cle,
        Body: contenu,
        ContentType: mimeType,
      }),
    );
  }

  async supprimer(cle: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: cle }));
  }

  urlPublique(cle: string): string {
    return `${this.basePublique}/${cle.split('/').map(encodeURIComponent).join('/')}`;
  }
}
