// (tabs)/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl, DeviceEventEmitter, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { cardApi, CreditCard, BANKS } from '../../services/cardApi';
import NetInfo from '@react-native-community/netinfo';
import { SelectList } from 'react-native-dropdown-select-list';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import SMSScanner from '../../components/SMSScanner';
import { useAuth } from '../../context/auth';

let smsListenerService: any = {
  updateCards: () => {},
  startListening: async () => false,
  stopListening: async () => {}
};

// Try to import the SMS module, but don't crash if it's not available
try {
  smsListenerService = require('../../services/smsListenerService').default;
} catch (error) {
  console.log('SMS listener service could not be imported:', error);
}

type SortOption = 'billDate' | 'dueDate' | 'name' | 'bank' | 'creditDays';
type SortDirection = 'asc' | 'desc';

// Function to calculate remaining days until a target date
const calculateDaysRemaining = (targetDay: string) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Create a date object for the target day in current month
  let targetDate = new Date(currentYear, currentMonth, parseInt(targetDay));
  
  // If the target date has already passed this month, go to next month
  if (targetDate < today) {
    targetDate = new Date(currentYear, currentMonth + 1, parseInt(targetDay));
  }
  
  // Calculate difference in days
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Function to calculate credit days (days from today until the payment due date after next bill)
const calculateCreditDays = (billDate: string, dueDate: string) => {
  // Convert string dates to numbers
  const billDay = parseInt(billDate);
  const dueDay = parseInt(dueDate);
  
  // Get current date
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Calculate next bill date
  let nextBillDate = new Date(currentYear, currentMonth, billDay);
  
  // If bill date has passed this month, look at next month's bill date
  if (billDay <= currentDay) {
    nextBillDate = new Date(currentYear, currentMonth + 1, billDay);
  }
  
  // Calculate due date after the next bill
  let dueDateAfterBill;
  
  // If due day is after bill day in the monthly cycle
  if (dueDay > billDay) {
    // Due date is in the same month as the bill date
    dueDateAfterBill = new Date(nextBillDate.getFullYear(), nextBillDate.getMonth(), dueDay);
  } else {
    // Due date is in the month after the bill date
    dueDateAfterBill = new Date(nextBillDate.getFullYear(), nextBillDate.getMonth() + 1, dueDay);
  }
  
  // Calculate difference in days
  const oneDayMs = 24 * 60 * 60 * 1000;
  const diffMs = dueDateAfterBill.getTime() - today.getTime();
  return Math.round(diffMs / oneDayMs);
};

// Function to calculate both dates simultaneously
const getCardDatesInfo = (billDate: string, dueDate: string) => {
  // Calculate days until bill generation date
  const billDaysLeft = calculateDaysRemaining(billDate);
  
  // Calculate days until due date
  const dueDaysLeft = calculateDaysRemaining(dueDate);
  
  // Calculate credit days (interest-free period)
  const creditDays = calculateCreditDays(billDate, dueDate);
  
  return {
    billDaysLeft,
    dueDaysLeft,
    creditDays
  };
};

