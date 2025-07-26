import { useEffect, useState } from 'react';
import { Text, View, ScrollView, StyleSheet } from 'react-native';
import axios from 'axios';

export default function UsersScreen() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    axios.get('http://192.168.100.127:5000/api/users')
      .then(res => setUsers(res.data))
      .catch(console.error);
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Users</Text>
      {users.map((u: any) => (
        <Text key={u._id} style={styles.item}>{u.userName}</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  item: { fontSize: 18, marginBottom: 8 }
});
