import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { ExportRgpd } from '@secondevie/contracts';
import { Badge, Bouton, Carte, Chargement, Ecran, Entete, Message } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { messageErreur } from '../../src/services/erreurs';
import { CLES, ecrireSecret, lireSecret, supprimerSecret } from '../../src/services/stockage';
import { couleurs, espacements } from '../../src/theme';

const LIBELLES: Record<ExportRgpd['statut'], string> = {
  en_attente: 'En préparation',
  pret: 'Prêt à télécharger',
  echoue: 'Échec de la génération',
  expire: 'Lien expiré',
};

export default function Export(): ReactElement {
  const [exportRgpd, setExportRgpd] = useState<ExportRgpd | null>(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const consulter = useCallback(async (id: string) => {
    try {
      const statut = await api.consulterExport(id);
      setExportRgpd(statut);

      if (statut.statut === 'expire' || statut.statut === 'echoue') {
        await supprimerSecret(CLES.brouillon);
      }
    } catch {
      await supprimerSecret(CLES.brouillon);
      setExportRgpd(null);
    }
  }, []);

  useEffect(() => {
    let monte = true;

    lireSecret('secondevie.export').then(async (id) => {
      if (!monte) return;
      if (id) await consulter(id);
      if (monte) setChargement(false);
    });

    return () => {
      monte = false;
    };
  }, [consulter]);

  useEffect(() => {
    if (!exportRgpd || exportRgpd.statut !== 'en_attente') return;

    const minuteur = setInterval(() => {
      void consulter(exportRgpd.id);
    }, 3_000);

    return () => clearInterval(minuteur);
  }, [exportRgpd, consulter]);

  async function demander(): Promise<void> {
    setErreur(null);
    setEnvoi(true);

    try {
      const { exportId } = await api.demanderExport();
      await ecrireSecret('secondevie.export', exportId);
      const statut = await api.consulterExport(exportId);
      setExportRgpd(statut);
    } catch (error: unknown) {
      setErreur(messageErreur(error, 'Impossible de demander l’export.'));
    } finally {
      setEnvoi(false);
    }
  }

  function telecharger(): void {
    if (!exportRgpd?.urlSignee) return;
    void Linking.openURL(api.urlTelechargementExport(exportRgpd.urlSignee));
  }

  if (chargement) {
    return <Chargement texte="Recherche d’un export en cours…" />;
  }

  return (
    <Ecran>
      <Entete
        titre="Mes données"
        sousTitre="Export RGPD asynchrone. Le lien de téléchargement est valable 15 minutes."
      />

      {erreur ? <Message type="erreur" texte={erreur} /> : null}

      {exportRgpd ? (
        <Carte>
          <View style={styles.entete}>
            <Text style={styles.titre}>
              Export du {new Date(exportRgpd.creeLe).toLocaleString('fr-FR')}
            </Text>
            <Badge
              texte={LIBELLES[exportRgpd.statut]}
              ton={
                exportRgpd.statut === 'pret'
                  ? 'succes'
                  : exportRgpd.statut === 'en_attente'
                    ? 'avertissement'
                    : 'danger'
              }
            />
          </View>
          {exportRgpd.statut === 'en_attente' ? (
            <Text style={styles.texte}>
              La génération peut prendre quelques instants. Cette page se met à jour
              automatiquement.
            </Text>
          ) : null}
          {exportRgpd.statut === 'pret' ? (
            <>
              <Text style={styles.texte}>
                Votre archive contient vos données de compte, profil, adresses, appareils et
                vérifications. Elle ne contient aucun mot de passe ni jeton.
              </Text>
              <Bouton titre="Télécharger l’archive" onPress={telecharger} />
            </>
          ) : null}
          {exportRgpd.statut === 'expire' ? (
            <Text style={styles.texte}>
              Le lien a expiré. Demandez un nouvel export pour obtenir une archive récente.
            </Text>
          ) : null}
          {exportRgpd.statut === 'echoue' ? (
            <Text style={styles.texte}>
              La génération a échoué. Réessayez ; si le problème persiste, contactez le support.
            </Text>
          ) : null}
        </Carte>
      ) : (
        <Carte>
          <Text style={styles.titre}>Aucun export récent</Text>
          <Text style={styles.texte}>
            Vous pouvez demander une copie de vos données à tout moment. L’export est limité au
            périmètre M1 (compte et identité).
          </Text>
        </Carte>
      )}

      <Bouton
        titre={exportRgpd?.statut === 'en_attente' ? 'Préparation en cours…' : 'Demander un export'}
        onPress={demander}
        chargement={envoi}
        desactive={exportRgpd?.statut === 'en_attente'}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { gap: espacements.sm },
  titre: { fontSize: 17, fontWeight: '700', color: couleurs.texte },
  texte: { fontSize: 14, lineHeight: 21, color: couleurs.texteSecondaire },
});
