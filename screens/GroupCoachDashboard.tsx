import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';

// --- Navigation Types ---
export type GroupStackParamList = {
  GroupCoachDashboard: undefined;
  GroupCreate: undefined;
  GroupEdit: { groupId: string; currentName: string };
  GroupMembers: { groupId: string; groupName: string };
};

type NavigationProp = NativeStackNavigationProp<GroupStackParamList>;

// --- Group Types ---
type Group = {
  _id: string;
  name: string;
  members: { _id: string; userName: string }[];
  createdAt?: string;
};

export default function GroupCoachDashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastTap, setLastTap] = useState<number | null>(null);
  const { user } = useUser();
  const navigation = useNavigation<NavigationProp>();

  const fetchGroups = async () => {
    try {
      const res = await fetch('https://makedarun-backend-2.onrender.com/api/groups/coach/groups', {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      Alert.alert('Error', 'Failed to fetch groups.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchGroups();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const handleDelete = (groupId: string, groupName: string) => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${groupName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`https://makedarun-backend-2.onrender.com/api/groups/${groupId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${user?.token}` },
              });
              setGroups((prev) => prev.filter((g) => g._id !== groupId));
            } catch (err) {
              console.error('Error deleting group:', err);
              Alert.alert('Error', 'Failed to delete group');
            }
          },
        },
      ]
    );
  };

  const handleDoubleTap = (groupId: string, groupName: string) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTap && now - lastTap < DOUBLE_PRESS_DELAY) {
      navigation.navigate('GroupMembers', { groupId, groupName });
    }
    setLastTap(now);
  };

  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0c4c7b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>My Groups</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          <Ionicons name="refresh" size={24} color={refreshing ? '#ccc' : '#0c4c7b'} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('GroupCreate')}
      >
        <Ionicons name="add" size={20} color="white" />
        <Text style={styles.createButtonText}>Create New Group</Text>
      </TouchableOpacity>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No groups yet</Text>
          <Text style={styles.emptyStateSubtext}>Create your first group to get started</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item._id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleDoubleTap(item._id, item.name)}
              activeOpacity={0.9}
            >
              <View style={styles.groupInfo}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('GroupEdit', {
                        groupId: item._id,
                        currentName: item.name,
                      })
                    }
                    style={styles.iconButton}
                  >
                    <Ionicons name="create-outline" size={20} color="#3498db" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item._id, item.name)}
                    style={styles.iconButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="people-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    {item.members.length} member{item.members.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>Created: {formatDate(item.createdAt)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    marginTop: 10,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    marginTop: 50,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0c4c7b',
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#0c4c7b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },
  cardDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    marginLeft: 6,
    color: '#666',
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
