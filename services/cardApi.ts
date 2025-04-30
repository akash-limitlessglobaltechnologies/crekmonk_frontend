// cardApi.ts
import storage from '../utils/storage';
import NetInfo from '@react-native-community/netinfo';

// Interfaces
export interface CreditCard {
  _id: string;
  userId: string;
  lastFourDigits: string;
  bankName: string;
  userName: string;
  billGenerationDate: number;
  billDueDate: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

// Constants
const API_URL = 'https://creditmonk-backend.vercel.app/api';

export const BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Yes Bank",
  "IndusInd Bank",
  "IDFC First Bank",
  "Federal Bank",
  "RBL Bank",
  "Standard Chartered Bank",
  "Citi Bank",
  "HSBC Bank",
  "American Express",
  "Bank of Baroda",
  "Punjab National Bank",
  "Union Bank of India",
  "Canara Bank",
  "South Indian Bank",
].sort();

// Helper Functions
const getAuthHeader = async () => {
  try {
    const token = await storage.getItem('userToken');
    console.log('Auth token retrieved:', token ? 'Token exists' : 'No token found');
    
    if (!token) {
      console.warn('No authentication token found in storage');
      throw new Error('Authentication required. Please log in again.');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    throw new Error('Authentication error. Please log in again.');
  }
};

// Main API Functions
export const cardApi = {
  createCard: async (cardData: Omit<CreditCard, '_id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Validate data
      if (!cardData.lastFourDigits || !/^\d{4}$/.test(cardData.lastFourDigits)) {
        throw new Error('Invalid card number format');
      }

      const isConnected = await NetInfo.fetch();
      if (!isConnected.isConnected) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      const headers = await getAuthHeader();
      console.log('Making POST request to create card');
      
      const response = await fetch(`${API_URL}/cards`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(cardData)
      });
      
      console.log('Create card response status:', response.status);
      
      const result = await response.json();
      console.log('Create card response:', result.success ? 'Success' : 'Failed');
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create card');
      }
      
      return result.card;
    } catch (error: any) {
      console.error('Error creating card:', error);
      throw new Error(error.message || 'Failed to create card');
    }
  },

  getAllCards: async () => {
    try {
      const isConnected = await NetInfo.fetch();
      if (!isConnected.isConnected) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      const headers = await getAuthHeader();
      console.log('Making GET request to fetch all cards');
      
      const response = await fetch(`${API_URL}/cards`, {
        method: 'GET',
        headers: headers
      });
      
      console.log('Get all cards response status:', response.status);
      
      const result = await response.json();
      console.log('Get all cards response:', result.success ? 'Success' : 'Failed');
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch cards');
      }
      
      return result.cards;
    } catch (error: any) {
      console.error('Error getting cards:', error);
      throw new Error(error.message || 'Failed to fetch cards');
    }
  },

  updateCard: async (lastFourDigits: string, updates: Partial<CreditCard>) => {
    try {
      // Validate updates
      if (updates.lastFourDigits && !/^\d{4}$/.test(updates.lastFourDigits)) {
        throw new Error('Invalid card number format');
      }

      if (updates.billGenerationDate && (updates.billGenerationDate < 1 || updates.billGenerationDate > 31)) {
        throw new Error('Invalid bill generation date');
      }

      if (updates.billDueDate && (updates.billDueDate < 1 || updates.billDueDate > 31)) {
        throw new Error('Invalid due date');
      }

      const isConnected = await NetInfo.fetch();
      if (!isConnected.isConnected) {
        throw new Error('No internet connection. Please try again when online.');
      }

      const headers = await getAuthHeader();
      console.log(`Making PUT request to update card: ${lastFourDigits}`);
      
      const response = await fetch(`${API_URL}/cards/${lastFourDigits}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(updates)
      });
      
      console.log('Update card response status:', response.status);
      
      const result = await response.json();
      console.log('Update card response:', result.success ? 'Success' : 'Failed');
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to update card');
      }
      
      return result.card;
    } catch (error: any) {
      console.error('Error updating card:', error);
      throw new Error(error.message || 'Failed to update card');
    }
  },

  deleteCard: async (lastFourDigits: string) => {
    try {
      console.log(`Starting delete operation for card: ${lastFourDigits}`);
      
      const isConnected = await NetInfo.fetch();
      console.log('Network status:', isConnected.isConnected ? 'Connected' : 'Disconnected');
      
      if (!isConnected.isConnected) {
        throw new Error('No internet connection. Please try again when online.');
      }

      // Log the request details
      console.log(`Making DELETE request to: ${API_URL}/cards/${lastFourDigits}`);
      const headers = await getAuthHeader();
      console.log('With headers:', JSON.stringify(headers));

      // IMPORTANT FIX: Changed from this approach to using proper PUT method
      const response = await fetch(`${API_URL}/cards/${lastFourDigits}`, {
        method: 'DELETE',  // This should be 'DELETE', not 'PUT'
        headers: headers
      });
      
      console.log(`Delete response status: ${response.status}`);
      
      // Try to parse the response body
      let responseBody;
      try {
        responseBody = await response.json();
        console.log('Delete response body:', responseBody);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        // If we can't parse JSON, get the response text
        const text = await response.text();
        console.log('Response as text:', text);
      }
      
      if (!response.ok) {
        throw new Error(responseBody?.message || `Server returned ${response.status}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Delete card error:', error);
      throw new Error(error.message || 'Failed to delete card');
    }
  },

  getCardByLastFour: async (lastFourDigits: string) => {
    try {
      const isConnected = await NetInfo.fetch();
      if (!isConnected.isConnected) {
        throw new Error('No internet connection. Please try again when online.');
      }

      const headers = await getAuthHeader();
      console.log(`Making GET request to fetch card: ${lastFourDigits}`);
      
      const response = await fetch(`${API_URL}/cards/${lastFourDigits}`, {
        method: 'GET',
        headers: headers
      });
      
      console.log('Get card response status:', response.status);
      
      const result = await response.json();
      console.log('Get card response:', result.success ? 'Success' : 'Failed');
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch card details');
      }
      
      return result.card;
    } catch (error: any) {
      console.error('Error getting card:', error);
      throw new Error(error.message || 'Failed to get card');
    }
  },

  // Network status check
  isOnline: async () => {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected ?? false;
  }
};