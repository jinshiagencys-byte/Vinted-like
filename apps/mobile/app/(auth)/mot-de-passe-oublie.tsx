import type { ReactElement } from 'react';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Bouton, Champ, Ecran, Entete, Lien, Message } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { messageErreur } from '../../src/services/erreurs';
import { emailValide, motDePasseValide } from '../../src/services/validation';

export default function MotDePasseOublie(): ReactElement {
  const router = useRouter();
  const [etape, setEtape] = useState<'demande' | 'confirmation'>('demande');
  const [email, setEmail] = useState('');
  const [jeton, setJeton] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function demander(): Promise<void> {
    setErreur(null);
    setMessage(null);

    if (!emailValide(email)) {
      setErreur('Saisissez une adresse e-mail valide.');
      return;
    }

    setEnvoi(true);

    try {
      const reponse = await api.demanderReinitialisation(email.trim());
      setMessage(reponse.message);
      setEtape('confirmation');
    } catch (error: unknown) {
      setErreur(messageErreur(error));
    } finally {
      setEnvoi(false);
    }
  }

  async function confirmer(): Promise<void> {
    setErreur(null);
    setMessage(null);

    if (!jeton.trim()) {
      setErreur('Saisissez le jeton reçu par e-mail.');
      return;
    }
    if (!motDePasseValide(nouveauMotDePasse)) {
      setErreur('Le mot de passe doit contenir entre 10 et 128 caractères.');
      return;
    }

    setEnvoi(true);

    try {
      await api.confirmerReinitialisation(jeton.trim(), nouveauMotDePasse);
      setMessage('Votre mot de passe a été modifié. Toutes vos sessions ont été révoquées.');
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Ce lien est invalide ou expiré.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Ecran>
      <Entete
        titre="Mot de passe oublié"
        sousTitre={
          etape === 'demande'
            ? 'Recevez un jeton de réinitialisation par e-mail.'
            : 'Saisissez le jeton reçu et choisissez un nouveau mot de passe.'
        }
      />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}
      {message ? <Message type="succes" texte={message} /> : null}

      {etape === 'demande' ? (
        <>
          <Champ
            label="E-mail"
            valeur={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={254}
          />
          <Bouton titre="Envoyer le jeton" onPress={demander} chargement={envoi} />
        </>
      ) : (
        <>
          <Champ
            label="Jeton reçu"
            valeur={jeton}
            onChangeText={setJeton}
            autoCapitalize="none"
            maxLength={256}
            aide="Copiez le jeton depuis l’e-mail de réinitialisation."
          />
          <Champ
            label="Nouveau mot de passe"
            valeur={nouveauMotDePasse}
            onChangeText={setNouveauMotDePasse}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={128}
          />
          <Bouton titre="Modifier le mot de passe" onPress={confirmer} chargement={envoi} />
          <Bouton
            titre="Renvoyer un jeton"
            onPress={() => setEtape('demande')}
            variante="secondaire"
          />
        </>
      )}

      <Lien titre="Revenir à la connexion" onPress={() => router.replace('/(auth)/connexion')} />
    </Ecran>
  );
}
