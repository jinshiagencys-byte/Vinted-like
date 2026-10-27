import { DomainError } from '../../../common/errors/domain-error';

export interface CurseurPage {
  majLe: Date;
  id: string;
}

export function encoderCurseur(majLe: Date, id: string): string {
  return Buffer.from(JSON.stringify({ majLe: majLe.toISOString(), id }), 'utf8').toString(
    'base64url',
  );
}

export function decoderCurseur(valeur: string | undefined): CurseurPage | null {
  if (!valeur) return null;

  try {
    const contenu = JSON.parse(Buffer.from(valeur, 'base64url').toString('utf8')) as {
      majLe?: unknown;
      id?: unknown;
    };

    if (typeof contenu.majLe !== 'string' || typeof contenu.id !== 'string') {
      throw new Error('format');
    }

    const majLe = new Date(contenu.majLe);

    if (Number.isNaN(majLe.getTime())) {
      throw new Error('date');
    }

    return { majLe, id: contenu.id };
  } catch {
    throw new DomainError('curseur_invalide', 'Le curseur de pagination est invalide.', 400);
  }
}
