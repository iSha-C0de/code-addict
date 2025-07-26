import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';


export default function LoginScreen({ navigation }: { navigation: any }) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setUser } = useUser();

  const handleLogin = async () => {
    console.log('🚀 Login started');

    if (!userName.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setLoading(true);
    console.log('⏳ Loading set to true');

    try {
      console.log('📡 Making fetch request...');
      const response = await fetch('https://makedarun-backend-2.onrender.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ userName, password }),
      });

      console.log('✅ Response received:', response.status, response.ok);

      const contentType = response.headers.get('content-type');
      console.log('📋 Content type:', contentType);

      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.log('❌ Non-JSON response:', text);
        throw new Error(text || 'Invalid server response');
      }

      console.log('🔍 Parsing JSON...');
      const data = await response.json();
      console.log('📄 Parsed data:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.log('❌ Response not OK:', data.message);
        throw new Error(data.message || `Login failed with status ${response.status}`);
      }

      if (!data.isApproved) {
        console.log('⏸️ Account not approved');
        Alert.alert('Account Not Approved', 'Your account is pending approval by an admin.');
        return;
      }

      if (!data._id || !data.userName || !data.role || !data.token) {
        console.log('❌ Missing required fields:', {
          _id: !!data._id,
          userName: !!data.userName,
          role: !!data.role,
          token: !!data.token
        });
        throw new Error('Invalid user data received from server');
      }

      console.log('💾 Storing data in AsyncStorage...');
      await AsyncStorage.multiSet([
        ['token', data.token],
        ['user', JSON.stringify(data)]
      ]);
      console.log('✅ AsyncStorage completed');

      console.log('👤 Setting user context...');
      setUser({
        _id: data._id,
        userName: data.userName,
        role: data.role,
        goal: data.goal ?? 1,
        group: data.group,
        emailAdd: data.emailAdd,
        contactNum: data.contactNum,
        address: data.address,
        token: data.token,
      });
      console.log('✅ User context set successfully');

      // 🚀 Role-based navigation
      console.log('📍 Navigating based on role...');
      if (data.role === 'admin') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'AdminTabs' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'UserTabs' }],
        });
      }

    } catch (err: unknown) {
      console.log('💥 Error caught:', err);
      let errorMessage = 'An unexpected error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
        console.error('Login error details:', err);
      }

      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network error - please check your connection';
      }

      Alert.alert('Login Failed', errorMessage);
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../assets/adaptive-icon.png')} // Adjust the path as needed
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>MakeDRun</Text>
          <Text style={styles.subtitle}>Track your runs, reach your goals</Text>
        </View>


        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              placeholder="Username"
              value={userName}
              onChangeText={setUserName}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              importantForAutofill="yes"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              importantForAutofill="yes"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={loading ? '#ccc' : '#666'}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
          >
            <Text style={[styles.registerText, loading && { color: '#ccc' }]}>
              Don't have an account? Register here
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  header: {
    alignItems: 'center',
    marginBottom: 40
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0c4c7b',
    marginTop: 10
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: '#fafafa',
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333'
  },
  eyeIcon: {
    padding: 5
  },
  loginButton: {
    backgroundColor: '#0c4c7b',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc'
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  registerText: {
    color: '#0c4c7b',
    textAlign: 'center',
    marginTop: 15,
  },
  logo: {
  width: 100,
  height: 100,
  marginBottom: 8,
},
});
