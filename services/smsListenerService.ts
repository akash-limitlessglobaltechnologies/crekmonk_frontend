// services/smsListenerService.ts
import { Platform, NativeModules, NativeEventEmitter, DeviceEventEmitter, EmitterSubscription } from 'react-native';
import smsReaderService from './smsReaderService';
import { cardApi, CreditCard } from '../services/cardApi';

// Define the SMS Event interface
interface SmsEvent {
  sender: string;
  message: string;
}

// Define the update event interface
interface CardUpdateEvent {
  cardId: string;
  updateData: Partial<CreditCard>;
  source: string;
}

// TypeScript interface for the native module
interface SMSModuleInterface {
  registerSMSReceiver(): Promise<boolean>;
  unregisterSMSReceiver(): Promise<boolean>;
  isReceiverRegistered(): Promise<boolean>;
}

// Get the native module if available
const SMSModule: SMSModuleInterface | null = Platform.OS === 'android' 
  ? NativeModules.SMSModule as SMSModuleInterface 
  : null;

/**
 * Service to handle listening for incoming SMS messages
 */
export const smsListenerService = {
  isListening: false,
  smsListener: null as EmitterSubscription | null,
  cachedCards: [] as CreditCard[],

  /**
   * Start listening for SMS messages
   * @param cards - Current cards for reference
   * @returns Whether listener was started
   */
  startListening: async (cards: CreditCard[]): Promise<boolean> => {
    // Cache cards for SMS processing
    smsListenerService.cachedCards = [...cards];
    
    try {
      // Only available on Android
      if (Platform.OS !== 'android' || !SMSModule) {
        console.log('SMS listening is only available on Android');
        return false;
      }
      
      // Register the broadcast receiver
      await SMSModule.registerSMSReceiver();
      
      // Listen for SMS events
      if (!smsListenerService.isListening) {
        console.log('Setting up SMS event listener');
        
        // Remove existing listener if any
        if (smsListenerService.smsListener) {
          smsListenerService.smsListener.remove();
          smsListenerService.smsListener = null;
        }
        
        // Create new listener
        smsListenerService.smsListener = DeviceEventEmitter.addListener(
          'OnSMSReceived',
          smsListenerService.handleSmsReceived
        );
        
        smsListenerService.isListening = true;
        console.log('SMS listener registered');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error starting SMS listener:', error);
      return false;
    }
  },
  
  /**
   * Stop listening for SMS messages
   * @returns Whether listener was stopped
   */
  stopListening: async (): Promise<boolean> => {
    try {
      // Only available on Android
      if (Platform.OS !== 'android' || !SMSModule) {
        return false;
      }
      
      // Unregister the broadcast receiver
      await SMSModule.unregisterSMSReceiver();
      
      // Remove the listener
      if (smsListenerService.smsListener) {
        smsListenerService.smsListener.remove();
        smsListenerService.smsListener = null;
      }
      
      smsListenerService.isListening = false;
      console.log('SMS listener unregistered');
      return true;
    } catch (error) {
      console.error('Error stopping SMS listener:', error);
      return false;
    }
  },
  
  /**
   * Update cards reference
   * @param cards - New cards array
   */
  updateCards: (cards: CreditCard[]): void => {
    smsListenerService.cachedCards = [...cards];
  },
  
  /**
   * Handle receiving an SMS message
   * @param event - SMS event with sender and message
   */
  handleSmsReceived: async (event: SmsEvent): Promise<void> => {
    try {
      console.log('SMS received:', event.sender);
      
      const { sender, message } = event;
      const cards = smsListenerService.cachedCards;
      
      // Skip if no cards to check against
      if (!cards || cards.length === 0) {
        console.log('No cards to check against');
        return;
      }
      
      // Check each card against the SMS
      let cardUpdated = false;
      
      for (const card of cards) {
        // Check if card number is mentioned in the SMS
        if (message.includes(card.lastFourDigits)) {
          console.log(`SMS matches card ending in ${card.lastFourDigits}`);
          
          // Parse bill date, due date and amount
          const extracted = smsReaderService.extractCardInfoFromSms(message, card);
          
          if (extracted.foundInfo) {
            // Prepare update data
            const updateData: Partial<CreditCard> = {};
            
            if (extracted.billGenerationDate) {
              updateData.billGenerationDate = extracted.billGenerationDate;
            }
            
            if (extracted.billDueDate) {
              updateData.billDueDate = extracted.billDueDate;
            }
            
            // Skip if no fields to update
            if (Object.keys(updateData).length === 0) continue;
            
            // Call API to update the card
            await cardApi.updateCard(card.lastFourDigits, updateData);
            cardUpdated = true;
            
            // Broadcast an event that a card was updated
            DeviceEventEmitter.emit('CardUpdatedFromSMS', {
              cardId: card.lastFourDigits,
              updateData,
              source: 'sms_listener'
            } as CardUpdateEvent);
            
            console.log(`Card ${card.lastFourDigits} updated with SMS data`);
            break;
          }
        }
      }
      
      if (!cardUpdated) {
        console.log('No card updates found in SMS');
      }
    } catch (error) {
      console.error('Error processing SMS:', error);
    }
  }
};

export default smsListenerService;