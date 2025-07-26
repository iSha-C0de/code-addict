import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  TextInput,
  SectionList,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Progress from 'react-native-progress';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface Member {
  _id: string;
  userName: string;
  goal: number;
  progress: number;
  distanceLeft: number;
  percentCompleted: string;
  role?: string;
  isApproved?: boolean;
  emailAdd?: string;
  contactNum?: string;
  address?: string;
}

interface Section {
  title: string;
  data: Member[];
}

export default function GroupMembersScreen({ route }: any) {
  const { groupName } = route.params;
  const [members, setMembers] = React.useState<Member[]>([]);
  const [sections, setSections] = React.useState<Section[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [coachName, setCoachName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = React.useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [expandedMember, setExpandedMember] = React.useState<string | null>(null);
  const [lastPress, setLastPress] = React.useState<number>(0);
  
  // Goal input modal state
  const [isGoalModalVisible, setIsGoalModalVisible] = React.useState(false);
  const [goalInputValue, setGoalInputValue] = React.useState('');
  const [selectedMemberNames, setSelectedMemberNames] = React.useState('');
  
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const itemsPerPage = 20;

  const isCoach = user?.role === 'coach';

  React.useEffect(() => {
    fetchGroupData();
  }, [groupName]);

  React.useEffect(() => {
    updateSections(members, searchQuery);
  }, [searchQuery, members]);

  const fetchGroupData = async () => {
    if (!groupName) {
      Alert.alert('Error', 'Missing group name');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        return;
      }

      const res = await fetch(
        `http://192.168.100.127:5000/api/groups/members/${encodeURIComponent(groupName)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setCoachName(data.coachName || 'Unknown Coach');

      const processedMembers = data.members.map((item: any) => {
        const goal = Number(item.goal) || 1;
        const progress = Number(item.progress) || 0;
        const distanceLeft = Math.max(goal - progress, 0);
        const percentCompleted = goal > 0 ? ((progress / goal) * 100).toFixed(1) + '%' : '0%';

        return {
          _id: item.userId || item._id || '',
          userName: item.userName || 'Unknown User',
          goal,
          progress,
          distanceLeft,
          percentCompleted,
          role: item.role || 'runner',
          isApproved: item.isApproved ?? false,
          emailAdd: item.emailAdd || '',
          contactNum: item.contactNum || '',
          address: item.address || '',
        };
      });

      setMembers(processedMembers);
      updateSections(processedMembers, searchQuery);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load group members';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSections = (membersList: Member[], query: string) => {
    const filtered = membersList.filter(member =>
      member.userName.toLowerCase().includes(query.toLowerCase())
    );

    const coaches = filtered.filter(member => member.role === 'coach');
    const runners = filtered.filter(member => member.role === 'runner');
    
    const newSections: Section[] = [];
    if (coaches.length > 0) {
      newSections.push({ title: 'Coaches', data: coaches });
    }
    if (runners.length > 0) {
      newSections.push({ title: 'Runners', data: runners });
    }

    setSections(newSections);
  };

  const handleLongPress = (memberId: string) => {
    if (!isCoach) return;
    setIsSelectionMode(true);
    setSelectedMembers(new Set([memberId]));
  };

  const handleMemberPress = (memberId: string) => {
    if (isSelectionMode && isCoach) {
      const newSelected = new Set(selectedMembers);
      if (newSelected.has(memberId)) {
        newSelected.delete(memberId);
      } else {
        newSelected.add(memberId);
      }
      setSelectedMembers(newSelected);
      if (newSelected.size === 0) {
        setIsSelectionMode(false);
      }
    }
  };

  const handleDoublePress = (memberId: string, memberName: string) => {
    if (isSelectionMode) return;
    navigation.navigate('RunHistory', { userId: memberId, userName: memberName });
  };

  const handleSelectAll = () => {
    if (selectedMembers.size === sections.reduce((sum, section) => sum + section.data.length, 0)) {
      setSelectedMembers(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedMembers(new Set(sections.flatMap(section => section.data.map(m => m._id))));
    }
  };

  const exitSelectionMode = () => {
    setSelectedMembers(new Set());
    setIsSelectionMode(false);
  };

  const showGoalInputDialog = () => {
    if (selectedMembers.size === 0) {
      Alert.alert('No Selection', 'Please select at least one member');
      return;
    }

    const memberNames = sections
      .flatMap(section => section.data)
      .filter(m => selectedMembers.has(m._id))
      .map(m => m.userName)
      .join(', ');

    setSelectedMemberNames(memberNames);
    setGoalInputValue('');
    setIsGoalModalVisible(true);
  };

  const handleGoalModalConfirm = () => {
    const numericGoal = parseFloat(goalInputValue);
    if (isNaN(numericGoal) || numericGoal <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive number for the goal.');
      return;
    }
    
    setIsGoalModalVisible(false);
    performBatchAction('resetGoals', numericGoal);
  };

  const handleGoalModalCancel = () => {
    setIsGoalModalVisible(false);
    setGoalInputValue('');
  };

  const performBatchAction = async (action: 'resetGoals' | 'deleteRuns' | 'removeMembers', newGoal?: number) => {
    if (selectedMembers.size === 0) return;

    const selectedMemberNames = sections
      .flatMap(section => section.data)
      .filter(m => selectedMembers.has(m._id))
      .map(m => m.userName)
      .join(', ');

    let actionText = '';
    let confirmText = '';
    
    switch (action) {
      case 'resetGoals':
        if (newGoal) {
          actionText = 'Set New Goal';
          confirmText = `Are you sure you want to set the goal to ${newGoal}m for: ${selectedMemberNames}?`;
        } else {
          showGoalInputDialog();
          return;
        }
        break;
      case 'deleteRuns':
        actionText = 'Delete Run History';
        confirmText = `Are you sure you want to delete all run history for: ${selectedMemberNames}? This action cannot be undone.`;
        break;
      case 'removeMembers':
        actionText = 'Remove Members';
        confirmText = `Are you sure you want to remove these members from the group: ${selectedMemberNames}?`;
        break;
    }

    Alert.alert(
      actionText,
      confirmText,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => executeBatchAction(action, newGoal),
        },
      ]
    );
  };

  const executeBatchAction = async (action: 'resetGoals' | 'deleteRuns' | 'removeMembers', newGoal?: number) => {
    setIsActionLoading(true);
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        return;
      }

      const selectedMemberIds = Array.from(selectedMembers);
      let endpoint = '';
      let method = 'POST';
      let body: any = {
        memberIds: selectedMemberIds,
        groupName: groupName,
      };

      switch (action) {
        case 'resetGoals':
          endpoint = 'http://192.168.100.127:5000/api/coach/reset-goals';
          if (newGoal !== undefined) {
            body.newGoal = newGoal;
          }
          break;
        case 'deleteRuns':
          endpoint = 'http://192.168.100.127:5000/api/coach/delete-runs';
          break;
        case 'removeMembers':
          endpoint = 'http://192.168.100.127:5000/api/coach/remove-members';
          break;
      }

      console.log('Making request to:', endpoint);
      console.log('Request body:', JSON.stringify(body, null, 2));

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
        }
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing success response:', parseError);
        result = { message: 'Action completed successfully' };
      }

      Alert.alert('Success', {
        resetGoals: `Goals have been set to ${newGoal}m successfully`,
        deleteRuns: 'Run history has been deleted successfully',
        removeMembers: 'Members have been removed successfully',
      }[action]);

      setSelectedMembers(new Set());
      setIsSelectionMode(false);

      // Refresh data
      await fetchGroupData();

    } catch (error) {
      console.error('Batch action error:', error);
      const message = error instanceof Error ? error.message : 'Action failed';
      Alert.alert('Error', message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
              Alert.alert('Error', 'Please login again');
              return;
            }

            const res = await fetch('http://192.168.100.127:5000/api/groups/leave', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });

            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
            }

            Alert.alert('Success', 'You have left the group');
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', 'Failed to leave group');
          }
        },
      },
    ]);
  };

  const toggleProfileExpansion = (memberId: string) => {
    if (isSelectionMode) return;
    setExpandedMember(expandedMember === memberId ? null : memberId);
  };

  const handlePress = (memberId: string, memberName: string) => {
    const currentTime = Date.now();
    const delta = currentTime - lastPress;

    if (delta < 300) {
      handleDoublePress(memberId, memberName);
    } else {
      handleMemberPress(memberId);
    }

    setLastPress(currentTime);
  };

  const renderMember = ({ item }: { item: Member }) => {
    const progressRatio = item.goal > 0 ? Math.min(item.progress / item.goal, 1) : 0;
    const isExpanded = expandedMember === item._id;
    const isSelected = selectedMembers.has(item._id);

    return (
      <TouchableWithoutFeedback
        onPress={() => handlePress(item._id, item.userName)}
        onLongPress={() => handleLongPress(item._id)}
      >
        <View style={[
          styles.memberCard,
          isSelected && styles.selectedCard,
          isSelectionMode && !isSelected && styles.dimmedCard
        ]}>
          {isSelectionMode && (
            <View style={styles.selectionIndicator}>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
          )}
          
          <View style={styles.memberHeader}>
            <View style={styles.avatar}>
              <Ionicons 
                name={item.role === 'coach' ? 'trophy' : 'person'} 
                size={24} 
                color={item.role === 'coach' ? '#f59e0b' : '#3b82f6'} 
              />
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.name}>{item.userName}</Text>
              <Text style={styles.statsText}>
                Goal: {item.goal} m | Progress: {item.progress.toFixed(1)} m
              </Text>
            </View>
            {!isSelectionMode && (
              <Text style={styles.percentText}>
                {item.percentCompleted}
              </Text>
            )}
          </View>

          <View style={styles.progressContainer}>
            <Progress.Bar
              progress={progressRatio}
              width={null}
              height={8}
              color={item.role === 'coach' ? '#f59e0b' : '#4CAF50'}
              unfilledColor="#e0e0e0"
              borderWidth={0}
              borderRadius={4}
            />
          </View>
          
          {!isSelectionMode && (
            <TouchableOpacity
              style={styles.profileToggle}
              onPress={() => toggleProfileExpansion(item._id)}
            >
              <Text style={styles.profileText}>
                Profile {isExpanded ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
          )}

          {isExpanded && !isSelectionMode && (
            <View style={styles.profileDetails}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Email:</Text>
                <Text style={styles.profileValue}>{item.emailAdd || 'N/A'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Contact:</Text>
                <Text style={styles.profileValue}>{item.contactNum || 'N/A'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Address:</Text>
                <Text style={styles.profileValue}>{item.address || 'N/A'}</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{groupName}</Text>
            <Text style={styles.subtitle}>Coach: {coachName}</Text>
          </View>
        </View>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
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

        {isSelectionMode && isCoach && (
          <View style={styles.selectionActions}>
            <TouchableOpacity 
              style={styles.selectAllButton} 
              onPress={handleSelectAll}
            >
              <Text style={styles.selectAllText}>
                {selectedMembers.size === sections.reduce((sum, section) => sum + section.data.length, 0) ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={exitSelectionMode}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isSelectionMode && isCoach && selectedMembers.size > 0 && (
        <View style={styles.actionBar}>
          <Text style={styles.selectedCount}>
            {selectedMembers.size} member{selectedMembers.size > 1 ? 's' : ''} selected
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.resetButton]}
              onPress={showGoalInputDialog}
              disabled={isActionLoading}
            >
              <Text style={styles.actionButtonText}>Set Goal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => performBatchAction('deleteRuns')}
              disabled={isActionLoading}
            >
              <Text style={styles.actionButtonText}>Delete Runs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={() => performBatchAction('removeMembers')}
              disabled={isActionLoading}
            >
              <Text style={styles.actionButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={styles.loadingText}>Loading group members...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setPage(1);
              fetchGroupData();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {!isLoading && !error && (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderItem={renderMember}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingBottom: 15 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No members found matching your search' : 'No members found in this group'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={itemsPerPage}
          maxToRenderPerBatch={itemsPerPage}
          windowSize={10}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      )}
      
      {user?.role === 'runner' && !isLoading && !isSelectionMode && (
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
          <Text style={styles.leaveButtonText}>Leave Group</Text>
        </TouchableOpacity>
      )}

      {isActionLoading && (
        <View style={styles.actionLoadingOverlay}>
          <View style={styles.actionLoadingContainer}>
            <ActivityIndicator size="large" color="#007BFF" />
            <Text style={styles.actionLoadingText}>Processing...</Text>
          </View>
        </View>
      )}

      {/* Goal Input Modal */}
      <Modal
        visible={isGoalModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleGoalModalCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Set New Goal</Text>
            <Text style={styles.modalMessage}>
              Enter the new goal (in meters) for: {selectedMemberNames}
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Enter goal in meters"
              value={goalInputValue}
              onChangeText={setGoalInputValue}
              keyboardType="numeric"
              autoFocus={true}
              placeholderTextColor="#64748b"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleGoalModalCancel}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleGoalModalConfirm}
              >
                <Text style={styles.modalConfirmButtonText}>Set Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: '#f8fafc' 
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
  subtitle: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: '#64748b' 
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
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
    height: 35,
    fontSize: 12,
    color: '#1e293b',
  },
  clearButton: {
    padding: 4,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  selectAllButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectAllText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  cancelButton: {
    backgroundColor: '#4b515aff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  actionBar: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  selectedCount: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#f59e0b',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  removeButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
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
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: { 
    color: '#dc2626', 
    textAlign: 'center', 
    marginBottom: 8,
    fontSize: 15,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  memberCard: {
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
  selectedCard: {
    borderColor: '#3b82f6',
    borderWidth: 1,
    backgroundColor: '#eff6ff',
  },
  dimmedCard: {
    opacity: 0.7,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  memberInfo: {
    flex: 1,
  },
  name: { 
    fontSize: 15, 
    fontWeight: '600',
    color: '#1e293b',
  },
  percentText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },
  statsText: {
    fontSize: 12,
    color: '#475569',
  },
  progressContainer: { 
    marginVertical: 6 
  },
  profileToggle: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  profileText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  profileDetails: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  profileLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  profileValue: {
    fontSize: 11,
    color: '#1e293b',
    flex: 2,
    textAlign: 'right',
  },
  leaveButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  leaveButtonText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 15 
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
  actionLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  actionLoadingContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionLoadingText: {
    marginTop: 8,
    fontSize: 15,
    color: '#64748b',
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
  // Modal styles for goal input
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 20,
    backgroundColor: '#f8fafc',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  modalConfirmButton: {
    backgroundColor: '#f59e0b',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});