export default function HomeScreen() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('creditDays');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showSmsScanner, setShowSmsScanner] = useState<boolean>(false);
  
  // Custom confirmation dialog state
  const [confirmDialogVisible, setConfirmDialogVisible] = useState<boolean>(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signOut } = useAuth();

  // Debug isOnline state
  useEffect(() => {
    console.log('Current isOnline state:', isOnline);
  }, [isOnline]);

  // Function to handle authentication failure
  const handleAuthFailure = useCallback(async () => {
    console.log('Authentication failed, logging out automatically...');
    try {
      await signOut();
      // No need to navigate as signOut should handle redirecting to the login screen
    } catch (error) {
      console.error('Error during automatic logout:', error);
    }
  }, [signOut]);

  // Effect to check for authentication failures
  useEffect(() => {
    if (error === 'Authentication failed') {
      handleAuthFailure();
    }
  }, [error, handleAuthFailure]);

  const loadCards = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      // Check for internet connection
      const netInfo = await NetInfo.fetch();
      console.log('Network status:', netInfo.isConnected ? 'Connected' : 'Disconnected');
      
      if (!netInfo.isConnected) {
        setError("No internet connection. Please check your network and try again.");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      console.log("Fetching cards from API...");
      const fetchedCards = await cardApi.getAllCards();
      console.log(`Fetched ${fetchedCards.length} cards`);
      
      setCards(fetchedCards);
      setFilteredCards(fetchedCards);
      
      // Update cards in SMS listener service
      if (Platform.OS === 'android') {
        smsListenerService.updateCards(fetchedCards);
      }
    } catch (error: any) {
      console.error('Error loading cards:', error);
      const errorMessage = error.message || "Failed to load cards. Please try again.";
      setError(errorMessage);
      
      // Check if the error is an authentication failure
      if (errorMessage.includes('Authentication failed') || errorMessage === 'Authentication failed') {
        handleAuthFailure();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleAuthFailure]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCards(false);
  }, [loadCards]);

  // Check for refresh parameter when screen comes into focus
  useEffect(() => {
    if (params.refresh === 'true') {
      console.log("Refresh parameter detected, reloading cards...");
      loadCards(true);
      
      // Clear the refresh parameter to prevent endless refreshing
      // This is a workaround since we can't directly modify URL params in expo-router
      setTimeout(() => {
        router.setParams({});
      }, 500);
    }
  }, [params.refresh, loadCards, router]);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !isOnline;
      setIsOnline(state.isConnected ?? false);
      
      // Reload cards when coming back online
      if (wasOffline && state.isConnected) {
        loadCards(false);
      }
    });

    return () => unsubscribe();
  }, [isOnline, loadCards]);

  // Start SMS listener when the app loads
  useEffect(() => {
    const startListener = async () => {
      if (Platform.OS === 'android' && cards.length > 0) {
        const started = await smsListenerService.startListening(cards);
        console.log('SMS listener started:', started);
      }
    };
    
    // Start the listener
    startListener();
    
    // Listen for card updates from SMS
    const subscription = DeviceEventEmitter.addListener(
      'CardUpdatedFromSMS',
      (event) => {
        console.log('Card updated from SMS, refreshing list:', event);
        loadCards(false);
      }
    );
    
    return () => {
      // Clean up listener
      subscription.remove();
      
      // Stop SMS listener when component unmounts
      if (Platform.OS === 'android') {
        smsListenerService.stopListening();
      }
    };
  }, [cards]);

  // Initial load and refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCards();
      // Ensure sorting by credit days in descending order is applied by default
      setSortBy('creditDays');
      setSortDirection('desc');
    }, [loadCards])
  );

  // Sort and filter cards
  useEffect(() => {
    let sorted = [...cards];
    
    // Apply bank filter
    if (selectedBank) {
      sorted = sorted.filter(card => card.bankName === selectedBank);
    }

    // Apply sorting
    sorted.sort((a, b) => {
      let compareValueA: string | number = '';
      let compareValueB: string | number = '';

      switch (sortBy) {
        case 'billDate':
          compareValueA = a.billGenerationDate;
          compareValueB = b.billGenerationDate;
          break;
        case 'dueDate':
          compareValueA = a.billDueDate;
          compareValueB = b.billDueDate;
          break;
        case 'name':
          compareValueA = a.userName.toLowerCase();
          compareValueB = b.userName.toLowerCase();
          break;
        case 'bank':
          compareValueA = a.bankName.toLowerCase();
          compareValueB = b.bankName.toLowerCase();
          break;
        case 'creditDays':
          // Calculate credit days for sorting
          compareValueA = calculateCreditDays(a.billGenerationDate, a.billDueDate);
          compareValueB = calculateCreditDays(b.billGenerationDate, b.billDueDate);
          break;
      }

      if (compareValueA < compareValueB) return sortDirection === 'asc' ? -1 : 1;
      if (compareValueA > compareValueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredCards(sorted);
  }, [cards, sortBy, sortDirection, selectedBank]);

  // Function to handle SMS scan completion
  const handleScanComplete = (result: any) => {
    console.log('SMS scan complete:', result);
    
    if (result.success && result.updatedCards > 0) {
      // Reload cards to show updated information
      loadCards(false);
    }
  };

  // Custom delete function that opens the confirmation dialog
  const handleDelete = (card: CreditCard) => {
    console.log('handleDelete function called for card:', card.lastFourDigits);
    
    if (!isOnline) {
      console.log('User is offline, showing offline message');
      setDeleteStatus('You\'re offline. Please reconnect to delete a card.');
      setTimeout(() => setDeleteStatus(null), 3000);
      return;
    }
    
    // Set the card to delete and show confirmation dialog
    setCardToDelete(card);
    setConfirmDialogVisible(true);
    console.log('Showing custom delete confirmation dialog');
  };

  // Function to execute when delete is confirmed
  const confirmDelete = async () => {
    console.log('Delete confirmed, starting delete operation');
    
    if (!cardToDelete) {
      console.error('No card selected for deletion');
      return;
    }
    
    setConfirmDialogVisible(false);
    setLoading(true);
    
    try {
      console.log(`Attempting to delete card with last four digits: ${cardToDelete.lastFourDigits}`);
      await cardApi.deleteCard(cardToDelete.lastFourDigits);
      console.log('Delete operation completed successfully');
      
      // Force a complete reload of cards from API
      const fetchedCards = await cardApi.getAllCards();
      console.log(`After delete, fetched ${fetchedCards.length} cards`);
      setCards(fetchedCards);
      setFilteredCards(fetchedCards);
      
      setDeleteStatus('Card deleted successfully');
      setTimeout(() => setDeleteStatus(null), 3000);
    } catch (error: any) {
      console.error('Delete operation failed:', error);
      const errorMessage = error.message || 'Failed to delete card';
      setDeleteStatus(errorMessage);
      
      // Check if the error is an authentication failure
      if (errorMessage.includes('Authentication failed') || errorMessage === 'Authentication failed') {
        handleAuthFailure();
      } else {
        setTimeout(() => setDeleteStatus(null), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to cancel delete
  const cancelDelete = () => {
    console.log('Delete canceled');
    setConfirmDialogVisible(false);
    setCardToDelete(null);
  };

  const handleEdit = (card: CreditCard) => {
    if (!isOnline) {
      setDeleteStatus('You\'re offline. Please reconnect to edit a card.');
      setTimeout(() => setDeleteStatus(null), 3000);
      return;
    }
    
    // Include explicit editMode flag in navigation params
    router.push({
      pathname: '/add-card',
      params: { 
        cardId: card.lastFourDigits,
        editMode: 'true'
      }
    });
  };

  const handleAddCard = () => {
    if (!isOnline) {
      setDeleteStatus('You\'re offline. Please reconnect to add a card.');
      setTimeout(() => setDeleteStatus(null), 3000);
      return;
    }
    
    // Explicitly navigate with reset param to force a fresh start
    router.push({
      pathname: '/add-card',
      params: { reset: 'true' }
    });
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const getSortButtonColor = (option: SortOption) => {
    return sortBy === option ? '#ffffff' : '#8e8e8e';
  };

  const renderFilterBar = () => (
    <View style={styles.filterContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterButtons}
      >
        {/* Credit Days filter button - Now First */}
        <TouchableOpacity 
          style={[styles.filterButton, sortBy === 'creditDays' && styles.filterButtonActive]}
          onPress={() => {
            if (sortBy === 'creditDays') {
              toggleSortDirection();
            } else {
              setSortBy('creditDays');
              setSortDirection('desc'); // Default to showing highest credit days first
            }
          }}
        >
          <Text style={[styles.filterText, { color: getSortButtonColor('creditDays') }]}>
            Credit Period {' '}
            {sortBy === 'creditDays' && (
              <Ionicons 
                name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'} 
                size={14} 
                color="#ffffff" 
              />
            )}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterButton, sortBy === 'billDate' && styles.filterButtonActive]}
          onPress={() => {
            if (sortBy === 'billDate') {
              toggleSortDirection();
            } else {
              setSortBy('billDate');
              setSortDirection('asc');
            }
          }}
        >
          <Text style={[styles.filterText, { color: getSortButtonColor('billDate') }]}>
            Bill Date {' '}
            {sortBy === 'billDate' && (
              <Ionicons 
                name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'} 
                size={14} 
                color="#ffffff" 
              />
            )}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterButton, sortBy === 'dueDate' && styles.filterButtonActive]}
          onPress={() => {
            if (sortBy === 'dueDate') {
              toggleSortDirection();
            } else {
              setSortBy('dueDate');
              setSortDirection('asc');
            }
          }}
        >
          <Text style={[styles.filterText, { color: getSortButtonColor('dueDate') }]}>
            Due Date {' '}
            {sortBy === 'dueDate' && (
              <Ionicons 
                name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'} 
                size={14} 
                color="#ffffff" 
              />
            )}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterButton, sortBy === 'name' && styles.filterButtonActive]}
          onPress={() => {
            if (sortBy === 'name') {
              toggleSortDirection();
            } else {
              setSortBy('name');
              setSortDirection('asc');
            }
          }}
        >
          <Text style={[styles.filterText, { color: getSortButtonColor('name') }]}>
            Name {' '}
            {sortBy === 'name' && (
              <Ionicons 
                name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'} 
                size={14} 
                color="#ffffff" 
              />
            )}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterButton, sortBy === 'bank' && styles.filterButtonActive]}
          onPress={() => {
            if (sortBy === 'bank') {
              toggleSortDirection();
            } else {
              setSortBy('bank');
              setSortDirection('asc');
            }
          }}
        >
          <Text style={[styles.filterText, { color: getSortButtonColor('bank') }]}>
            Bank {' '}
            {sortBy === 'bank' && (
              <Ionicons 
                name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'} 
                size={14} 
                color="#ffffff" 
              />
            )}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bankFilterContainer}>
        <SelectList
          setSelected={(val: string) => setSelectedBank(val)}
          data={[
            { key: '', value: 'All Banks' },
            ...BANKS.map(bank => ({ key: bank, value: bank }))
          ]}
          save="value"
          search={true}
          defaultOption={{ key: '', value: 'All Banks' }}
          boxStyles={styles.bankSelect}
          dropdownStyles={styles.bankDropdown}
          inputStyles={styles.bankSelectText}
          dropdownTextStyles={styles.bankDropdownText}
          searchPlaceholder="Search banks..."
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#1a1a1a', '#2d2d2d']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading cards...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2d2d2d']}
        style={StyleSheet.absoluteFill}
      />

      {/* Custom confirmation dialog */}
      <ConfirmationDialog 
        visible={confirmDialogVisible}
        title="Delete Card"
        message={cardToDelete ? `Are you sure you want to delete card ending with ${cardToDelete.lastFourDigits}?` : ''}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        confirmText="Delete"
        isDestructive={true}
      />

      <View style={styles.header}>
        <Text style={styles.title}>My Cards</Text>
        <View style={styles.headerRightContainer}>
          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={16} color="#ff9800" />
              <Text style={styles.offlineText}>Offline Mode</Text>
            </View>
          )}
          
          {/* SMS Scan button */}
          <TouchableOpacity 
            style={[styles.smsButton, !isOnline && styles.buttonDisabled]}
            onPress={() => setShowSmsScanner(!showSmsScanner)}
            disabled={!isOnline}
          >
            <Ionicons name="chatbubbles-outline" size={16} color="#ffffff" />
            <Text style={styles.smsButtonText}>
              {showSmsScanner ? 'Hide Scanner' : 'SMS Scanner'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SMS Scanner Component */}
      <SMSScanner 
        isVisible={showSmsScanner}
        cards={cards}
        onScanComplete={handleScanComplete}
      />

      {renderFilterBar()}

      {/* Status message for delete operations */}
      {deleteStatus && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{deleteStatus}</Text>
        </View>
      )}

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#ffffff"]}
            tintColor="#ffffff"
          />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#ff6b6b" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => loadCards()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredCards.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color="#8e8e8e" />
            <Text style={styles.emptyText}>
              {cards.length === 0 ? 'No cards added yet' : 'No cards match the filter'}
            </Text>
            {cards.length === 0 && isOnline && (
              <TouchableOpacity 
                style={styles.addButton}
                onPress={handleAddCard}
              >
                <Text style={styles.addButtonText}>Add Your First Card</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {filteredCards.map((card) => {
              const datesInfo = getCardDatesInfo(card.billGenerationDate, card.billDueDate);
              
              // Determine credit days color based on the available credit period
              let creditDaysStatusColor;
              
              // Colors for credit days (more days = better)
              if (datesInfo.creditDays >= 45) {
                creditDaysStatusColor = '#4caf50'; // green for excellent (45+ days)
              } else if (datesInfo.creditDays >= 30) {
                creditDaysStatusColor = '#8bc34a'; // light green for very good (30-44 days)
              } else if (datesInfo.creditDays >= 20) {
                creditDaysStatusColor = '#cddc39'; // lime for good (20-29 days)
              } else if (datesInfo.creditDays >= 15) {
                creditDaysStatusColor = '#ffc107'; // amber for average (15-19 days)
              } else if (datesInfo.creditDays >= 10) {
                creditDaysStatusColor = '#ff9800'; // orange for below average (10-14 days)
              } else {
                creditDaysStatusColor = '#ff5252'; // red for very short credit period (<10 days)
              }
              
              // Simplified text for bill generation
              const billStatusText = `${datesInfo.billDaysLeft} days left for bill generation`;
              
              // Revised text for payment due with due date at the end
              const dueStatusText = `${datesInfo.dueDaysLeft} days left for payment due date`;
              
              // Colors for due date status
              const dueStatusColor = datesInfo.dueDaysLeft <= 3 
                ? '#ff5252' // red for urgent (3 days or less)
                : datesInfo.dueDaysLeft <= 7 
                  ? '#ffa726' // orange for attention (4-7 days)
                  : '#4caf50'; // green for plenty of time (more than 7 days)
              
              return (
                <View key={card._id || card.lastFourDigits} style={styles.cardContainer}>
                  <LinearGradient
                    colors={['#3a3a3a', '#2d2d2d']}
                    style={styles.card}
                  >
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.bankName}>{card.bankName}</Text>
                        <Text style={styles.cardNumber}>•••• {card.lastFourDigits}</Text>
                      </View>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity 
                          style={[styles.actionButton, !isOnline && styles.buttonDisabled]}
                          onPress={() => handleEdit(card)}
                          disabled={!isOnline}
                        >
                          <Ionicons name="pencil" size={20} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.deleteButton, !isOnline && styles.buttonDisabled]}
                          onPress={() => {
                            console.log('Delete button clicked for card:', card.lastFourDigits);
                            handleDelete(card);
                          }}
                          disabled={!isOnline}
                        >
                          <Ionicons name="trash" size={20} color="#ff6b6b" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {/* Credit Days Feature - Prominent Display */}
                    <View style={styles.creditDaysContainer}>
                      <LinearGradient
                        colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.3)']}
                        style={styles.creditDaysGradient}
                      >
                        <View style={styles.creditDaysContent}>
                          <Text style={styles.creditDaysTitle}>Credit Period</Text>
                          <Text style={[styles.creditDaysValue, { color: creditDaysStatusColor }]}>
                            {datesInfo.creditDays} Days
                          </Text>
                          <Ionicons 
                            name="time-outline" 
                            size={24} 
                            color={creditDaysStatusColor} 
                            style={styles.creditDaysIcon}
                          />
                        </View>
                      </LinearGradient>
                    </View>
                    
                    <View style={styles.cardBody}>
                      <Text style={styles.userName}>{card.userName}</Text>
                      <View style={styles.dates}>
                        {/* Left date container - Bill Date */}
                        <View style={styles.dateContainerLeft}>
                          <Text style={styles.dateLabel}>Bill Date</Text>
                          <Text style={styles.dateValue}>{card.billGenerationDate}</Text>
                          <View style={styles.billStatusContainer}>
                            <Text style={[styles.dateStatusText, { color: '#ffffff' }]}>
                              {billStatusText}
                            </Text>
                          </View>
                        </View>
                        
                        {/* Right date container - Due Date */}
                        <View style={styles.dateContainerRight}>
                          <Text style={[styles.dateLabel, styles.dateLabelRight]}>Due Date</Text>
                          <Text style={[styles.dateValue, styles.dateValueRight]}>{card.billDueDate}</Text>
                          <View style={styles.dueDateStatusContainer}>
                            <Text style={[styles.dueDateStatusText, { color: dueStatusColor }]}>
                              {dueStatusText}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Remove the Add Card FAB (circular button) as requested */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  smsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a4a4a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  smsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 6,
  },
  filterContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  filterButtons: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2d2d2d',
  },
  filterButtonActive: {
    backgroundColor: '#4a4a4a',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bankFilterContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  bankSelect: {
    backgroundColor: '#2d2d2d',
    borderRadius: 20,
    borderWidth: 0,
    paddingHorizontal: 16,
    height: 40,
  },
  bankDropdown: {
    backgroundColor: '#2d2d2d',
    borderWidth: 0,
    marginTop: 5,
    borderRadius: 10,
    maxHeight: 200,
  },
  bankSelectText: {
    color: '#ffffff',
    fontSize: 14,
  },
  bankDropdownText: {
    color: '#ffffff',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  offlineText: {
    color: '#ff9800',
    marginLeft: 6,
    fontSize: 14,
  },
  statusContainer: {
    backgroundColor: '#2d2d2d',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  cardContainer: {
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
  },
  card: {
    padding: 20,
    borderRadius: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  bankName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  cardNumber: {
    fontSize: 16,
    color: '#8e8e8e',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4a4a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#2d2d2d',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Credit Days container styles
  creditDaysContainer: {
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  creditDaysGradient: {
    borderRadius: 12,
    padding: 12,
  },
  creditDaysContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditDaysTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },
  creditDaysValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  creditDaysIcon: {
    marginLeft: 5,
  },
  cardBody: {
    gap: 15,
  },
  userName: {
    fontSize: 16,
    color: '#ffffff',
  },
  // Updated date container and alignment styles
  dates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dateContainerLeft: {
    width: '48%',
    alignItems: 'flex-start',
  },
  dateContainerRight: {
    width: '48%',
    alignItems: 'flex-end', // This right-aligns all content
  },
  dateLabel: {
    fontSize: 12,
    color: '#8e8e8e',
    marginBottom: 4,
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  dateLabelRight: {
    textAlign: 'right',
  },
  dateValue: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  dateValueRight: {
    textAlign: 'right',
  },
  billStatusContainer: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
  },
  dueDateStatusContainer: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
  },
  dateStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dueDateStatusText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#8e8e8e',
    fontSize: 16,
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#4a4a4a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#4a4a4a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
});