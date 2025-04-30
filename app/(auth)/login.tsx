import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import storage from '../../utils/storage';
import api from '../../services/api';
import { useAuth } from '../../context/auth';
import CountryCodeSelector from '../../components/CountryCodeSelector';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [phoneIdentifier, setPhoneIdentifier] = useState('');
  const [isPhone, setIsPhone] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  // Handle identifier input change based on type
  const handleIdentifierChange = (text) => {
    if (isPhone) {
      setPhoneIdentifier(text);
    } else {
      setEmailIdentifier(text);
    }
    setError('');
  };

  // Toggle between email and phone login
  const toggleLoginType = (usePhone) => {
    setIsPhone(usePhone);
    setError('');
  };

  // Get the current identifier based on login type
  const getCurrentIdentifier = () => {
    return isPhone ? phoneIdentifier : emailIdentifier;
  };

  const handleLogin = async () => {
    const identifier = getCurrentIdentifier();
    
    if (!identifier || !pin) {
      setError('Please fill in all fields');
      return;
    }

    // Validate email or phone based on selected type
    if (isPhone) {
      // Check if the user entered a valid phone number (only digits)
      if (!/^\d+$/.test(identifier)) {
        setError('Please enter a valid phone number (digits only)');
        return;
      }
    } else {
      // Simple email validation
      if (!/\S+@\S+\.\S+/.test(identifier)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      // Format the identifier based on type (email or phone)
      let formattedIdentifier = identifier;
      if (isPhone) {
        // Remove any non-digit characters the user might have entered
        const cleanPhoneNumber = identifier.replace(/\D/g, '');
        formattedIdentifier = `${countryCode} ${cleanPhoneNumber}`;
      }

      console.log('Attempting login with:', { identifier: formattedIdentifier, pin: '****' });
      
      const response = await api.login({
        identifier: formattedIdentifier,
        pin
      });

      if (response.success && response.token) {
        console.log('Login successful, received token');
        
        // Store token and user data
        await signIn({
          token: response.token,
          email: response.email || '',
          phone: response.phone || ''
        });
        
        console.log('Auth context updated');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2d2d2d']}
        style={styles.background}
      />
      
      <Animated.View 
        entering={FadeInDown.duration(1000).springify()} 
        style={styles.header}
      >
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Login to your account</Text>
      </Animated.View>

      <Animated.View 
        entering={FadeInUp.duration(1000).springify()} 
        style={styles.formContainer}
      >
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Login with</Text>
          <View style={styles.loginTypeContainer}>
            <TouchableOpacity 
              style={[
                styles.loginTypeButton, 
                !isPhone && styles.loginTypeButtonActive
              ]}
              onPress={() => toggleLoginType(false)}
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
              onPress={() => toggleLoginType(true)}
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

        <View style={styles.inputContainer}>
          <Text style={styles.label}>PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your 4-digit PIN"
            placeholderTextColor="#8e8e8e"
            value={pin}
            onChangeText={(text) => {
              setPin(text);
              setError('');
            }}
            secureTextEntry={true}
            keyboardType="numeric"
            maxLength={4}
            editable={!loading}
            // iOS specific properties to ensure password dots are visible
            textContentType="password"
            passwordRules="minlength: 4; maxlength: 4; required: digit;"
            // Force visibility of secure entry on iOS
            clearTextOnFocus={false}
            autoCorrect={false}
            autoComplete="password"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <LinearGradient
            colors={['#4a4a4a', '#3a3a3a']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Logging in...' : 'Login'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/signup')}
          style={styles.linkButton}
          disabled={loading}
        >
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </TouchableOpacity>
      </Animated.View>
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
    paddingTop: 40,
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
  },
  linkText: {
    color: '#8e8e8e',
    fontSize: 14,
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 15,
    textAlign: 'center',
  },
});