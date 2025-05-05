// components/AuthErrorListener.tsx
import React, { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/auth';
import { AUTH_ERROR_EVENT } from '../services/api';

/**
 * A component that listens for authentication error events
 * and handles automatic logout and redirection to login screen
 */
const AuthErrorListener: React.FC = () => {
  const router = useRouter();
  const { signOut } = useAuth();
  
  useEffect(() => {
    const handleAuthError = async (event: any) => {
      console.log('[AuthErrorListener] Auth error event received:', event);
      
      try {
        // Perform sign out
        await signOut();
        
        // Navigate to login
        router.replace('/login');
      } catch (error) {
        console.error('[AuthErrorListener] Error during sign out after auth error:', error);
        // Still redirect to login even if sign out fails
        router.replace('/login');
      }
    };
    
    // Add event listener
    const subscription = DeviceEventEmitter.addListener(
      AUTH_ERROR_EVENT,
      handleAuthError
    );
    
    // Clean up listener on unmount
    return () => {
      subscription.remove();
    };
  }, [signOut, router]);
  
  // This component doesn't render anything visible
  return null;
};

export default AuthErrorListener;