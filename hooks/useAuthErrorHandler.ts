// hooks/useAuthErrorHandler.ts
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/auth';

/**
 * Hook to detect authentication errors and redirect to login page
 * @param error The error object or string to check for auth failures
 */
export const useAuthErrorHandler = (error: any) => {
  const router = useRouter();
  const { signOut } = useAuth();

  // Check if an error message is authentication related
  const isAuthError = useCallback((error: any): boolean => {
    if (!error) return false;
    
    // Check string error messages
    if (typeof error === 'string') {
      const lowerError = error.toLowerCase();
      return (
        lowerError.includes('authentication failed') ||
        lowerError.includes('not authenticated') ||
        lowerError.includes('unauthenticated') ||
        lowerError.includes('unauthorized') ||
        lowerError.includes('no authentication token') ||
        lowerError.includes('jwt')
      );
    }
    
    // Check error objects with message property
    if (error.message) {
      const lowerMessage = error.message.toLowerCase();
      return (
        lowerMessage.includes('authentication failed') ||
        lowerMessage.includes('not authenticated') ||
        lowerMessage.includes('unauthenticated') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('no authentication token') ||
        lowerMessage.includes('jwt')
      );
    }
    
    // Check for HTTP status code in error object
    if (error.status === 401 || error.statusCode === 401) {
      return true;
    }
    
    return false;
  }, []);

  useEffect(() => {
    if (isAuthError(error)) {
      handleAuthError();
    }
  }, [error, isAuthError]);

  const handleAuthError = useCallback(async () => {
    console.log('[AuthErrorHandler] Authentication error detected, logging out and redirecting...');
    try {
      // First, sign out the user
      await signOut();
      
      // Then redirect to login
      router.replace('/login');
    } catch (error) {
      console.error('[AuthErrorHandler] Error during sign out:', error);
      // If sign out fails, still redirect to login
      router.replace('/login');
    }
  }, [signOut, router]);

  return { handleAuthError, isAuthError };
};

export default useAuthErrorHandler;