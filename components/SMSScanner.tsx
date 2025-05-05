// components/SMSScanner.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Import modules conditionally to prevent crashes
let smsPermissionService: any = { isSmsAvailable: async () => false };
let smsReaderService: any = { scanAndUpdateCards: async () => ({ success: false, error: 'SMS module not available' }) };

// Try to import the SMS modules, but don't crash if they're not available
try {
  smsPermissionService = require('../services/smsPermissionService').default;
  smsReaderService = require('../services/smsReaderService').default;
} catch (error) {
  console.log('SMS services could not be imported:', error);
}

import { CreditCard } from '../services/cardApi';

interface SMSScannerProps {
  onScanComplete?: (result: any) => void;
  cards: CreditCard[];
  isVisible?: boolean;
}

interface ScanResult {
  success: boolean;
  error?: string;
  message?: string;
  updatedCards?: number;
  needsUserGuidance?: boolean;
}

const SMSScanner: React.FC<SMSScannerProps> = ({ 
  onScanComplete, 
  cards, 
  isVisible = true 
}) => {
  const [scanning, setScanning] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [modulesAvailable, setModulesAvailable] = useState<boolean>(true);
  
  // Check if modules are available
  useEffect(() => {
    const checkModules = async () => {
      try {
        // For iOS, we need to check if we actually have the module available
        const isAvailable = await smsPermissionService.isSmsAvailable();
        setModulesAvailable(isAvailable);
        
        if (isAvailable && isVisible) {
          checkSmsPermission();
        } else if (Platform.OS === 'ios') {
          setPermissionStatus('ios_limited');
        } else {
          setPermissionStatus('unavailable');
        }
      } catch (error) {
        console.error('Error checking SMS modules:', error);
        setModulesAvailable(false);
        setPermissionStatus('unavailable');
      }
    };
    
    checkModules();
  }, [isVisible]);
  
  // Function to check SMS permission
  const checkSmsPermission = async () => {
    try {
      if (!modulesAvailable) {
        setPermissionStatus('unavailable');
        return;
      }
      
      const isAvailable = await smsPermissionService.isSmsAvailable();
      if (!isAvailable) {
        setPermissionStatus('unavailable');
        return;
      }
      
      if (Platform.OS === 'ios') {
        // iOS doesn't have direct SMS permission check
        setPermissionStatus('ios_limited');
        return;
      }
      
      // On Android, we can try to request permission
      const { granted } = await smsPermissionService.requestSmsPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error checking SMS permission:', error);
      setPermissionStatus('error');
    }
  };
  
  // Function to request permission
  const requestPermission = async () => {
    try {
      if (!modulesAvailable) {
        Alert.alert('SMS Module Unavailable', 
          'The SMS scanning functionality is not available on this device.');
        return;
      }
      
      const { granted } = await smsPermissionService.requestSmsPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      
      if (!granted) {
        // Show guidance to the user
        Alert.alert(
          'Permission Required',
          'SMS scanning requires permission to read messages. Would you like to open settings?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => smsPermissionService.openSmsSettings()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting SMS permission:', error);
      setPermissionStatus('error');
    }
  };
  
  // Function to scan SMS messages
  const scanSms = async () => {
    if (!modulesAvailable) {
      Alert.alert('SMS Module Unavailable', 
        'The SMS scanning functionality is not available on this device.');
      return;
    }
    
    if (cards.length === 0) {
      Alert.alert('No Cards', 'Please add credit cards before scanning SMS messages.');
      return;
    }
    
    try {
      setScanning(true);
      const result = await smsReaderService.scanAndUpdateCards(cards);
      setLastScanResult(result);
      setHasScanned(true);
      
      if (result.success) {
        if (result.updatedCards && result.updatedCards > 0) {
          Alert.alert(
            'Scan Complete',
            `Successfully updated ${result.updatedCards} cards with information from SMS messages.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'No Updates Found',
            'Scanned messages but did not find any new information for your cards.',
            [{ text: 'OK' }]
          );
        }
      } else {
        if (result.needsUserGuidance) {
          // Special case for iOS
          Alert.alert(
            'SMS Access Limited',
            'On iOS, we cannot directly read SMS messages. Please manually check your messages and update your cards.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Scan Failed',
            result.error || 'Failed to scan SMS messages.',
            [{ text: 'OK' }]
          );
        }
      }
      
      // Notify parent component
      if (onScanComplete) {
        onScanComplete(result);
      }
    } catch (error) {
      console.error('Error scanning SMS:', error);
      setLastScanResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
      
      Alert.alert(
        'Error',
        'An unexpected error occurred while scanning SMS messages.',
        [{ text: 'OK' }]
      );
    } finally {
      setScanning(false);
    }
  };
  
  // Don't render if not visible
  if (!isVisible) return null;
  
  // Render based on module availability and permission status
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#3a3a3a', '#2d2d2d']}
        style={styles.card}
      >
        <View style={styles.header}>
          <Ionicons name="chatbubbles-outline" size={24} color="#ffffff" />
          <Text style={styles.title}>SMS Auto-Update</Text>
        </View>
        
        <Text style={styles.description}>
          Automatically update your credit card information by scanning SMS messages from your bank.
        </Text>
        
        {!modulesAvailable ? (
          <View style={styles.infoBox}>
            <Ionicons name="alert-circle-outline" size={24} color="#ff6b6b" />
            <Text style={styles.infoText}>
              SMS scanning functionality is not available on this device or installation.
            </Text>
          </View>
        ) : permissionStatus === 'unavailable' ? (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={24} color="#ff9800" />
            <Text style={styles.infoText}>
              SMS scanning is not available on this device.
            </Text>
          </View>
        ) : permissionStatus === 'ios_limited' ? (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={24} color="#ff9800" />
            <Text style={styles.infoText}>
              On iOS, we cannot directly read SMS messages. Please manually check your messages and update your cards.
            </Text>
          </View>
        ) : permissionStatus === 'denied' ? (
          <View style={styles.infoBox}>
            <Ionicons name="alert-circle-outline" size={24} color="#ff6b6b" />
            <Text style={styles.infoText}>
              SMS permission is required for this feature.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={requestPermission}
            >
              <Text style={styles.buttonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        ) : permissionStatus === 'error' ? (
          <View style={styles.infoBox}>
            <Ionicons name="alert-circle-outline" size={24} color="#ff6b6b" />
            <Text style={styles.infoText}>
              An error occurred while checking SMS permission.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={checkSmsPermission}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            {hasScanned && lastScanResult && (
              <View style={[
                styles.resultBox,
                lastScanResult.success ? styles.successBox : styles.errorBox
              ]}>
                <Ionicons 
                  name={lastScanResult.success ? "checkmark-circle-outline" : "alert-circle-outline"} 
                  size={20} 
                  color={lastScanResult.success ? "#4CAF50" : "#ff6b6b"} 
                />
                <Text style={styles.resultText}>
                  {lastScanResult.success 
                    ? lastScanResult.message || "Scan completed successfully" 
                    : lastScanResult.error || "Scan failed"}
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.scanButton, scanning && styles.buttonDisabled]}
              onPress={scanSms}
              disabled={scanning}
            >
              {scanning ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Ionicons name="scan-outline" size={20} color="#ffffff" />
                  <Text style={styles.scanButtonText}>Scan SMS Messages</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    marginHorizontal: 20,
  },
  card: {
    padding: 20,
    borderRadius: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
  },
  description: {
    fontSize: 14,
    color: '#c4c4c4',
    marginBottom: 15,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  infoText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  actionContainer: {
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#4a4a4a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  button: {
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 10,
    width: '100%',
  },
  successBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  errorBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b6b',
  },
  resultText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
});

export default SMSScanner;