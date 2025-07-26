import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useUser } from '../context/UserContext';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface GroupMember {
  _id: string;
  userName: string;
  progress: number;
  goal: number;
}

export default function GroupScreen() {
  const { user, setUser } = useUser();
  const [groupName, setGroupName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<GroupMember[]>([]);
  const [coachName, setCoachName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const token = user?.token;

  const handleJoinGroup = async () => {
    try {
      if (!token || !user?._id) throw new Error('Authentication required');

      const res = await fetch('https://makedarun-backend-2.onrender.com/api/groups/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ groupName, groupPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setUser({ ...user!, group: data.groupName });
      setGroupName('');
      setPassword('');
      Alert.alert('Success', 'Joined group successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const fetchGroupMembers = async () => {
    if (!user?.group || !token) return;
    try {
      setLoading(true);
      const res = await fetch(`https://makedarun-backend-2.onrender.com/api/groups/members/${encodeURIComponent(user.group)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch group members');

      setCoachName(data.coachName || '');
      const sorted = (data.members || []).sort((a: GroupMember, b: GroupMember) => {
        const aPct = a.goal ? a.progress / a.goal : 0;
        const bPct = b.goal ? b.progress / b.goal : 0;
        return bPct - aPct;
      });

      setMembers(sorted);
      setFilteredMembers(sorted);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      Alert.alert('Error', error.message || 'Could not fetch group members.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroupMembers();
    setRefreshing(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query) {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter((member) =>
        member.userName.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredMembers(filtered);
    }
  };

  const leaveGroup = async () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave the group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Leave',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This action cannot be undone. Confirm leaving the group?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const res = await fetch('https://makedarun-backend-2.onrender.com/api/groups/leave', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                      });

                      const data = await res.json();
                      if (!res.ok) throw new Error(data.message);

                      setUser({ ...user!, group: undefined });
                      setMembers([]);
                      setFilteredMembers([]);
                      setCoachName('');
                      Alert.alert('Left Group', 'You have successfully left the group.');
                    } catch (err: any) {
                      Alert.alert('Error', err.message);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (user?.group) {
      fetchGroupMembers();
    } else {
      setLoading(false);
    }
  }, [user?.group]);

  if (!user?.group) {
    return (
      <View style={styles.container}>
        <KeyboardAvoidingView
          style={styles.joinContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <MaterialIcons name="group" size={48} color="#fff" />
              </View>
            </View>
            
            <Text style={styles.welcomeTitle}>Join a Group</Text>
            <Text style={styles.welcomeSubtitle}>Connect with your team and track progress together</Text>
            
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Group Name</Text>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="groups" size={20} color="#0c4c7b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholder="Enter group name"
                    autoCapitalize="none"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="lock" size={20} color="#0c4c7b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter group password"
                    autoCapitalize="none"
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <MaterialIcons 
                      name={showPassword ? 'visibility-off' : 'visibility'} 
                      size={20} 
                      color="#0c4c7b" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.joinButton} onPress={handleJoinGroup}>
                <Text style={styles.joinButtonText}>Join Group</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.groupInfo}>
            <Text style={styles.groupTitle}>{user.group}</Text>
            <View style={styles.groupDetails}>
              {coachName ? <Text style={styles.coachName}>Coach: {coachName}</Text> : null}
              <Text style={styles.memberCount}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.leaveButton} onPress={leaveGroup}>
            <MaterialIcons name="exit-to-app" size={18} color="#FF3B30" />
            <Text style={styles.leaveButtonText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#0c4c7b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search members..."
          placeholderTextColor="#999"
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <MaterialIcons name="clear" size={20} color="#0c4c7b" style={styles.clearIcon} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0c4c7b" />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0c4c7b']}
              tintColor="#0c4c7b"
            />
          }
          renderItem={({ item, index }) => {
            const percentage = item.goal ? ((item.progress / item.goal) * 100) : 0;
            const isCurrentUser = item._id === user?._id;
            
            return (
              <View style={[styles.memberCard, isCurrentUser && styles.currentUserCard]}>
                <View style={styles.memberHeader}>
                  <View style={styles.rankContainer}>
                    <Text style={styles.rank}>{index + 1}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberDetails}>
                      <Text style={[styles.memberName, isCurrentUser && styles.currentUserName]}>
                        {item.userName}
                        {isCurrentUser && <Text style={styles.youLabel}> (You)</Text>}
                      </Text>
                      <Text style={styles.memberProgress}>
                        {Number(item.progress).toFixed(2)}/{Number(item.goal)} km
                      </Text>
                    </View>
                  </View>
                  <View style={styles.percentageContainer}>
                    <Text style={[styles.percentage, { color: percentage >= 100 ? '#34C759' : '#0c4c7b' }]}>
                      {percentage.toFixed(0)}%
                    </Text>
                  </View>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { 
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: percentage >= 100 ? '#34C759' : '#0c4c7b'
                        },
                      ]}
                    />
                  </View>
                  {percentage >= 100 && (
                    <MaterialIcons name="check-circle" size={14} color="#34C759" style={styles.completedIcon} />
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="group-off" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No members found' : 'No members yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search term' : 'Be the first to join this group!'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa',
    marginTop: 20,
  },
  
  // Join Form Styles
  joinContainer: {
    flex: 1,
  },
  formContainer: { 
    flexGrow: 1, 
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0c4c7b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0c4c7b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  welcomeTitle: { 
    fontSize: 28, 
    fontWeight: 'bold',
    color: '#0c4c7b',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: { 
    marginBottom: 8, 
    fontWeight: '600',
    color: '#0c4c7b',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    height: 50,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 4,
  },
  joinButton: {
    backgroundColor: '#0c4c7b',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0c4c7b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },

  // Group View Styles
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
  },
  groupTitle: { 
    fontSize: 22, 
    fontWeight: 'bold',
    color: '#0c4c7b',
    marginBottom: 4,
  },
  groupDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coachName: { 
    fontSize: 13, 
    color: '#666',
    fontWeight: '500',
  },
  memberCount: {
    fontSize: 13,
    color: '#0c4c7b',
    fontWeight: '600',
    backgroundColor: '#f0f6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  leaveButtonText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Search Bar Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  clearIcon: {
    padding: 4,
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
    color: '#666',
  },

  // List Styles
  list: { 
    padding: 16,
    paddingBottom: 32,
  },
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  currentUserCard: {
    borderColor: '#0c4c7b',
    borderWidth: 1.5,
    backgroundColor: '#f8fbff',
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rankContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0c4c7b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rank: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: { 
    fontSize: 15, 
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  currentUserName: {
    color: '#0c4c7b',
  },
  youLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0c4c7b',
  },
  memberProgress: { 
    fontSize: 12, 
    color: '#666',
  },
  percentageContainer: {
    alignItems: 'flex-end',
  },
  percentage: { 
    fontSize: 15, 
    fontWeight: 'bold',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#e1e5e9',
    borderRadius: 3,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  completedIcon: {
    marginLeft: 6,
  },
  
  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});