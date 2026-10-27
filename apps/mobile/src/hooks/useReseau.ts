import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useReseau(): { horsLigne: boolean } {
  const [horsLigne, setHorsLigne] = useState(false);

  useEffect(() => {
    const desabonner = NetInfo.addEventListener((etat) => {
      setHorsLigne(etat.isConnected === false || etat.isInternetReachable === false);
    });

    return desabonner;
  }, []);

  return { horsLigne };
}
