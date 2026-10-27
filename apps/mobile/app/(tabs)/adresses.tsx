import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { Adresse as AdresseApi } from '@secondevie/contracts';
import {
  Badge,
  Bouton,
  Carte,
  Champ,
  Chargement,
  Ecran,
  Entete,
  EtatVide,
  Lien,
  Message,
} from '../../src/components/ui';
import { api } from '../../src/services/api';
import { messageErreur } from '../../src/services/erreurs';
import { couleurs, espacements } from '../../src/theme';

interface Formulaire {
  libelle: string;
  destinataire: string;
  ligne1: string;
  ligne2: string;
  codePostal: string;
  ville: string;
  telephone: string;
}

const VIDE: Formulaire = {
  libelle: '',
  destinataire: '',
  ligne1: '',
  ligne2: '',
  codePostal: '',
  ville: '',
  telephone: '',
};

export default function Adresses(): ReactElement {
  const router = useRouter();
  const [adresses, setAdresses] = useState<AdresseApi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);

    try {
      setAdresses(await api.listerAdresses());
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible de charger vos adresses.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  function ouvrirCreation(): void {
    setEditionId(null);
    setFormulaire({ ...VIDE });
    setSucces(null);
    setErreur(null);
  }

  function ouvrirEdition(adresse: AdresseApi): void {
    setEditionId(adresse.id);
    setFormulaire({
      libelle: adresse.libelle,
      destinataire: adresse.destinataire,
      ligne1: adresse.ligne1,
      ligne2: adresse.ligne2 ?? '',
      codePostal: adresse.codePostal,
      ville: adresse.ville,
      telephone: adresse.telephone,
    });
    setSucces(null);
    setErreur(null);
  }

  function modifier(champ: keyof Formulaire, valeur: string): void {
    setFormulaire((actuel) => (actuel ? { ...actuel, [champ]: valeur } : actuel));
  }

  async function enregistrer(): Promise<void> {
    if (!formulaire) return;

    setErreur(null);
    setSucces(null);

    const requis: Array<[keyof Formulaire, string]> = [
      ['libelle', 'le libellé'],
      ['destinataire', 'le destinataire'],
      ['ligne1', 'la première ligne'],
      ['codePostal', 'le code postal'],
      ['ville', 'la ville'],
      ['telephone', 'le téléphone'],
    ];

    for (const [champ, nom] of requis) {
      if (!formulaire[champ].trim()) {
        setErreur(`Renseignez ${nom}.`);
        return;
      }
    }

    setEnvoi(true);

    try {
      const charge = {
        ...formulaire,
        ligne2: formulaire.ligne2.trim() || null,
        pays: 'FR',
      };

      if (editionId) {
        await api.modifierAdresse(editionId, charge);
        setSucces('Adresse modifiée.');
      } else {
        await api.creerAdresse({ ...charge, estDefaut: adresses.length === 0 });
        setSucces('Adresse ajoutée.');
      }

      setFormulaire(null);
      setEditionId(null);
      await charger();
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible d’enregistrer l’adresse.'));
    } finally {
      setEnvoi(false);
    }
  }

  function confirmerSuppression(adresse: AdresseApi): void {
    Alert.alert(
      'Supprimer cette adresse ?',
      `${adresse.libelle} — ${adresse.ligne1}, ${adresse.codePostal} ${adresse.ville}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void supprimer(adresse.id);
          },
        },
      ],
    );
  }

  async function supprimer(id: string): Promise<void> {
    setErreur(null);
    setSucces(null);

    try {
      await api.supprimerAdresse(id);
      setSucces('Adresse supprimée.');
      await charger();
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible de supprimer l’adresse.'));
    }
  }

  async function definirDefaut(id: string): Promise<void> {
    setErreur(null);
    setSucces(null);

    try {
      await api.definirAdresseParDefaut(id);
      setSucces('Adresse par défaut mise à jour.');
      await charger();
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible de définir cette adresse par défaut.'));
    }
  }

  if (chargement) {
    return <Chargement texte="Chargement de vos adresses…" />;
  }

  return (
    <Ecran>
      <Entete
        titre="Mes adresses"
        sousTitre="Au plus une adresse par défaut parmi vos adresses actives."
        action={
          <Bouton
            titre="Ajouter"
            onPress={ouvrirCreation}
            variante="secondaire"
            accessibilityLabel="Ajouter une adresse"
          />
        }
      />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}
      {succes ? <Message type="succes" texte={succes} /> : null}

      {formulaire ? (
        <Carte>
          <Text style={styles.titreCarte}>
            {editionId ? 'Modifier l’adresse' : 'Nouvelle adresse'}
          </Text>
          <Champ
            label="Libellé"
            valeur={formulaire.libelle}
            onChangeText={(v) => modifier('libelle', v)}
            maxLength={40}
            placeholder="Maison"
          />
          <Champ
            label="Destinataire"
            valeur={formulaire.destinataire}
            onChangeText={(v) => modifier('destinataire', v)}
            maxLength={120}
          />
          <Champ
            label="Adresse"
            valeur={formulaire.ligne1}
            onChangeText={(v) => modifier('ligne1', v)}
            maxLength={120}
          />
          <Champ
            label="Complément (facultatif)"
            valeur={formulaire.ligne2}
            onChangeText={(v) => modifier('ligne2', v)}
            maxLength={120}
          />
          <Champ
            label="Code postal"
            valeur={formulaire.codePostal}
            onChangeText={(v) => modifier('codePostal', v)}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <Champ
            label="Ville"
            valeur={formulaire.ville}
            onChangeText={(v) => modifier('ville', v)}
            maxLength={120}
          />
          <Champ
            label="Téléphone"
            valeur={formulaire.telephone}
            onChangeText={(v) => modifier('telephone', v)}
            keyboardType="phone-pad"
            maxLength={20}
          />
          <Bouton
            titre={editionId ? 'Enregistrer' : 'Ajouter l’adresse'}
            onPress={enregistrer}
            chargement={envoi}
          />
          <Bouton titre="Annuler" onPress={() => setFormulaire(null)} variante="discret" />
        </Carte>
      ) : null}

      {adresses.length === 0 && !formulaire ? (
        <EtatVide
          titre="Aucune adresse"
          description="Ajoutez une adresse pour préparer vos prochains achats et ventes."
          action={<Bouton titre="Ajouter une adresse" onPress={ouvrirCreation} />}
        />
      ) : null}

      {adresses.map((adresse) => (
        <Carte key={adresse.id}>
          <View style={styles.enteteCarte}>
            <Text style={styles.titreCarte}>{adresse.libelle}</Text>
            {adresse.estDefaut ? <Badge texte="Par défaut" ton="succes" /> : null}
          </View>
          <Text style={styles.texte}>
            {adresse.destinataire}
            {'\n'}
            {adresse.ligne1}
            {adresse.ligne2 ? `\n${adresse.ligne2}` : ''}
            {'\n'}
            {adresse.codePostal} {adresse.ville} ({adresse.pays}){'\n'}
            {adresse.telephone}
          </Text>
          <View style={styles.actions}>
            {!adresse.estDefaut ? (
              <Bouton
                titre="Par défaut"
                onPress={() => void definirDefaut(adresse.id)}
                variante="secondaire"
              />
            ) : null}
            <Bouton titre="Modifier" onPress={() => ouvrirEdition(adresse)} variante="secondaire" />
            <Bouton
              titre="Supprimer"
              onPress={() => confirmerSuppression(adresse)}
              variante="danger"
            />
          </View>
        </Carte>
      ))}

      <Lien titre="Retour au profil" onPress={() => router.push('/(tabs)/moi')} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  enteteCarte: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacements.sm,
  },
  titreCarte: { fontSize: 17, fontWeight: '700', color: couleurs.texte },
  texte: { fontSize: 14, lineHeight: 21, color: couleurs.texteSecondaire },
  actions: { gap: espacements.sm },
});
