import { Tabs } from 'expo-router';
import type { ReactElement } from 'react';
import { Text, type ColorValue } from 'react-native';
import { couleurs } from '../../src/theme';

function Icone({ symbole, couleur }: { symbole: string; couleur: ColorValue }): ReactElement {
  return <Text style={{ fontSize: 20, color: couleur }}>{symbole}</Text>;
}

export default function LayoutOnglets(): ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: couleurs.primaire,
        tabBarInactiveTintColor: couleurs.texteSecondaire,
        tabBarStyle: { backgroundColor: couleurs.surface, borderTopColor: couleurs.bordure },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="moi"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Icone symbole="👤" couleur={color} />,
        }}
      />
      <Tabs.Screen
        name="adresses"
        options={{
          title: 'Adresses',
          tabBarIcon: ({ color }) => <Icone symbole="🏠" couleur={color} />,
        }}
      />
      <Tabs.Screen
        name="securite"
        options={{
          title: 'Sécurité',
          tabBarIcon: ({ color }) => <Icone symbole="🔒" couleur={color} />,
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: 'Export',
          tabBarIcon: ({ color }) => <Icone symbole="📦" couleur={color} />,
        }}
      />
      <Tabs.Screen name="suppression" options={{ href: null }} />
    </Tabs>
  );
}
