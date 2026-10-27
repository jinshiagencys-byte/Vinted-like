import { describe, expect, it } from 'vitest';
import { STATUTS_ANNONCE, type StatutAnnonce } from '../enums';
import { peutVoir, roleActeur } from '../politiques/politique-visibilite';
import { uneAnnonce } from './fabriques';

const PROPRIETAIRE = '22222222-2222-4222-8222-222222222222';

describe('PolitiqueVisibilite', () => {
  it('rend seules les annonces publiées visibles du public quand le vendeur est actif', () => {
    for (const statut of STATUTS_ANNONCE) {
      expect(peutVoir(uneAnnonce({ statut }), 'actif')).toBe(statut === 'publiee');
    }
  });

  it('masque toutes les annonces publiques d’un vendeur suspendu ou supprimé', () => {
    for (const statutVendeur of ['suspendu', 'supprime'] as const) {
      for (const statut of STATUTS_ANNONCE) {
        expect(peutVoir(uneAnnonce({ statut }), statutVendeur)).toBe(false);
      }
    }
  });

  it('conserve l’accès du propriétaire quel que soit le statut', () => {
    for (const statut of STATUTS_ANNONCE) {
      expect(
        peutVoir(uneAnnonce({ statut }), 'supprime', { id: PROPRIETAIRE, role: 'membre' }),
      ).toBe(true);
    }
  });

  it('conserve l’accès des modérateurs et administrateurs', () => {
    for (const role of ['moderateur', 'admin'] as const) {
      expect(peutVoir(uneAnnonce({ statut: 'brouillon' }), 'actif', { role })).toBe(true);
    }
  });

  it('attribue le bon rôle à l’acteur', () => {
    const annonce = uneAnnonce({ statut: 'publiee' as StatutAnnonce });
    expect(roleActeur(annonce, { id: PROPRIETAIRE })).toBe('proprietaire');
    expect(roleActeur(annonce, { role: 'moderateur' })).toBe('moderateur');
    expect(roleActeur(annonce, { role: 'admin' })).toBe('admin');
    expect(roleActeur(annonce, {})).toBe('public');
  });
});
