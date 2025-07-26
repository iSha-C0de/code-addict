import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  SectionList,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { GroupStackParamList } from '../navigation/GroupsStack';

type RunHistoryRouteProp = RouteProp<GroupStackParamList, 'RunHistory'>;

interface Run {
  _id: string;
  distance: number; // Distance in kilometers
  duration: number; // Duration in minutes
  location?: string; // Optional, can be coordinates or name
  date: string; // Date as string (parsed to Date for display)
  pace?: number; // Optional pace in min/km
  createdAt?: string;
  updatedAt?: string;
}

interface Section {
  title: string;
  data: Run[];
}

export default function RunHistoryScreen() {
  const route = useRoute<RunHistoryRouteProp>();
  const { userId, userName } = route.params;
  const navigation = useNavigation<any>();
  const [history, setHistory] = useState<Run[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const updateSections = (runs: Run[], query: string) => {
    const filtered = runs.filter(run => {
      const dateStr = new Date(run.date).toLocaleDateString();
      const location = run.location || '';
      return dateStr.toLowerCase().includes(query.toLowerCase()) || location.toLowerCase().includes(query.toLowerCase());
    });

    const groupedByMonth = filtered.reduce((acc, run) => {
      const date = new Date(run.date);
      const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      acc[monthYear].push(run);
      return acc;
    }, {} as Record<string, Run[]>);

    const newSections: Section[] = Object.entries(groupedByMonth)
      .map(([title, data]) => ({ title, data: data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }))
      .sort((a, b) => {
        const dateA = new Date(a.data[0].date);
        const dateB = new Date(b.data[0].date);
        return dateB.getTime() - dateA.getTime();
      });

    setSections(newSections);
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token');
        }
        const res = await fetch(`https://makedarun-backend-2.onrender.com/api/runs/user/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        setHistory(data);
        updateSections(data, searchQuery);
      } catch (err) {
        console.error('Error fetching run history:', err);
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to fetch run history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  useEffect(() => {
    updateSections(history, searchQuery);
  }, [searchQuery, history]);

  const RunItem = ({ item }: { item: Run }) => {
    return (
      <View style={styles.runCard}>
        <View style={styles.runHeader}>
          <Ionicons name="trail-sign" size={20} color="#3b82f6" style={styles.runIcon} />
          <View style={styles.runInfo}>
            <Text style={styles.runDate}>{new Date(item.date).toLocaleDateString()}</Text>
            <Text style={styles.runLocation}>
              {item.location || 'No location data'}
            </Text>
          </View>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{item.distance.toFixed(2)} m</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{item.duration} min</Text>
          </View>
          {item.pace && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pace</Text>
              <Text style={styles.statValue}>{(60 / item.pace).toFixed(2)} min/km</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section: { title } }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.loadingText}>Loading run history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{userName ? `${userName}'s Run History` : 'Run History'}</Text>
          </View>
        </View>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by date or location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#64748b"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No runs found matching your search' : 'No runs found'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <RunItem item={item} />}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingBottom: 15 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={itemsPerPage}
          maxToRenderPerBatch={itemsPerPage}
          windowSize={10}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  header: {
    marginTop: 50,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    marginLeft: 8,
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 15,
    color: '#1e293b',
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 15,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  runCard: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  runHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  runIcon: {
    marginRight: 8,
  },
  runInfo: {
    flex: 1,
  },
  runDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  runLocation: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flex: 1,
    minWidth: '30%',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  sectionHeader: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
});