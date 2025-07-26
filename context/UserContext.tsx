import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthUser {
  _id: string;
  userName: string;
  role: 'runner' | 'coach' | 'admin';
  goal: number;
  group?: string; // Store group name directly
  emailAdd?: string;
  contactNum?: string;
  address?: string;
  token: string;
}

interface UserContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  isLoading: boolean;
  logout: () => Promise<void>;
  tryAutoLogin: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  isLoading: true,
  logout: async () => {},
  tryAutoLogin: async () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  console.log('🏗️ UserProvider component mounted/re-rendered');

  const logout = useCallback(async () => {
    console.log('🚪 Logout initiated');
    try {
      await AsyncStorage.multiRemove(['token', 'user', 'role']);
      setUser(null);
      console.log('✅ Logout completed');
    } catch (error) {
      console.error('💥 Failed to logout:', error);
      setUser(null);
    }
  }, []);

  const tryAutoLogin = useCallback(async () => {
    console.log('🔄 tryAutoLogin started');
    setIsLoading(true);

    try {
      console.log('📱 Attempting to get user and token from AsyncStorage...');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AsyncStorage timeout')), 5000)
      );

      const storagePromise = Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('role'),
      ]);

      const [storedUser, token, role] = await Promise.race([storagePromise, timeoutPromise]) as [
        string | null,
        string | null,
        string | null
      ];

      console.log('🔑 Token retrieved:', token ? 'EXISTS' : 'NULL');
      console.log('👤 Stored user retrieved:', storedUser ? 'EXISTS' : 'NULL');

      if (storedUser && token) {
        console.log('✅ Both user and token found, parsing and verifying...');
        try {
          const parsedUser = JSON.parse(storedUser);

          console.log('🔍 Verifying token with server...');
          const response = await fetch('http://192.168.100.127:5000/api/auth/verify', {
            headers: { Authorization: `Bearer ${token}` },
          });

          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            if (response.ok) {
              const userData = await response.json();

              const verifiedUser: AuthUser = {
                _id: userData._id,
                userName: userData.userName,
                role: userData.role,
                goal: userData.goal ?? 1,
                group: userData.group, // This is now the group name directly
                emailAdd: userData.emailAdd,
                contactNum: userData.contactNum,
                address: userData.address,
                token,
              };

              setUser(verifiedUser);
              console.log('✅ User verified and set successfully');
            } else {
              console.log('❌ Token verification failed, clearing storage');
              await logout();
            }
          } else {
            console.log('❌ Invalid response format, clearing storage');
            await logout();
          }
        } catch (parseError) {
          console.error('💥 Failed to parse user data or verify token:', parseError);
          await logout();
        }
      } else if (token && role) {
        console.log('🔄 No stored user but have token, attempting verification...');
        try {
          const response = await fetch('http://192.168.100.127:5000/api/auth/verify', {
            headers: { Authorization: `Bearer ${token}` },
          });

          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json') && response.ok) {
            const userData = await response.json();

            const verifiedUser: AuthUser = {
              _id: userData._id,
              userName: userData.userName,
              role: userData.role,
              goal: userData.goal ?? 1,
              group: userData.group, // This is now the group name directly
              emailAdd: userData.emailAdd,
              contactNum: userData.contactNum,
              address: userData.address,
              token,
            };

            setUser(verifiedUser);
            console.log('✅ User verified from token and set successfully');
          } else {
            console.log('❌ Token verification failed');
            await logout();
          }
        } catch (verifyError) {
          console.error('💥 Token verification failed:', verifyError);
          await logout();
        }
      } else {
        console.log('ℹ️ No stored user/token found, user remains null');
        setUser(null);
      }
    } catch (error) {
      console.error('💥 Failed to auto login:', error);
      setUser(null);
      try {
        await logout();
      } catch (logoutError) {
        console.error('💥 Logout also failed:', logoutError);
      }
    } finally {
      console.log('🏁 tryAutoLogin completed, setting loading to false');
      setIsLoading(false);
    }
  }, [logout]);

  const handleSetUser = useCallback(async (newUser: AuthUser | null) => {
    console.log('👤 handleSetUser called with:', newUser ? 'USER_DATA' : 'NULL');

    if (newUser) {
      try {
        console.log('💾 Saving user data to AsyncStorage...');
        await AsyncStorage.multiSet([
          ['token', newUser.token],
          ['user', JSON.stringify(newUser)],
          ['role', newUser.role],
        ]);
        console.log('✅ User data saved successfully');
      } catch (error) {
        console.error('💥 Failed to save user data:', error);
      }
    } else {
      try {
        await AsyncStorage.multiRemove(['token', 'user', 'role']);
      } catch (error) {
        console.error('💥 Failed to clear storage:', error);
      }
    }
    setUser(newUser);
    console.log('✅ User state updated');
  }, []);

  useEffect(() => {
    console.log('🚀 UserProvider useEffect triggered, calling tryAutoLogin...');

    tryAutoLogin().catch(error => {
      console.error('💥 tryAutoLogin failed in useEffect:', error);
      setIsLoading(false);
    });
  }, [tryAutoLogin]);

  useEffect(() => {
    if (isLoading) {
      console.log('⏲️ Safety timer started (8 seconds)');
      const safetyTimer = setTimeout(() => {
        if (isLoading) {
          console.log('🚨 SAFETY TIMEOUT: Forcing loading to false');
          setIsLoading(false);
          setUser(null);
        }
      }, 8000);

      return () => {
        console.log('🧹 Safety timer cleanup');
        clearTimeout(safetyTimer);
      };
    }
  }, [isLoading]);

  useEffect(() => {
    console.log('🎯 UserProvider state changed:', {
      hasUser: !!user,
      isLoading,
      userRole: user?.role,
      userName: user?.userName,
      group: user?.group,
    });
  }, [user, isLoading]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser: handleSetUser,
        isLoading,
        logout,
        tryAutoLogin,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const useAuth = useUser;