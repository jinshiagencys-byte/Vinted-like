import { Injectable } from '@nestjs/common';
import { contientContact } from '../../domain/valeurs/texte';
import type { ModerationTextePort } from '../../domain/ports';
import { MOTS_INTERDITS, VERSION_MOTS_INTERDITS } from './mots-interdits.v1';

/** Normalisation tolérante : casse, accents, espaces et leetspeak simple. */
export function normaliserPourModeration(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

@Injectable()
export class ModerationTexteAdapter implements ModerationTextePort {
  readonly version = VERSION_MOTS_INTERDITS;

  async analyser(texte: string): Promise<{ contientContact: boolean; motsInterdits: string[] }> {
    const normalise = ` ${normaliserPourModeration(texte)} `;
    const trouves = MOTS_INTERDITS.filter((mot) =>
      normalise.includes(` ${normaliserPourModeration(mot)} `),
    );

    return {
      contientContact: contientContact(texte),
      motsInterdits: [...new Set(trouves)],
    };
  }
}
