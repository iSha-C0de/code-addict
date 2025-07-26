import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Progress from 'react-native-progress';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useUser } from '../context/UserContext';
import ApiService from '../services/apiService';

const screenWidth = Dimensions.get('window').width;

interface Run {
  _id: string;
  distance: number;
  duration: number;
  location: string;
  date: string;
}

const RunStatsScreen = () => {
  const { user, tryAutoLogin } = useUser();
  const [runs, setRuns] = useState<Run[]>([]);
  const [goal, setGoal] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [showAll, setShowAll] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      fetchData();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, [fadeAnim])
  );

  const fetchData = async () => {
    try {
      setRefreshing(true);
      console.log('🔍 Starting fetchData in RunStatsScreen...');

      if (!user) {
        console.log('🚨 No user in context, attempting auto-login...');
        await tryAutoLogin();
        if (!user) {
          Alert.alert('Error', 'Please login again');
          return;
        }
      }

      const token = await AsyncStorage.getItem('token');
      console.log('🌐 Token:', token?.substring(0, 10) + '...');

      if (!token) {
        console.error('🚨 No token found');
        Alert.alert('Error', 'Please login again');
        return;
      }

      console.log('📡 Fetching runs...');
      const runData = await ApiService.getUserRuns();
      console.log('📦 Runs data:', runData);
      setRuns(runData);

      const totalDistance = runData.reduce((sum: number, run: Run) => sum + Number(run.distance), 0);
      setProgress(totalDistance);

      console.log('🌐 Fetching user profile...');
      const profileRes = await fetch(`http://192.168.100.127:5000/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('📡 Profile response status:', profileRes.status);
      const profileData = await profileRes.json();
      console.log('📦 Profile data:', profileData);

      if (!profileRes.ok) {
        throw new Error(`Failed to fetch profile: ${profileData.message || profileRes.status}`);
      }

      setGoal(profileData.goal && !isNaN(profileData.goal) ? Number(profileData.goal) : 1);

      console.log('💾 Updating progress:', totalDistance);
      const progressRes = await fetch(`http://192.168.100.127:5000/api/users/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: profileData._id, progress: totalDistance }),
      });
      console.log('📦 Progress update response:', await progressRes.json());
    } catch (err: any) {
      console.error('💥 Fetch error:', err);
      Alert.alert('Error', err.message || 'Failed to load data');
    } finally {
      setRefreshing(false);
      console.log('🏁 Fetch data completed');
    }
  };

  const onRefresh = async () => {
    await fetchData();
  };

  const RunItem = ({ item, fadeAnim }: { item: Run; fadeAnim: Animated.Value }) => {
    const pace = item.distance && item.duration ? (item.distance / 1000) / (item.duration / 60) : 0;
    
    return (
      <Animated.View style={[styles.runItem, { opacity: fadeAnim }]}>
        <View style={styles.runItemHeader}>
          <Icon name="place" size={18} color="#0c4c7b" />
          <Text style={styles.runText}>
            {item.location || 'No location data'}
          </Text>
        </View>
        <View style={styles.runDetails}>
          <View style={styles.runDetailItem}>
            <Icon name="directions-run" size={16} color="#4caf50" />
            <Text style={styles.runDetailText}>{item.distance} m</Text>
          </View>
          <View style={styles.runDetailItem}>
            <Icon name="timer" size={16} color="#4caf50" />
            <Text style={styles.runDetailText}>{item.duration} min</Text>
          </View>
          <View style={styles.runDetailItem}>
            <Icon name="speed" size={16} color="#4caf50" />
            <Text style={styles.runDetailText}>{pace.toFixed(1)} km/h</Text>
          </View>
          <View style={styles.runDetailItem}>
            <Icon name="calendar-today" size={16} color="#4caf50" />
            <Text style={styles.runDetailText}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderRunItem = ({ item }: { item: Run }) => <RunItem item={item} fadeAnim={fadeAnim} />;

  const generateChartData = () => {
    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];

    if (selectedPeriod === 'week') {
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        const label = day.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(label);
        const total = runs
          .filter((r) => new Date(r.date).toDateString() === day.toDateString())
          .reduce((sum, r) => sum + Number(r.distance), 0);
        data.push(total);
      }
    } else if (selectedPeriod === 'month') {
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - i * 7);
        const label = `Week ${4 - i}`;
        labels.push(label);
        const total = runs
          .filter((r) => {
            const runDate = new Date(r.date);
            const start = new Date(weekStart);
            const end = new Date(weekStart);
            end.setDate(start.getDate() + 6);
            return runDate >= start && runDate <= end;
          })
          .reduce((sum, r) => sum + Number(r.distance), 0);
        data.push(total);
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = month.toLocaleString('en-US', { month: 'short' });
        labels.push(label);
        const total = runs
          .filter((r) => {
            const runDate = new Date(r.date);
            return (
              runDate.getMonth() === month.getMonth() &&
              runDate.getFullYear() === month.getFullYear()
            );
          })
          .reduce((sum, r) => sum + Number(r.distance), 0);
        data.push(total);
      }
    }

    return {
      labels,
      datasets: [
        {
          data,
          strokeWidth: 2,
        },
      ],
    };
  };

  const progressPercentage = goal ? Math.min((progress / goal) * 100, 100) : 0;

  return (
    <FlatList
      data={showAll ? runs : runs.slice(0, 5)}
      keyExtractor={(item) => item._id}
      renderItem={renderRunItem}
      ListHeaderComponent={
        <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Your Running Journey</Text>

          <View style={styles.buttonContainer}>
            {['week', 'month', 'year'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && styles.activeButton,
                ]}
                onPress={() => setSelectedPeriod(period as any)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    selectedPeriod === period && styles.activeButtonText,
                  ]}
                >
                  {period[0].toUpperCase() + period.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.chartContainer}>
            <Text style={styles.subtitle}>Distance Over Time</Text>
            <LineChart
              data={generateChartData()}
              width={screenWidth - 50}
              height={220}
              yAxisSuffix=" km"
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#e0f7fa',
                backgroundGradientTo: '#80deea',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(0, 150, 136, ${opacity})`,
                labelColor: () => '#0c4c7b',
                propsForDots: {
                  r: '3',
                  strokeWidth: '2',
                  stroke: '#0c4c7b',
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressText}>
                Goal: <Text style={styles.bold}>{goal} m</Text>
              </Text>
              <Text style={styles.progressText}>
                Progress: <Text style={styles.bold}>{progress.toFixed(2)} m</Text>
              </Text>
              <Text style={styles.progressText}>
                Completion: <Text style={styles.bold}>{progressPercentage.toFixed(1)}%</Text>
              </Text>
            </View>
            <Progress.Circle
              size={100}
              progress={goal ? progress / goal : 0}
              showsText
              color="#0c4c7b"
              borderWidth={2}
              thickness={8}
              textStyle={styles.progressCircleText}
            />
          </View>

          <View style={styles.runHistoryHeader}>
            <Text style={styles.subtitle}>Run History</Text>
            {runs.length > 5 && (
              <TouchableOpacity
                style={styles.showAllButton}
                onPress={() => setShowAll(!showAll)}
              >
                <Text style={styles.showAllText}>
                  {showAll ? 'Show Less' : 'Show All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      }
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    paddingHorizontal: 10,
    paddingTop: 50,
    paddingBottom: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0c4c7b',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginVertical: 5,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTextContainer: {
    flex: 1,
    marginRight: 15,
  },
  progressText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  bold: {
    fontWeight: '700',
    color: '#0c4c7b',
  },
  progressCircleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4c7b',
  },
  runItem: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  runItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  runDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 24,
  },
  runDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  runText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 6,
    flex: 1, // Ensure text can take available space
  },
  runDetailText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  periodButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
  },
  activeButton: {
    backgroundColor: '#0c4c7b',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeButtonText: {
    color: '#fff',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    minHeight: 260,
  },
  chart: {
    borderRadius: 12,
    marginVertical: 10,
    paddingRight: 10,
    paddingLeft: 10,
  },
  runHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  showAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#0c4c7b',
    borderRadius: 20,
  },
  showAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RunStatsScreen;