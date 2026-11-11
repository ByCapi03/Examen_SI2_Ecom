import React, { createContext, useContext, useState, useEffect } from 'react';
import { secureStorage } from '../storage/secureStorage';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await secureStorage.getItem('userToken');
        const storedUser = await secureStorage.getItem('userData');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error('Failed to load session from SecureStore', e);
      } finally {
        setLoading(false);
      }
    };
    loadStoredAuth();
  }, []);

  const login = async (newToken: string, newUser: User) => {
    try {
      await secureStorage.setItem('userToken', newToken);
      await secureStorage.setItem('userData', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
    } catch (e) {
      console.error('Failed to save session to SecureStore', e);
    }
  };

  const logout = async () => {
    try {
      await secureStorage.removeItem('userToken');
      await secureStorage.removeItem('userData');
      setToken(null);
      setUser(null);
    } catch (e) {
      console.error('Failed to delete session from SecureStore', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
