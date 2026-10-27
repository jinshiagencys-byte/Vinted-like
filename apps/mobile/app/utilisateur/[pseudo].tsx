import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';
import type { ProfilPublic } from '@secondevie/contracts';
import { ErreurApi } from '@secondevie/contracts';
import {
  Badge,
  Bouton,
  Carte,
  Chargement,
  Ecran,
  Entete,
  Lien,
  Ligne,
  Message,
} from '../../src/components/ui';
import { api } from '../../src/services/api';
import { messageErreur } from '../../src/services/erreurs';
import { couleurs } from '../../src/theme';

export default function ProfilPublicEcran(): ReactElement {
  const router = useRouter();
  const { pseudo } = useLocalSearchParams<{ pseudo?: string }>();
  const [profil, setProfil] = useState<ProfilPublic | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [introuvable, setIntrouvable] = useState(false);

  const charger = useCallback(async () => {
    if (!pseudo) {
      setIntrouvable(true);
      setChargement(false);
      return;
    }

    setErreur(null);
    setIntrouvable(false);

    try {
      setProfil(await api.profilPublic(pseudo));
    } catch (error: unknown) {
      if (error instanceof ErreurApi && error.status === 404) {
        setIntrouvable(true);
      } else {
        setErreur(messageErreur(error, 'Impossible de charger ce profil.'));
      }
    } finally {
      setChargement(false);
    }
  }, [pseudo]);

  useEffect(() => {
    void charger();
  }, [charger]);

  function partager(): void {
    if (!profil) return;

    void Share.share({
      message: `Découvrez le profil de ${profil.pseudo} sur SecondeVie.`,
    });
  }

  if (chargement) {
    return <Chargement texte="Chargement du profil…" />;
  }

  if (introuvable) {
    return (
      <Ecran defilant={false}>
        <Entete titre="Profil introuvable" />
        <Message
          type="info"
          texte="Ce profil n’existe pas ou son propriétaire a choisi de le réserver aux membres."
        />
        <Bouton titre="Revenir en arrière" onPress={() => router.back()} variante="secondaire" />
      </Ecran>
    );
  }

  if (!profil) {
    return (
      <Ecran defilant={false}>
        <Entete titre="Profil" />
        {erreur ? <Message type="erreur" texte={erreur} /> : null}
        <Bouton titre="Réessayer" onPress={() => void charger()} />
        <Lien titre="Revenir en arrière" onPress={() => router.back()} />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Entete
        titre={profil.pseudo}
        sousTitre={`Membre depuis le ${new Date(profil.membreDepuis).toLocaleDateString('fr-FR')}`}
        action={<Badge texte={`${profil.noteMoyenne.toFixed(1)} / 5`} ton="succes" />}
      />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}

      <Carte>
        <Text style={styles.bio}>{profil.bio ?? 'Ce membre n’a pas encore écrit de bio.'}</Text>
      </Carte>

      <Carte>
        <Ligne label="Note moyenne" valeur={`${profil.noteMoyenne.toFixed(1)} / 5`} />
        <Ligne label="Ventes" valeur={String(profil.nbVentes)} />
        <Ligne label="Achats" valeur={String(profil.nbAchats)} />
      </Carte>

      <Message
        type="info"
        texte="Seules les informations publiques sont affichées. Les annonces et évaluations arriveront avec les modules suivants."
      />

      <Bouton titre="Partager ce profil" onPress={partager} variante="secondaire" />
      <Lien titre="Revenir en arrière" onPress={() => router.back()} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  bio: { fontSize: 15, lineHeight: 22, color: couleurs.texte },
});
