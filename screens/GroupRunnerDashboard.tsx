// GroupRunnerDashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useUser } from '../context/UserContext';
import * as Progress from 'react-native-progress';
import { MaterialIcons } from '@expo/vector-icons';

interface GroupMember {
  _id: string;
  userName: string;
  goal: number;
  progress: number;
  distanceLeft: number;
  percentCompleted: string;
  emailAdd?: string;
  contactNum?: string;
  address?: string;
}

const PRIMARY_COLOR = '#0c4c7b';

export default function GroupRunnerDashboard() {
  const { user } = useUser();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [coachName, setCoachName] = useState<string>('Unknown Coach');
  const [groupName, setGroupName] = useState<string>('Unknown Group');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroupMembers = async () => {
    if (!user?.group || !user.token) {
      setError("You haven't joined a group yet.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://makedarun-backend-2.onrender.com/api/groups/members/${encodeURIComponent(user.group)}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch');
      }

      const data = await response.json();
      setCoachName(data.coachName || 'Unknown Coach');
      setGroupName(data.groupName || user.group);

      const processedMembers = data.members.map((item: any) => ({
        _id: item.userId || item._id || '',
        userName: item.userName || 'Unknown',
        goal: Number(item.goal) || 1,
        progress: Number(item.progress) || 0,
        distanceLeft: Math.max((Number(item.goal) || 1) - (Number(item.progress) || 0), 0),
        percentCompleted:
          item.goal > 0 ? ((item.progress / item.goal) * 100).toFixed(1) + '%' : '0%',
        emailAdd: item.emailAdd || 'N/A',
        contactNum: item.contactNum || 'N/A',
        address: item.address || 'N/A',
      }));

      setMembers(processedMembers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroupMembers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroupMembers();
  };

  const toggleProfileExpansion = (memberId: string) => {
    setExpandedMember(expandedMember === memberId ? null : memberId);
  };

  const renderMember = ({ item }: { item: GroupMember }) => {
    const progressRatio = item.goal > 0 ? Math.min(item.progress / item.goal, 1) : 0;
    const isExpanded = expandedMember === item._id;

    return (
      <View style={styles.card}>
        <View style={styles.rowSpaceBetween}>
          <Text style={styles.name}>{item.userName}</Text>
        </View>

        <Text style={styles.details}>
          Goal: {item.goal} m | Progress: {item.progress.toFixed(2)} m
        </Text>
        <Text style={styles.remaining}>Remaining: {item.distanceLeft.toFixed(2)} m</Text>

        <Progress.Bar
          progress={progressRatio}
          width={null}
          height={10}
          color={PRIMARY_COLOR}
          unfilledColor="#dbeafe"
          borderWidth={0}
          borderRadius={8}
          style={{ marginTop: 8 }}
        />
        <Text style={styles.percentText}>{item.percentCompleted} Complete</Text>

        <TouchableOpacity onPress={() => toggleProfileExpansion(item._id)}>
          <Text style={styles.toggleText}>
            {isExpanded ? 'Hide Profile ▲' : 'Show Profile ▼'}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.profileBox}>
            <Text style={styles.profileItem}>📧 {item.emailAdd}</Text>
            <Text style={styles.profileItem}>📱 {item.contactNum}</Text>
            <Text style={styles.profileItem}>🏠 {item.address}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.groupText}>Group: {groupName}</Text>
          <Text style={styles.coachText}>Coach: {coachName}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh}>
          <MaterialIcons name="refresh" size={26} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.subText}>Loading group members...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item._id}
          renderItem={renderMember}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY_COLOR]} />
          }
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  groupText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  coachText: {
    fontSize: 16,
    color: '#475569',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748b',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  details: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  remaining: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  percentText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    textAlign: 'right',
  },
  toggleText: {
    marginTop: 8,
    textAlign: 'center',
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  profileBox: {
    marginTop: 10,
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  profileItem: {
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 4,
  },
});
