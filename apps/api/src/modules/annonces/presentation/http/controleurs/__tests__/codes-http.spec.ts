import { describe, expect, it } from 'vitest';
import { AnnoncesControleur } from '../annonces.controleur';
import { FavorisControleur } from '../favoris.controleur';
import { PhotosControleur } from '../photos.controleur';

/**
 * Garde-fou de contrat : les codes HTTP déclarés dans `docs/openapi/m2-annonces.yaml`
 * doivent correspondre à ceux des contrôleurs. NestJS répond `201` par défaut à un
 * `POST` ; sans test, un oubli de `@HttpCode` dérive silencieusement du contrat.
 */
function codeHttp(prototype: object, methode: string): number | undefined {
  const gestionnaire = (prototype as Record<string, unknown>)[methode];

  if (typeof gestionnaire !== 'function') {
    throw new Error(`Méthode de contrôleur introuvable : ${methode}`);
  }

  return Reflect.getMetadata('__httpCode__', gestionnaire) as number | undefined;
}

describe('Contrôleurs M2 — codes HTTP du contrat', () => {
  it('déclare les codes des annonces', () => {
    const controleur = AnnoncesControleur.prototype;

    expect(codeHttp(controleur, 'creerBrouillon')).toBe(201);
    expect(codeHttp(controleur, 'publierAnnonce')).toBe(200);
    expect(codeHttp(controleur, 'archiverAnnonce')).toBe(200);
    expect(codeHttp(controleur, 'republierAnnonce')).toBe(200);
  });

  it('déclare les codes des photos', () => {
    const controleur = PhotosControleur.prototype;

    expect(codeHttp(controleur, 'preparerPhoto')).toBe(201);
    expect(codeHttp(controleur, 'confirmerPhoto')).toBe(202);
    expect(codeHttp(controleur, 'definirPrincipale')).toBe(200);
    expect(codeHttp(controleur, 'supprimerPhoto')).toBe(200);
  });

  it('déclare les codes des favoris', () => {
    const controleur = FavorisControleur.prototype;

    expect(codeHttp(controleur, 'ajouter')).toBe(200);
    expect(codeHttp(controleur, 'retirer')).toBe(200);
  });
});
