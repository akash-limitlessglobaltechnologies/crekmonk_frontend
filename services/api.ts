import { Platform } from 'react-native';
import storage from '../utils/storage';

// Dynamic API URL based on platform
const getBaseUrl = () => {
  if (__DEV__) {
    // Development environment
    if (Platform.OS === 'android') {
      return 'https://creditmonk-backend.vercel.app/api';
    } else if (Platform.OS === 'ios') {
      return 'https://creditmonk-backend.vercel.app/api';
    } else {
      return 'https://creditmonk-backend.vercel.app/api';
    }
  }
  // Production environment
  return 'https://creditmonk-backend.vercel.app/api';
};

const API_URL = getBaseUrl();

export interface ApiResponse {
  success: boolean;
  message: string;
  token?: string;
  currentStep?: number;
  nextStep?: string;
  devOtp?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Connection': 'keep-alive',
};

const getAuthHeader = async () => {
  try {
    const token = await storage.getItem('userToken');
    if (token) {
      return {
        ...defaultHeaders,
        'Authorization': `Bearer ${token}`
      };
    }
    return defaultHeaders;
  } catch (error) {
    console.error('Error getting auth header:', error);
    return defaultHeaders;
  }
};

export const api = {
  post: async <T>(endpoint: string, data: any, requiresAuth = false): Promise<T> => {
    try {
      console.log('API Request:', endpoint, data);
      
      // Add timeout to fetch
      const timeoutDuration = 15000; // 15 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
      
      // Get headers - with auth token if required
      const headers = requiresAuth ? await getAuthHeader() : defaultHeaders;
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'omit',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      console.log('API Response:', result);
      return result;
    } catch (error: any) {
      console.error('API Error:', {
        message: error.message,
        endpoint,
        data,
        platform: Platform.OS,
        apiUrl: API_URL,
      });

      // Enhanced error handling
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your internet connection.');
      } else if (error instanceof TypeError && error.message.includes('Network request failed')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      
      throw error;
    }
  },

  get: async <T>(endpoint: string): Promise<T> => {
    try {
      // Add timeout to fetch
      const timeoutDuration = 15000; // 15 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
      
      // Always include auth token for GET requests
      const headers = await getAuthHeader();
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'GET',
        headers,
        credentials: 'omit',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      console.log('API Response:', result);
      return result;
    } catch (error: any) {
      console.error('API Error:', {
        message: error.message,
        endpoint,
        platform: Platform.OS,
        apiUrl: API_URL,
      });

      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your internet connection.');
      } else if (error instanceof TypeError && error.message.includes('Network request failed')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      
      throw error;
    }
  },

  signup: async (data: {
    step: number;
    email?: string;
    emailOtp?: string;
    phone?: string;
    phoneOtp?: string;
    pin?: string;
  }): Promise<ApiResponse> => {
    // Validate data before sending
    const { step } = data;
    
    if (step === 3 && (!data.email || !data.phone)) {
      throw new Error('Email and phone number are required');
    }

    try {
      return await api.post<ApiResponse>('/users/signup', data);
    } catch (error: any) {
      // Add specific error handling for signup
      const errorMessage = error.message || 'Signup failed. Please try again.';
      throw new Error(errorMessage);
    }
  },

  login: async (data: { identifier: string; pin: string }): Promise<ApiResponse> => {
    try {
      // Validate login data
      if (!data.identifier || !data.pin) {
        throw new Error('Email/Phone and PIN are required');
      }

      return await api.post<ApiResponse>('/users/login', data);
    } catch (error: any) {
      // Add specific error handling for login
      const errorMessage = error.message || 'Login failed. Please try again.';
      throw new Error(errorMessage);
    }
  },
  
  // Card-related API calls (all require auth)
  getCards: async (): Promise<any> => {
    try {
      return await api.get('/cards');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch cards';
      throw new Error(errorMessage);
    }
  },
  
  createCard: async (cardData: any): Promise<any> => {
    try {
      return await api.post('/cards', cardData, true);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create card';
      throw new Error(errorMessage);
    }
  },
  
  updateCard: async (lastFour: string, cardData: any): Promise<any> => {
    try {
      return await api.post(`/cards/${lastFour}`, cardData, true);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update card';
      throw new Error(errorMessage);
    }
  },
  
  deleteCard: async (lastFour: string): Promise<any> => {
    try {
      console.log('🔄 deleteCard method called for card:', lastFour);
      
      // Validate input
      if (!lastFour || !/^\d{4}$/.test(lastFour)) {
        console.error('❌ Invalid card number format:', lastFour);
        throw new Error('Invalid card number format');
      }
      
      // Get token and check auth
      const token = await storage.getItem('userToken');
      console.log('🔑 Token for card deletion:', token ? 'Token exists' : 'No token found');
      
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }
      
      // Log the complete request details
      const deleteUrl = `${API_URL}/cards/${lastFour}`;
      console.log('📤 Sending DELETE request to:', deleteUrl);
      
      // Make the request with full debugging
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response status text:', response.statusText);
      
      // Parse the response body
      const result = await response.json();
      console.log('📥 Response body:', JSON.stringify(result));
      
      // Handle error responses
      if (!response.ok) {
        console.error('❌ Delete request failed:', result.message || response.statusText);
        throw new Error(result.message || `Failed to delete card (${response.status})`);
      }
      
      console.log('✅ Card deletion successful');
      return result;
    } catch (error: any) {
      console.error('❌ Error in deleteCard method:', error.message);
      console.error('Stack trace:', error.stack);
      
      // Enhanced error messages based on error type
      if (error.message.includes('Network request failed')) {
        throw new Error('Network connection failed. Please check your internet and try again.');
      }
      
      throw error;
    }
  },

  // Helper method to check connectivity
  checkConnectivity: async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  },
  deleteAccount: async (): Promise<ApiResponse> => {
    console.log('api.deleteAccount method called');
    try {
      const token = await storage.getItem('userToken');
      console.log('Token retrieved:', token ? 'Token exists' : 'No token!');
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      console.log('Making DELETE request to /users/account');
      const response = await fetch(`${API_URL}/users/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response received:', response.status);
      const result = await response.json();
      console.log('Response data:', result);
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete account');
      }
      
      return result;
    } catch (error: any) {
      console.error('Error in deleteAccount API call:', error);
      const errorMessage = error.message || 'Failed to delete account';
      throw new Error(errorMessage);
    }
  },
};

export default api;