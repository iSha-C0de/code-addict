import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function RegisterScreen({ navigation }: any) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [emailAdd, setEmailAdd] = useState('');
  const [role, setRole] = useState('runner');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ userName: '', emailAdd: '', password: '' });

  const validateForm = () => {
    let isValid = true;
    const newErrors = { userName: '', emailAdd: '', password: '' };

    if (!userName.trim()) {
      newErrors.userName = 'Username is required';
      isValid = false;
    }
    if (!emailAdd.trim() || !emailAdd.match(/^\S+@\S+\.\S+$/)) {
      newErrors.emailAdd = 'Valid email is required';
      isValid = false;
    }
    if (!password || password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      Alert.alert('Error', 'Please fix the form errors');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('https://makedarun-backend-2.onrender.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, password, emailAdd, role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      Alert.alert('Success', 'Account created! Please wait for admin approval.');
      navigation.navigate('Login');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setUserName('');
    setPassword('');
    setEmailAdd('');
    setRole('runner');
    setErrors({ userName: '', emailAdd: '', password: '' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Username"
          style={[styles.input, errors.userName ? styles.inputError : null]}
          value={userName}
          onChangeText={setUserName}
          autoCapitalize="none"
        />
        {errors.userName ? <Text style={styles.errorText}>{errors.userName}</Text> : null}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Email"
          style={[styles.input, errors.emailAdd ? styles.inputError : null]}
          value={emailAdd}
          onChangeText={setEmailAdd}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.emailAdd ? <Text style={styles.errorText}>{errors.emailAdd}</Text> : null}
      </View>

      <View style={styles.inputContainer}>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            style={[styles.input, styles.passwordInput, errors.password ? styles.inputError : null]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={24} color="#666" />
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
      </View>

      <Text style={styles.label}>Select Role</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={role}
          onValueChange={(itemValue) => setRole(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Runner" value="runner" />
          <Picker.Item label="Coach" value="coach" />
        </Picker>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelButtonText}>Clear</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f7fa',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
    color: '#1a2a44',
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    padding: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a2a44',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  button: {
    backgroundColor: '#0c4c7b',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 5,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#1a2a44',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
});