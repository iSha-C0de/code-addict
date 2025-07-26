import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  UrlTile,
  Region,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useUser } from '../context/UserContext';
import ApiService from '../services/apiService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LocationSubscription } from 'expo-location';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface Props extends NativeStackScreenProps<any, any> {}

// Updated constants for better accuracy
const MIN_DISTANCE = 10; // Reduced from 100 to 10 meters
const MAX_SPEED = 15; // Reduced from 20 to 15 km/h for more realistic running speeds
const MIN_ACCURACY = 10; // Minimum GPS accuracy in meters
const MIN_MOVEMENT_DISTANCE = 2; // Minimum distance between points in meters
const STATIONARY_TIME_THRESHOLD = 30000;
const GPS_SMOOTHING_WINDOW = 3; // Number of recent points to consider for smoothing

export default function RunFormScreen({ navigation }: Props) {
  const [recording, setRecording] = useState<boolean>(false);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [pace, setPace] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastMovementTime, setLastMovementTime] = useState<number>(0);
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [startLocationName, setStartLocationName] = useState<string>('');
  const [endLocationName, setEndLocationName] = useState<string>('');

  const locationWatcher = useRef<LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const lastLocationRef = useRef<LatLng | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const recentLocationsRef = useRef<Location.LocationObject[]>([]);
  const totalDistanceRef = useRef<number>(0); // Keep running total

  const { user, setUser } = useUser();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is required.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    })();

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    if (isOnline && user) {
      ApiService.testConnection().then(connected => {
        if (connected) {
          ApiService.syncOfflineRuns().catch(console.error);
        }
      });
    }

    return () => {
      unsubscribe();
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOnline, user]);

  useEffect(() => {
    if (recording && startTime) {
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setDuration(elapsed);
        
        // Use the ref value for real-time distance calculation
        const currentDistance = totalDistanceRef.current;
        if (currentDistance > 0) {
          const distanceKm = currentDistance / 1000;
          const elapsedHours = elapsed / 3600;
          const paceKmH = elapsedHours > 0 ? distanceKm / elapsedHours : 0;
          setPace(paceKmH);
        }

        if (lastMovementTime && (Date.now() - lastMovementTime) > STATIONARY_TIME_THRESHOLD) {
          setIsMoving(false);
        } else {
          setIsMoving(true);
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [recording, startTime, lastMovementTime]);

  // Enhanced location validation with GPS smoothing
  const validateAndSmoothLocation = (newLocation: Location.LocationObject): LatLng | null => {
    // Check GPS accuracy
    if (newLocation.coords.accuracy && newLocation.coords.accuracy > MIN_ACCURACY) {
      console.log(`Poor GPS accuracy: ${newLocation.coords.accuracy}m`);
      return null;
    }

    // Add to recent locations for smoothing
    recentLocationsRef.current.push(newLocation);
    if (recentLocationsRef.current.length > GPS_SMOOTHING_WINDOW) {
      recentLocationsRef.current.shift();
    }

    // If we don't have a previous location, accept this one
    if (!lastLocationRef.current || !lastUpdateTimeRef.current) {
      return {
        latitude: newLocation.coords.latitude,
        longitude: newLocation.coords.longitude,
      };
    }

    const timeDiff = (newLocation.timestamp - lastUpdateTimeRef.current) / 1000;
    if (timeDiff <= 0) return null;

    const distance = getDistanceFromLatLonInMeters(
      lastLocationRef.current.latitude,
      lastLocationRef.current.longitude,
      newLocation.coords.latitude,
      newLocation.coords.longitude
    );

    // Check minimum movement distance
    if (distance < MIN_MOVEMENT_DISTANCE) {
      return null;
    }

    // Check for realistic speed
    const speed = distance / timeDiff;
    const speedKmH = speed * 3.6;

    if (speedKmH > MAX_SPEED) {
      console.log(`Unrealistic speed detected: ${speedKmH.toFixed(2)} km/h`);
      return null;
    }

    // Apply GPS smoothing if we have enough points
    if (recentLocationsRef.current.length >= 2) {
      const smoothedLat = recentLocationsRef.current.reduce((sum, loc) => sum + loc.coords.latitude, 0) / recentLocationsRef.current.length;
      const smoothedLng = recentLocationsRef.current.reduce((sum, loc) => sum + loc.coords.longitude, 0) / recentLocationsRef.current.length;
      
      return {
        latitude: smoothedLat,
        longitude: smoothedLng,
      };
    }

    return {
      latitude: newLocation.coords.latitude,
      longitude: newLocation.coords.longitude,
    };
  };

  // Get location name using reverse geocoding
  const getLocationName = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const geocoded = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      
      if (geocoded && geocoded.length > 0) {
        const location = geocoded[0];
        const parts = [
          location.street,
          location.district || location.subregion,
          location.city,
        ].filter(Boolean);
        
        return parts.length > 0 ? parts.join(', ') : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }
    } catch (error) {
      console.log('Geocoding failed:', error);
    }
    
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  };

  const startRun = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to start tracking your run.');
      return;
    }

    setRecording(true);
    setRoute([]);
    setDistance(0);
    setDuration(0);
    setPace(0);
    setStartTime(Date.now());
    setLastMovementTime(Date.now());
    setIsMoving(true);
    setStartLocationName('');
    setEndLocationName('');

    // Reset tracking variables
    lastLocationRef.current = null;
    lastUpdateTimeRef.current = 0;
    totalDistanceRef.current = 0;
    recentLocationsRef.current = [];

    locationWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000, // Increased interval for better accuracy
        distanceInterval: 1, // Reduced distance interval
      },
      async (location) => {
        const validatedLocation = validateAndSmoothLocation(location);
        
        if (!validatedLocation) {
          return;
        }

        setRoute((prev: LatLng[]) => {
          const newRoute = [...prev, validatedLocation];
          
          // Calculate incremental distance
          if (newRoute.length > 1) {
            const lastPoint = prev[prev.length - 1];
            const incrementalDistance = getDistanceFromLatLonInMeters(
              lastPoint.latitude,
              lastPoint.longitude,
              validatedLocation.latitude,
              validatedLocation.longitude
            );
            
            // Add to total distance
            totalDistanceRef.current += incrementalDistance;
            setDistance(totalDistanceRef.current);
          }
          
          return newRoute;
        });

        // Get location names for start and end
        if (!startLocationName) {
          const startName = await getLocationName(validatedLocation.latitude, validatedLocation.longitude);
          setStartLocationName(startName);
        }

        setLastMovementTime(Date.now());
        lastLocationRef.current = validatedLocation;
        lastUpdateTimeRef.current = location.timestamp;

        const newRegion: Region = {
          latitude: validatedLocation.latitude,
          longitude: validatedLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setRegion(newRegion);
      }
    );
  };

  const stopMapTracking = () => {
    if (mapRef.current && region) {
      mapRef.current.animateToRegion({
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      }, 0);
    }
  };

  const stopRun = async () => {
    setRecording(false);
    
    if (locationWatcher.current) {
      locationWatcher.current.remove();
      locationWatcher.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    stopMapTracking();

    // Get end location name
    let finalEndLocationName = endLocationName;
    if (route.length > 0 && !finalEndLocationName) {
      const lastPoint = route[route.length - 1];
      finalEndLocationName = await getLocationName(lastPoint.latitude, lastPoint.longitude);
    }

    const finalDistance = totalDistanceRef.current;

    if (finalDistance < MIN_DISTANCE) {
      Alert.alert(
        'Run Too Short', 
        `Minimum distance of ${MIN_DISTANCE}m not reached. This run won't be saved.`
      );
      resetRunState();
      return;
    }

    if (!isMoving) {
      Alert.alert(
        'No Movement Detected', 
        'No significant movement detected during this run. It won\'t be saved.'
      );
      resetRunState();
      return;
    }

    const finalDurationMinutes = duration / 60;
    const finalDistanceKm = finalDistance / 1000;
    const finalDurationHours = finalDurationMinutes / 60;
    const finalPaceKmH = finalDurationHours > 0 && finalDistanceKm > 0 ? finalDistanceKm / finalDurationHours : 0;

    if (finalDistance <= 0 || finalDurationMinutes <= 0) {
      Alert.alert(
        'Invalid Run', 
        `Run must have distance and duration greater than 0.\nDistance: ${finalDistance}m, Duration: ${finalDurationMinutes.toFixed(2)} min`
      );
      resetRunState();
      return;
    }

    // Create location string combining start and end
    const locationString = startLocationName && finalEndLocationName 
      ? `${startLocationName} → ${finalEndLocationName}`
      : startLocationName || finalEndLocationName || undefined;

    const runData = {
      distance: parseFloat(finalDistance.toFixed(2)),
      duration: parseFloat(finalDurationMinutes.toFixed(2)),
      pace: parseFloat(finalPaceKmH.toFixed(2)),
      date: new Date().toISOString(),
      location: locationString,
      path: route,
    };

    try {
      if (isOnline && user) {
        await ApiService.createRun(runData);
        Alert.alert(
          'Run saved to server!', 
          `Distance: ${formatDistance(finalDistance)}\nDuration: ${formatTime(duration)}\nPace: ${formatPaceKmH(finalPaceKmH)}\nRoute: ${locationString || 'Unknown location'}`
        );
      } else {
        const offlineRun = {
          id: Date.now().toString(),
          ...runData,
          startLat: route[0]?.latitude,
          startLng: route[0]?.longitude,
          endLat: route[route.length - 1]?.latitude,
          endLng: route[route.length - 1]?.longitude,
        };

        const stored = await AsyncStorage.getItem('offlineRuns');
        const runs = stored ? JSON.parse(stored) : [];
        runs.push(offlineRun);
        await AsyncStorage.setItem('offlineRuns', JSON.stringify(runs));

        Alert.alert(
          !isOnline ? 'Run saved offline (no connection)' : 'Run saved offline!', 
          `Distance: ${formatDistance(finalDistance)}\nDuration: ${formatTime(duration)}\nPace: ${formatPaceKmH(finalPaceKmH)}\nRoute: ${locationString || 'Unknown location'}\n\nWill sync when online.`
        );
      }
    } catch (error) {
      const offlineRun = {
        id: Date.now().toString(),
        ...runData,
        startLat: route[0]?.latitude,
        startLng: route[0]?.longitude,
        endLat: route[route.length - 1]?.latitude,
        endLng: route[route.length - 1]?.longitude,
      };

      const stored = await AsyncStorage.getItem('offlineRuns');
      const runs = stored ? JSON.parse(stored) : [];
      runs.push(offlineRun);
      await AsyncStorage.setItem('offlineRuns', JSON.stringify(runs));

      Alert.alert(
        'Run saved offline', 
        `Failed to save to server: ${error instanceof Error ? error.message : 'Unknown error'}\n\nSaved locally instead. Will sync when connection is restored.`
      );
    }

    resetRunState();
  };

  const resetRunState = () => {
    setRoute([]);
    setDistance(0);
    setDuration(0);
    setPace(0);
    setStartTime(null);
    setIsMoving(false);
    setLastMovementTime(0);
    setStartLocationName('');
    setEndLocationName('');
    totalDistanceRef.current = 0;
    recentLocationsRef.current = [];
  };

  const getDistanceFromLatLonInMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371000;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg: number): number => deg * (Math.PI / 180);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${meters.toFixed(0)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPaceKmH = (paceKmH: number): string => {
    if (!paceKmH || paceKmH <= 0) return '-';
    return `${paceKmH.toFixed(1)} km/h`;
  };

  const handleLogin = () => navigation.navigate('Login');

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('role');
          setUser(null);
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const centerOnUser = () => {
    if (region && mapRef.current) {
      mapRef.current.animateToRegion(region, 1000);
    }
  };

  if (!region) return <Text style={{ marginTop: 50, textAlign: 'center' }}>Loading map...</Text>;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={region}
        showsUserLocation
        followsUserLocation={recording && mapReady}
        showsMyLocationButton={false}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={(newRegion) => {
          if (!recording) {
            setRegion(newRegion);
          }
        }}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {route.length > 1 && (
          <Polyline
            coordinates={route}
            strokeWidth={4}
            strokeColor="#0c4c7b"
            lineJoin="round"
            lineCap="round"
          />
        )}
        {route.length > 0 && (
          <Marker coordinate={route[0]} title="Start" pinColor="green" />
        )}
        {route.length > 0 && !recording && (
          <Marker
            coordinate={route[route.length - 1]}
            title="End"
            pinColor="red"
          />
        )}
      </MapView>

      <View style={[styles.connectionStatus, { backgroundColor: isOnline ? '#28a745' : '#dc3545' }]}>
        <Text style={styles.connectionText}>
          {isOnline ? '● Online' : '● Offline'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={user ? handleLogout : handleLogin}
        style={styles.loginBtn}
      >
        {user ? (
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.userName}</Text>
            <Ionicons name="log-out-outline" size={20} color="#0c4c7b" />
          </View>
        ) : (
          <View style={styles.loginInfo}>
            <Text style={styles.loginText}>Login</Text>
            <Ionicons name="log-in-outline" size={20} color="#0c4c7b" />
          </View>
        )}
      </TouchableOpacity>

      {recording && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{formatDistance(distance)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pace</Text>
            <Text style={styles.statValue}>{formatPaceKmH(pace)}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={recording ? stopRun : startRun}
        style={[styles.button, { backgroundColor: recording ? '#d9534f' : '#0c4c7b' }]}
      >
        <Text style={styles.buttonText}>{recording ? 'Stop' : 'Start'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={centerOnUser} style={styles.locationBtn}>
        <Ionicons name="locate" size={28} color="#0c4c7b" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20, marginTop:10, },
  map: { flex: 1 },
  connectionStatus: {
    position: 'absolute',
    top: 30,
    left: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loginBtn: {
    position: 'absolute',
    top: 30,
    right: 80,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 5,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 14, fontWeight: '600', color: '#0c4c7b' },
  loginText: { fontSize: 14, fontWeight: '600', color: '#0c4c7b' },
  statsContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-around',
    elevation: 5,
  },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#0c4c7b' },
  button: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 30,
  },
  buttonText: { color: '#fff', fontSize: 18 },
  locationBtn: {
    position: 'absolute',
    top: 30,
    right: 20,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 30,
    elevation: 5,
  },
});