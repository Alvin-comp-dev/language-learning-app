import analytics from '@react-native-firebase/analytics';

// Analytics event names
export const ANALYTICS_EVENTS = {
  LESSON_START: 'lesson_start',
  LESSON_COMPLETE: 'lesson_complete',
  SPEECH_RECOGNITION: 'speech_recognition',
  AI_RESPONSE: 'ai_response',
  ERROR_OCCURRED: 'error_occurred',
  FEEDBACK_SUBMITTED: 'feedback_submitted',
  UPGRADE_PROMPT_SHOWN: 'upgrade_prompt_shown',
  SUBSCRIPTION_STARTED: 'subscription_started'
} as const;

// Analytics user properties
export const USER_PROPERTIES = {
  LANGUAGE: 'target_language',
  SUBSCRIPTION_TIER: 'subscription_tier',
  LESSONS_COMPLETED: 'lessons_completed',
  TOTAL_SPEAKING_TIME: 'total_speaking_time',
  RECOGNITION_ACCURACY: 'recognition_accuracy'
} as const;

// Analytics helper functions
export const Analytics = {
  // Track lesson events
  trackLessonStart: async (lessonId: string, lessonType: string) => {
    await analytics().logEvent(ANALYTICS_EVENTS.LESSON_START, {
      lesson_id: lessonId,
      lesson_type: lessonType,
      timestamp: Date.now()
    });
  },

  trackLessonComplete: async (lessonId: string, duration: number, score: number) => {
    await analytics().logEvent(ANALYTICS_EVENTS.LESSON_COMPLETE, {
      lesson_id: lessonId,
      duration_seconds: duration,
      score: score,
      timestamp: Date.now()
    });
  },

  // Track speech recognition
  trackSpeechRecognition: async (accuracy: number, duration: number) => {
    await analytics().logEvent(ANALYTICS_EVENTS.SPEECH_RECOGNITION, {
      accuracy_percentage: accuracy,
      duration_seconds: duration,
      timestamp: Date.now()
    });
  },

  // Track AI response
  trackAIResponse: async (responseTime: number, contextLength: number) => {
    await analytics().logEvent(ANALYTICS_EVENTS.AI_RESPONSE, {
      response_time_ms: responseTime,
      context_length: contextLength,
      timestamp: Date.now()
    });
  },

  // Track errors
  trackError: async (errorType: string, errorMessage: string) => {
    await analytics().logEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
      error_type: errorType,
      error_message: errorMessage,
      timestamp: Date.now()
    });
  },

  // Track feedback
  trackFeedback: async (feedbackType: string, rating: number, comment?: string) => {
    await analytics().logEvent(ANALYTICS_EVENTS.FEEDBACK_SUBMITTED, {
      feedback_type: feedbackType,
      rating: rating,
      comment: comment,
      timestamp: Date.now()
    });
  },

  // Track upgrade prompts
  trackUpgradePrompt: async (promptLocation: string, promptType: string) => {
    await analytics().logEvent(ANALYTICS_EVENTS.UPGRADE_PROMPT_SHOWN, {
      location: promptLocation,
      prompt_type: promptType,
      timestamp: Date.now()
    });
  },

  // Track subscription events
  trackSubscriptionStarted: async (plan: string, price: number) => {
    await analytics().logEvent(ANALYTICS_EVENTS.SUBSCRIPTION_STARTED, {
      plan_type: plan,
      price: price,
      timestamp: Date.now()
    });
  },

  // Set user properties
  setUserProperties: async (properties: Record<string, string | number>) => {
    for (const [key, value] of Object.entries(properties)) {
      await analytics().setUserProperty(key, String(value));
    }
  }
};

export default Analytics; 