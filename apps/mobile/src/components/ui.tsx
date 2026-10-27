import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { couleurs, espacements, rayons, tailles } from '../theme';

interface EcranProps {
  children: ReactNode;
  defilant?: boolean;
  pied?: ReactNode;
}

export function Ecran({ children, defilant = true, pied }: EcranProps): ReactElement {
  const contenu = defilant ? (
    <ScrollView
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.contenu}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.ecran}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {contenu}
        {pied}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface EnteteProps {
  titre: string;
  sousTitre?: string;
  action?: ReactNode;
}

export function Entete({ titre, sousTitre, action }: EnteteProps): ReactElement {
  return (
    <View style={styles.entete}>
      <View style={styles.enteteTexte}>
        <Text style={styles.titre} accessibilityRole="header">
          {titre}
        </Text>
        {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
      </View>
      {action}
    </View>
  );
}

interface ChampProps {
  label: string;
  valeur: string;
  onChangeText: (valeur: string) => void;
  erreur?: string | null;
  aide?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  testID?: string;
}

export function Champ({
  label,
  valeur,
  onChangeText,
  erreur,
  aide,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  multiline,
  maxLength,
  editable = true,
  testID,
}: ChampProps): ReactElement {
  return (
    <View style={styles.champ}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.saisie,
          multiline ? styles.saisieMultiligne : null,
          erreur ? styles.saisieErreur : null,
          !editable ? styles.saisieDesactivee : null,
        ]}
        value={valeur}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={couleurs.texteSecondaire}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        accessibilityLabel={label}
        accessibilityHint={aide}
        testID={testID}
      />
      {aide && !erreur ? <Text style={styles.aide}>{aide}</Text> : null}
      {erreur ? (
        <Text style={styles.erreurChamp} accessibilityLiveRegion="polite">
          {erreur}
        </Text>
      ) : null}
    </View>
  );
}

interface BoutonProps {
  titre: string;
  onPress: () => void;
  variante?: 'primaire' | 'secondaire' | 'danger' | 'discret';
  chargement?: boolean;
  desactive?: boolean;
  accessibilityLabel?: string;
}

export function Bouton({
  titre,
  onPress,
  variante = 'primaire',
  chargement = false,
  desactive = false,
  accessibilityLabel,
}: BoutonProps): ReactElement {
  const inactif = desactive || chargement;

  return (
    <Pressable
      onPress={chargement ? undefined : onPress}
      disabled={inactif}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titre}
      accessibilityState={{ disabled: inactif, busy: chargement }}
      style={({ pressed }) => [
        styles.bouton,
        styles[`bouton_${variante}`],
        pressed && !inactif ? styles.boutonPresse : null,
        inactif ? styles.boutonDesactive : null,
      ]}
    >
      {chargement ? (
        <ActivityIndicator
          color={variante === 'primaire' || variante === 'danger' ? '#FFFFFF' : couleurs.primaire}
        />
      ) : (
        <Text style={[styles.boutonTexte, styles[`boutonTexte_${variante}`]]}>{titre}</Text>
      )}
    </Pressable>
  );
}

interface MessageProps {
  type: 'erreur' | 'succes' | 'info' | 'avertissement';
  texte: string;
}

export function Message({ type, texte }: MessageProps): ReactElement {
  return (
    <View
      style={[
        styles.message,
        type === 'erreur' ? styles.messageErreur : null,
        type === 'succes' ? styles.messageSucces : null,
        type === 'info' ? styles.messageInfo : null,
        type === 'avertissement' ? styles.messageAvertissement : null,
      ]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.messageTexte}>{texte}</Text>
    </View>
  );
}

export function Chargement({ texte = 'Chargement…' }: { texte?: string }): ReactElement {
  return (
    <View style={styles.chargement} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={couleurs.primaire} />
      <Text style={styles.chargementTexte}>{texte}</Text>
    </View>
  );
}

interface EtatVideProps {
  titre: string;
  description?: string;
  action?: ReactNode;
}

export function EtatVide({ titre, description, action }: EtatVideProps): ReactElement {
  return (
    <View style={styles.etatVide}>
      <Text style={styles.etatVideTitre}>{titre}</Text>
      {description ? <Text style={styles.etatVideDescription}>{description}</Text> : null}
      {action}
    </View>
  );
}

export function Carte({ children }: { children: ReactNode }): ReactElement {
  return <View style={styles.carte}>{children}</View>;
}

interface LigneProps {
  label: string;
  valeur: string;
  action?: ReactNode;
}

export function Ligne({ label, valeur, action }: LigneProps): ReactElement {
  return (
    <View style={styles.ligne}>
      <View style={styles.ligneTexte}>
        <Text style={styles.ligneLabel}>{label}</Text>
        <Text style={styles.ligneValeur}>{valeur}</Text>
      </View>
      {action}
    </View>
  );
}

