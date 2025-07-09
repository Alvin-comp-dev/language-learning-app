import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useApp } from './src/store/AppStore';
import * as Sentry from '@sentry/react-native';
import monitoring from './src/config/monitoring';
import backupService from './src/services/backupService';

// Import screens
import WelcomeScreen from './src/screens/onboarding/WelcomeScreen';
import LanguageSelectionScreen from './src/screens/onboarding/LanguageSelectionScreen';
import AssessmentScreen from './src/screens/onboarding/AssessmentScreen';
import DashboardScreen from './src/screens/main/DashboardScreen';
import ProgressScreen from './src/screens/main/ProgressScreen';
import AchievementsScreen from './src/screens/main/AchievementsScreen';
import ConversationScreen from './src/screens/lessons/ConversationScreen';
import ContentPacksScreen from './src/screens/main/ContentPacksScreen';
import { CertificationScreen } from './src/screens/certification/CertificationScreen';
import { CertificationAssessmentScreen } from './src/screens/certification/CertificationAssessmentScreen';
import { CertificationResultsScreen } from './src/screens/certification/CertificationResultsScreen';

// Import services and store
import { AuthProvider } from './src/store/AuthStore';
import { AppProvider } from './src/store/AppStore';

// Components
import AchievementNotification from './src/components/ui/AchievementNotification';
import { BetaFeedback } from './src/components/ui/BetaFeedback';

// Type definitions for navigation
export type RootStackParamList = {
  Welcome: undefined;
  LanguageSelection: undefined;
  Assessment: undefined;
  Dashboard: undefined;
  Progress: undefined;
  Achievements: undefined;
  Conversation: { lessonId: string };
  ContentPacks: undefined;
  Lessons: { contentPackId: string };
  Certification: undefined;
  CertificationAssessment: { attemptId: string; levelId: string };
  CertificationResults: { attemptId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Initialize monitoring
monitoring.initializeMonitoring();

// Create error boundary component
const ErrorBoundary = Sentry.withErrorBoundary(
  ({ children }) => children,
  {
    fallback: ({ error }) => (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Oops! Something went wrong.</Text>
        <Text style={styles.errorMessage}>{error?.message}</Text>
        <Button onPress={() => RNRestart.Restart()} title="Restart App" />
      </View>
    ),
  }
);

export default function App() {
  const { 
    isOnboarding,
    currentAchievementNotification,
    hideAchievementNotification,
    loadUserProgress,
    loadAchievements,
    userId
  } = useApp();

  useEffect(() => {
    // Start performance monitoring
    const { markLoadComplete } = monitoring.monitorAppPerformance();

    // Load initial data
    const initializeApp = async () => {
      try {
        await Promise.all([
          loadUserProgress(),
          loadAchievements()
        ]);

        // Set user context for monitoring if logged in
        if (userId) {
          monitoring.setUserContext(userId);
        }

        markLoadComplete();
      } catch (error) {
        monitoring.trackError(error as Error, { 
          context: 'App initialization',
          isOnboarding
        });
      }
    };

    initializeApp();

    // Start automated backups
    backupService.startAutomatedBackups().catch(error => {
      console.error('Failed to start automated backups:', error);
      monitoring.trackError(error as Error, { context: 'App.startAutomatedBackups' });
    });

    return () => {
      // Clear user context on unmount
      monitoring.clearUserContext();
      // Cleanup
      backupService.stopAutomatedBackups();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppProvider>
            <NavigationContainer>
              <StatusBar style="auto" />
              {currentAchievementNotification && (
                <AchievementNotification
                  achievement={currentAchievementNotification}
                  onHide={hideAchievementNotification}
                />
              )}
              {__DEV__ && <BetaFeedback onClose={() => {}} />}
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              >
                {isOnboarding ? (
                  // Onboarding Stack
                  <>
                    <Stack.Screen name="Welcome" component={WelcomeScreen} />
                    <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
                    <Stack.Screen name="Assessment" component={AssessmentScreen} />
                  </>
                ) : (
                  // Main App Stack
                  <>
                    <Stack.Screen name="Dashboard" component={DashboardScreen} />
                    <Stack.Screen name="Progress" component={ProgressScreen} />
                    <Stack.Screen name="Achievements" component={AchievementsScreen} />
                    <Stack.Screen name="Conversation" component={ConversationScreen} />
                    <Stack.Screen name="ContentPacks" component={ContentPacksScreen} />
                    <Stack.Screen name="Certification" component={CertificationScreen} />
                    <Stack.Screen name="CertificationAssessment" component={CertificationAssessmentScreen} />
                    <Stack.Screen name="CertificationResults" component={CertificationResultsScreen} />
                  </>
                )}
              </Stack.Navigator>
            </NavigationContainer>
          </AppProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff'
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#666'
  }
}); 