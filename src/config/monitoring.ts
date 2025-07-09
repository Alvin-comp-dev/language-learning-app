import * as Sentry from '@sentry/react-native';
import Analytics from './firebase';

// Performance thresholds
const THRESHOLDS = {
  SPEECH_RECOGNITION_MAX_TIME: 5000, // 5 seconds
  AI_RESPONSE_MAX_TIME: 3000, // 3 seconds
  APP_LOAD_MAX_TIME: 2000, // 2 seconds
  MIN_SPEECH_ACCURACY: 0.85 // 85%
};

// Initialize Sentry
export const initializeMonitoring = () => {
  Sentry.init({
    dsn: "your-sentry-dsn", // Replace with actual DSN
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    debug: __DEV__,
    tracesSampleRate: 1.0,
    enableNative: true,
    attachStacktrace: true,
    
    // Configure which errors to ignore
    beforeSend(event) {
      // Ignore certain errors
      if (event.exception?.values?.[0]?.type === 'NetworkError' && 
          event.exception.values[0].value?.includes('offline')) {
        return null;
      }
      return event;
    },

    // Add app metadata to all events
    initialScope: {
      tags: {
        environment: __DEV__ ? 'development' : 'production',
        version: '1.0.0-beta',
      },
    },
  });
};

// Monitor speech recognition performance
export const monitorSpeechRecognition = async (duration: number, accuracy: number) => {
  // Track performance metrics
  Sentry.addBreadcrumb({
    category: 'speech.recognition',
    message: `Speech recognition completed in ${duration}ms with ${accuracy * 100}% accuracy`,
    level: 'info',
  });

  // Log to analytics
  await Analytics.trackSpeechRecognition(accuracy, duration / 1000);

  // Alert if performance is poor
  if (duration > THRESHOLDS.SPEECH_RECOGNITION_MAX_TIME) {
    Sentry.captureMessage(
      `Speech recognition took too long: ${duration}ms`,
      'warning'
    );
  }

  if (accuracy < THRESHOLDS.MIN_SPEECH_ACCURACY) {
    Sentry.captureMessage(
      `Low speech recognition accuracy: ${accuracy * 100}%`,
      'warning'
    );
  }
};

// Monitor AI response performance
export const monitorAIResponse = async (duration: number, contextLength: number) => {
  // Track performance metrics
  Sentry.addBreadcrumb({
    category: 'ai.response',
    message: `AI response generated in ${duration}ms with context length ${contextLength}`,
    level: 'info',
  });

  // Log to analytics
  await Analytics.trackAIResponse(duration, contextLength);

  // Alert if response is slow
  if (duration > THRESHOLDS.AI_RESPONSE_MAX_TIME) {
    Sentry.captureMessage(
      `AI response took too long: ${duration}ms`,
      'warning'
    );
  }
};

// Track errors with context
export const trackError = async (
  error: Error,
  context: Record<string, any> = {},
  level: Sentry.SeverityLevel = 'error'
) => {
  // Add error to Sentry
  Sentry.withScope(scope => {
    scope.setExtras(context);
    scope.setLevel(level);
    Sentry.captureException(error);
  });

  // Log to analytics
  await Analytics.trackError(error.name, error.message);
};

// Monitor app performance
export const monitorAppPerformance = () => {
  const transaction = Sentry.startTransaction({
    name: 'app-load',
  });

  Sentry.getCurrentHub().configureScope(scope => {
    scope.setSpan(transaction);
  });

  return {
    transaction,
    markLoadComplete: () => {
      const duration = Date.now() - transaction.startTimestamp;
      
      if (duration > THRESHOLDS.APP_LOAD_MAX_TIME) {
        Sentry.captureMessage(
          `App load took too long: ${duration}ms`,
          'warning'
        );
      }

      transaction.finish();
    }
  };
};

// Set user context
export const setUserContext = (userId: string, attributes: Record<string, any> = {}) => {
  Sentry.setUser({
    id: userId,
    ...attributes
  });
};

// Clear user context (on logout)
export const clearUserContext = () => {
  Sentry.setUser(null);
};

export default {
  initializeMonitoring,
  monitorSpeechRecognition,
  monitorAIResponse,
  trackError,
  monitorAppPerformance,
  setUserContext,
  clearUserContext
}; 