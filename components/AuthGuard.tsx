import { useEffect, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAuth();
  }, [segments]);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const inAuthGroup = segments[0] === '(auth)';
      
      if (token && inAuthGroup) {
        // Redirect to home if user has token but is on auth screen
        router.replace('/(tabs)');
      } else if (!token && !inAuthGroup) {
        // Redirect to login if user has no token and is not on auth screen
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      router.replace('/(auth)/login');
    }
  };

  return <>{children}</>;
}