import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';
import { FournisseurSession, useSession } from '../src/auth/FournisseurSession';
import { BanniereHorsLigne } from '../src/components/BanniereHorsLigne';
import { Chargement } from '../src/components/ui';

function Garde(): ReactElement {
  const { etat } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (etat === 'chargement') return;

    const dansAuth = segments[0] === '(auth)';
    const routePublique = segments[0] === 'utilisateur';

    if (etat === 'deconnecte' && !dansAuth && !routePublique) {
      router.replace('/(auth)/connexion');
    } else if (etat === 'connecte' && dansAuth) {
      router.replace('/(tabs)/moi');
    }
  }, [etat, segments, router]);

  if (etat === 'chargement') {
    return <Chargement texte="Ouverture de votre espace…" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <BanniereHorsLigne />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="utilisateur/[pseudo]" />
      </Stack>
    </View>
  );
}

export default function Racine(): ReactElement {
  return (
    <FournisseurSession>
      <StatusBar style="dark" />
      <Garde />
    </FournisseurSession>
  );
}
