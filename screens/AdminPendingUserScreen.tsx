import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface User {
  _id: string;
  userName: string;
  role: string;
  emailAdd?: string;
  contactNum?: string;
  address?: string;
  group?: string;
  isApproved: boolean;
  createdAt: string;
}

type RoleFilter = 'all' | 'runner' | 'coach';

const BASE_URL = 'http://192.168.100.127:5000/api';

export default function AdminUserListScreen() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RoleFilter>('all');
  
  // Selection state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const [editForm, setEditForm] = useState({
    role: 'runner',
    emailAdd: '',
    contactNum: '',
    address: '',
    group: '',
    isApproved: false,
  });

  // Helper function to make authenticated requests
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const config: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      };

      console.log(`Making request to: ${url}`);
      console.log('Request config:', {
        method: config.method || 'GET',
        headers: config.headers,
        body: config.body ? 'Present' : 'None'
      });

      const response = await fetch(url, config);
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response headers:`, response.headers);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response: ${text}`);
      }

      if (!response.ok) {
        const errorMessage = data?.message || `HTTP error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error('Request error:', error);
      throw error;
    }
  };

  const fetchUsers = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      // First, try to get pending users specifically
      let users;
      try {
        users = await makeAuthenticatedRequest(`${BASE_URL}/users/pending`);
        console.log('Fetched pending users:', users);
      } catch (error) {
        console.log('Pending endpoint failed, trying all users:', error);
        // Fallback to all users and filter client-side
        const allUsersData = await makeAuthenticatedRequest(`${BASE_URL}/users`);
        users = allUsersData.filter((user: User) => !user.isApproved && user.role !== 'admin');
      }
      
      setAllUsers(users);
      filterUsers(users, activeFilter);
      
      // Clear selection if users changed
      setSelectedUsers(new Set());
    } catch (error) {
      console.error('Fetch users error:', error);
      Alert.alert(
        'Error', 
        `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterUsers = (users: User[], filter: RoleFilter) => {
    if (filter === 'all') {
      setFilteredUsers(users);
    } else {
      setFilteredUsers(users.filter(user => user.role === filter));
    }
  };

  const handleFilterChange = (filter: RoleFilter) => {
    setActiveFilter(filter);
    filterUsers(allUsers, filter);
    // Clear selection when filter changes
    setSelectedUsers(new Set());
  };

  // Selection functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedUsers(new Set());
    }
  };

  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      // If all are selected, deselect all
      setSelectedUsers(new Set());
    } else {
      // Select all filtered users
      setSelectedUsers(new Set(filteredUsers.map(user => user._id)));
    }
  };

  const getSelectedUserCount = () => selectedUsers.size;

  const isAllSelected = () => filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length;

  useEffect(() => {
    fetchUsers();
  }, []);

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role,
      emailAdd: user.emailAdd || '',
      contactNum: user.contactNum || '',
      address: user.address || '',
      group: user.group || '',
      isApproved: user.isApproved || false,
    });
    setModalVisible(true);
  };

  const updateEditForm = (field: keyof typeof editForm, value: string | boolean) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleApprove = async (userId: string) => {
    try {
      console.log(`Approving user: ${userId}`);
      
      const result = await makeAuthenticatedRequest(
        `${BASE_URL}/users/${userId}/approve`,
        {
          method: 'PUT',
        }
      );
      
      console.log('Approval result:', result);
      
      // Show success message
      Alert.alert('Success', result.message || 'User approved successfully');
      
      // Remove from selection if selected
      const newSelected = new Set(selectedUsers);
      newSelected.delete(userId);
      setSelectedUsers(newSelected);
      
      // Refresh the user list
      await fetchUsers();
      
    } catch (error) {
      console.error('Approval error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to approve user: ${errorMessage}`);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedUsers.size === 0) return;

    Alert.alert(
      'Batch Approve',
      `Are you sure you want to approve ${selectedUsers.size} selected user(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          onPress: async () => {
            try {
              const userIds = Array.from(selectedUsers);
              const promises = userIds.map(userId => 
                makeAuthenticatedRequest(`${BASE_URL}/users/${userId}/approve`, {
                  method: 'PUT',
                })
              );
              
              await Promise.all(promises);
              
              Alert.alert('Success', `${userIds.length} user(s) approved successfully`);
              setSelectedUsers(new Set());
              await fetchUsers();
              
            } catch (error) {
              console.error('Batch approval error:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert('Error', `Failed to approve users: ${errorMessage}`);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (userId: string) => {
    Alert.alert(
      'Reject User',
      'Are you sure you want to reject this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`Rejecting user: ${userId}`);
              
              const result = await makeAuthenticatedRequest(
                `${BASE_URL}/users/${userId}`,
                {
                  method: 'DELETE',
                }
              );
              
              console.log('Rejection result:', result);
              
              Alert.alert('Success', result.message || 'User rejected and removed');
              
              // Remove from selection if selected
              const newSelected = new Set(selectedUsers);
              newSelected.delete(userId);
              setSelectedUsers(newSelected);
              
              await fetchUsers();
              
            } catch (error) {
              console.error('Rejection error:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert('Error', `Failed to reject user: ${errorMessage}`);
            }
          },
        },
      ]
    );
  };

  const handleBatchReject = async () => {
    if (selectedUsers.size === 0) return;

    Alert.alert(
      'Batch Reject',
      `Are you sure you want to reject ${selectedUsers.size} selected user(s)? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject All',
          style: 'destructive',
          onPress: async () => {
            try {
              const userIds = Array.from(selectedUsers);
              const promises = userIds.map(userId => 
                makeAuthenticatedRequest(`${BASE_URL}/users/${userId}`, {
                  method: 'DELETE',
                })
              );
              
              await Promise.all(promises);
              
              Alert.alert('Success', `${userIds.length} user(s) rejected successfully`);
              setSelectedUsers(new Set());
              await fetchUsers();
              
            } catch (error) {
              console.error('Batch rejection error:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert('Error', `Failed to reject users: ${errorMessage}`);
            }
          },
        },
      ]
    );
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    
    try {
      console.log(`Updating user: ${selectedUser._id}`, editForm);
      
      const result = await makeAuthenticatedRequest(
        `${BASE_URL}/users/${selectedUser._id}`,
        {
          method: 'PUT',
          body: JSON.stringify(editForm),
        }
      );
      
      console.log('Update result:', result);
      
      Alert.alert('Success', 'User updated successfully');
      setModalVisible(false);
      await fetchUsers();
      
    } catch (error) {
      console.error('Update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to update user: ${errorMessage}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'runner':
        return 'person-outline';
      case 'coach':
        return 'barbell-outline';
      default:
        return 'person-outline';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'runner':
        return '#4CAF50';
      case 'coach':
        return '#FF9800';
      default:
        return '#666';
    }
  };

  const renderFilterButton = (filter: RoleFilter, label: string, count: number) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === filter && styles.activeFilterButton
      ]}
      onPress={() => handleFilterChange(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        activeFilter === filter && styles.activeFilterButtonText
      ]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.has(item._id);
    
    return (
      <TouchableOpacity
        style={[
          styles.card,
          selectionMode && isSelected && styles.selectedCard
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleSelectUser(item._id);
          }
        }}
        activeOpacity={selectionMode ? 0.7 : 1}
      >
        {selectionMode && (
          <View style={styles.selectionIndicator}>
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={isSelected ? '#0c4c7b' : '#ccc'}
            />
          </View>
        )}
        
        <View style={[styles.cardContent, selectionMode && styles.cardContentWithSelection]}>
          <View style={styles.cardHeader}>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Ionicons 
                  name={getRoleIcon(item.role)} 
                  size={20} 
                  color={getRoleColor(item.role)} 
                />
                <Text style={styles.userName}>{item.userName}</Text>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
                <Text style={styles.roleBadgeText}>{item.role.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.pendingStatus}>⏳ PENDING</Text>
          </View>

          <View style={styles.cardDetails}>
            {item.emailAdd && (
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={16} color="#666" />
                <Text style={styles.detailText}>{item.emailAdd}</Text>
              </View>
            )}
            {item.contactNum && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={16} color="#666" />
                <Text style={styles.detailText}>{item.contactNum}</Text>
              </View>
            )}
            {item.group && (
              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={16} color="#666" />
                <Text style={styles.detailText}>Group: {item.group}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.detailText}>Registered: {formatDate(item.createdAt)}</Text>
            </View>
          </View>

          {!selectionMode && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApprove(item._id)}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => openEditModal(item)}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleReject(item._id)}
              >
                <Ionicons name="close" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const runnerCount = allUsers.filter(user => user.role === 'runner').length;
  const coachCount = allUsers.filter(user => user.role === 'coach').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pending Approvals</Text>
        <Text style={styles.headerSubtitle}>
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} waiting for approval
        </Text>
      </View>

      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', allUsers.length)}
        {renderFilterButton('runner', 'Runners', runnerCount)}
        {renderFilterButton('coach', 'Coaches', coachCount)}
      </View>

      {/* Selection Controls */}
      <View style={styles.selectionControls}>
        <TouchableOpacity
          style={[styles.selectionButton, selectionMode && styles.activeSelectionButton]}
          onPress={toggleSelectionMode}
        >
          <Ionicons 
            name={selectionMode ? 'checkmark-done' : 'checkmark-circle-outline'} 
            size={20} 
            color={selectionMode ? '#fff' : '#0c4c7b'} 
          />
          <Text style={[
            styles.selectionButtonText,
            selectionMode && styles.activeSelectionButtonText
          ]}>
            {selectionMode ? `Selected (${getSelectedUserCount()})` : 'Select'}
          </Text>
        </TouchableOpacity>

        {selectionMode && (
          <>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={selectAllUsers}
            >
              <Ionicons 
                name={isAllSelected() ? 'checkmark-done-outline' : 'checkmark-outline'} 
                size={18} 
                color="#0c4c7b" 
              />
              <Text style={styles.selectAllButtonText}>
                {isAllSelected() ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>

            {getSelectedUserCount() > 0 && (
              <View style={styles.batchActions}>
                <TouchableOpacity
                  style={[styles.batchButton, styles.batchApproveButton]}
                  onPress={handleBatchApprove}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.batchButtonText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.batchButton, styles.batchRejectButton]}
                  onPress={handleBatchReject}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={styles.batchButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0c4c7b" />
          <Text style={styles.loadingText}>Loading pending users...</Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No pending approvals</Text>
          <Text style={styles.emptySubtext}>All users have been processed</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchUsers(true)}
              colors={['#0c4c7b']}
            />
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit User Details</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.roleSelector}>
                {['runner', 'coach'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      editForm.role === role && styles.selectedRoleOption
                    ]}
                    onPress={() => updateEditForm('role', role)}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      editForm.role === role && styles.selectedRoleOptionText
                    ]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                value={editForm.emailAdd}
                onChangeText={text => updateEditForm('emailAdd', text)}
                style={styles.input}
                placeholder="Enter email address"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Contact Number</Text>
              <TextInput
                value={editForm.contactNum}
                onChangeText={text => updateEditForm('contactNum', text)}
                style={styles.input}
                placeholder="Enter contact number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                value={editForm.address}
                onChangeText={text => updateEditForm('address', text)}
                style={styles.input}
                placeholder="Enter address"
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Group</Text>
              <TextInput
                value={editForm.group}
                onChangeText={text => updateEditForm('group', text)}
                style={styles.input}
                placeholder="Enter group name"
              />
            </View>

            <View style={styles.approvalToggle}>
              <Text style={styles.fieldLabel}>Approval Status</Text>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  editForm.isApproved ? styles.approvedToggle : styles.pendingToggle
                ]}
                onPress={() => updateEditForm('isApproved', !editForm.isApproved)}
              >
                <Ionicons
                  name={editForm.isApproved ? 'checkmark-circle' : 'time-outline'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.toggleButtonText}>
                  {editForm.isApproved ? 'Approved' : 'Pending'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleUpdate}
            >
              <Text style={styles.modalButtonText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0c4c7b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  activeFilterButton: {
    backgroundColor: '#0c4c7b',
    borderColor: '#0c4c7b',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  selectionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0c4c7b',
    backgroundColor: '#fff',
  },
  activeSelectionButton: {
    backgroundColor: '#0c4c7b',
  },
  selectionButtonText: {
    fontSize: 10,
    color: '#0c4c7b',
    fontWeight: '600',
    marginLeft: 6,
  },
  activeSelectionButtonText: {
    color: '#fff',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 1,
    paddingVertical: 6,
    marginLeft: 12,
  },
  selectAllButtonText: {
    fontSize: 10,
    color: '#0c4c7b',
    fontWeight: '500',
    marginLeft: 4,
  },
  batchActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  batchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginLeft: 4,
  },
  batchApproveButton: {
    backgroundColor: '#28a745',
  },
  batchRejectButton: {
    backgroundColor: '#dc3545',
  },
  batchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 5,
    marginVertical: 1,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#0c4c7b',
    backgroundColor: '#f8faff',
  },
  selectionIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardContentWithSelection: {
    paddingLeft: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginLeft: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  pendingStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fd7e14',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  cardDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  editButton: {
    backgroundColor: '#0c4c7b',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  closeButton: {
    padding: 4,
  },
  modalForm: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  roleSelector: {
    flexDirection: 'row',
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ced4da',
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedRoleOption: {
    backgroundColor: '#0c4c7b',
    borderColor: '#0c4c7b',
  },
  roleOptionText: {
    fontSize: 16,
    color: '#495057',
    fontWeight: '500',
  },
  selectedRoleOptionText: {
    color: '#fff',
  },
  approvalToggle: {
    marginTop: 10,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  approvedToggle: {
    backgroundColor: '#28a745',
  },
  pendingToggle: {
    backgroundColor: '#fd7e14',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  saveButton: {
    backgroundColor: '#0c4c7b',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButtonText: {
    color: '#495057',
  },
});