export function Badge({
  texte,
  ton = 'neutre',
}: {
  texte: string;
  ton?: 'neutre' | 'succes' | 'danger' | 'avertissement';
}): ReactElement {
  return (
    <View
      style={[
        styles.badge,
        ton === 'succes' ? styles.badgeSucces : null,
        ton === 'danger' ? styles.badgeDanger : null,
        ton === 'avertissement' ? styles.badgeAvertissement : null,
      ]}
    >
      <Text style={styles.badgeTexte}>{texte}</Text>
    </View>
  );
}

export function Lien({ titre, onPress }: { titre: string; onPress: () => void }): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.lien, pressed ? styles.lienPresse : null]}
    >
      <Text style={styles.lienTexte}>{titre}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: espacements.lg, paddingBottom: espacements.xxl, gap: espacements.lg },
  entete: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: espacements.md,
  },
  enteteTexte: { flex: 1, gap: espacements.xs },
  titre: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontSize: 15, lineHeight: 21, color: couleurs.texteSecondaire },
  champ: { gap: espacements.xs },
  label: { fontSize: 14, fontWeight: '600', color: couleurs.texte },
  saisie: {
    minHeight: tailles.champ,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayons.md,
    backgroundColor: couleurs.surface,
    paddingHorizontal: espacements.md,
    paddingVertical: espacements.sm,
    fontSize: 16,
    color: couleurs.texte,
  },
  saisieMultiligne: { minHeight: 96, textAlignVertical: 'top' },
  saisieErreur: { borderColor: couleurs.danger },
  saisieDesactivee: { backgroundColor: couleurs.neutreClair, color: couleurs.texteSecondaire },
  aide: { fontSize: 13, color: couleurs.texteSecondaire },
  erreurChamp: { fontSize: 13, color: couleurs.danger, fontWeight: '600' },
  bouton: {
    minHeight: tailles.cibleTactile,
    borderRadius: rayons.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacements.lg,
    paddingVertical: espacements.md,
    borderWidth: 1,
  },
  bouton_primaire: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
  bouton_secondaire: { backgroundColor: couleurs.surface, borderColor: couleurs.primaire },
  bouton_danger: { backgroundColor: couleurs.danger, borderColor: couleurs.danger },
  bouton_discret: { backgroundColor: 'transparent', borderColor: 'transparent' },
  boutonPresse: { opacity: 0.82 },
  boutonDesactive: { opacity: 0.5 },
  boutonTexte: { fontSize: 16, fontWeight: '700' },
  boutonTexte_primaire: { color: '#FFFFFF' },
  boutonTexte_secondaire: { color: couleurs.primaire },
  boutonTexte_danger: { color: '#FFFFFF' },
  boutonTexte_discret: { color: couleurs.primaire },
  message: { borderRadius: rayons.md, padding: espacements.md, borderWidth: 1 },
  messageErreur: { backgroundColor: couleurs.dangerClair, borderColor: couleurs.danger },
  messageSucces: { backgroundColor: couleurs.succesClair, borderColor: couleurs.succes },
  messageInfo: { backgroundColor: couleurs.primaireClair, borderColor: couleurs.primaire },
  messageAvertissement: {
    backgroundColor: couleurs.avertissementClair,
    borderColor: couleurs.avertissement,
  },
  messageTexte: { fontSize: 14, lineHeight: 20, color: couleurs.texte },
  chargement: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacements.md },
  chargementTexte: { color: couleurs.texteSecondaire, fontSize: 15 },
  etatVide: { alignItems: 'center', gap: espacements.sm, paddingVertical: espacements.xl },
  etatVideTitre: { fontSize: 17, fontWeight: '700', color: couleurs.texte },
  etatVideDescription: {
    fontSize: 14,
    color: couleurs.texteSecondaire,
    textAlign: 'center',
    lineHeight: 20,
  },
  carte: {
    backgroundColor: couleurs.surface,
    borderRadius: rayons.lg,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espacements.lg,
    gap: espacements.md,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacements.md,
    minHeight: 40,
  },
  ligneTexte: { flex: 1, gap: 2 },
  ligneLabel: { fontSize: 12, textTransform: 'uppercase', color: couleurs.texteSecondaire },
  ligneValeur: { fontSize: 15, color: couleurs.texte },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: rayons.pilule,
    paddingHorizontal: espacements.sm,
    paddingVertical: 2,
    backgroundColor: couleurs.neutreClair,
  },
  badgeSucces: { backgroundColor: couleurs.succesClair },
  badgeDanger: { backgroundColor: couleurs.dangerClair },
  badgeAvertissement: { backgroundColor: couleurs.avertissementClair },
  badgeTexte: { fontSize: 12, fontWeight: '700', color: couleurs.texte },
  lien: { minHeight: tailles.cibleTactile, justifyContent: 'center' },
  lienPresse: { opacity: 0.7 },
  lienTexte: { color: couleurs.primaire, fontSize: 15, fontWeight: '600' },
});
