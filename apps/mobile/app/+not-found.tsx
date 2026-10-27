import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Bouton, Ecran, Entete, Message } from '../src/components/ui';

export default function Introuvable(): ReactElement {
  const router = useRouter();

  return (
    <Ecran defilant={false}>
      <Entete titre="Page introuvable" sousTitre="Cette section n’existe pas ou a été déplacée." />
      <Message type="info" texte="Vérifiez le lien utilisé ou revenez à votre profil." />
      <Bouton titre="Revenir à l’accueil" onPress={() => router.replace('/')} />
    </Ecran>
  );
}
