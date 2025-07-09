import { Platform } from 'react-native';

export const PRODUCTION_CONFIG = {
  // API Endpoints
  API_BASE_URL: 'https://api.speakflow.app',
  SOCKET_URL: 'wss://realtime.speakflow.app',
  
  // Authentication
  AUTH_DOMAIN: 'auth.speakflow.app',
  AUTH_REDIRECT_URI: Platform.select({
    ios: 'com.speakflow.app://auth',
    android: 'com.speakflow.app://auth',
    default: 'https://speakflow.app/auth'
  }),
  
  // Analytics & Monitoring
  SENTRY_DSN: 'https://your-sentry-dsn.ingest.sentry.io/project-id',
  FIREBASE_CONFIG: {
    apiKey: 'your-firebase-api-key',
    authDomain: 'speakflow.firebaseapp.com',
    projectId: 'speakflow',
    storageBucket: 'speakflow.appspot.com',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id',
    measurementId: 'your-measurement-id'
  },
  
  // External Services
  STRIPE_PUBLISHABLE_KEY: 'pk_live_your-stripe-key',
  ANTHROPIC_API_URL: 'https://api.anthropic.com/v1',
  OPENAI_API_URL: 'https://api.openai.com/v1',
  
  // Performance Thresholds
  PERFORMANCE: {
    SPEECH_RECOGNITION_TIMEOUT: 10000, // 10 seconds
    AI_RESPONSE_TIMEOUT: 5000, // 5 seconds
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    MAX_AUDIO_SIZE: 1024 * 1024, // 1MB
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
  },
  
  // Feature Flags
  FEATURES: {
    ENABLE_OFFLINE_MODE: true,
    ENABLE_BACKGROUND_SYNC: true,
    ENABLE_PUSH_NOTIFICATIONS: true,
    ENABLE_ANALYTICS: true,
    ENABLE_ERROR_REPORTING: true,
    ENABLE_CRASH_REPORTING: true,
  },
  
  // Content Delivery
  CDN_URL: 'https://cdn.speakflow.app',
  ASSETS_VERSION: '1.0.0',
  
  // Caching Strategy
  CACHE: {
    ENABLE_MEMORY_CACHE: true,
    ENABLE_DISK_CACHE: true,
    MAX_MEMORY_ENTRIES: 1000,
    MAX_DISK_SPACE: 50 * 1024 * 1024, // 50MB
  },
  
  // Error Handling
  ERROR_CONFIG: {
    SHOW_ERROR_DETAILS: false,
    LOG_ERRORS_TO_SERVER: true,
    ERROR_REPORTING_RATE: 1.0, // Report 100% of errors
  },
  
  // Rate Limiting
  RATE_LIMITS: {
    AI_REQUESTS_PER_MINUTE: 30,
    SPEECH_RECOGNITION_PER_MINUTE: 20,
    API_REQUESTS_PER_MINUTE: 60,
  },
  
  // Backup & Recovery
  BACKUP: {
    ENABLE_AUTO_BACKUP: true,
    BACKUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    MAX_BACKUP_AGE: 30 * 24 * 60 * 60 * 1000, // 30 days
    BACKUP_ENCRYPTION: true,
  },
  
  // Security
  SECURITY: {
    REQUIRE_BIOMETRIC: Platform.select({
      ios: true,
      android: true,
      default: false
    }),
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    MAX_LOGIN_ATTEMPTS: 5,
    PASSWORD_MIN_LENGTH: 12,
    REQUIRE_SPECIAL_CHARS: true,
  }
}; 