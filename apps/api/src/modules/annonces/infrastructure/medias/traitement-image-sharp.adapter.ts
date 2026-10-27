import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { DomainError } from '../../../../common/errors/domain-error';
import type { ImageAnalysee, ImageTraitee, TraitementImagePort } from '../../domain/ports';

export const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;
export const DIMENSION_MIN = 400;
export const RATIO_MIN = 1 / 3;
export const RATIO_MAX = 3;

const VARIANTES: Readonly<Record<string, number>> = {
  s: 300,
  m: 800,
  l: 1600,
};

interface FormatDetecte {
  format: 'jpeg' | 'png' | 'webp';
  mimeType: string;
}

/** Détection par magic bytes : ne jamais faire confiance au type déclaré. */
export function detecterFormat(contenu: Buffer): FormatDetecte | null {
  if (contenu.length >= 3 && contenu[0] === 0xff && contenu[1] === 0xd8 && contenu[2] === 0xff) {
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }

  const signaturePng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  if (
    contenu.length >= signaturePng.length &&
    signaturePng.every((octet, index) => contenu[index] === octet)
  ) {
    return { format: 'png', mimeType: 'image/png' };
  }

  if (
    contenu.length >= 12 &&
    contenu.toString('ascii', 0, 4) === 'RIFF' &&
    contenu.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { format: 'webp', mimeType: 'image/webp' };
  }

  return null;
}

function validerDimensions(largeur: number, hauteur: number): void {
  if (largeur < DIMENSION_MIN || hauteur < DIMENSION_MIN) {
    throw new DomainError(
      'photo_invalide',
      `La photo doit mesurer au moins ${DIMENSION_MIN} × ${DIMENSION_MIN} pixels.`,
      422,
    );
  }

  const ratio = largeur / hauteur;

  if (ratio < RATIO_MIN || ratio > RATIO_MAX) {
    throw new DomainError(
      'photo_invalide',
      'Le rapport largeur/hauteur de la photo doit être compris entre 1:3 et 3:1.',
      422,
    );
  }
}

/**
 * DCT-II 1D séparable, utilisée par l'empreinte perceptuelle 64 bits.
 * Complexité négligeable sur une matrice 32 × 32.
 */
function dct1d(entree: Float64Array): Float64Array {
  const taille = entree.length;
  const sortie = new Float64Array(taille);

  for (let frequence = 0; frequence < taille; frequence += 1) {
    let somme = 0;

    for (let index = 0; index < taille; index += 1) {
      somme += entree[index] * Math.cos((Math.PI * frequence * (index + 0.5)) / taille);
    }

    sortie[frequence] = somme;
  }

  return sortie;
}

/** pHash 64 bits : DCT sur 32 × 32 niveaux de gris, médiane des 63 coefficients. */
export function calculerPHash(pixels: Buffer, largeur = 32, hauteur = 32): string {
  if (pixels.length < largeur * hauteur) {
    throw new DomainError('photo_invalide', 'Les pixels de la photo sont invalides.', 422);
  }

  const matrice: number[][] = [];

  for (let ligne = 0; ligne < hauteur; ligne += 1) {
    const lignePixels = new Float64Array(largeur);

    for (let colonne = 0; colonne < largeur; colonne += 1) {
      lignePixels[colonne] = pixels[ligne * largeur + colonne] ?? 0;
    }

    matrice.push(Array.from(dct1d(lignePixels)));
  }

  const transformee: number[][] = Array.from({ length: hauteur }, () => new Array(largeur).fill(0));

  for (let colonne = 0; colonne < largeur; colonne += 1) {
    const colonnePixels = Float64Array.from(matrice.map((ligne) => ligne[colonne] ?? 0));
    const resultat = dct1d(colonnePixels);

    for (let ligne = 0; ligne < hauteur; ligne += 1) {
      transformee[ligne]![colonne] = resultat[ligne] ?? 0;
    }
  }

  const coefficients: number[] = [];

  for (let ligne = 0; ligne < 8; ligne += 1) {
    for (let colonne = 0; colonne < 8; colonne += 1) {
      if (ligne === 0 && colonne === 0) continue;
      coefficients.push(transformee[ligne]![colonne] ?? 0);
    }
  }

  const tries = [...coefficients].sort((a, b) => a - b);
  const mediane = (tries[30]! + tries[31]!) / 2;

  let hash = 0n;

  for (const coefficient of coefficients) {
    hash = (hash << 1n) | (coefficient > mediane ? 1n : 0n);
  }

  return hash.toString(16).padStart(16, '0');
}

@Injectable()
export class TraitementImageSharpAdapter implements TraitementImagePort {
  async analyser(contenu: Buffer, mimeDeclare: string): Promise<ImageAnalysee> {
    if (contenu.length === 0 || contenu.length > TAILLE_MAX_OCTETS) {
      throw new DomainError(
        'photo_invalide',
        `La photo doit peser au maximum ${TAILLE_MAX_OCTETS / (1024 * 1024)} Mo.`,
        422,
      );
    }

    const detecte = detecterFormat(contenu);

    if (!detecte || detecte.mimeType !== mimeDeclare) {
      throw new DomainError(
        'photo_invalide',
        'Le fichier n’est pas une image JPEG, PNG ou WebP valide.',
        422,
      );
    }

    let metadonnees: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;

    try {
      metadonnees = await sharp(contenu, { failOn: 'error' }).metadata();
    } catch {
      throw new DomainError('photo_invalide', 'La photo est illisible ou corrompue.', 422);
    }

    if (!metadonnees.width || !metadonnees.height) {
      throw new DomainError('photo_invalide', 'Les dimensions de la photo sont inconnues.', 422);
    }

    // `sharp.metadata()` renvoie les dimensions du fichier ; l'orientation EXIF
    // peut les permuter à l'affichage. On normalise en appliquant la rotation.
    const orientation = metadonnees.orientation ?? 1;
    const permutee = orientation >= 5 && orientation <= 8;
    const largeur = permutee ? metadonnees.height : metadonnees.width;
    const hauteur = permutee ? metadonnees.width : metadonnees.height;

    validerDimensions(largeur, hauteur);

    return { largeur, hauteur, mimeType: detecte.mimeType };
  }

  async traiter(contenu: Buffer): Promise<ImageTraitee> {
    const detecte = detecterFormat(contenu);
    const analyse = await this.analyser(contenu, detecte?.mimeType ?? '');

    const base = sharp(contenu, { failOn: 'error' }).rotate();
    const original = await base.clone().webp({ quality: 88 }).toBuffer();
    const variantes: Record<string, Buffer> = {};

    for (const [nom, largeur] of Object.entries(VARIANTES)) {
      variantes[nom] = await base
        .clone()
        .resize({ width: largeur, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    }

    const pixels = await sharp(contenu, { failOn: 'error' })
      .rotate()
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    return {
      largeur: analyse.largeur,
      hauteur: analyse.hauteur,
      mimeType: 'image/webp',
      original,
      extension: 'webp',
      variantes,
      perceptHash: calculerPHash(pixels),
    };
  }
}
