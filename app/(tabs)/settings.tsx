import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Switch, 
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import api from '../../services/api';

const SettingItem = ({ icon, title, value, isSwitch, onPress }) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress}>
    <LinearGradient
      colors={['#2d2d2d', '#1a1a1a']}
      style={styles.settingGradient}
    >
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={24} color="#ffffff" />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      {isSwitch ? (
        <Switch value={value} onValueChange={onPress} />
      ) : (
        <Ionicons name="chevron-forward" size={24} color="#8e8e8e" />
      )}
    </LinearGradient>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const router = useRouter();
  const { userData, logout } = useAuth();
  const [notifications, setNotifications] = React.useState(true);
  const [biometric, setBiometric] = React.useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };

  const confirmDeleteAccount = async () => {
    try {
      setIsLoading(true);
      
      // Call the API to delete the account
      await api.deleteAccount();
      
      // After successful deletion, close modal and sign out
      setShowDeleteModal(false);
      await signOut();
      
      // Show success message
      Alert.alert(
        "Account Deleted",
        "Your account has been successfully deleted.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert(
        "Delete Failed", 
        error.message || "Failed to delete account. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2d2d2d']}
        style={styles.background}
      />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.profile}>
          <LinearGradient
            colors={['#3a3a3a', '#2d2d2d']}
            style={styles.profileCard}
          >
            <View style={styles.profileIcon}>
              <Ionicons name="person" size={40} color="#ffffff" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userData?.email}</Text>
              {userData?.phone && (
                <Text style={styles.profileEmail}>{userData.phone}</Text>
              )}
            </View>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
         
          <SettingItem
            icon="card-outline"
            title="Cards & Banking"
            onPress={() => router.push('/add-card')}
          />
          
          <SettingItem
            icon="trash-outline"
            title="Delete Account"
            onPress={handleDeleteAccount}
          />
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout} 
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#ff6b6b', '#ff5252']}
            style={styles.logoutGradient}
          >
            <Ionicons name="log-out-outline" size={24} color="#ffffff" />
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#2d2d2d', '#1a1a1a']}
              style={styles.modalGradient}
            >
              <View style={styles.modalIconContainer}>
                <View style={styles.modalIconBackground}>
                  <Ionicons name="warning-outline" size={40} color="#ff5252" />
                </View>
              </View>
              
              <Text style={styles.modalTitle}>Delete Account</Text>
              
              <Text style={styles.modalText}>
                This action will permanently delete your account and all associated cards. This cannot be undone.
              </Text>
              
              <Text style={styles.modalQuestion}>
                Are you sure you want to delete your account?
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={cancelDelete}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.deleteButton]} 
                  onPress={confirmDeleteAccount}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Yes, Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Increased padding for tab bar
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
  profile: {
    padding: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  profileIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a4a4a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#8e8e8e',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8e8e8e',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingItem: {
    marginBottom: 10,
    borderRadius: 15,
    overflow: 'hidden',
  },
  settingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#ffffff',
  },
  logoutButton: {
    margin: 20,
    marginBottom: 40,
    borderRadius: 15,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalGradient: {
    paddingHorizontal: 25,
    paddingVertical: 30,
    alignItems: 'center',
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#cccccc',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 25,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#3a3a3a',
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: '#ff5252',
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});