import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Moi } from '@secondevie/contracts';
import { useSession } from '../../src/auth/FournisseurSession';
import {
  Badge,
  Bouton,
  Carte,
  Champ,
  Chargement,
  Ecran,
  Entete,
  Lien,
  Ligne,
  Message,
} from '../../src/components/ui';
import { api, estErreurNonAutorisee } from '../../src/services/api';
import { messageErreur } from '../../src/services/erreurs';

export default function Profil(): ReactElement {
  const router = useRouter();
  const { deconnecter, rafraichirMoi } = useSession();
  const [moi, setMoi] = useState<Moi | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  const [pseudo, setPseudo] = useState('');
  const [nomComplet, setNomComplet] = useState('');
  const [telephone, setTelephone] = useState('');
  const [bio, setBio] = useState('');
  const [taille, setTaille] = useState('');
  const [pointure, setPointure] = useState('');
  const [visibilite, setVisibilite] = useState<'public' | 'membres'>('public');

  const charger = useCallback(async () => {
    setErreur(null);

    try {
      const profil = await api.consulterMoi();
      setMoi(profil);
      rafraichirMoi(profil);
      setPseudo(profil.utilisateur.pseudo);
      setNomComplet(profil.utilisateur.nomComplet ?? '');
      setTelephone(profil.utilisateur.telephone ?? '');
      setBio(profil.profil.bio ?? '');
      setTaille(profil.profil.tailleCm ? String(profil.profil.tailleCm) : '');
      setPointure(profil.profil.pointure ? String(profil.profil.pointure) : '');
      setVisibilite(profil.profil.visibilite);
    } catch (error: unknown) {
      if (estErreurNonAutorisee(error)) {
        await deconnecter();
        return;
      }
      setErreur(messageErreur(error, 'Impossible de charger votre profil.'));
    } finally {
      setChargement(false);
    }
  }, [deconnecter, rafraichirMoi]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  async function enregistrer(): Promise<void> {
    if (!moi) return;

    setErreur(null);
    setSucces(null);

    const tailleNombre = taille.trim() ? Number(taille) : null;
    const pointureNombre = pointure.trim() ? Number(pointure) : null;

    if (
      tailleNombre !== null &&
      (!Number.isInteger(tailleNombre) || tailleNombre < 120 || tailleNombre > 230)
    ) {
      setErreur('La taille doit être un nombre entier entre 120 et 230 cm.');
      return;
    }
    if (
      pointureNombre !== null &&
      (!Number.isInteger(pointureNombre) || pointureNombre < 15 || pointureNombre > 50)
    ) {
      setErreur('La pointure doit être un entier entre 15 et 50.');
      return;
    }

    setEnregistrement(true);

    try {
      const profil = await api.mettreAJourMoi({
        version: moi.utilisateur.version,
        pseudo,
        nomComplet: nomComplet.trim() || null,
        telephone: telephone.trim() || null,
        profil: {
          bio: bio.trim() || null,
          tailleCm: tailleNombre,
          pointure: pointureNombre,
          visibilite,
        },
      });
      setMoi(profil);
      rafraichirMoi(profil);
      setEdition(false);
      setSucces(
        telephone !== (moi.utilisateur.telephone ?? '')
          ? 'Profil mis à jour. Un code SMS vous sera envoyé pour vérifier votre nouveau numéro.'
          : 'Profil mis à jour.',
      );
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible d’enregistrer les modifications.'));
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status?: number }).status === 409
      ) {
        void charger();
      }
    } finally {
      setEnregistrement(false);
    }
  }

  async function seDeconnecter(): Promise<void> {
    await deconnecter();
    router.replace('/(auth)/connexion');
  }

  if (chargement) {
    return <Chargement texte="Chargement de votre profil…" />;
  }

  if (!moi) {
    return (
      <Ecran>
        <Entete titre="Mon profil" />
        {erreur ? <Message type="erreur" texte={erreur} /> : null}
        <Bouton titre="Réessayer" onPress={() => void charger()} />
        <Bouton titre="Se déconnecter" onPress={seDeconnecter} variante="discret" />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Entete
        titre={`Bonjour, ${moi.utilisateur.pseudo}`}
        sousTitre={moi.utilisateur.email}
        action={
          <Bouton
            titre={edition ? 'Annuler' : 'Modifier'}
            onPress={() => setEdition((valeur) => !valeur)}
            variante="secondaire"
          />
        }
      />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}
      {succes ? <Message type="succes" texte={succes} /> : null}

      {!edition ? (
        <>
          <Carte>
            <Ligne label="Statut" valeur={moi.utilisateur.statut} />
            <Ligne
              label="E-mail vérifié"
              valeur={moi.utilisateur.emailVerifie ? 'Oui' : 'Non'}
              action={
                <Badge
                  texte={moi.utilisateur.emailVerifie ? 'Vérifié' : 'À vérifier'}
                  ton={moi.utilisateur.emailVerifie ? 'succes' : 'avertissement'}
                />
              }
            />
            <Ligne
              label="Téléphone"
              valeur={moi.utilisateur.telephone ?? 'Non renseigné'}
              action={
                moi.utilisateur.telephone ? (
                  <Badge
                    texte={moi.utilisateur.telephoneVerifie ? 'Vérifié' : 'À vérifier'}
                    ton={moi.utilisateur.telephoneVerifie ? 'succes' : 'avertissement'}
                  />
                ) : undefined
              }
            />
            <Ligne
              label="Profil acheteur/vendeur"
              valeur={moi.utilisateur.kycLegerComplet ? 'Complet' : 'À compléter avant achat'}
            />
            <Ligne
              label="Réputation"
              valeur={`${moi.utilisateur.noteMoyenne.toFixed(1)} / 5 · ${moi.utilisateur.nbVentes} ventes · ${moi.utilisateur.nbAchats} achats`}
            />
            <Ligne
              label="Membre depuis"
              valeur={new Date(moi.utilisateur.creeLe).toLocaleDateString('fr-FR')}
            />
          </Carte>

          <Carte>
            <Ligne label="Bio" valeur={moi.profil.bio ?? 'Aucune bio'} />
            <Ligne
              label="Mensurations"
              valeur={
                [
                  moi.profil.tailleCm ? `${moi.profil.tailleCm} cm` : null,
                  moi.profil.pointure ? `pointure ${moi.profil.pointure}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Non renseignées'
              }
            />
            <Ligne
              label="Visibilité"
              valeur={moi.profil.visibilite === 'public' ? 'Public' : 'Membres'}
            />
            <Ligne
              label="Styles préférés"
              valeur={moi.profil.stylesPreferes.join(', ') || 'Aucun'}
            />
          </Carte>

          <Bouton
            titre="Voir mon profil public"
            onPress={() =>
              router.push({
                pathname: '/utilisateur/[pseudo]',
                params: { pseudo: moi.utilisateur.pseudo },
              })
            }
            variante="secondaire"
          />
          <Lien titre="Se déconnecter" onPress={seDeconnecter} />
        </>
      ) : (
        <Carte>
          <Champ label="Pseudo" valeur={pseudo} onChangeText={setPseudo} maxLength={30} />
          <Champ
            label="Nom complet (facultatif)"
            valeur={nomComplet}
            onChangeText={setNomComplet}
            maxLength={120}
            aide="Jamais visible publiquement."
          />
          <Champ
            label="Téléphone (facultatif)"
            valeur={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
            maxLength={20}
          />
          <Champ
            label="Bio"
            valeur={bio}
            onChangeText={setBio}
            multiline
            maxLength={300}
            aide={`${bio.length} / 300 caractères.`}
          />
          <Champ
            label="Taille (cm)"
            valeur={taille}
            onChangeText={setTaille}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Champ
            label="Pointure"
            valeur={pointure}
            onChangeText={setPointure}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Bouton
            titre={`Profil ${visibilite === 'public' ? 'public' : 'réservé aux membres'}`}
            onPress={() => setVisibilite(visibilite === 'public' ? 'membres' : 'public')}
            variante="secondaire"
          />
          <Bouton titre="Enregistrer" onPress={enregistrer} chargement={enregistrement} />
        </Carte>
      )}
    </Ecran>
  );
}
