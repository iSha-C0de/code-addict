import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

interface AuditLog {
  _id: string;
  action: string;
  performedBy: string;
  role: string;
  targetUserId: string;
  details: any;
  createdAt: string;
}

export default function AuditScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch('https://makedarun-backend-2.onrender.com/api/audit');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📋 Audit Logs</Text>
      <FlatList
        data={logs}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.logItem}>
            <Text style={styles.action}>
              {item.performedBy} ({item.role}) → {item.action}
            </Text>
            <Text style={styles.details}>
              Target: {item.targetUserId}
            </Text>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  logItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  action: { fontSize: 16, fontWeight: '600' },
  details: { fontSize: 14, color: '#555' },
  date: { fontSize: 12, color: '#999', marginTop: 4 },
});
