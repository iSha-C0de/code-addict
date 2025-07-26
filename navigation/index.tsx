import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import RunFormScreen from '../screens/RunFormScreen';
import StatsScreen from '../screens/RunStatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegistrationScreen';

import GroupStack from './GroupsStack';
import { useUser } from '../context/UserContext';
import AdminNavigation from '../navigation/AdminTabs';
// Bottom tabs
const Tab = createBottomTabNavigator();

function AppTabs() {
  const { user } = useUser();
  const isRunner = user?.role === 'runner';
  const isCoach = user?.role === 'coach';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;
          if (route.name === 'Run') iconName = focused ? 'play-circle' : 'play-circle-outline';
          else if (route.name === 'Stats') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Groups') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0c4c7b',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Run" component={RunFormScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      {(isRunner || isCoach) && <Tab.Screen name="Groups" component={GroupStack} />}
      {(isRunner || isCoach) && <Tab.Screen name="Profile" component={ProfileScreen} />}
    </Tab.Navigator>
  );
}

// Auth stack
const AuthStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// ✅ FIXED: Root navigation
export default function RootNavigation() {
  const { user, isLoading } = useUser();

  console.log('🏠 RootNavigation render - User:', !!user, 'Role:', user?.role, 'Loading:', isLoading);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0c4c7b" />
      </View>
    );
  }

  if (!user) {
    console.log('🔑 Showing AuthNavigator');
    return <AuthNavigator />;
  }

  if (user.role === 'admin') {
    console.log('👑 Showing AdminNavigation');
    return <AdminNavigation />;
  }

  console.log('🏃 Showing AppTabs (Runner/Coach)');
  return <AppTabs />;
}
