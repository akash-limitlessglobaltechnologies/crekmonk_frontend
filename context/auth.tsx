import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import storage from '../utils/storage';
import api from '../services/api';

interface UserData {
  email: string;
  phone: string;
}

interface AuthContextData {
  userData: UserData | null;
  token: string | null;
  signIn: (data: { token: string; email: string; phone: string }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadStorageData();
  }, []);

  useEffect(() => {
    if (loading) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    
    if (token && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [token, segments, loading]);

  async function loadStorageData(): Promise<void> {
    try {
      const storedToken = await storage.getItem('userToken');
      const storedEmail = await storage.getItem('userEmail');
      const storedPhone = await storage.getItem('userPhone');

      console.log('Stored token found:', !!storedToken);
      
      if (storedToken) {
        setToken(storedToken);
        setUserData({
          email: storedEmail || '',
          phone: storedPhone || ''
        });
      }
    } catch (error) {
      console.log('Error loading storage data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(data: { token: string; email: string; phone: string }) {
    try {
      // Store token and user data
      await storage.setItem('userToken', data.token);
      
      if (data.email) {
        await storage.setItem('userEmail', data.email);
      }
      
      if (data.phone) {
        await storage.setItem('userPhone', data.phone);
      }
      
      // Verify token was stored
      const verifyToken = await storage.getItem('userToken');
      console.log('Token stored successfully:', !!verifyToken);

      // Update state
      setToken(data.token);
      setUserData({
        email: data.email || '',
        phone: data.phone || ''
      });
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async function signOut() {
    try {
      await storage.removeItem('userToken');
      await storage.removeItem('userEmail');
      await storage.removeItem('userPhone');
      
      setToken(null);
      setUserData(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
  
  async function deleteAccount() {
    try {
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      console.log('Deleting account with email:', userData?.email);
      
      // Call the deleteAccount API endpoint
      const response = await fetch('https://creditmonk-backend.vercel.app/api/users/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: userData?.email })
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Delete account failed:', responseData);
        throw new Error(responseData.message || 'Failed to delete account');
      }
      
      console.log('Account deleted successfully:', responseData);
      
      // Sign out after successful deletion
      await signOut();
      
    } catch (error: any) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ 
      userData, 
      token, 
      signIn, 
      signOut,
      deleteAccount
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}