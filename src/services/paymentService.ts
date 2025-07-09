import { initStripe, useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../config/supabase';

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      '3 lessons per day',
      'Basic pronunciation feedback',
      '5 core scenarios',
      'Basic progress tracking',
      '1 AI tutor personality',
    ],
  },
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    price: 19.99,
    interval: 'month',
    features: [
      'Unlimited daily lessons',
      'Advanced pronunciation analysis',
      '8 AI tutor personalities',
      'Real-time conversation correction',
      'Offline mode',
      'Advanced progress analytics',
      'Priority support',
      'All content packs included',
    ],
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    price: 149.99,
    interval: 'year',
    features: [
      'All Premium Monthly features',
      '37% savings ($12.49/month)',
      'Early access to new features',
    ],
  },
];

class PaymentService {
  private stripePromise: Promise<void>;

  constructor() {
    // Initialize Stripe
    this.stripePromise = initStripe({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      merchantIdentifier: 'merchant.com.speakflow',
      urlScheme: 'speakflow',
    });
  }

  async createSubscription(
    tier: SubscriptionTier,
    customerId?: string
  ): Promise<{ clientSecret: string; subscriptionId: string }> {
    try {
      // Create or get customer
      let customer = customerId;
      if (!customer) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) throw new Error('User not authenticated');

        const { data: customerData, error: customerError } = await supabase
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('user_id', userData.user.id)
          .single();

        if (customerError && customerError.code !== 'PGRST116') {
          throw customerError;
        }

        if (customerData) {
          customer = customerData.stripe_customer_id;
        } else {
          // Create new customer in Stripe via your backend
          const response = await fetch('/api/create-stripe-customer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userData.user.email,
              userId: userData.user.id,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create Stripe customer');
          }

          const { customerId: newCustomerId } = await response.json();
          customer = newCustomerId;
        }
      }

      // Create subscription
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer,
          priceId: tier.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }

      const { clientSecret, subscriptionId } = await response.json();
      return { clientSecret, subscriptionId };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  async getCurrentSubscription(): Promise<SubscriptionTier['id'] | null> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return null;

      const { data: subscriptionData, error } = await supabase
        .from('user_subscriptions')
        .select('tier_id, status')
        .eq('user_id', userData.user.id)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return 'free';
        throw error;
      }

      return subscriptionData?.tier_id || 'free';
    } catch (error) {
      console.error('Error getting current subscription:', error);
      return 'free';
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  async handlePaymentSheet(clientSecret: string): Promise<boolean> {
    try {
      const { presentPaymentSheet, confirmPaymentSheetPayment } = useStripe();
      
      const { error: presentError } = await presentPaymentSheet({
        clientSecret,
      });

      if (presentError) {
        throw presentError;
      }

      const { error: confirmError } = await confirmPaymentSheetPayment();
      if (confirmError) {
        throw confirmError;
      }

      return true;
    } catch (error) {
      console.error('Error handling payment sheet:', error);
      return false;
    }
  }

  getSubscriptionTier(tierId: string): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId);
  }

  isFeatureAvailable(feature: string, currentTier: SubscriptionTier['id']): boolean {
    const tier = this.getSubscriptionTier(currentTier);
    if (!tier) return false;
    return tier.features.includes(feature);
  }

  async processContentPackPurchase(userId: string, contentPack: any): Promise<void> {
    try {
      // Create payment intent for the content pack
      const response = await fetch('/api/create-content-pack-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          contentPackId: contentPack.id,
          amount: contentPack.price * 100, // Convert to cents
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret } = await response.json();

      // Handle payment with Stripe
      const success = await this.handlePaymentSheet(clientSecret);
      if (!success) {
        throw new Error('Payment failed');
      }
    } catch (error) {
      console.error('Error processing content pack purchase:', error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService(); 