import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { cardApi, CreditCard, BANKS } from '../../services/cardApi';
import NetInfo from '@react-native-community/netinfo';
import { SelectList } from 'react-native-dropdown-select-list';
import ConfirmationDialog from '../../components/ConfirmationDialog'; // Import the custom dialog

type SortOption = 'billDate' | 'dueDate' | 'name' | 'bank';
type SortDirection = 'asc' | 'desc';

export default function HomeScreen() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('billDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Custom confirmation dialog state
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  
  const router = useRouter();
  const params = useLocalSearchParams();

  // Debug isOnline state
  useEffect(() => {
    console.log('Current isOnline state:', isOnline);
  }, [isOnline]);

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
    } catch (error: any) {
      console.error('Error loading cards:', error);
      setError(error.message || "Failed to load cards. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  // Initial load and refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCards();
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
      }

      if (compareValueA < compareValueB) return sortDirection === 'asc' ? -1 : 1;
      if (compareValueA > compareValueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredCards(sorted);
  }, [cards, sortBy, sortDirection, selectedBank]);

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
      setDeleteStatus(error.message || 'Failed to delete card');
      setTimeout(() => setDeleteStatus(null), 3000);
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
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={16} color="#ff9800" />
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
        )}
      </View>

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
            {filteredCards.map((card) => (
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
                  <View style={styles.cardBody}>
                    <Text style={styles.userName}>{card.userName}</Text>
                    <View style={styles.dates}>
                      <View>
                        <Text style={styles.dateLabel}>Bill Date</Text>
                        <Text style={styles.dateValue}>{card.billGenerationDate}</Text>
                      </View>
                      <View>
                        <Text style={styles.dateLabel}>Due Date</Text>
                        <Text style={styles.dateValue}>{card.billDueDate}</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </>
        )}
      </ScrollView>

    
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
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
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
    marginTop: 8,
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
    marginBottom: 20,
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
  cardBody: {
    gap: 15,
  },
  userName: {
    fontSize: 16,
    color: '#ffffff',
  },
  dates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dateLabel: {
    fontSize: 12,
    color: '#8e8e8e',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    color: '#ffffff',
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
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabDisabled: {
    opacity: 0.5,
  },
  fabGradient: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  }
});