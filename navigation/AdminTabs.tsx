import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import AdminDashboard from '../screens/AdminPendingUserScreen';
import AdminUsersScreen from '../screens/AdminApprovedUserScreen';
import AdminAuditScreen from '../screens/AuditScreen';
import ProtectedRoute from './ProtectedRoute';

const Tab = createBottomTabNavigator();

// Logout function using context
const handleLogout = async (setUser: (user: any) => void) => {
  Alert.alert(
    'Logout',
    'Are you sure you want to logout?',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            console.log('Starting logout process...');
            
            // Clear user from context first to prevent unnecessary API calls
            console.log('Setting user to null...');
            setUser(null);
            
            // Then clear all stored data
            await AsyncStorage.multiRemove(['token', 'role', 'userData']);
            console.log('AsyncStorage cleared');
            console.log('Logout completed');
            
          } catch (error) {
            console.error('Error during logout:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            Alert.alert('Error', `Failed to logout. Please try again. ${errorMessage}`);
          }
        },
      },
    ],
    { cancelable: true }
  );
};

// Header logout button component
const LogoutButton = ({ setUser }: { setUser: (user: any) => void }) => (
  <TouchableOpacity
    onPress={() => handleLogout(setUser)}
    style={{
      marginRight: 15,
      padding: 8,
      borderRadius: 20,
      backgroundColor: '#fff',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    }}
  >
    <Ionicons name="log-out-outline" size={20} color="#dc3545" />
  </TouchableOpacity>
);

// Protected admin screen wrappers
function ProtectedAdminDashboard({ navigation }: any) {
  return (
    <ProtectedRoute navigation={navigation} requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  );
}

function ProtectedAdminUsers({ navigation }: any) {
  return (
    <ProtectedRoute navigation={navigation} requiredRole="admin">
      <AdminUsersScreen />
    </ProtectedRoute>
  );
}

function ProtectedAdminSettings({ navigation }: any) {
  return (
    <ProtectedRoute navigation={navigation} requiredRole="admin">
      <AdminAuditScreen />
    </ProtectedRoute>
  );
}

export default function AdminNavigation() {
  const { setUser } = useUser();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;
          if (route.name === 'Pending') {
            iconName = focused ? 'hourglass' : 'hourglass-outline';
          } else if (route.name === 'Users') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0c4c7b',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#0c4c7b',
          elevation: 4,
          shadowOpacity: 0.3,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
        headerRight: () => <LogoutButton setUser={setUser} />,
      })}
    >
      <Tab.Screen 
        name="Pending" 
        component={ProtectedAdminDashboard}
        options={{ headerTitle: 'Pending Approvals' }}
      />
      <Tab.Screen 
        name="Users" 
        component={ProtectedAdminUsers}
        options={{ headerTitle: 'Manage Users' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={ProtectedAdminSettings}
        options={{ headerTitle: 'Settings & Audit' }}
      />
    </Tab.Navigator>
  );
}