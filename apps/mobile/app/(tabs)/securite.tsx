import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { Appareil, Moi } from '@secondevie/contracts';
import { useSession } from '../../src/auth/FournisseurSession';
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
import { motDePasseValide } from '../../src/services/validation';
import { couleurs, espacements } from '../../src/theme';

export default function Securite(): ReactElement {
  const router = useRouter();
  const { deconnecter, rafraichirMoi } = useSession();
  const [moi, setMoi] = useState<Moi | null>(null);
  const [appareils, setAppareils] = useState<Appareil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [codeSms, setCodeSms] = useState('');
  const [envoiSms, setEnvoiSms] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);

    try {
      const [profil, liste] = await Promise.all([api.consulterMoi(), api.listerAppareils()]);
      setMoi(profil);
      rafraichirMoi(profil);
      setAppareils(liste);
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible de charger vos informations de sécurité.'));
    } finally {
      setChargement(false);
    }
  }, [rafraichirMoi]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  async function changerMotDePasse(): Promise<void> {
    setErreur(null);
    setSucces(null);

    if (!actuel) {
      setErreur('Saisissez votre mot de passe actuel.');
      return;
    }
    if (!motDePasseValide(nouveau)) {
      setErreur('Le nouveau mot de passe doit contenir entre 10 et 128 caractères.');
      return;
    }
    if (nouveau !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setEnvoi(true);

    try {
      await api.changerMotDePasse(actuel, nouveau);
      setActuel('');
      setNouveau('');
      setConfirmation('');
      Alert.alert(
        'Mot de passe modifié',
        'Toutes vos sessions ont été révoquées. Reconnectez-vous avec votre nouveau mot de passe.',
        [
          {
            text: 'Se reconnecter',
            onPress: () => {
              void deconnecter().then(() => router.replace('/(auth)/connexion'));
            },
          },
        ],
      );
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible de modifier le mot de passe.'));
    } finally {
      setEnvoi(false);
    }
  }

  function confirmerRevocation(appareil: Appareil): void {
    Alert.alert('Révoquer cet appareil ?', `${appareil.plateforme} · ${appareil.deviceId}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Révoquer',
        style: 'destructive',
        onPress: () => {
          void revoquer(appareil.id);
        },
      },
    ]);
  }

  async function revoquer(id: string): Promise<void> {
    setErreur(null);
    setSucces(null);

    try {
      await api.revoquerAppareil(id);
      setSucces('Appareil révoqué.');
      setAppareils(await api.listerAppareils());
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible de révoquer cet appareil.'));
    }
  }

  async function envoyerCodeSms(): Promise<void> {
    setErreur(null);
    setSucces(null);
    setEnvoiSms(true);

    try {
      await api.renvoyerCodeTelephone();
      setSucces('Un code SMS a été envoyé.');
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible d’envoyer le code SMS.'));
    } finally {
      setEnvoiSms(false);
    }
  }

  async function verifierSms(): Promise<void> {
    setErreur(null);
    setSucces(null);

    if (!/^\d{6}$/.test(codeSms)) {
      setErreur('Saisissez les 6 chiffres du code SMS.');
      return;
    }

    setEnvoiSms(true);

    try {
      await api.verifierTelephone(codeSms);
      setCodeSms('');
      setSucces('Téléphone vérifié.');
      await charger();
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Le code SMS est invalide ou expiré.'));
    } finally {
      setEnvoiSms(false);
    }
  }

  if (chargement) {
    return <Chargement texte="Chargement de la sécurité…" />;
  }

  return (
    <Ecran>
      <Entete titre="Sécurité" sousTitre="Sessions, mot de passe et vérification du téléphone." />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}
      {succes ? <Message type="succes" texte={succes} /> : null}

      <Carte>
        <Text style={styles.titreCarte}>Appareils connectés</Text>
        {appareils.length === 0 ? (
          <EtatVide titre="Aucun appareil actif" description="Vos sessions apparaîtront ici." />
        ) : (
          appareils.map((appareil) => (
            <View key={appareil.id} style={styles.appareil}>
              <View style={styles.appareilTexte}>
                <Text style={styles.appareilNom}>{appareil.plateforme}</Text>
                <Text style={styles.texteSecondaire} numberOfLines={1}>
                  {appareil.deviceId}
                </Text>
                <Text style={styles.texteSecondaire}>
                  Dernière activité :{' '}
                  {appareil.derniereActiviteLe
                    ? new Date(appareil.derniereActiviteLe).toLocaleString('fr-FR')
                    : 'inconnue'}
                </Text>
              </View>
              <Bouton
                titre="Révoquer"
                onPress={() => confirmerRevocation(appareil)}
                variante="danger"
              />
            </View>
          ))
        )}
      </Carte>

      {moi?.utilisateur.telephone ? (
        <Carte>
          <View style={styles.enteteCarte}>
            <Text style={styles.titreCarte}>Téléphone</Text>
            <Badge
              texte={moi.utilisateur.telephoneVerifie ? 'Vérifié' : 'À vérifier'}
              ton={moi.utilisateur.telephoneVerifie ? 'succes' : 'avertissement'}
            />
          </View>
          <Text style={styles.texte}>{moi.utilisateur.telephone}</Text>
          {!moi.utilisateur.telephoneVerifie ? (
            <>
              <Bouton
                titre="Envoyer un code SMS"
                onPress={envoyerCodeSms}
                variante="secondaire"
                chargement={envoiSms}
              />
              <Champ
                label="Code SMS"
                valeur={codeSms}
                onChangeText={(valeur) => setCodeSms(valeur.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Bouton titre="Vérifier le téléphone" onPress={verifierSms} chargement={envoiSms} />
            </>
          ) : null}
        </Carte>
      ) : null}

      <Carte>
        <Text style={styles.titreCarte}>Changer de mot de passe</Text>
        <Champ
          label="Mot de passe actuel"
          valeur={actuel}
          onChangeText={setActuel}
          secureTextEntry
          maxLength={128}
        />
        <Champ
          label="Nouveau mot de passe"
          valeur={nouveau}
          onChangeText={setNouveau}
          secureTextEntry
          maxLength={128}
        />
        <Champ
          label="Confirmer le nouveau mot de passe"
          valeur={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          maxLength={128}
        />
        <Bouton titre="Modifier le mot de passe" onPress={changerMotDePasse} chargement={envoi} />
      </Carte>

      <Carte>
        <Text style={styles.titreCarte}>Supprimer mon compte</Text>
        <Text style={styles.texteSecondaire}>
          Cette action est définitive. Vos données sont anonymisées et vos sessions révoquées.
        </Text>
        <Bouton
          titre="Ouvrir la suppression"
          onPress={() => router.push('/(tabs)/suppression')}
          variante="danger"
        />
      </Carte>

      <Lien titre="Retour au profil" onPress={() => router.push('/(tabs)/moi')} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titreCarte: { fontSize: 17, fontWeight: '700', color: couleurs.texte },
  enteteCarte: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacements.sm,
  },
  appareil: {
    gap: espacements.sm,
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
    paddingTop: espacements.md,
  },
  appareilTexte: { gap: 2 },
  appareilNom: {
    fontSize: 15,
    fontWeight: '700',
    color: couleurs.texte,
    textTransform: 'capitalize',
  },
  texte: { fontSize: 15, color: couleurs.texte },
  texteSecondaire: { fontSize: 13, color: couleurs.texteSecondaire, lineHeight: 19 },
});
