// services/smsPermissionService.ts
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import * as SMS from 'expo-sms';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

type PermissionResult = {
  granted: boolean | 'unknown';
  receiveGranted?: boolean;
};

/**
 * Service to handle SMS permissions across platforms
 */
export const smsPermissionService = {
  /**
   * Check if SMS features are available on the device
   */
  isSmsAvailable: async (): Promise<boolean> => {
    try {
      const isAvailable = await SMS.isAvailableAsync();
      return isAvailable;
    } catch (error) {
      console.error('Error checking SMS availability:', error);
      return false;
    }
  },

  /**
   * Request SMS read permission based on platform
   */
  requestSmsPermission: async (): Promise<PermissionResult> => {
    try {
      if (Platform.OS === 'android') {
        // Android requires explicit SMS permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: 'SMS Permission Required',
            message: 'This app needs to read your SMS messages to automatically update your credit card information.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        // Android 11+ may also need RECEIVE_SMS permission
        let receiveGranted = false;
        if (parseInt(Platform.Version as string, 10) >= 30) { // Android 11+
          receiveGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
            {
              title: 'Receive SMS Permission',
              message: 'This app needs permission to receive SMS notifications to update cards in real-time.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
        }

        return {
          granted: granted === PermissionsAndroid.RESULTS.GRANTED,
          receiveGranted: receiveGranted === PermissionsAndroid.RESULTS.GRANTED || receiveGranted === true
        };
      } else if (Platform.OS === 'ios') {
        // iOS doesn't have direct SMS read permission
        // We'll use a user prompt to ask them to manually allow notifications for SMS
        return new Promise((resolve) => {
          Alert.alert(
            'Permission Required',
            'To use automatic SMS updates, please enable notifications for this app in Settings.',
            [
              {
                text: 'Cancel',
                onPress: () => resolve({ granted: false }),
                style: 'cancel',
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  Linking.openURL('app-settings:');
                  resolve({ granted: 'unknown' }); // We can't know if they actually granted it
                },
              },
            ]
          );
        });
      }
      
      return { granted: false };
    } catch (error) {
      console.error('Error requesting SMS permission:', error);
      return { granted: false };
    }
  },

  /**
   * Open system SMS settings
   */
  openSmsSettings: async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.SMS_SETTINGS
        );
        return true;
      } else if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error opening SMS settings:', error);
      return false;
    }
  }
};

export default smsPermissionService;