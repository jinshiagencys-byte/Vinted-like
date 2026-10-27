import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import type { Adresse } from '../../domain/entities';
import type { AdresseRepository, CreerAdresse, MiseAJourAdresse } from '../../domain/ports';
import { ADRESSE_REPOSITORY } from '../../domain/ports';

export interface AdresseCommande {
  libelle: string;
  destinataire: string;
  ligne1: string;
  ligne2?: string | null;
  codePostal: string;
  ville: string;
  pays?: string;
  telephone: string;
  estDefaut?: boolean;
}

@Injectable()
export class GererAdresses {
  constructor(@Inject(ADRESSE_REPOSITORY) private readonly adresses: AdresseRepository) {}

  lister(utilisateurId: string): Promise<Adresse[]> {
    return this.adresses.listerActives(utilisateurId);
  }

  async ajouter(utilisateurId: string, commande: AdresseCommande): Promise<Adresse> {
    return this.adresses.creer(this.valider({ ...commande, utilisateurId }));
  }

  async modifier(
    utilisateurId: string,
    id: string,
    commande: Partial<AdresseCommande>,
  ): Promise<Adresse> {
    const donnees = this.validerPartiel(commande);
    return this.adresses.mettreAJour(utilisateurId, id, donnees);
  }

  async supprimer(utilisateurId: string, id: string): Promise<void> {
    const adresse = await this.adresses.trouverActive(utilisateurId, id);

    if (!adresse) {
      throw new DomainError('adresse_introuvable', 'Adresse introuvable.', 404);
    }

    await this.adresses.marquerSupprimee(utilisateurId, id, new Date());
  }

  async definirDefaut(utilisateurId: string, id: string): Promise<void> {
    await this.adresses.definirDefaut(utilisateurId, id);
  }

  private valider(commande: CreerAdresse): CreerAdresse {
    const texte = {
      libelle: commande.libelle?.trim(),
      destinataire: commande.destinataire?.trim(),
      ligne1: commande.ligne1?.trim(),
      ligne2: commande.ligne2?.trim() || null,
      codePostal: commande.codePostal?.trim(),
      ville: commande.ville?.trim(),
      telephone: commande.telephone?.trim(),
      pays: (commande.pays ?? 'FR').trim().toUpperCase(),
    };

    if (!texte.libelle || texte.libelle.length > 40) {
      throw new DomainError('adresse_invalide', 'Le libellé est invalide.', 422);
    }
    if (!texte.destinataire || texte.destinataire.length > 120) {
      throw new DomainError('adresse_invalide', 'Le destinataire est invalide.', 422);
    }
    if (!texte.ligne1 || texte.ligne1.length > 120) {
      throw new DomainError('adresse_invalide', 'La première ligne est invalide.', 422);
    }
    if (texte.ligne2 && texte.ligne2.length > 120) {
      throw new DomainError('adresse_invalide', 'La seconde ligne est invalide.', 422);
    }
    if (!texte.codePostal || texte.codePostal.length > 10) {
      throw new DomainError('adresse_invalide', 'Le code postal est invalide.', 422);
    }
    if (!texte.ville || texte.ville.length > 120) {
      throw new DomainError('adresse_invalide', 'La ville est invalide.', 422);
    }
    if (!texte.telephone || texte.telephone.length > 20) {
      throw new DomainError('adresse_invalide', 'Le téléphone est invalide.', 422);
    }
    if (!/^[A-Z]{2}$/.test(texte.pays)) {
      throw new DomainError('adresse_invalide', 'Le pays est invalide.', 422);
    }

    return { ...commande, ...texte } as CreerAdresse;
  }

  private validerPartiel(commande: Partial<AdresseCommande>): MiseAJourAdresse {
    const donnees: MiseAJourAdresse = {};

    if (commande.libelle !== undefined) {
      donnees.libelle = this.texteObligatoire(commande.libelle, 40, 'Le libellé est invalide.');
    }
    if (commande.destinataire !== undefined) {
      donnees.destinataire = this.texteObligatoire(
        commande.destinataire,
        120,
        'Le destinataire est invalide.',
      );
    }
    if (commande.ligne1 !== undefined) {
      donnees.ligne1 = this.texteObligatoire(
        commande.ligne1,
        120,
        'La première ligne est invalide.',
      );
    }
    if (commande.ligne2 !== undefined) {
      const ligne2 = commande.ligne2?.trim() ?? null;

      if (ligne2 !== null && ligne2.length > 120) {
        throw new DomainError('adresse_invalide', 'La seconde ligne est invalide.', 422);
      }

      donnees.ligne2 = ligne2 || null;
    }
    if (commande.codePostal !== undefined) {
      donnees.codePostal = this.texteObligatoire(
        commande.codePostal,
        10,
        'Le code postal est invalide.',
      );
    }
    if (commande.ville !== undefined) {
      donnees.ville = this.texteObligatoire(commande.ville, 120, 'La ville est invalide.');
    }
    if (commande.telephone !== undefined) {
      donnees.telephone = this.texteObligatoire(
        commande.telephone,
        20,
        'Le téléphone est invalide.',
      );
    }
    if (commande.pays !== undefined) {
      const pays = commande.pays.trim().toUpperCase();

      if (!/^[A-Z]{2}$/.test(pays)) {
        throw new DomainError('adresse_invalide', 'Le pays est invalide.', 422);
      }

      donnees.pays = pays;
    }

    return donnees;
  }

  private texteObligatoire(valeur: string, maximum: number, message: string): string {
    const texte = valeur?.trim();

    if (!texte || texte.length > maximum) {
      throw new DomainError('adresse_invalide', message, 422);
    }

    return texte;
  }
}
