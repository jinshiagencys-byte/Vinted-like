import { describe, expect, it } from 'vitest';
import { uneAnnonce, unePhoto } from '../../../../domain/__tests__/fabriques';
import { versAnnonceApi, versPageAnnoncesApi } from '../annonce.serialiseur';

describe('sérialiseur HTTP des annonces', () => {
  it('expose les dates ISO et masque les champs internes des photos', () => {
    const annonce = {
      ...uneAnnonce({ statut: 'publiee' }),
      photos: [unePhoto()],
    };

    const api = versAnnonceApi(annonce, 'public');

    expect(api.creeLe).toBe('2026-10-28T09:00:00.000Z');
    expect(api.roleActeur).toBe('public');
    expect(api.photos[0]).not.toHaveProperty('urlOriginale');
    expect(api.photos[0]).not.toHaveProperty('perceptHash');
    expect(api.photos[0]?.urlVariantes).toEqual(unePhoto().urlVariantes);
  });

  it('conserve le motif de refus pour le propriétaire', () => {
    const annonce = {
      ...uneAnnonce({ statut: 'refusee', motifRefus: 'Photo interdite' }),
      photos: [],
    };

    expect(versAnnonceApi(annonce).motifRefus).toBe('Photo interdite');
  });

  it('sérialise une page avec son curseur', () => {
    const page = versPageAnnoncesApi({
      items: [{ ...uneAnnonce(), photos: [] }],
      curseurSuivant: 'curseur',
    });

    expect(page.items).toHaveLength(1);
    expect(page.curseurSuivant).toBe('curseur');
  });
});
