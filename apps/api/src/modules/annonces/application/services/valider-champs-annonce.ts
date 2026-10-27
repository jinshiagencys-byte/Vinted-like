import { DomainError } from '../../../../common/errors/domain-error';
import type { MiseAJourAnnonce } from '../../domain/ports';
import { ETATS_ARTICLE } from '../../domain/enums';
import type { EtatArticle } from '../../domain/enums';
import { Prix, Poids, Taille } from '../../domain/valeurs/article';
import { Description } from '../../domain/valeurs/description';
import { Titre } from '../../domain/valeurs/titre';

export interface ChampsAnnonceBruts {
  titre?: string;
  description?: string;
  categorieId?: string | null;
  marqueId?: string | null;
  taille?: string | null;
  etat?: EtatArticle | null;
  couleur?: string | null;
  matiere?: string | null;
  prixCents?: number | null;
  prixOrigineCents?: number | null;
  poidsG?: number | null;
}

/** Valide et normalise les champs fournis ; `undefined` signifie « inchangé ». */
export function validerChampsAnnonce(commande: ChampsAnnonceBruts): MiseAJourAnnonce {
  const donnees: MiseAJourAnnonce = {};

  if (commande.titre !== undefined) donnees.titre = Titre.creer(commande.titre).valeur;
  if (commande.description !== undefined) {
    donnees.description = Description.creer(commande.description).valeur;
  }
  if (commande.categorieId !== undefined) donnees.categorieId = commande.categorieId;
  if (commande.marqueId !== undefined) donnees.marqueId = commande.marqueId;
  if (commande.taille !== undefined) {
    donnees.taille = commande.taille === null ? null : Taille.creer(commande.taille).valeur;
  }
  if (commande.etat !== undefined) {
    if (commande.etat !== null && !ETATS_ARTICLE.includes(commande.etat)) {
      throw new DomainError('etat_invalide', 'L’état de l’article est invalide.', 422);
    }
    donnees.etat = commande.etat;
  }
  if (commande.couleur !== undefined) {
    donnees.couleur = texteOptionnel(commande.couleur, 30, 'La couleur est invalide.');
  }
  if (commande.matiere !== undefined) {
    donnees.matiere = texteOptionnel(commande.matiere, 60, 'La matière est invalide.');
  }
  if (commande.prixCents !== undefined) {
    donnees.prixCents = commande.prixCents === null ? null : Prix.creer(commande.prixCents).cents;
  }
  if (commande.prixOrigineCents !== undefined) {
    donnees.prixOrigineCents =
      commande.prixOrigineCents === null ? null : Prix.creer(commande.prixOrigineCents).cents;
  }
  if (commande.poidsG !== undefined) {
    donnees.poidsG = commande.poidsG === null ? null : Poids.creer(commande.poidsG).grammes;
  }

  return donnees;
}

export function verifierCoherencePrix(
  prixCents: number | null,
  prixOrigineCents: number | null,
): void {
  if (prixCents !== null && prixOrigineCents !== null && prixOrigineCents < prixCents) {
    throw new DomainError(
      'prix_invalide',
      'Le prix d’origine doit être supérieur ou égal au prix de vente.',
      422,
    );
  }
}

function texteOptionnel(valeur: string | null, maximum: number, message: string): string | null {
  if (valeur === null) return null;

  const texte = valeur.trim().replace(/\s+/g, ' ');

  if (texte.length < 1 || texte.length > maximum) {
    throw new DomainError('champ_invalide', message, 422);
  }

  return texte;
}
