import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReseau } from '../hooks/useReseau';
import { couleurs, espacements } from '../theme';

export function BanniereHorsLigne(): ReactElement | null {
  const { horsLigne } = useReseau();

  if (!horsLigne) return null;

  return (
    <View style={styles.banniere} accessibilityLiveRegion="polite">
      <Text style={styles.texte}>
        Vous êtes hors ligne. Vos saisies sont conservées ; réessayez une fois reconnecté.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banniere: {
    backgroundColor: couleurs.avertissementClair,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.avertissement,
    paddingHorizontal: espacements.lg,
    paddingVertical: espacements.sm,
  },
  texte: { color: couleurs.avertissement, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
