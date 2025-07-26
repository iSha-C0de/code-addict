import { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { LinearGradient } from 'expo-linear-gradient';

interface UserProfile {
  _id: string;
  userName: string;
  role: string;
  emailAdd?: string;
  contactNum?: string;
  address?: string;
  group?: string;
  goal: number;
  progress: number;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  password?: string;
}

export default function ProfileScreen() {
  const { user, isLoading: contextLoading, tryAutoLogin, logout } = useUser();
  const [profile, setProfile] = useState<UserProfile>({
    _id: '',
    userName: '',
    role: '',
    emailAdd: '',
    contactNum: '',
    address: '',
    group: '',
    goal: 1,
    progress: 0,
    isApproved: false,
    createdAt: '',
    updatedAt: '',
    password: '',
  });
  const [newGoal, setNewGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        console.log('🔍 Starting profile fetch...');

        if (!user) {
          console.log('🚨 No user in context, attempting auto-login...');
          await tryAutoLogin();
          return;
        }

        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.log('🚨 No token found in AsyncStorage');
          Alert.alert('Error', 'Please login again');
          return;
        }

        console.log('🌐 Fetching profile with token:', token.substring(0, 10) + '...');
        const res = await fetch(`https://makedarun-backend-2.onrender.com/api/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('📡 Response status:', res.status);
        const data = await res.json();
        console.log('📦 Profile data received:', JSON.stringify(data, null, 2));

        if (!res.ok) {
          console.log('❌ Fetch failed:', data.message || 'Unknown error');
          throw new Error(data.message || 'Failed to fetch profile');
        }

        const profileData: UserProfile = {
          _id: data._id || '',
          userName: data.userName || '',
          role: data.role || '',
          emailAdd: data.emailAdd || '',
          contactNum: data.contactNum || '',
          address: data.address || '',
          group: data.group || '',
          goal: data.goal ?? 1,
          progress: data.progress ?? 0,
          isApproved: data.isApproved ?? false,
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || '',
          password: '',
        };

        setProfile(profileData);
        setNewGoal('');
        await AsyncStorage.setItem('user', JSON.stringify(profileData));
        console.log('✅ Profile set successfully:', profileData);
      } catch (err: any) {
        console.error('💥 Error fetching profile:', err);
        Alert.alert('Error', err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
        console.log('🏁 Fetch profile completed');
      }
    };

    fetchProfile();
  }, [user, tryAutoLogin]);

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const token = await AsyncStorage.getItem('token');

      if (!profile.userName) {
        Alert.alert('Error', 'Username cannot be empty');
        return;
      }
      if (profile.password && profile.password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters long');
        return;
      }

      const profileUpdate = {
        userName: profile.userName,
        emailAdd: profile.emailAdd,
        contactNum: profile.contactNum,
        address: profile.address,
        ...(profile.password && { password: profile.password }),
      };

      console.log('💾 Saving profile:', profileUpdate);
      const res = await fetch(`https://makedarun-backend-2.onrender.com/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileUpdate),
      });

      const data = await res.json();
      console.log('📦 Save profile response:', data);
      if (!res.ok) throw new Error(data.message);

      setProfile({ ...data, progress: data.progress ?? 0, password: '' });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: any) {
      console.error('💥 Error saving profile:', err);
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddGoal = async () => {
    try {
      setSavingGoal(true);
      const goalValue = parseFloat(newGoal);

      if (isNaN(goalValue) || goalValue <= 0) {
        Alert.alert('Error', 'Please enter a valid goal (must be greater than 0)');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      const updatedGoal = profile.goal + goalValue;

      console.log('🎯 Adding to goal:', goalValue, 'Current goal:', profile.goal, 'New total:', updatedGoal);
      const res = await fetch(`https://makedarun-backend-2.onrender.com/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ goal: updatedGoal }),
      });

      const data = await res.json();
      console.log('📦 Goal add response:', data);
      if (!res.ok) throw new Error(data.message);

      setProfile({ ...profile, goal: data.goal ?? 1, progress: data.progress ?? 0 });
      setNewGoal('');
      await AsyncStorage.setItem('user', JSON.stringify({ ...data, progress: data.progress ?? 0 }));
      Alert.alert('Success', `Goal updated to ${updatedGoal} m`);
    } catch (err: any) {
      console.error('💥 Error adding goal:', err);
      Alert.alert('Error', err.message || 'Failed to add goal');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            console.log('🚪 Logging out...');
            await logout();
            Alert.alert('Success', 'Logged out successfully');
          } catch (err: any) {
            console.error('💥 Error logging out:', err);
            Alert.alert('Error', err.message || 'Failed to log out');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDisplayValue = (value: string | boolean | undefined) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value || 'N/A';
  };

  const progressPercentage = profile.goal > 0 ? (profile.progress / profile.goal) * 100 : 0;

  if (loading || contextLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{profile.userName}</Text>
          <Text style={styles.userRole}>{profile.role}</Text>
        </View>

        {/* Progress Card
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Progress Overview</Text>
          <View style={styles.progressStats}>
            <Text style={styles.progressText}>
              {profile.progress.toFixed(1)} m / {profile.goal} m
            </Text>
            <Text style={styles.progressPercentage}>
              {progressPercentage.toFixed(0)}% Complete
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <LinearGradient
              colors={['#3b82f6', '#1d4ed8']}
              style={[styles.progressBar, { width: `${Math.min(progressPercentage, 100)}%` }]}
            />
          </View>
        </View> */}

        {/* Account Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(!isEditing)}
            >
              <Text style={styles.editButtonText}>
                {isEditing ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {!isEditing ? (
            <View style={styles.infoContainer}>
              <InfoRow label="Username" value={profile.userName} />
              <InfoRow label="Email" value={profile.emailAdd} />
              <InfoRow label="Phone" value={profile.contactNum} />
              <InfoRow label="Address" value={profile.address} />
              <InfoRow label="Group" value={profile.group} />
              <InfoRow 
                label="Status" 
                value={profile.isApproved ? "Approved" : "Pending"} 
              />
              <InfoRow label="Member Since" value={formatDate(profile.createdAt)} />
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  value={profile.userName}
                  onChangeText={(v) => setProfile({ ...profile, userName: v })}
                  style={styles.input}
                  placeholder="Enter your username"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  value={profile.password}
                  onChangeText={(v) => setProfile({ ...profile, password: v })}
                  style={styles.input}
                  placeholder="Leave empty to keep current"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  value={profile.emailAdd}
                  onChangeText={(v) => setProfile({ ...profile, emailAdd: v })}
                  style={styles.input}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  value={profile.contactNum}
                  onChangeText={(v) => setProfile({ ...profile, contactNum: v })}
                  style={styles.input}
                  placeholder="Enter your phone"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  value={profile.address}
                  onChangeText={(v) => setProfile({ ...profile, address: v })}
                  style={[styles.input, styles.textAreaInput]}
                  placeholder="Enter your address"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, savingProfile && styles.disabledButton]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Goal Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal Management</Text>
          
          <View style={styles.currentGoalContainer}>
            <Text style={styles.currentGoalLabel}>Current Goal</Text>
            <Text style={styles.currentGoalValue}>{profile.goal} m</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Add to Goal (m)</Text>
            <TextInput
              value={newGoal}
              onChangeText={setNewGoal}
              style={styles.input}
              placeholder="Enter additional meters"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={[styles.goalButton, savingGoal && styles.disabledButton]}
            onPress={handleAddGoal}
            disabled={savingGoal}
          >
            {savingGoal ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.goalButtonText}>Add Goal</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.disabledButton]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.logoutButtonText}>Logout</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper component for info rows
const InfoRow = ({ label, value }: { label: string; value: string | undefined }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || 'N/A'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    backgroundColor: '#0c4c7b',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0c4c7b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#bfdbfe',
    textTransform: 'capitalize',
  },
  progressCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4c7b',
    marginBottom: 12,
  },
  progressStats: {
    marginBottom: 12,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0c4c7b',
    marginBottom: 4,
  },
  progressPercentage: {
    fontSize: 14,
    color: '#0c4c7b',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop:20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4c7b',
  },
  editButton: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0c4c7b',
  },
  editButtonText: {
    color: '#0c4c7b',
    fontSize: 14,
    fontWeight: '500',
  },
  infoContainer: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  formContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textAreaInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#0c4c7b',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  currentGoalContainer: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentGoalLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  currentGoalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0c4c7b',
  },
  goalButton: {
    backgroundColor: '#0c4c7b',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  goalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#c51c1cac',
    marginHorizontal: 20,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  bottomSpacer: {
    height: 20,
  },
});