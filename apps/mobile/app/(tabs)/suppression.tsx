import type { ReactElement } from 'react';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useSession } from '../../src/auth/FournisseurSession';
import { Bouton, Carte, Champ, Ecran, Entete, Lien, Message } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { messageErreur, raisonsSuppression } from '../../src/services/erreurs';
import { couleurs } from '../../src/theme';

export default function Suppression(): ReactElement {
  const router = useRouter();
  const { deconnecter } = useSession();
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [blocages, setBlocages] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);

  async function supprimer(): Promise<void> {
    setErreur(null);
    setBlocages([]);

    if (!motDePasse) {
      setErreur('Saisissez votre mot de passe pour confirmer.');
      return;
    }

    setEnvoi(true);

    try {
      await api.supprimerCompte(motDePasse);
      await deconnecter();
      router.replace('/(auth)/connexion');
    } catch (error: unknown) {
      const raisons = raisonsSuppression(error);
      if (raisons.length > 0) {
        setBlocages(raisons);
      }
      setErreur(messageErreur(error, 'Impossible de supprimer le compte.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Ecran>
      <Entete titre="Supprimer mon compte" sousTitre="Action définitive et irréversible." />

      <Message
        type="avertissement"
        texte="Votre compte sera anonymisé : e-mail, téléphone, nom, date de naissance, adresses et appareils seront effacés ou détachés. Vos sessions seront révoquées immédiatement."
      />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}

      {blocages.length > 0 ? (
        <Carte>
          <Text style={styles.titre}>Suppression bloquée</Text>
          {blocages.map((blocage) => (
            <Text key={blocage} style={styles.texte}>
              • {blocage}
            </Text>
          ))}
        </Carte>
      ) : null}

      <Carte>
        <Champ
          label="Mot de passe"
          valeur={motDePasse}
          onChangeText={setMotDePasse}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          maxLength={128}
        />
        <Bouton
          titre="Supprimer définitivement mon compte"
          onPress={supprimer}
          variante="danger"
          chargement={envoi}
        />
      </Carte>

      <Lien titre="Annuler" onPress={() => router.replace('/(tabs)/moi')} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 17, fontWeight: '700', color: couleurs.texte },
  texte: { fontSize: 14, lineHeight: 20, color: couleurs.texteSecondaire },
});
