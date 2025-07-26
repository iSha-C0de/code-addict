import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthUser {
  _id: string;
  userName: string;
  role: 'runner' | 'coach' | 'admin';
  goal: number;
  group?: string;
  emailAdd?: string;
  contactNum?: string;
  address?: string;
   token?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  isLoading: boolean;
  tryAutoLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isLoading: true,
  tryAutoLogin: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const tryAutoLogin = async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const role = await AsyncStorage.getItem('role');

      if (token && role) {
        const response = await fetch('https://makedarun-backend-2.onrender.com/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          if (response.ok) {
            const userData = await response.json();
            setUser({
              _id: userData._id,
              userName: userData.userName,
              role: userData.role,
              goal: userData.goal ?? 1,
              group: userData.group,
              emailAdd: userData.emailAdd,
              contactNum: userData.contactNum,
              address: userData.address,
              token,
            });
          } else {
            await AsyncStorage.multiRemove(['token', 'role']);
            setUser(null);
          }
        } else {
          await AsyncStorage.multiRemove(['token', 'role']);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auto-login failed:', error);
      await AsyncStorage.multiRemove(['token', 'role']);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    tryAutoLogin();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, tryAutoLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
