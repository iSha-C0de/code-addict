import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import GroupsScreen from '../screens/GroupsScreen';
import GroupCoachDashboard from '../screens/GroupCoachDashboard';
import GroupRunnerDashboard from '../screens/GroupRunnerDashboard';
import GroupCreateScreen from '../screens/GroupCreateScreen';
import GroupJoinScreen from '../screens/GroupJoinScreen';
import GroupMembersScreen from '../screens/GroupMembersScreen';
import GroupEditScreen from '../screens/GroupEditScreen';
import GroupMemberProfile from '../screens/GroupMemberProfile';
import RunHistoryScreen from '../screens/RunHistoryScreen';
import { useUser } from '../context/UserContext';

export type GroupStackParamList = {
  GroupsHome: undefined;
  GroupCoachDashboard: undefined;
  GroupRunnerDashboard: undefined;
  GroupJoin: undefined;
  GroupCreate: undefined;
  GroupEdit: {
    groupId: string;
    currentName: string;
  };
  GroupMembers: { groupName: string };
  GroupMemberProfile: { member: Member };
  RunHistory: { userId: string; userName?: string }; // Reverted to userId and userName
};

interface Member {
  _id: string;
  userName: string;
  goal?: number;
  progress?: number;
  distanceLeft?: number;
  percentCompleted?: string;
}

const Stack = createNativeStackNavigator<GroupStackParamList>();

export default function GroupStack() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0c4c7b" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GroupsHome" component={GroupsScreen} />
      <Stack.Screen name="GroupCoachDashboard" component={GroupCoachDashboard} />
      <Stack.Screen name="GroupRunnerDashboard" component={GroupRunnerDashboard} />
      <Stack.Screen name="GroupJoin" component={GroupJoinScreen} />
      <Stack.Screen name="GroupCreate" component={GroupCreateScreen} />
      <Stack.Screen name="GroupEdit" component={GroupEditScreen} />
      <Stack.Screen name="GroupMembers" component={GroupMembersScreen} />
      <Stack.Screen name="GroupMemberProfile" component={GroupMemberProfile} />
      <Stack.Screen name="RunHistory" component={RunHistoryScreen} />
    </Stack.Navigator>
  );
}