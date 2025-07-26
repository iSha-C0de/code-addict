// RunFormScreen.tsx
import { useEffect, useRef, useState } from 'react';
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
} from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';

export default function RunFormScreen({ navigation }: any) {
  const [recording, setRecording] = useState(false);
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [region, setRegion] = useState<any>(null);
  const [distance, setDistance] = useState(0); // in meters
  const [duration, setDuration] = useState(0); // in seconds
  const [pace, setPace] = useState(0); // in m/s
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<MapView | null>(null);
  
  const { user, setUser } = useUser();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is required.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    })();
  }, []);

  // Timer for duration
  useEffect(() => {
    if (recording && startTime) {
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setDuration(elapsed);
        
        // Calculate pace (m/s)
        if (distance > 0) {
          setPace(distance / elapsed);
        }
      }, 100); // Update every 100ms for smooth display
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording, startTime, distance]);

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('role');
            setUser(null);
            navigation.navigate('Login');
          },
        },
      ]
    );
  };

  const startRun = async () => {
    // Check if user is logged in before starting run
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

    locationWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 1000,
        distanceInterval: 2,
      },
      (location) => {
        const newPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        
        setRoute((prev) => {
          const newRoute = [...prev, newPoint];
          
          // Calculate distance in real-time
          if (newRoute.length > 1) {
            const totalDistance = calculateDistance(newRoute);
            setDistance(totalDistance);
          }
          
          return newRoute;
        });

        // Update region to follow user
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setRegion(newRegion);

        // Animate map to follow user
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      }
    );
  };

  const stopRun = async () => {
    setRecording(false);
    locationWatcher.current?.remove();
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const finalDistance = distance / 1000; // Convert to km for storage
    const finalDuration = duration / 60; // Convert to minutes for storage
    const finalPace = finalDuration / finalDistance; // min/km for storage

    const run = {
      id: Date.now().toString(),
      distance: parseFloat(finalDistance.toFixed(2)),
      duration: parseFloat(finalDuration.toFixed(2)),
      pace: parseFloat(finalPace.toFixed(2)),
      date: new Date().toISOString(),
      startLat: route[0]?.latitude,
      startLng: route[0]?.longitude,
      endLat: route[route.length - 1]?.latitude,
      endLng: route[route.length - 1]?.longitude,
      path: route,
    };

    const stored = await AsyncStorage.getItem('offlineRuns');
    const runs = stored ? JSON.parse(stored) : [];
    runs.push(run);
    await AsyncStorage.setItem('offlineRuns', JSON.stringify(runs));

    Alert.alert('Run saved!', `Distance: ${run.distance} km\nDuration: ${run.duration} mins`);
    setRoute([]);
    setDistance(0);
    setDuration(0);
    setPace(0);
  };

  const calculateDistance = (points: { latitude: number; longitude: number }[]) => {
    let dist = 0;
    for (let i = 1; i < points.length; i++) {
      dist += getDistanceFromLatLonInMeters(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      );
    }
    return dist;
  };

  const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Radius of the earth in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  };

  const deg2rad = (deg: number) => deg * (Math.PI / 180);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
        followsUserLocation={recording}
        showsMyLocationButton={false}
      >
        {/* OpenStreetMap tiles */}
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        
        {/* Route polyline */}
        {route.length > 1 && (
          <Polyline 
            coordinates={route} 
            strokeWidth={4} 
            strokeColor="#0c4c7b" 
            lineJoin="round"
            lineCap="round"
          />
        )}
        
        {/* Start marker */}
        {route.length > 0 && (
          <Marker
            coordinate={route[0]}
            title="Start"
            pinColor="green"
          />
        )}
        
        {/* End marker (only when not recording) */}
        {route.length > 0 && !recording && (
          <Marker
            coordinate={route[route.length - 1]}
            title="End"
            pinColor="red"
          />
        )}
      </MapView>

      {/* Login/Logout Button */}
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

      {/* Real-time Stats Display */}
      {recording && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{distance.toFixed(0)} m</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pace</Text>
            <Text style={styles.statValue}>{pace.toFixed(1)} m/s</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={recording ? stopRun : startRun}
        style={[styles.button, { backgroundColor: recording ? '#d9534f' : '#0c4c7b' }]}
      >
        <Text style={styles.buttonText}>{recording ? 'Stop' : 'Start'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={centerOnUser}
        style={styles.locationBtn}
      >
        <Ionicons name="locate" size={28} color="#0c4c7b" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  map: {
    flex: 1,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0c4c7b',
  },
  loginText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0c4c7b',
  },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0c4c7b',
  },
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