import type { ReactElement } from 'react';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ErreurApi } from '@secondevie/contracts';
import { api } from '../../src/services/api';
import { sauvegarderBrouillon } from '../../src/services/brouillon';
import { messageErreur } from '../../src/services/erreurs';
import {
  dateNaissanceValide,
  emailValide,
  motDePasseValide,
  pseudoValide,
} from '../../src/services/validation';
import { Bouton, Champ, Ecran, Entete, Lien, Message } from '../../src/components/ui';
import { couleurs, espacements } from '../../src/theme';
import { StyleSheet, Text, View } from 'react-native';

interface Erreurs {
  email?: string;
  pseudo?: string;
  motDePasse?: string;
  dateNaissance?: string;
  cgu?: string;
}

export default function Inscription(): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [cgu, setCgu] = useState(false);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  function valider(): boolean {
    const suivantes: Erreurs = {};

    if (!emailValide(email)) suivantes.email = 'Saisissez une adresse e-mail valide.';
    if (!pseudoValide(pseudo)) {
      suivantes.pseudo = '3 à 30 caractères : lettres, chiffres, points, tirets, underscores.';
    }
    if (!motDePasseValide(motDePasse)) {
      suivantes.motDePasse = 'Le mot de passe doit contenir entre 10 et 128 caractères.';
    }
    if (!dateNaissanceValide(dateNaissance)) {
      suivantes.dateNaissance = 'Date au format AAAA-MM-JJ, avec au moins 18 ans.';
    }
    if (!cgu) suivantes.cgu = 'Vous devez accepter les conditions générales.';

    setErreurs(suivantes);
    return Object.keys(suivantes).length === 0;
  }

  async function soumettre(): Promise<void> {
    setErreurGlobale(null);

    if (!valider()) return;

    setEnvoi(true);

    try {
      await sauvegarderBrouillon({ email, telephone, pseudo, dateNaissance });
      await api.inscription({
        email: email.trim(),
        pseudo: pseudo.trim(),
        motDePasse,
        dateNaissance,
        ...(telephone.trim() ? { telephone: telephone.trim() } : {}),
      });

      router.push({ pathname: '/(auth)/verification', params: { email: email.trim() } });
    } catch (error: unknown) {
      if (error instanceof ErreurApi) {
        if (error.code === 'email_deja_utilise') {
          setErreurs({ email: messageErreur(error) });
          return;
        }
        if (error.code === 'pseudo_deja_utilise' || error.code === 'pseudo_reserve') {
          setErreurs({ pseudo: messageErreur(error) });
          return;
        }
        if (error.code === 'telephone_deja_utilise') {
          setErreurGlobale(messageErreur(error));
          return;
        }
      }

      setErreurGlobale(messageErreur(error));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Ecran>
      <Entete
        titre="Créer un compte"
        sousTitre="Rejoignez SecondeVie pour vendre et acheter des vêtements de seconde main."
      />

      {erreurGlobale ? <Message type="erreur" texte={erreurGlobale} /> : null}

      <Champ
        label="E-mail"
        valeur={email}
        onChangeText={setEmail}
        erreur={erreurs.email}
        placeholder="vous@exemple.fr"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
      />
      <Champ
        label="Téléphone (facultatif)"
        valeur={telephone}
        onChangeText={setTelephone}
        placeholder="06 12 34 56 78"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={20}
        aide="Obligatoire avant votre premier achat ou virement."
      />
      <Champ
        label="Pseudo"
        valeur={pseudo}
        onChangeText={setPseudo}
        erreur={erreurs.pseudo}
        placeholder="mon-pseudo"
        autoCapitalize="none"
        maxLength={30}
      />
      <Champ
        label="Mot de passe"
        valeur={motDePasse}
        onChangeText={setMotDePasse}
        erreur={erreurs.motDePasse}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        aide="10 caractères minimum, sans votre e-mail ni votre pseudo."
      />
      <Champ
        label="Date de naissance"
        valeur={dateNaissance}
        onChangeText={setDateNaissance}
        erreur={erreurs.dateNaissance}
        placeholder="AAAA-MM-JJ"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />

      <View style={styles.cgu}>
        <Bouton
          titre={
            cgu
              ? '☑ J’accepte les CGU et la politique de confidentialité'
              : '☐ J’accepte les CGU et la politique de confidentialité'
          }
          onPress={() => setCgu((valeur) => !valeur)}
          variante="discret"
          accessibilityLabel="Accepter les conditions générales"
        />
        {erreurs.cgu ? <Text style={styles.erreurCgu}>{erreurs.cgu}</Text> : null}
      </View>

      <Bouton titre="Créer mon compte" onPress={soumettre} chargement={envoi} />
      <Lien titre="J’ai déjà un compte" onPress={() => router.replace('/(auth)/connexion')} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  cgu: { gap: espacements.xs },
  erreurCgu: { color: couleurs.danger, fontSize: 13, fontWeight: '600' },
});
