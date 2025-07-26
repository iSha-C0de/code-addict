import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import * as Progress from 'react-native-progress';

interface Member {
  _id: string;
  userName: string;
  goal: number;
  progress: number;
  distanceLeft: number;
  percentCompleted: string;
}

export default function GroupMembersScreen({ route }: any) {
  const { groupName } = route.params;
  const [members, setMembers] = React.useState<Member[]>([]);
  const [coachName, setCoachName] = React.useState('');
  const { user, setUser } = useUser();
  const navigation = useNavigation<any>();

  React.useEffect(() => {
    const fetchGroupData = async () => {
      try {
        const res = await fetch(
          `https://makedarun-backend-2.onrender.com/api/groups/members/${groupName}`,
          {
            headers: {
              Authorization: `Bearer ${user?.token}`,
            },
          }
        );
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        console.log('Fetched members:', data.members);
        setCoachName(data.coachName);
        // Map userId to _id
        setMembers(
          data.members.map((item: any) => ({
            _id: item.userId,
            userName: item.userName,
            goal: item.goal,
            progress: item.progress,
            distanceLeft: item.distanceLeft,
            percentCompleted: item.percentCompleted,
          }))
        );
      } catch (error) {
        console.error('Failed to load group members:', error);
      }
    };
    fetchGroupData();
  }, [groupName]);

  const handleLeaveGroup = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            const res = await fetch('https://makedarun-backend-2.onrender.com/api/groups/leave', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${user?.token}`,
              },
            });
            if (res.ok) {
              setUser({ ...user!, group: undefined });
              navigation.goBack();
            }
          } catch (error) {
            console.error(error);
          }
        },
      },
    ]);
  };

  const renderMember = ({ item }: { item: Member }) => {
    const progressRatio = item.goal > 0 ? item.progress / item.goal : 0;

    return (
      <View style={styles.memberCard}>
        <Text style={styles.name}>{item.userName}</Text>
        <View style={styles.progressContainer}>
          <Progress.Bar
            progress={progressRatio}
            width={null}
            height={12}
            color="#4CAF50"
            unfilledColor="#e0e0e0"
            borderWidth={0}
            borderRadius={6}
          />
          <Text style={styles.progressText}>
            {item.progress.toFixed(2)} km / {item.goal} km ({item.percentCompleted})
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => {
              console.log('Navigating with member:', item);
              navigation.navigate('GroupMemberProfile', {
                member: {
                  _id: item._id,
                  userName: item.userName,
                  goal: item.goal,
                  progress: item.progress,
                  distanceLeft: item.distanceLeft,
                  percentCompleted: item.percentCompleted,
                },
              });
            }}
          >
            <Text style={styles.buttonText}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewButton}
            onPress={() =>
              navigation.navigate('RunHistory', {
                userId: item._id,
                userName: item.userName,
              })
            }
          >
            <Text style={styles.buttonText}>Runs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Group: {groupName}</Text>
      <Text style={styles.subtitle}>Coach: {coachName}</Text>

      <FlatList
        data={members}
        keyExtractor={(item) => item._id}
        renderItem={renderMember}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {user?.role === 'runner' && (
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
          <Text style={styles.leaveButtonText}>Leave Group</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#e6f4ffff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, fontWeight: '500', marginBottom: 10, color: '#555' },
  memberCard: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
  },
  name: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  progressContainer: { marginBottom: 8 },
  progressText: {
    marginTop: 4,
    fontSize: 13,
    color: '#333',
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  viewButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#007BFF',
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 13,
  },
  leaveButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f44336',
    alignItems: 'center',
  },
  leaveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});