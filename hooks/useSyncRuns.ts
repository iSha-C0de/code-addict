// hooks/useSyncRuns.ts
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function useSyncRuns() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected) {
        const stored = await AsyncStorage.getItem('offlineRuns');
        const runs = stored ? JSON.parse(stored) : [];

        if (runs.length > 0) {
          console.log(`🔄 Syncing ${runs.length} offline run(s)...`);
        }

        const successfullySynced: any[] = [];

        for (const run of runs) {
          try {
            const res = await fetch('https://makedarun-backend-2.onrender.com/api/runs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(run),
            });

            if (res.ok) {
              successfullySynced.push(run);
            } else {
              console.log('❌ Failed to sync run:', await res.text());
            }
          } catch (e) {
            console.log('❌ Sync error:', e);
          }
        }

        // Remove synced runs
        if (successfullySynced.length > 0) {
          const remaining = runs.filter(
            (r: any) => !successfullySynced.includes(r)
          );
          await AsyncStorage.setItem('offlineRuns', JSON.stringify(remaining));
          console.log(`✅ Synced ${successfullySynced.length} run(s).`);
        }
      }
    });

    return () => unsubscribe();
  }, []);
}
