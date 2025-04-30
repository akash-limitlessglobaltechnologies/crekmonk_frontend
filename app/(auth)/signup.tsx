import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import storage from '../../utils/storage';
import api from '../../services/api';
import CountryCodeSelector from '../../components/CountryCodeSelector';

const { width } = Dimensions.get('window');

interface StepData {
  email?: string;
  emailOtp?: string;
  phone?: string;
  phoneOtp?: string;
  pin?: string;
  countryCode?: string;
}

type StepNumber = 1 | 2 | 3 | 4 | 5;

const stepTitles: Record<StepNumber, string> = {
  1: 'Enter Email',
  2: 'Verify Email',
  3: 'Enter Phone',
  4: 'Verify Phone',
  5: 'Create PIN'
};

const stepDescriptions: Record<StepNumber, string> = {
  1: 'Please enter your email address to get started',
  2: 'Enter the verification code sent to your email',
  3: 'Enter your phone number for additional security',
  4: 'Enter the verification code sent to your phone',
  5: 'Create a 4-digit PIN for secure access'
};

export default function SignupScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [data, setData] = useState<StepData>({
    countryCode: '+91', // Default to India country code
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear input fields when step changes
  useEffect(() => {
    // Clear OTP fields when moving to a new step
    if (currentStep === 2) {
      setData(prev => ({ ...prev, emailOtp: '' }));
    }
    if (currentStep === 4) {
      setData(prev => ({ ...prev, phoneOtp: '' }));
    }
    setError(''); // Clear any error messages
  }, [currentStep]);

  const handleSignupStep = async () => {
    try {
      setLoading(true);
      setError('');
  
      // Validate input for current step
      if (currentStep === 1 && !data.email) {
        setError('Please enter your email address');
        setLoading(false);
        return;
      } else if (currentStep === 2 && !data.emailOtp) {
        setError('Please enter the verification code');
        setLoading(false);
        return;
      } else if (currentStep === 3 && !data.phone) {
        setError('Please enter your phone number');
        setLoading(false);
        return;
      } else if (currentStep === 4 && !data.phoneOtp) {
        setError('Please enter the verification code');
        setLoading(false);
        return;
      } else if (currentStep === 5 && (!data.pin || data.pin.length !== 4)) {
        setError('Please enter a 4-digit PIN');
        setLoading(false);
        return;
      }
      
      // Prepare request data
      const requestData = {
        step: currentStep,
        ...data
      };
  
      // Format phone number correctly with country code and space
      if (data.phone) {
        // Clean the phone number to remove any non-digit characters
        const cleanPhoneNumber = data.phone.replace(/\D/g, '');
        requestData.phone = `${data.countryCode} ${cleanPhoneNumber}`;
      }
  
      console.log('Sending signup request:', requestData);
  
      const response = await api.signup(requestData);
  
      if (response.token) {
        await storage.setItem('userToken', response.token);
        router.replace('/(tabs)');
      } else if (response.currentStep) {
        setCurrentStep(response.currentStep as StepNumber);
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = () => {
    switch (currentStep) {
      case 1:
        return (
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#8e8e8e"
            value={data.email}
            onChangeText={(text) => {
              setData(prev => ({ ...prev, email: text }));
              setError('');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
        );
      case 2:
        return (
          <>
            <Text style={styles.verificationText}>
              Enter verification code sent to {data.email}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#8e8e8e"
              value={data.emailOtp}
              onChangeText={(text) => {
                setData(prev => ({ ...prev, emailOtp: text }));
                setError('');
              }}
              keyboardType="numeric"
              maxLength={6}
              editable={!loading}
            />
          </>
        );
      case 3:
        return (
          <>
            <View style={styles.phoneContainer}>
              <CountryCodeSelector
                selectedCode={data.countryCode}
                onSelect={(code) => setData(prev => ({ ...prev, countryCode: code }))}
              />
              <TextInput
                style={[styles.input, styles.phoneInput]}
                placeholder="Phone number (digits only)"
                placeholderTextColor="#8e8e8e"
                value={data.phone}
                onChangeText={(text) => {
                  // Allow only digits
                  const cleaned = text.replace(/\D/g, '');
                  setData(prev => ({ ...prev, phone: cleaned }));
                  setError('');
                }}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>
            <Text style={styles.phoneHelper}>
              Enter only digits, country code will be added automatically
            </Text>
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.verificationText}>
              Enter verification code sent to {data.countryCode} {data.phone}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#8e8e8e"
              value={data.phoneOtp}
              onChangeText={(text) => {
                setData(prev => ({ ...prev, phoneOtp: text }));
                setError('');
              }}
              keyboardType="numeric"
              maxLength={6}
              editable={!loading}
            />
          </>
        );
      case 5:
        return (
          <TextInput
            style={styles.input}
            placeholder="Create 4-digit PIN"
            placeholderTextColor="#8e8e8e"
            value={data.pin}
            onChangeText={(text) => {
              // Allow only digits
              const cleaned = text.replace(/\D/g, '');
              setData(prev => ({ ...prev, pin: cleaned }));
              setError('');
            }}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            editable={!loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <LinearGradient
        colors={['#1a1a1a', '#2d2d2d']}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        entering={FadeInDown.duration(1000).springify()}
        style={styles.header}
      >
        <Text style={styles.title}>{stepTitles[currentStep]}</Text>
        <Text style={styles.subtitle}>{stepDescriptions[currentStep]}</Text>
        <Text style={styles.stepIndicator}>Step {currentStep} of 5</Text>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(1000).springify()}
        style={styles.formContainer}
      >
        {renderInput()}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignupStep}
          disabled={loading}
        >
          <LinearGradient
            colors={['#4a4a4a', '#3a3a3a']}
            style={styles.buttonGradient}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {currentStep === 5 ? 'Complete Signup' : 'Continue'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/login')}
          style={styles.linkButton}
          disabled={loading}
        >
          <Text style={styles.linkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
    textAlign: 'center',
    marginBottom: 8,
  },
  stepIndicator: {
    fontSize: 14,
    color: '#6e6e6e',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  input: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 20,
    flex: 1,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneInput: {
    marginLeft: 8,
    marginBottom: 8,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  phoneHelper: {
    color: '#8e8e8e',
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  verificationText: {
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  button: {
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 20,
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
  },
  linkText: {
    color: '#8e8e8e',
    fontSize: 14,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 15,
  },
});