import type { ReactElement } from 'react';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/auth/FournisseurSession';
import { Bouton, Champ, Ecran, Entete, Lien, Message } from '../../src/components/ui';
import { appareilDemande } from '../../src/services/appareil';
import { api } from '../../src/services/api';
import { messageErreur } from '../../src/services/erreurs';
import { emailValide } from '../../src/services/validation';

export default function Connexion(): ReactElement {
  const router = useRouter();
  const { connecter } = useSession();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(): Promise<void> {
    setErreur(null);

    if (!emailValide(email)) {
      setErreur('Saisissez une adresse e-mail valide.');
      return;
    }
    if (!motDePasse) {
      setErreur('Saisissez votre mot de passe.');
      return;
    }

    setEnvoi(true);

    try {
      const session = await api.connexion({
        email: email.trim(),
        motDePasse,
        appareil: await appareilDemande(),
      });
      await connecter(session);
      router.replace('/(tabs)/moi');
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'E-mail ou mot de passe incorrect.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Ecran>
      <Entete titre="Bon retour" sousTitre="Connectez-vous à votre compte SecondeVie." />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}

      <Champ
        label="E-mail"
        valeur={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
      />
      <Champ
        label="Mot de passe"
        valeur={motDePasse}
        onChangeText={setMotDePasse}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        maxLength={128}
      />

      <Bouton titre="Se connecter" onPress={soumettre} chargement={envoi} />
      <Lien
        titre="Mot de passe oublié ?"
        onPress={() => router.push('/(auth)/mot-de-passe-oublie')}
      />
      <Lien titre="Créer un compte" onPress={() => router.replace('/(auth)/inscription')} />
    </Ecran>
  );
}
