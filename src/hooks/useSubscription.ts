import { useState, useEffect } from 'react';
import { paymentService, SubscriptionTier, SUBSCRIPTION_TIERS } from '../services/paymentService';

export interface UseSubscriptionResult {
  currentTier: SubscriptionTier | null;
  isLoading: boolean;
  error: Error | null;
  isFeatureAvailable: (feature: string) => boolean;
  isPremium: boolean;
  showUpgradePrompt: () => void;
  upgradeSubscription: (tierId: string) => Promise<void>;
}

export const useSubscription = (): UseSubscriptionResult => {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      setIsLoading(true);
      const tierId = await paymentService.getCurrentSubscription();
      const tier = tierId ? paymentService.getSubscriptionTier(tierId) || null : null;
      setCurrentTier(tier || SUBSCRIPTION_TIERS[0]); // Default to free tier
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load subscription status'));
      setCurrentTier(SUBSCRIPTION_TIERS[0]); // Default to free tier on error
    } finally {
      setIsLoading(false);
    }
  };

  const isFeatureAvailable = (feature: string): boolean => {
    if (!currentTier) return false;
    return paymentService.isFeatureAvailable(feature, currentTier.id);
  };

  const showUpgradePrompt = () => {
    // This will be implemented by the parent component
    // We'll emit an event or use navigation to show the upgrade screen
  };

  const upgradeSubscription = async (tierId: string) => {
    try {
      const tier = paymentService.getSubscriptionTier(tierId);
      if (!tier) throw new Error('Invalid subscription tier');

      const { clientSecret, subscriptionId } = await paymentService.createSubscription(tier);
      const success = await paymentService.handlePaymentSheet(clientSecret);

      if (success) {
        await loadSubscriptionStatus(); // Reload subscription status
      } else {
        throw new Error('Payment failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to upgrade subscription'));
      throw err;
    }
  };

  return {
    currentTier,
    isLoading,
    error,
    isFeatureAvailable,
    isPremium: currentTier?.id !== 'free',
    showUpgradePrompt,
    upgradeSubscription,
  };
}; 