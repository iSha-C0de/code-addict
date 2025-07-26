import React, { useEffect, useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';

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

export default function ApprovedUsersScreen() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editForm, setEditForm] = useState({
    role: 'runner',
    emailAdd: '',
    contactNum: '',
    address: '',
    group: '',
    isApproved: true,
  });

  const fetchUsers = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch('http://192.168.100.127:5000/api/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      
      // Only show approved users (excluding admins)
      const approvedUsers = data.filter((user: User) => user.isApproved && user.role !== 'admin');
      
      setAllUsers(approvedUsers);
      applyFilters(approvedUsers, activeFilter, searchQuery);
    } catch (error) {
      console.log('Fetch error:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = (users: User[], roleFilter: RoleFilter, search: string) => {
    let filtered = users;

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(user => 
        user.userName.toLowerCase().includes(searchLower) ||
        user.emailAdd?.toLowerCase().includes(searchLower) ||
        user.contactNum?.toLowerCase().includes(searchLower) ||
        user.address?.toLowerCase().includes(searchLower) ||
        user.group?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredUsers(filtered);
  };

  const handleFilterChange = (filter: RoleFilter) => {
    setActiveFilter(filter);
    applyFilters(allUsers, filter, searchQuery);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    applyFilters(allUsers, activeFilter, query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    applyFilters(allUsers, activeFilter, '');
  };

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [])
  );

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
      isApproved: user.isApproved,
    });
    setModalVisible(true);
  };

  const updateEditForm = (field: keyof typeof editForm, value: string | boolean) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSuspend = async (userId: string) => {
    Alert.alert(
      'Suspend User',
      'Are you sure you want to suspend this user? They will lose access until re-approved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const res = await fetch(`http://192.168.100.127:5000/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ isApproved: false }),
              });
              
              if (!res.ok) {
                const errorData = await res.text();
                console.log('Suspend error response:', errorData);
                throw new Error(`Suspension failed: ${res.status}`);
              }
              
              // Refresh the list to remove the suspended user
              fetchUsers();
              
              Alert.alert('Success', 'User has been suspended');
            } catch (error) {
              console.log('Suspension error:', error);
              Alert.alert('Error', 'Failed to suspend user');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (userId: string) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to permanently delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const res = await fetch(`http://192.168.100.127:5000/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              
              if (!res.ok) {
                const errorData = await res.text();
                console.log('Delete error response:', errorData);
                throw new Error(`Deletion failed: ${res.status}`);
              }
              
              // Remove from local state immediately
              const updatedUsers = allUsers.filter(user => user._id !== userId);
              setAllUsers(updatedUsers);
              applyFilters(updatedUsers, activeFilter, searchQuery);
              
              Alert.alert('Success', 'User deleted successfully');
            } catch (error) {
              console.log('Delete error:', error);
              Alert.alert('Error', 'Failed to delete user');
              fetchUsers();
            }
          },
        },
      ]
    );
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`http://192.168.100.127:5000/api/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      
      if (!res.ok) {
        const errorData = await res.text();
        console.log('Update error response:', errorData);
        throw new Error(`Update failed: ${res.status}`);
      }
      
      Alert.alert('Success', 'User updated successfully');
      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.log('Update error:', error);
      Alert.alert('Error', 'Failed to update user');
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

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.card}>
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
        <View style={styles.approvedStatus}>
          <Ionicons name="checkmark-circle" size={16} color="#28a745" />
          <Text style={styles.approvedStatusText}>APPROVED</Text>
        </View>
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
        {item.address && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{item.address}</Text>
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
          <Text style={styles.detailText}>Joined: {formatDate(item.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.suspendButton]}
          onPress={() => handleSuspend(item._id)}
        >
          <Ionicons name="pause-circle-outline" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Suspend</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item._id)}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const runnerCount = allUsers.filter(user => user.role === 'runner').length;
  const coachCount = allUsers.filter(user => user.role === 'coach').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Approved Users</Text>
        <Text style={styles.headerSubtitle}>
          {filteredUsers.length} active user{filteredUsers.length !== 1 ? 's' : ''} in the system
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, phone, address, or group..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', allUsers.length)}
        {renderFilterButton('runner', 'Runners', runnerCount)}
        {renderFilterButton('coach', 'Coaches', coachCount)}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0c4c7b" />
          <Text style={styles.loadingText}>Loading approved users...</Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No users found' : 'No approved users'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery 
              ? `No users match "${searchQuery}"` 
              : activeFilter === 'all' 
                ? 'No users have been approved yet' 
                : `No approved ${activeFilter}s found`}
          </Text>
          {searchQuery && (
            <TouchableOpacity style={styles.clearSearchButton} onPress={clearSearch}>
              <Text style={styles.clearSearchButtonText}>Clear search</Text>
            </TouchableOpacity>
          )}
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
                numberOfLines={3}
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
                  editForm.isApproved ? styles.approvedToggle : styles.suspendedToggle
                ]}
                onPress={() => updateEditForm('isApproved', !editForm.isApproved)}
              >
                <Ionicons
                  name={editForm.isApproved ? 'checkmark-circle' : 'pause-circle'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.toggleButtonText}>
                  {editForm.isApproved ? 'Approved' : 'Suspended'}
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
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
  },
  clearButton: {
    marginLeft: 10,
    padding: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  clearSearchButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0c4c7b',
    borderRadius: 20,
  },
  clearSearchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
  approvedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  approvedStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#155724',
    marginLeft: 4,
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  editButton: {
    backgroundColor: '#0c4c7b',
  },
  suspendButton: {
    backgroundColor: '#fd7e14',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
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
    textAlignVertical: 'top',
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
  suspendedToggle: {
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