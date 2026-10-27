import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../common/errors/domain-error';
import { uneAnnonce, unePhoto } from './fabriques';
import {
  deciderPublication,
  verifierChampsObligatoires,
  verifierPrealablesPublication,
} from '../politiques/politique-publication';
import { verifierQuotaActif } from '../politiques/politique-quota';

const SIGNAUX_CONFORMES = {
  contientContact: false,
  motsInterdits: [] as string[],
  doublonExact: false,
  quasiDoublon: false,
  categorieValide: true,
  tailleRequise: true,
  tailleDansGrille: true,
};

describe('verifierPrealablesPublication', () => {
  it('accepte une annonce complète avec une photo traitée', () => {
    expect(() => verifierPrealablesPublication(uneAnnonce(), [unePhoto()])).not.toThrow();
  });

  it('refuse une annonce incomplète avec un 422 et le champ manquant', () => {
    try {
      verifierPrealablesPublication(uneAnnonce({ poidsG: null }), [unePhoto()]);
      expect.unreachable();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('annonce_incomplete');
      expect((error as DomainError).details).toEqual({ champ: 'poidsG' });
    }
  });

  it('exige au moins une photo', () => {
    expect(() => verifierPrealablesPublication(uneAnnonce(), [])).toThrowError(
      /au moins une photo/,
    );
  });

  it('refuse une photo encore en traitement', () => {
    expect(() =>
      verifierPrealablesPublication(uneAnnonce(), [unePhoto({ statutTraitement: 'televersee' })]),
    ).toThrowError(/traitées/);
  });

  it('refuse une photo refusée', () => {
    expect(() =>
      verifierPrealablesPublication(uneAnnonce(), [unePhoto({ statutModeration: 'refusee' })]),
    ).toThrowError(/refusée/);
  });

  it('refuse plus de 12 photos', () => {
    expect(() =>
      verifierPrealablesPublication(
        uneAnnonce(),
        Array.from({ length: 13 }, (_, index) => unePhoto({ id: `photo-${index}`, ordre: index })),
      ),
    ).toThrowError(/12 photos/);
  });

  it('refuse la publication depuis un statut incompatible', () => {
    expect(() =>
      verifierPrealablesPublication(uneAnnonce({ statut: 'publiee' }), [unePhoto()]),
    ).toThrowError(/état actuel/);
  });
});

describe('verifierChampsObligatoires', () => {
  it('accepte une annonce complète', () => {
    expect(() => verifierChampsObligatoires(uneAnnonce())).not.toThrow();
  });

  it('refuse un champ obligatoire remis à null sur une annonce en ligne', () => {
    try {
      verifierChampsObligatoires(uneAnnonce({ statut: 'publiee', couleur: null }));
      expect.unreachable();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('annonce_incomplete');
      expect((error as DomainError).details).toEqual({ champ: 'couleur' });
    }
  });
});

describe('deciderPublication', () => {
  it('publie quand tous les signaux sont conformes', () => {
    expect(deciderPublication(SIGNAUX_CONFORMES)).toEqual({ statut: 'publiee' });
  });

  it('refuse un contact, un mot interdit ou un doublon exact', () => {
    expect(deciderPublication({ ...SIGNAUX_CONFORMES, contientContact: true }).statut).toBe(
      'refusee',
    );
    expect(deciderPublication({ ...SIGNAUX_CONFORMES, motsInterdits: ['whatsapp'] }).statut).toBe(
      'refusee',
    );
    expect(deciderPublication({ ...SIGNAUX_CONFORMES, doublonExact: true }).statut).toBe('refusee');
  });

  it('refuse une catégorie invalide ou une taille absente de la grille', () => {
    expect(deciderPublication({ ...SIGNAUX_CONFORMES, categorieValide: false }).statut).toBe(
      'refusee',
    );
    expect(deciderPublication({ ...SIGNAUX_CONFORMES, tailleDansGrille: false }).statut).toBe(
      'refusee',
    );
  });

  it('place un quasi-doublon en revue humaine', () => {
    expect(deciderPublication({ ...SIGNAUX_CONFORMES, quasiDoublon: true })).toEqual({
      statut: 'en_revue',
      raisons: ['quasi_doublon'],
    });
  });
});

describe('quota', () => {
  it('accepte la 20e annonce active et refuse la 21e', () => {
    expect(() => verifierQuotaActif(19)).not.toThrow();
    expect(() => verifierQuotaActif(20)).toThrowError(/quota/);
  });
});
