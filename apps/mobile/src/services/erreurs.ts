import { ErreurApi } from '@secondevie/contracts';

const MESSAGES: Record<string, string> = {
  reseau_indisponible: 'Connexion impossible. Vérifiez votre réseau puis réessayez.',
  email_deja_utilise: 'Cette adresse e-mail est déjà utilisée.',
  pseudo_deja_utilise: 'Ce pseudo est déjà utilisé.',
  telephone_deja_utilise: 'Ce numéro de téléphone est déjà utilisé.',
  pseudo_reserve: 'Ce pseudo est réservé.',
  email_non_verifie: 'Vérifiez votre e-mail avant de continuer.',
  code_invalide: 'Le code est invalide ou expiré.',
  code_expire: 'Le code a expiré. Demandez un nouveau code.',
  tentatives_epuisees: 'Trop de tentatives. Demandez un nouveau code plus tard.',
  identifiants_invalides: 'E-mail ou mot de passe incorrect.',
  compte_bloque: 'Trop de tentatives. Réessayez dans quelques minutes.',
  session_invalide: 'Votre session a expiré. Reconnectez-vous.',
  mot_de_passe_incorrect: 'Le mot de passe est incorrect.',
  jeton_invalide: 'Ce lien est invalide ou expiré.',
  suppression_impossible: 'Votre compte ne peut pas être supprimé pour le moment.',
  fournisseur_indisponible:
    'Le service est momentanément indisponible. Réessayez dans quelques instants.',
  lien_export_invalide: 'Ce lien de téléchargement a expiré.',
  export_introuvable: 'Cet export est introuvable ou a expiré.',
  trop_de_requetes: 'Trop de requêtes. Patientez un instant.',
  compte_supprime: 'Ce compte n’est plus actif.',
  compte_suspendu: 'Ce compte est suspendu. Contactez le support.',
  age_insuffisant: 'Vous devez avoir au moins 18 ans pour créer un compte.',
  mot_de_passe_compromis:
    'Ce mot de passe est apparu dans une fuite connue. Choisissez-en un autre.',
  adresse_introuvable: 'Cette adresse est introuvable.',
  appareil_introuvable: 'Cet appareil est introuvable.',
  ressource_introuvable: 'Cette ressource est introuvable.',
};

export function messageErreur(
  error: unknown,
  defaut = 'Une erreur est survenue. Réessayez.',
): string {
  if (error instanceof ErreurApi) {
    return MESSAGES[error.code] ?? error.message ?? defaut;
  }

  return defaut;
}

export function estHorsLigne(error: unknown): boolean {
  return error instanceof ErreurApi && error.status === 0;
}

export function raisonsSuppression(error: unknown): string[] {
  if (!(error instanceof ErreurApi)) return [];

  const raisons = error.details?.raisons;

  if (!Array.isArray(raisons)) return [];

  return raisons
    .map((raison) => {
      switch (raison) {
        case 'commande_en_cours':
          return 'Une commande est en cours. Terminez-la avant de supprimer votre compte.';
        case 'litige_ouvert':
          return 'Un litige est ouvert. Il doit être résolu avant la suppression.';
        case 'solde_non_nul':
          return 'Votre portefeuille contient un solde. Retirez-le avant la suppression.';
        default:
          return 'Un blocage empêche la suppression.';
      }
    })
    .filter(Boolean);
}
