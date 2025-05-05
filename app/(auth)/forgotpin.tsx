import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useAuth } from '../../context/auth';
import CountryCodeSelector from '../../components/CountryCodeSelector';

const { width } = Dimensions.get('window');

export default function ForgotPINScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [phoneIdentifier, setPhoneIdentifier] = useState('');
  const [isPhone, setIsPhone] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const { signIn } = useAuth();

  // Clear error when changing inputs
  useEffect(() => {
    setError('');
  }, [emailIdentifier, phoneIdentifier, otp, newPin, confirmPin, isPhone]);

  // Handle identifier input change based on type
  const handleIdentifierChange = (text: string) => {
    if (isPhone) {
      setPhoneIdentifier(text);
    } else {
      setEmailIdentifier(text);
    }
  };

  // Toggle between email and phone
  const toggleIdentifierType = (usePhone: boolean) => {
    setIsPhone(usePhone);
  };

  // Get the current identifier based on type
  const getCurrentIdentifier = () => {
    return isPhone ? phoneIdentifier : emailIdentifier;
  };

  // Format the identifier for API request
  const getFormattedIdentifier = () => {
    if (isPhone) {
      const cleanPhoneNumber = phoneIdentifier.replace(/\D/g, '');
      return `${countryCode} ${cleanPhoneNumber}`;
    }
    return emailIdentifier;
  };

  // Step 1: Request OTP
  const handleRequestOTP = async () => {
    const identifier = getCurrentIdentifier();
    
    if (!identifier) {
      setError('Please enter your email or phone number');
      return;
    }

    // Validate email or phone based on selected type
    if (isPhone) {
      if (!/^\d+$/.test(identifier)) {
        setError('Please enter a valid phone number (digits only)');
        return;
      }
    } else {
      if (!/\S+@\S+\.\S+/.test(identifier)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const formattedIdentifier = getFormattedIdentifier();
      console.log('Requesting OTP for:', formattedIdentifier);
      
      const response = await api.forgetPin({
        identifier: formattedIdentifier,
        step: 1
      });

      if (response.success) {
        setCurrentStep(2);
        setSuccess(`OTP sent successfully! Please check your ${isPhone ? 'phone' : 'email'}`);
      } else {
        throw new Error(response.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      console.error('Request OTP error:', err);
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and set new PIN
  const handleResetPIN = async () => {
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }

    if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setError('PIN must be 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const formattedIdentifier = getFormattedIdentifier();
      console.log('Resetting PIN for:', formattedIdentifier);
      
      const response = await api.forgetPin({
        identifier: formattedIdentifier,
        step: 2,
        otp,
        newPin
      });

      if (response.success) {
        setSuccess('PIN changed successfully!');
        
        // Automatically redirect to login page after successful PIN reset
        // Short delay to allow user to see the success message
        setTimeout(() => {
          router.replace('/login');
        }, 1500);
      } else {
        throw new Error(response.message || 'Failed to reset PIN');
      }
    } catch (err: any) {
      console.error('Reset PIN error:', err);
      setError(err.message || 'Failed to reset PIN');
    } finally {
      setLoading(false);
    }
  };

  // Render the appropriate step
  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Reset PIN with</Text>
            <View style={styles.loginTypeContainer}>
              <TouchableOpacity 
                style={[
                  styles.loginTypeButton, 
                  !isPhone && styles.loginTypeButtonActive
                ]}
                onPress={() => toggleIdentifierType(false)}
                disabled={loading}
              >
                <Text style={[
                  styles.loginTypeText,
                  !isPhone && styles.loginTypeTextActive
                ]}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.loginTypeButton, 
                  isPhone && styles.loginTypeButtonActive
                ]}
                onPress={() => toggleIdentifierType(true)}
                disabled={loading}
              >
                <Text style={[
                  styles.loginTypeText,
                  isPhone && styles.loginTypeTextActive
                ]}>Phone</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.secondaryLabel}>{isPhone ? 'Phone Number' : 'Email Address'}</Text>
            <View style={styles.identifierContainer}>
              {isPhone && (
                <CountryCodeSelector
                  selectedCode={countryCode}
                  onSelect={setCountryCode}
                />
              )}
              <TextInput
                style={[
                  styles.input, 
                  isPhone && styles.phoneInput
                ]}
                placeholder={isPhone ? "Enter phone number" : "Enter email address"}
                placeholderTextColor="#8e8e8e"
                value={getCurrentIdentifier()}
                onChangeText={handleIdentifierChange}
                autoCapitalize="none"
                keyboardType={isPhone ? "phone-pad" : "email-address"}
                editable={!loading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRequestOTP}
            disabled={loading}
          >
            <LinearGradient
              colors={['#4a4a4a', '#3a3a3a']}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Get OTP</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      );
    } else if (currentStep === 2) {
      return (
        <>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter OTP"
              placeholderTextColor="#8e8e8e"
              value={otp}
              onChangeText={setOtp}
              keyboardType="numeric"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>New PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new 4-digit PIN"
              placeholderTextColor="#8e8e8e"
              value={newPin}
              onChangeText={setNewPin}
              secureTextEntry={true}
              keyboardType="numeric"
              maxLength={4}
              editable={!loading}
              textContentType="password"
              passwordRules="minlength: 4; maxlength: 4; required: digit;"
              clearTextOnFocus={false}
              autoCorrect={false}
              autoComplete="password"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm new 4-digit PIN"
              placeholderTextColor="#8e8e8e"
              value={confirmPin}
              onChangeText={setConfirmPin}
              secureTextEntry={true}
              keyboardType="numeric"
              maxLength={4}
              editable={!loading}
              textContentType="password"
              passwordRules="minlength: 4; maxlength: 4; required: digit;"
              clearTextOnFocus={false}
              autoCorrect={false}
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPIN}
            disabled={loading}
          >
            <LinearGradient
              colors={['#4a4a4a', '#3a3a3a']}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Reset PIN</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setCurrentStep(1)}
            disabled={loading}
          >
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        </>
      );
    }
    
    return null;
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <LinearGradient
        colors={['#1a1a1a', '#2d2d2d']}
        style={styles.background}
      />
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View 
          entering={FadeInDown.duration(1000).springify()} 
          style={styles.header}
        >
          <Text style={styles.title}>Forgot PIN</Text>
          <Text style={styles.subtitle}>Reset your account PIN</Text>
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.duration(1000).springify()} 
          style={styles.formContainer}
        >
          {success ? <Text style={styles.success}>{success}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {renderStep()}

          <TouchableOpacity
            onPress={() => router.push('/login')}
            style={[styles.linkButton, { marginTop: 15 }]}
            disabled={loading}
          >
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8e8e8e',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
  },
  secondaryLabel: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 16,
  },
  loginTypeContainer: {
    flexDirection: 'row',
    marginTop: 5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2d2d2d',
  },
  loginTypeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginTypeButtonActive: {
    backgroundColor: '#3a3a3a',
  },
  loginTypeText: {
    color: '#8e8e8e',
    fontSize: 14,
    fontWeight: '500',
  },
  loginTypeTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  identifierContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  phoneInput: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  button: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    padding: 10,
  },
  linkText: {
    color: '#8e8e8e',
    fontSize: 14,
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 15,
    textAlign: 'center',
    padding: 5,
  },
  success: {
    color: '#4CD964',
    marginBottom: 15,
    textAlign: 'center',
    padding: 5,
  },
});