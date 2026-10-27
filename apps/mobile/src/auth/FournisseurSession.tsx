import type { ReactElement, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Moi, Session, UtilisateurSession } from '@secondevie/contracts';
import {
  abonnerSession,
  fermerSession,
  ouvrirSession,
  restaurerSession,
  utilisateurCourant,
} from '../services/api';

interface EtatSession {
  etat: 'chargement' | 'connecte' | 'deconnecte';
  utilisateur: UtilisateurSession | null;
  moi: Moi | null;
  connecter: (session: Session) => Promise<void>;
  deconnecter: () => Promise<void>;
  rafraichirMoi: (moi: Moi) => void;
}

const Contexte = createContext<EtatSession | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }): ReactElement {
  const [etat, setEtat] = useState<'chargement' | 'connecte' | 'deconnecte'>('chargement');
  const [utilisateur, setUtilisateur] = useState<UtilisateurSession | null>(null);
  const [moi, setMoi] = useState<Moi | null>(null);

  useEffect(() => {
    let monte = true;

    abonnerSession((valeur) => {
      if (!monte) return;
      setUtilisateur(valeur);
      if (!valeur) setMoi(null);
    });

    restaurerSession()
      .then((profil) => {
        if (!monte) return;
        setMoi(profil);
        setUtilisateur(utilisateurCourant());
        setEtat(profil ? 'connecte' : 'deconnecte');
      })
      .catch(() => {
        if (!monte) return;
        setEtat('deconnecte');
      });

    return () => {
      monte = false;
    };
  }, []);

  const connecter = useCallback(async (session: Session) => {
    await ouvrirSession(session);
    setUtilisateur(session.utilisateur);
    setEtat('connecte');
  }, []);

  const deconnecter = useCallback(async () => {
    await fermerSession();
    setUtilisateur(null);
    setMoi(null);
    setEtat('deconnecte');
  }, []);

  const rafraichirMoi = useCallback((profil: Moi) => {
    setMoi(profil);
    setUtilisateur((actuel) =>
      actuel
        ? {
            ...actuel,
            pseudo: profil.utilisateur.pseudo,
            emailVerifie: profil.utilisateur.emailVerifie,
            telephoneVerifie: profil.utilisateur.telephoneVerifie,
            kycLegerComplet: profil.utilisateur.kycLegerComplet,
            versionSecurite: profil.utilisateur.versionSecurite,
          }
        : actuel,
    );
  }, []);

  const valeur = useMemo<EtatSession>(
    () => ({ etat, utilisateur, moi, connecter, deconnecter, rafraichirMoi }),
    [etat, utilisateur, moi, connecter, deconnecter, rafraichirMoi],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): EtatSession {
  const valeur = useContext(Contexte);

  if (!valeur) {
    throw new Error('useSession doit être utilisé sous FournisseurSession');
  }

  return valeur;
}
