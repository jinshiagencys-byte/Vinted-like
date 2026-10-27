import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { DomainError } from '../../../../../common/errors/domain-error';
import {
  calculerPHash,
  detecterFormat,
  TraitementImageSharpAdapter,
} from '../traitement-image-sharp.adapter';

async function imageJpeg(largeur = 600, hauteur = 800): Promise<Buffer> {
  return sharp({
    create: {
      width: largeur,
      height: hauteur,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('TraitementImageSharpAdapter', () => {
  const images = new TraitementImageSharpAdapter();

  it('détecte les formats par magic bytes', async () => {
    const jpeg = await imageJpeg();
    expect(detecterFormat(jpeg)).toEqual({ format: 'jpeg', mimeType: 'image/jpeg' });
    expect(detecterFormat(Buffer.from('pas une image'))).toBeNull();
  });

  it('refuse un type déclaré différent du contenu réel', async () => {
    const jpeg = await imageJpeg();
    await expect(images.analyser(jpeg, 'image/png')).rejects.toBeInstanceOf(DomainError);
  });

  it('refuse une image trop petite ou au ratio extrême', async () => {
    const petite = await imageJpeg(300, 300);
    await expect(images.analyser(petite, 'image/jpeg')).rejects.toThrowError(/400/);

    const panoramique = await imageJpeg(1_600, 400);
    await expect(images.analyser(panoramique, 'image/jpeg')).rejects.toThrowError(/rapport/);
  });

  it('produit trois variantes WebP, supprime les EXIF et calcule un pHash', async () => {
    const source = await sharp({
      create: {
        width: 1_200,
        height: 1_600,
        channels: 3,
        background: { r: 200, g: 90, b: 40 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const traitee = await images.traiter(source);

    expect(traitee.extension).toBe('webp');
    expect(Object.keys(traitee.variantes).sort()).toEqual(['l', 'm', 's']);
    expect(traitee.perceptHash).toMatch(/^[0-9a-f]{16}$/);

    const originale = await sharp(traitee.original).metadata();
    expect(originale.format).toBe('webp');
    expect(originale.exif).toBeUndefined();
    expect(originale.orientation).toBeUndefined();
  });

  it('produit la même empreinte pour la même image et une empreinte différente sinon', async () => {
    const premiere = await images.traiter(await imageJpeg());
    const seconde = await images.traiter(await imageJpeg());
    const autre = await images.traiter(
      await sharp({
        create: {
          width: 600,
          height: 800,
          channels: 3,
          background: { r: 10, g: 200, b: 30 },
        },
      })
        .jpeg()
        .toBuffer(),
    );

    expect(premiere.perceptHash).toBe(seconde.perceptHash);
    expect(autre.perceptHash).not.toBe(premiere.perceptHash);
  });

  it('calcule un pHash stable sur des pixels uniformes', () => {
    const pixels = Buffer.alloc(32 * 32, 128);
    expect(calculerPHash(pixels)).toMatch(/^[0-9a-f]{16}$/);
  });
});
