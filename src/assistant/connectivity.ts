import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { AssistantMode } from './types';

export function useConnectivity(onlineEnabled: boolean): {
  isInternetAvailable: boolean;
  mode: AssistantMode;
} {
  const [isInternetAvailable, setIsInternetAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    const update = (state: NetInfoState) => {
      if (mounted) {
        setIsInternetAvailable(state.isConnected === true && state.isInternetReachable !== false);
      }
    };

    NetInfo.fetch().then(update).catch((error: unknown) => {
      console.error('Failed to read network state', error);
    });
    const unsubscribe = NetInfo.addEventListener(update);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    isInternetAvailable,
    mode: onlineEnabled && isInternetAvailable ? 'online' : 'offline',
  };
}
