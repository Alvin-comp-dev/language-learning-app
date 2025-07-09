import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';

import { Button, Text } from '../../components/ui';
import { colors, spacing, globalStyles } from '../../theme';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Welcome'
>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();

  const handleGetStarted = () => {
    navigation.navigate('LanguageSelection');
  };

  const handleSignIn = () => {
    // TODO: Navigate to sign in screen
    console.log('Sign in pressed');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
      
      <View style={styles.content}>
        {/* Logo and App Name */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text variant="h1" style={styles.logoText}>
              🌍
            </Text>
          </View>
          <Text variant="h1" style={styles.appName}>
            SpeakFlow
          </Text>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroImageContainer}>
            <Text style={styles.heroEmoji}>💬</Text>
          </View>
          
          <Text variant="h2" style={styles.heroTitle}>
            Master any language through real conversations with AI
          </Text>
          
          <Text variant="bodyLarge" style={styles.heroSubtitle}>
            Practice speaking from day one with your personal AI tutor. Get instant feedback and build confidence through real-world scenarios.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>🎯</Text>
            <Text variant="bodyMedium" style={styles.featureText}>
              Personalized learning paths
            </Text>
          </View>
          
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>🗣️</Text>
            <Text variant="bodyMedium" style={styles.featureText}>
              Real-time pronunciation feedback
            </Text>
          </View>
          
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>🤖</Text>
            <Text variant="bodyMedium" style={styles.featureText}>
              AI conversation practice
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Get Started"
          onPress={handleGetStarted}
          size="large"
          fullWidth
          style={styles.primaryButton}
        />
        
        <Button
          title="Learn More"
          onPress={() => console.log('Learn more pressed')}
          variant="outline"
          size="large"
          fullWidth
          style={styles.secondaryButton}
        />
        
        <View style={styles.signInContainer}>
          <Text variant="bodyMedium" color={colors.text.secondary}>
            Already have an account?{' '}
          </Text>
          <Text
            variant="bodyMedium"
            color={colors.primary[500]}
            onPress={handleSignIn}
            style={styles.signInLink}
          >
            Sign In
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    ...globalStyles.container,
    justifyContent: 'space-between',
  },
  
  content: {
    flex: 1,
    ...globalStyles.screenPadding,
    justifyContent: 'center',
  },
  
  header: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[50],
    ...globalStyles.centerContent,
    marginBottom: spacing.md,
  },
  
  logoText: {
    fontSize: 40,
  },
  
  appName: {
    color: colors.primary[500],
    textAlign: 'center',
  },
  
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  
  heroImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[50],
    ...globalStyles.centerContent,
    marginBottom: spacing['2xl'],
  },
  
  heroEmoji: {
    fontSize: 60,
  },
  
  heroTitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  
  heroSubtitle: {
    textAlign: 'center',
    color: colors.text.secondary,
    paddingHorizontal: spacing.md,
    lineHeight: 24,
  },
  
  features: {
    marginBottom: spacing['2xl'],
  },
  
  feature: {
    ...globalStyles.row,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  
  featureEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  
  featureText: {
    flex: 1,
    color: colors.text.secondary,
  },
  
  actions: {
    ...globalStyles.screenPadding,
    paddingBottom: spacing.lg,
  },
  
  primaryButton: {
    marginBottom: spacing.md,
  },
  
  secondaryButton: {
    marginBottom: spacing.lg,
  },
  
  signInContainer: {
    ...globalStyles.row,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  
  signInLink: {
    textDecorationLine: 'underline',
  },
});

export default WelcomeScreen; 