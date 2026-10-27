import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../src/auth/FournisseurSession';
import { Bouton, Champ, Ecran, Entete, Lien, Message } from '../../src/components/ui';
import { appareilDemande } from '../../src/services/appareil';
import { api } from '../../src/services/api';
import { effacerBrouillon, lireBrouillon } from '../../src/services/brouillon';
import { messageErreur } from '../../src/services/erreurs';
import { couleurs, espacements } from '../../src/theme';

export default function Verification(): ReactElement {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { connecter } = useSession();
  const [email, setEmail] = useState(emailParam ?? '');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [renvoi, setRenvoi] = useState(false);
  const [secondes, setSecondes] = useState(60);

  useEffect(() => {
    if (email) return;

    lireBrouillon().then((brouillon) => {
      if (brouillon?.email) setEmail(brouillon.email);
    });
  }, [email]);

  useEffect(() => {
    if (secondes <= 0) return;

    const minuteur = setInterval(() => setSecondes((valeur) => Math.max(0, valeur - 1)), 1_000);
    return () => clearInterval(minuteur);
  }, [secondes]);

  const verifier = useCallback(async () => {
    setErreur(null);
    setSucces(null);

    if (!/^\d{6}$/.test(code)) {
      setErreur('Saisissez les 6 chiffres du code reçu.');
      return;
    }

    setEnvoi(true);

    try {
      const session = await api.verifierEmail({
        email,
        code,
        appareil: await appareilDemande(),
      });
      await connecter(session);
      await effacerBrouillon();
      router.replace('/(tabs)/moi');
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Le code est invalide ou expiré.'));
    } finally {
      setEnvoi(false);
    }
  }, [code, email, connecter, router]);

  async function renvoyerCode(): Promise<void> {
    setErreur(null);
    setSucces(null);
    setRenvoi(true);

    try {
      await api.renvoyerCodeEmail(email);
      setSucces('Si un compte existe, un nouveau code a été envoyé.');
      setSecondes(60);
    } catch (error: unknown) {
      setErreur(messageErreur(error));
    } finally {
      setRenvoi(false);
    }
  }

  if (!email) {
    return (
      <Ecran>
        <Entete titre="Vérification de l’e-mail" />
        <Message
          type="avertissement"
          texte="Aucune adresse e-mail à vérifier. Reprenez l’inscription."
        />
        <Lien
          titre="Revenir à l’inscription"
          onPress={() => router.replace('/(auth)/inscription')}
        />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Entete
        titre="Vérifiez votre e-mail"
        sousTitre={`Un code à 6 chiffres a été envoyé à ${email}.`}
      />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}
      {succes ? <Message type="succes" texte={succes} /> : null}

      <Champ
        label="Code de vérification"
        valeur={code}
        onChangeText={(valeur) => setCode(valeur.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        aide="Le code est valable 15 minutes et limité à 5 tentatives."
      />

      <Bouton
        titre="Vérifier"
        onPress={verifier}
        chargement={envoi}
        desactive={code.length !== 6}
      />

      <View style={styles.renvoi}>
        <Text style={styles.texteSecondaire}>
          {secondes > 0
            ? `Vous pouvez renvoyer un code dans ${secondes} s.`
            : 'Vous n’avez rien reçu ?'}
        </Text>
        <Bouton
          titre="Renvoyer un code"
          onPress={renvoyerCode}
          variante="secondaire"
          chargement={renvoi}
          desactive={secondes > 0}
        />
      </View>

      <Lien
        titre="Changer d’adresse e-mail"
        onPress={() => router.replace('/(auth)/inscription')}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  renvoi: { gap: espacements.sm },
  texteSecondaire: { color: couleurs.texteSecondaire, fontSize: 14 },
});
