// utils/syncRuns.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'http://192.168.100.127:5000/api/runs';

export const syncRuns = async () => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const token = await AsyncStorage.getItem('token');
  const storedRuns = await AsyncStorage.getItem('runs');
  const runs = storedRuns ? JSON.parse(storedRuns) : [];

  if (!runs.length) return;

  for (const run of runs) {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(run),
      });
    } catch (err) {
      console.log('Sync error:', err);
      return;
    }
  }

  await AsyncStorage.removeItem('runs');
};
