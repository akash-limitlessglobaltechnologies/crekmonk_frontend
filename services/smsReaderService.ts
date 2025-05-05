// services/smsReaderService.ts
import { Platform } from 'react-native';
import * as SMS from 'expo-sms';
import smsPermissionService from './smsPermissionService';
import SmsAndroid from 'react-native-get-sms-android';
import { cardApi, CreditCard } from '../services/cardApi';

interface SmsMessage {
  _id: string;
  thread_id: string;
  address: string;
  body: string;
  date: string;
  date_sent: string;
  read: number;
  type: number;
  service_center: string;
}

interface ExtractedCardInfo {
  foundInfo: boolean;
  billGenerationDate: number | null;
  billDueDate: number | null;
  amount: number | null;
}

interface CardUpdate {
  cardId: string;
  billGenerationDate?: number;
  billDueDate?: number;
  amount?: number;
  foundInfo: boolean;
}

interface ScanResult {
  success: boolean;
  message?: string;
  error?: string;
  updatedCards?: number;
  updates?: Record<string, CardUpdate>;
  needsUserGuidance?: boolean;
  androidError?: string;
}

/**
 * Service to handle SMS reading and parsing for credit card information
 */
export const smsReaderService = {
  /**
   * Main function to scan SMS messages and update credit card information
   * @param cards - Array of credit card objects
   * @returns Result of the operation
   */
  scanAndUpdateCards: async (cards: CreditCard[]): Promise<ScanResult> => {
    try {
      // Check if SMS is available on the device
      const isAvailable = await smsPermissionService.isSmsAvailable();
      if (!isAvailable) {
        return { success: false, error: 'SMS is not available on this device' };
      }

      // Request permission
      const { granted } = await smsPermissionService.requestSmsPermission();
      if (!granted) {
        return { success: false, error: 'SMS permission not granted' };
      }

      // Different implementation for Android and iOS
      if (Platform.OS === 'android') {
        return await smsReaderService.scanAndroidSms(cards);
      } else if (Platform.OS === 'ios') {
        return { success: false, error: 'Direct SMS reading not available on iOS', needsUserGuidance: true };
      }

      return { success: false, error: 'Unsupported platform' };
    } catch (error) {
      console.error('Error in SMS scanning:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to scan SMS messages' 
      };
    }
  },

  /**
   * Function to scan SMS messages on Android
   * @param cards - Array of credit card objects
   */
  scanAndroidSms: async (cards: CreditCard[]): Promise<ScanResult> => {
    return new Promise((resolve) => {
      // Filter by banks to narrow down SMS search
      const bankNames = cards.map(card => card.bankName.toLowerCase());
      
      // Maximum number of messages to scan
      const maxMessages = 100;
      
      // Get all SMS messages
      SmsAndroid.list(
        JSON.stringify({
          box: 'inbox', // 'inbox' (default), 'sent', 'draft', 'outbox', 'failed', 'queued', and '' for all
          indexFrom: 0, // start from index 0
          maxCount: maxMessages, // count of SMS to return each time
        }),
        async (fail: string) => {
          console.error('Failed to get SMS list:', fail);
          resolve({ success: false, error: 'Failed to read SMS messages', androidError: fail });
        },
        async (count: number, smsList: string) => {
          try {
            if (count === 0) {
              resolve({ success: true, message: 'No SMS messages found', updatedCards: 0 });
              return;
            }

            // Parse the SMS list
            const smsListObj: SmsMessage[] = JSON.parse(smsList);
            
            // Track how many cards were updated
            let updatedCards = 0;
            const updatedCardIds: string[] = [];
            const cardUpdates: Record<string, CardUpdate> = {};

            // Check each SMS message for credit card information
            for (const sms of smsListObj) {
              const message = sms.body.toLowerCase();
              const sender = sms.address.toLowerCase();
              
              // First check if SMS might be related to any bank
              const isBankSms = bankNames.some(bank => 
                sender.includes(bank) || message.includes(bank)
              );
              
              if (!isBankSms) continue;
              
              // Now check each card
              for (const card of cards) {
                // Skip if we already found an update for this card
                if (updatedCardIds.includes(card.lastFourDigits)) continue;
                
                // Check if card number is mentioned in the SMS
                if (message.includes(card.lastFourDigits)) {
                  // Parse bill date, due date and amount
                  const extracted = smsReaderService.extractCardInfoFromSms(message, card);
                  
                  if (extracted.foundInfo) {
                    cardUpdates[card.lastFourDigits] = {
                      cardId: card.lastFourDigits,
                      ...extracted
                    };
                    updatedCardIds.push(card.lastFourDigits);
                    updatedCards++;
                  }
                }
              }
            }
            
            // Update cards with the API
            if (updatedCards > 0) {
              await smsReaderService.updateCardsWithApi(cardUpdates);
            }
            
            resolve({ 
              success: true, 
              message: `Updated ${updatedCards} cards from SMS messages`,
              updatedCards,
              updates: cardUpdates
            });
          } catch (error) {
            console.error('Error processing SMS list:', error);
            resolve({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Failed to process SMS messages' 
            });
          }
        }
      );
    });
  },
  
  /**
   * Extract bill date, due date and amount from an SMS message
   * @param message - The SMS message text
   * @param card - The card object to match against
   * @returns Extracted information
   */
  extractCardInfoFromSms: (message: string, card: CreditCard): ExtractedCardInfo => {
    const result: ExtractedCardInfo = {
      foundInfo: false,
      billGenerationDate: null,
      billDueDate: null,
      amount: null,
    };
    
    // Normalize message for easier parsing
    const normalizedMsg = message.toLowerCase().replace(/\s+/g, ' ');
    
    // Common patterns to find in SMS
    const billDatePatterns = [
      // Common bill date patterns
      /bill(ing)? (date|generated).*?(\d{1,2})(?:st|nd|rd|th)?/i,
      /statement (date|generated).*?(\d{1,2})(?:st|nd|rd|th)?/i,
      /generated on.*?(\d{1,2})(?:st|nd|rd|th)?/i,
      /bill for.*?(\d{1,2})(?:st|nd|rd|th)?/i
    ];
    
    const dueDatePatterns = [
      // Common due date patterns
      /due (date|on).*?(\d{1,2})(?:st|nd|rd|th)?/i,
      /pay by.*?(\d{1,2})(?:st|nd|rd|th)?/i,
      /payment due.*?(\d{1,2})(?:st|nd|rd|th)?/i
    ];
    
    const amountPatterns = [
      // Amount patterns with currency symbols
      /total (due|amount|bill|payment).*?([\$₹€£¥])\s*([0-9,]+(\.[0-9]{2})?)/i,
      /amount.*?([\$₹€£¥])\s*([0-9,]+(\.[0-9]{2})?)/i,
      /([\$₹€£¥])\s*([0-9,]+(\.[0-9]{2})?)/i,
      /rs\.?\s*([0-9,]+(\.[0-9]{2})?)/i,
      /inr\s*([0-9,]+(\.[0-9]{2})?)/i
    ];
    
    // Search for bill date
    for (const pattern of billDatePatterns) {
      const match = normalizedMsg.match(pattern);
      if (match && match[match.length-1]) {
        const extractedDate = parseInt(match[match.length-1], 10);
        if (!isNaN(extractedDate) && extractedDate >= 1 && extractedDate <= 31) {
          result.billGenerationDate = extractedDate;
          result.foundInfo = true;
          break;
        }
      }
    }
    
    // Search for due date
    for (const pattern of dueDatePatterns) {
      const match = normalizedMsg.match(pattern);
      if (match && match[match.length-1]) {
        const extractedDate = parseInt(match[match.length-1], 10);
        if (!isNaN(extractedDate) && extractedDate >= 1 && extractedDate <= 31) {
          result.billDueDate = extractedDate;
          result.foundInfo = true;
          break;
        }
      }
    }
    
    // Search for amount
    for (const pattern of amountPatterns) {
      const match = normalizedMsg.match(pattern);
      if (match) {
        // Extract the amount, removing commas and currency symbols
        let amountStr;
        if (match[2] && !isNaN(parseFloat(match[2].replace(/,/g, '')))) {
          amountStr = match[2].replace(/,/g, '');
        } else if (match[1] && !isNaN(parseFloat(match[1].replace(/,/g, '')))) {
          amountStr = match[1].replace(/,/g, '');
        }
        
        if (amountStr) {
          const extractedAmount = parseFloat(amountStr);
          if (!isNaN(extractedAmount) && extractedAmount > 0) {
            result.amount = extractedAmount;
            result.foundInfo = true;
            break;
          }
        }
      }
    }
    
    return result;
  },
  
  /**
   * Update cards with the API using the extracted SMS information
   * @param cardUpdates - Map of card IDs to their updates
   */
  updateCardsWithApi: async (cardUpdates: Record<string, CardUpdate>) => {
    try {
      const results = [];
      
      for (const [cardId, update] of Object.entries(cardUpdates)) {
        // Only update API with bill generation date and due date
        const updateData: Partial<CreditCard> = {};
        
        if (update.billGenerationDate) {
          updateData.billGenerationDate = update.billGenerationDate;
        }
        
        if (update.billDueDate) {
          updateData.billDueDate = update.billDueDate;
        }
        
        // Skip if no fields to update
        if (Object.keys(updateData).length === 0) continue;
        
        // Call API to update the card
        const result = await cardApi.updateCard(cardId, updateData);
        results.push({ cardId, success: true, result });
      }
      
      return { success: true, results };
    } catch (error) {
      console.error('Error updating cards with API:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update cards with API' 
      };
    }
  }
};

export default smsReaderService;