const EXTENSION_PAR_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MIME_TYPES_PHOTO = Object.keys(EXTENSION_PAR_MIME);

export function extensionDepuisMime(mimeType: string): string {
  return EXTENSION_PAR_MIME[mimeType] ?? 'bin';
}

export function cleTemporaire(annonceId: string, photoId: string, mimeType: string): string {
  return `tmp/${annonceId}/${photoId}.${extensionDepuisMime(mimeType)}`;
}

export function cleOriginale(annonceId: string, photoId: string, extension: string): string {
  return `originaux/${annonceId}/${photoId}.${extension}`;
}

export function cleVariante(
  annonceId: string,
  photoId: string,
  variante: string,
  extension: string,
): string {
  return `variantes/${annonceId}/${photoId}/${variante}.${extension}`;
}

export const VARIANTES_PHOTO = ['s', 'm', 'l'] as const;
