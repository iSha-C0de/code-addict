import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GroupStackParamList } from '../navigation/GroupsStack';
import { useUser } from '../context/UserContext';

type NavigationProp = NativeStackNavigationProp<GroupStackParamList>;

export default function GroupsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useUser(); 

  useEffect(() => {
    if (user?.role === 'coach') {
      navigation.replace('GroupCoachDashboard');
    } else if (user?.role === 'runner') {
      navigation.replace('GroupJoin');
    }
  }, [user]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
