import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, FlatList, Modal, Platform, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { cardApi, BANKS, CreditCard } from '../../services/cardApi';

// Define initial empty form state
const initialFormState = {
  lastFourDigits: '',
  bankName: '',
  userName: '',
  billGenerationDate: '',
  billDueDate: ''
};

// Custom DatePicker component
const DatePicker = ({ visible, onClose, onSelect, currentValue }) => {
  // Generate array of days from 1 to 31
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  
  // Set the initial selection to the current value or empty string
  const [selectedDay, setSelectedDay] = useState(currentValue || '');

  // Reset selected day when modal opens with a new current value
  useEffect(() => {
    setSelectedDay(currentValue || '');
  }, [currentValue, visible]);

  // Helper to determine if a day is selected
  const isDaySelected = (day) => selectedDay === day;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.datePickerContainer}>
          <View style={styles.datePickerHeader}>
            <Text style={styles.datePickerTitle}>Select Day</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.daysGrid}>
            {days.map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  isDaySelected(day) && styles.selectedDayButton
                ]}
                onPress={() => {
                  setSelectedDay(day);
                  onSelect(day);
                  onClose();
                }}
              >
                <Text 
                  style={[
                    styles.dayText, 
                    isDaySelected(day) && styles.selectedDayText
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function AddCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [fetchingCard, setFetchingCard] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // State for bank name suggestions
  const [bankSuggestions, setBankSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Date picker modal states
  const [billDatePickerVisible, setBillDatePickerVisible] = useState(false);
  const [dueDatePickerVisible, setDueDatePickerVisible] = useState(false);
  
  // Initialize with empty form data
  const [formData, setFormData] = useState(initialFormState);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  // Reset form and edit mode on screen focus
  useFocusEffect(
    useCallback(() => {
      // Check if we have a reset parameter or if there's no card/cardId parameter
      const shouldReset = params.reset === 'true' || (!params.cardId && !params.card);
      
      if (shouldReset) {
        console.log('Resetting form data due to reset parameter or no edit params');
        setFormData(initialFormState);
        setIsEditMode(false);
        setError('');
      }
      
      return () => {
        // Cleanup if needed
      };
    }, [params.reset, params.cardId, params.card])
  );

  // Handle params changes and detect edit mode
  useEffect(() => {
    // If we have the reset parameter, ensure we're in add mode and return early
    if (params.reset === 'true') {
      setIsEditMode(false);
      setFormData(initialFormState);
      return;
    }
    
    // Check if we're in edit mode
    const editMode = Boolean(params.cardId || params.card);
    setIsEditMode(editMode);
    
    // If we have card ID in params, fetch the card data from API
    if (params.cardId) {
      fetchCardDetails(params.cardId as string);
    } else if (params.card) {
      try {
        const cardData = JSON.parse(params.card as string) as CreditCard;
        setFormData({
          lastFourDigits: cardData.lastFourDigits,
          bankName: cardData.bankName,
          userName: cardData.userName,
          billGenerationDate: cardData.billGenerationDate.toString(),
          billDueDate: cardData.billDueDate.toString()
        });
      } catch (error) {
        console.error('Error parsing card data:', error);
        Alert.alert('Error', 'Invalid card data');
        router.back();
      }
    } else {
      // If it's a new card (no params), reset the form data
      setFormData(initialFormState);
    }
  }, [params.cardId, params.card, params.reset]);

  const fetchCardDetails = async (lastFourDigits: string) => {
    try {
      setFetchingCard(true);
      setError('');
      
      const cardData = await cardApi.getCardByLastFour(lastFourDigits);
      
      setFormData({
        lastFourDigits: cardData.lastFourDigits,
        bankName: cardData.bankName,
        userName: cardData.userName,
        billGenerationDate: cardData.billGenerationDate.toString(),
        billDueDate: cardData.billDueDate.toString()
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch card details');
      Alert.alert('Error', err.message || 'Failed to fetch card details');
    } finally {
      setFetchingCard(false);
    }
  };

  // Function to filter bank suggestions based on user input
  const filterBankSuggestions = (text) => {
    const filteredBanks = BANKS.filter(bank => 
      bank.toLowerCase().includes(text.toLowerCase())
    );
    setBankSuggestions(filteredBanks);
    setShowSuggestions(filteredBanks.length > 0 && text.length > 0);
  };

  // Function to handle bank name input change
  const handleBankNameChange = (text) => {
    setFormData({...formData, bankName: text});
    filterBankSuggestions(text);
    setError('');
  };

  // Function to handle bank suggestion selection
  const selectBankSuggestion = (bank) => {
    setFormData({...formData, bankName: bank});
    setShowSuggestions(false);
  };

  // Date selection handlers
  const handleBillDateSelect = (day) => {
    setFormData({...formData, billGenerationDate: day});
    setError('');
  };

  const handleDueDateSelect = (day) => {
    setFormData({...formData, billDueDate: day});
    setError('');
  };

  const validateForm = () => {
    if (!formData.lastFourDigits || !formData.bankName || !formData.userName || 
        !formData.billGenerationDate || !formData.billDueDate) {
      setError('All fields are required');
      return false;
    }

    if (!/^\d{4}$/.test(formData.lastFourDigits)) {
      setError('Card number must be exactly 4 digits');
      return false;
    }

    const billDate = parseInt(formData.billGenerationDate);
    const dueDate = parseInt(formData.billDueDate);

    if (isNaN(billDate) || isNaN(dueDate) || 
        billDate < 1 || billDate > 31 || 
        dueDate < 1 || dueDate > 31) {
      setError('Dates must be between 1 and 31');
      return false;
    }

    return true;
  };

  // Improved navigation function that guarantees redirect to home screen
  const navigateToHome = () => {
    console.log('Navigating to home initiated...');
    
    // Reset edit mode and form data before navigating
    setIsEditMode(false);
    setFormData(initialFormState);
    
    // Try multiple navigation approaches to ensure at least one works
    setTimeout(() => {
      try {
        // First attempt - navigate with refresh param to force reload of cards
        router.navigate({
          pathname: '/(tabs)',
          params: { refresh: 'true' }
        });
      } catch (error) {
        console.error('First navigation attempt failed:', error);
        
        // Second attempt - replace route completely
        try {
          router.replace('/(tabs)');
        } catch (secondError) {
          console.error('Second navigation attempt failed:', secondError);
          
          // Last resort - use tabs directly
          try {
            router.navigate('/(tabs)/index');
          } catch (finalError) {
            console.error('All navigation attempts failed:', finalError);
          }
        }
      }
    }, 300); // Short delay to ensure API operation completes
  };

  const handleSubmit = async () => {
    try {
      if (!validateForm()) return;
      
      if (!isOnline) {
        Alert.alert('Error', 'No internet connection. Please try again when online.');
        return;
      }
      
      setLoading(true);
      setError('');

      const cardData = {
        ...formData,
        billGenerationDate: parseInt(formData.billGenerationDate),
        billDueDate: parseInt(formData.billDueDate)
      };

      if (isEditMode) {
        await cardApi.updateCard(formData.lastFourDigits, cardData);
        // Immediate navigation without Alert
        navigateToHome();
      } else {
        await cardApi.createCard(cardData);
        // Clear form data after successful submission
        setFormData(initialFormState);
        // Immediate navigation without Alert
        navigateToHome();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save card');
      Alert.alert('Error', err.message || 'Failed to save card');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingCard) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LinearGradient
          colors={['#1a1a1a', '#2d2d2d']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Fetching card details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <LinearGradient
          colors={['#1a1a1a', '#2d2d2d']}
          style={StyleSheet.absoluteFill}
        />

        {/* Bill Date Picker Modal */}
        <DatePicker
          visible={billDatePickerVisible}
          onClose={() => setBillDatePickerVisible(false)}
          onSelect={handleBillDateSelect}
          currentValue={formData.billGenerationDate}
        />

        {/* Due Date Picker Modal */}
        <DatePicker
          visible={dueDatePickerVisible}
          onClose={() => setDueDatePickerVisible(false)}
          onSelect={handleDueDateSelect}
          currentValue={formData.billDueDate}
        />

        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              // Clear params when navigating back to prevent persistence
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title}>{isEditMode ? 'Edit Card' : 'Add New Card'}</Text>
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <Text style={styles.label}>Last 4 Digits</Text>
            <TextInput
              style={[isEditMode ? styles.inputDisabled : styles.input]}
              placeholder="Enter last 4 digits"
              placeholderTextColor="#8e8e8e"
              value={formData.lastFourDigits}
              onChangeText={(text) => {
                setFormData({...formData, lastFourDigits: text});
                setError('');
              }}
              keyboardType="numeric"
              maxLength={4}
              editable={!isEditMode}
            />

            <Text style={styles.label}>Card Issuer </Text>
            <View style={styles.bankInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter Issuer name"
                placeholderTextColor="#8e8e8e"
                value={formData.bankName}
                onChangeText={handleBankNameChange}
                onFocus={() => filterBankSuggestions(formData.bankName)}
                onBlur={() => {
                  // Delay hiding suggestions to allow for selection
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              
              {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={bankSuggestions}
                    keyExtractor={(item) => item}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => selectBankSuggestion(item)}
                      >
                        <Text style={styles.suggestionText}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}
            </View>

            <Text style={styles.label}>Card Holder Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter card holder name"
              placeholderTextColor="#8e8e8e"
              value={formData.userName}
              onChangeText={(text) => {
                setFormData({...formData, userName: text});
                setError('');
              }}
            />

            <Text style={styles.label}>Bill Generation Date</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setBillDatePickerVisible(true)}
            >
              <Text style={styles.datePickerButtonText}>
                {formData.billGenerationDate 
                  ? `Day ${formData.billGenerationDate} of each month` 
                  : "Select bill generation date"}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#ffffff" />
            </TouchableOpacity>

            <Text style={styles.label}>Bill Due Date</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setDueDatePickerVisible(true)}
            >
              <Text style={styles.datePickerButtonText}>
                {formData.billDueDate 
                  ? `Day ${formData.billDueDate} of each month` 
                  : "Select bill due date"}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#ffffff" />
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, (loading || !isOnline) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || !isOnline}
            >
              <LinearGradient
                colors={['#4a4a4a', '#3a3a3a']}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isEditMode ? 'Update Card' : 'Add Card'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 60,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  offlineBadge: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // Increased padding to ensure button is visible
  },
  formContainer: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  label: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 20,
  },
  inputDisabled: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 20,
    opacity: 0.5,
  },
  bankInputContainer: {
    position: 'relative',
    zIndex: 1,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#3d3d3d',
    borderRadius: 10,
    maxHeight: 150,
    marginTop: -15,
    marginBottom: 20,
    zIndex: 2,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  suggestionText: {
    color: '#ffffff',
    fontSize: 16,
  },
  // Date picker button styles
  datePickerButton: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  // Date picker modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  datePickerContainer: {
    width: '70%', 
    maxWidth: 320,
    backgroundColor: '#2d2d2d',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start', 
    marginBottom: 10,
  },
  dayButton: {
    width: '16%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: '1%',
    borderRadius: 5,
    backgroundColor: '#3a3a3a',
  },
  selectedDayButton: {
    backgroundColor: '#4a90e2',
  },
  dayText: {
    color: '#ffffff',
    fontSize: 14,
  },
  selectedDayText: {
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
    alignItems: 'center',
    marginTop: 5,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 15,
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 40, // Added significant bottom margin
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});