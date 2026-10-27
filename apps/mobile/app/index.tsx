import { Redirect } from 'expo-router';
import type { ReactElement } from 'react';
import { useSession } from '../src/auth/FournisseurSession';
import { Chargement } from '../src/components/ui';

/** Point d'entrée : redirige selon l'état de session restauré. */
export default function Index(): ReactElement {
  const { etat } = useSession();

  if (etat === 'chargement') {
    return <Chargement texte="Ouverture de votre espace…" />;
  }

  return <Redirect href={etat === 'connecte' ? '/(tabs)/moi' : '/(auth)/connexion'} />;
}
