import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncRuns } from '../utils/syncRuns'; // adjust path if needed

export const useSyncOnConnect = () => {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        syncRuns();
      }
    });

    return () => unsubscribe();
  }, []);
};
