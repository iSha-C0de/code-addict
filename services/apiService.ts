import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

interface RunData {
  distance: number; // Distance in meters
  duration: number; // Duration in minutes
  pace?: number; // Pace in km/h
  location?: string; // Now stores "Start Location → End Location"
  date?: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  path?: Array<{ latitude: number; longitude: number }>;
}

interface OfflineRun {
  id: string;
  distance: number; // Distance in meters
  duration: number; // Duration in minutes
  pace: number; // Pace in km/h
  date: string;
  location?: string; // Location name string
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  path?: Array<{ latitude: number; longitude: number }>;
}

class ApiService {
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing connection to:', API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/auth/test`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      console.log('Test connection status:', response.status);
      return response.status < 500;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async createRun(runData: RunData): Promise<any> {
    try {
      // Enhanced validation with lower minimum distance
      if (!runData.distance || runData.distance < 10) {
        throw new Error(`Distance must be at least 10 meters, received: ${runData.distance} meters`);
      }
      if (!runData.duration || runData.duration <= 0) {
        throw new Error(`Duration must be greater than 0 minutes, received: ${runData.duration} minutes`);
      }

      // Validate pace if provided - more restrictive for accuracy
      if (runData.pace && (runData.pace > 15 || runData.pace < 0.5)) {
        throw new Error(`Pace of ${runData.pace} km/h is outside realistic running range (0.5-15 km/h)`);
      }

      // Enhanced path validation for better accuracy
      if (runData.path && runData.path.length > 1) {
        const calculatedDistance = this.calculatePathDistance(runData.path);
        const discrepancy = Math.abs(calculatedDistance - runData.distance) / runData.distance;
        
        // Stricter validation - 15% tolerance instead of 20%
        if (discrepancy > 0.15) {
          console.warn(`Distance discrepancy: reported=${runData.distance}m, calculated=${calculatedDistance.toFixed(2)}m`);
          // Still allow but log the discrepancy
        }
      }

      // Validate minimum duration for the distance (prevent unrealistic fast runs)
      const minimumDurationMinutes = runData.distance / 1000 / 15 * 60; // 15 km/h max speed = minimum time
      if (runData.duration < minimumDurationMinutes) {
        throw new Error(`Duration too short for distance. Minimum: ${minimumDurationMinutes.toFixed(2)} minutes for ${runData.distance}m`);
      }

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(runData),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage += `, message: ${errorData.message || 'Unknown error'}`;
        } catch {
          errorMessage += `, response: ${responseText}`;
        }
        throw new Error(errorMessage);
      }

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error('Error creating run:', error);
      throw error;
    }
  }

  private calculatePathDistance(path: Array<{ latitude: number; longitude: number }>): number {
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      distance += this.getDistanceFromLatLonInMeters(
        path[i-1].latitude,
        path[i-1].longitude,
        path[i].latitude,
        path[i].longitude
      );
    }
    return distance;
  }

  private getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async getUserRuns(): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/runs/myruns`, {
        method: 'GET',
        headers,
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error('Error fetching user runs:', error);
      throw error;
    }
  }

  async deleteRun(runId: string): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/runs/${runId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting run:', error);
      throw error;
    }
  }

  async syncOfflineRuns(): Promise<void> {
    try {
      const offlineRuns = await AsyncStorage.getItem('offlineRuns');
      if (!offlineRuns) return;

      const runs: OfflineRun[] = JSON.parse(offlineRuns);
      if (!Array.isArray(runs) || runs.length === 0) return;

      const syncedRunIds: string[] = [];

      for (const run of runs) {
        try {
          // Enhanced validation for offline runs
          if (!run.distance || run.distance < 10) {
            console.log(`Skipping invalid offline run: distance too short (${run.distance}m)`);
            continue;
          }
          if (!run.duration || run.duration <= 0) {
            console.log(`Skipping invalid offline run: invalid duration (${run.duration}m)`);
            continue;
          }

          // Check for realistic pace
          if (run.pace && (run.pace > 15 || run.pace < 0.5)) {
            console.log(`Skipping invalid offline run: unrealistic pace (${run.pace}km/h)`);
            continue;
          }

          const apiRunData: RunData = {
            distance: Number(run.distance),
            duration: Number(run.duration),
            pace: run.pace ? Number(run.pace) : undefined,
            date: run.date,
            location: run.location, // Now contains "Start → End" format
            path: run.path,
          };

          await this.createRun(apiRunData);
          syncedRunIds.push(run.id);
          console.log(`Successfully synced offline run: ${run.id}`);
        } catch (error) {
          console.error(`Failed to sync run ${run.id}:`, error);
        }
      }

      if (syncedRunIds.length > 0) {
        const remainingRuns = runs.filter((run: OfflineRun) => !syncedRunIds.includes(run.id));
        await AsyncStorage.setItem('offlineRuns', JSON.stringify(remainingRuns));
        console.log(`Synced ${syncedRunIds.length} offline runs, ${remainingRuns.length} remaining`);
      }
    } catch (error) {
      console.error('Error syncing offline runs:', error);
    }
  }
}

export default new ApiService();