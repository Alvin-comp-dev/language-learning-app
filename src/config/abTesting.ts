import { Platform } from 'react-native';
import Analytics from './firebase';

// Types for A/B testing
export type Variant = 'control' | 'variant_a' | 'variant_b' | 'variant_c';

export interface ABTest {
  id: string;
  name: string;
  description: string;
  variants: {
    [key in Variant]: {
      weight: number;
      config: any;
    };
  };
  isActive: boolean;
  startDate: string;
  endDate: string;
}

// Active A/B tests configuration
export const AB_TESTS: { [key: string]: ABTest } = {
  // Test different lesson completion thresholds
  'lesson_completion_threshold': {
    id: 'lesson_completion_threshold',
    name: 'Lesson Completion Threshold',
    description: 'Testing different thresholds for marking a lesson as complete',
    variants: {
      control: {
        weight: 0.25,
        config: { threshold: 0.8 } // 80% accuracy required
      },
      variant_a: {
        weight: 0.25,
        config: { threshold: 0.7 } // 70% accuracy required
      },
      variant_b: {
        weight: 0.25,
        config: { threshold: 0.9 } // 90% accuracy required
      },
      variant_c: {
        weight: 0.25,
        config: { threshold: 0.75 } // 75% accuracy required
      }
    },
    isActive: true,
    startDate: '2024-03-01',
    endDate: '2024-04-01'
  },

  // Test different AI tutor personalities
  'ai_tutor_personality': {
    id: 'ai_tutor_personality',
    name: 'AI Tutor Personality',
    description: 'Testing different AI tutor personality styles',
    variants: {
      control: {
        weight: 0.25,
        config: { style: 'neutral' }
      },
      variant_a: {
        weight: 0.25,
        config: { style: 'encouraging' }
      },
      variant_b: {
        weight: 0.25,
        config: { style: 'challenging' }
      },
      variant_c: {
        weight: 0.25,
        config: { style: 'casual' }
      }
    },
    isActive: true,
    startDate: '2024-03-01',
    endDate: '2024-04-01'
  },

  // Test different upgrade prompt frequencies
  'upgrade_prompt_frequency': {
    id: 'upgrade_prompt_frequency',
    name: 'Upgrade Prompt Frequency',
    description: 'Testing different frequencies for showing upgrade prompts',
    variants: {
      control: {
        weight: 0.25,
        config: { lessonsBeforePrompt: 5 }
      },
      variant_a: {
        weight: 0.25,
        config: { lessonsBeforePrompt: 3 }
      },
      variant_b: {
        weight: 0.25,
        config: { lessonsBeforePrompt: 7 }
      },
      variant_c: {
        weight: 0.25,
        config: { lessonsBeforePrompt: 10 }
      }
    },
    isActive: true,
    startDate: '2024-03-01',
    endDate: '2024-04-01'
  }
};

// Helper class for managing A/B tests
class ABTestingManager {
  private userVariants: { [key: string]: Variant } = {};
  private userId: string | null = null;

  // Initialize user's test variants
  public initializeUser = (userId: string) => {
    this.userId = userId;
    Object.keys(AB_TESTS).forEach(testId => {
      if (AB_TESTS[testId].isActive) {
        this.assignVariant(testId);
      }
    });
  };

  // Assign a variant for a specific test
  private assignVariant = (testId: string): Variant => {
    if (this.userVariants[testId]) {
      return this.userVariants[testId];
    }

    const test = AB_TESTS[testId];
    if (!test || !test.isActive) {
      return 'control';
    }

    // Generate random number for weighted selection
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const [variant, config] of Object.entries(test.variants)) {
      cumulativeWeight += config.weight;
      if (random <= cumulativeWeight) {
        this.userVariants[testId] = variant as Variant;
        this.trackVariantAssignment(testId, variant as Variant);
        return variant as Variant;
      }
    }

    return 'control';
  };

  // Get the variant for a specific test
  public getVariant = (testId: string): Variant => {
    return this.userVariants[testId] || this.assignVariant(testId);
  };

  // Get the configuration for a specific test variant
  public getTestConfig = (testId: string): any => {
    const variant = this.getVariant(testId);
    return AB_TESTS[testId]?.variants[variant]?.config || {};
  };

  // Track variant assignment
  private trackVariantAssignment = async (testId: string, variant: Variant) => {
    if (!this.userId) return;

    await Analytics.trackEvent('ab_test_assignment', {
      test_id: testId,
      variant,
      user_id: this.userId,
      platform: Platform.OS,
      timestamp: new Date().toISOString()
    });
  };

  // Track conversion event for a specific test
  public trackConversion = async (testId: string, eventName: string, eventData: any = {}) => {
    if (!this.userId) return;

    const variant = this.getVariant(testId);
    await Analytics.trackEvent('ab_test_conversion', {
      test_id: testId,
      variant,
      event_name: eventName,
      user_id: this.userId,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
      ...eventData
    });
  };

  // Reset user's test variants
  public resetUser = () => {
    this.userVariants = {};
    this.userId = null;
  };
}

export const abTesting = new ABTestingManager();
export default abTesting; 