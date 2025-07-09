import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSubscription } from '../../hooks/useSubscription';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface WithSubscriptionGateProps {
  requiredFeature: string;
  fallbackComponent?: React.ReactNode;
}

export const withSubscriptionGate = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  { requiredFeature, fallbackComponent }: WithSubscriptionGateProps
) => {
  return (props: P) => {
    const { isFeatureAvailable, isPremium, showUpgradePrompt } = useSubscription();

    if (isFeatureAvailable(requiredFeature)) {
      return <WrappedComponent {...props} />;
    }

    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }

    return (
      <View style={styles.container}>
        <Card style={styles.upgradeCard}>
          <Text style={styles.title}>
            ⭐️ Unlock Premium Feature
          </Text>
          
          <Text style={styles.description}>
            This feature is available exclusively to our premium members.
            Upgrade now to access:
          </Text>

          <View style={styles.featureList}>
            <Text style={styles.feature}>✓ Unlimited daily lessons</Text>
            <Text style={styles.feature}>✓ Advanced pronunciation analysis</Text>
            <Text style={styles.feature}>✓ 8 AI tutor personalities</Text>
            <Text style={styles.feature}>✓ Real-time conversation correction</Text>
            <Text style={styles.feature}>✓ All content packs included</Text>
          </View>

          <Button
            onPress={showUpgradePrompt}
            style={styles.upgradeButton}
            textStyle={styles.upgradeButtonText}
          >
            Upgrade to Premium
          </Button>

          <Text style={styles.priceText}>
            Starting at $19.99/month
          </Text>
        </Card>
      </View>
    );
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.medium,
    backgroundColor: colors.background,
  },
  upgradeCard: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.large,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.medium,
    color: colors.text,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.large,
    color: colors.textSecondary,
  },
  featureList: {
    marginBottom: spacing.large,
  },
  feature: {
    fontSize: 16,
    marginBottom: spacing.small,
    color: colors.text,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.medium,
    borderRadius: 8,
    marginBottom: spacing.small,
  },
  upgradeButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  priceText: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.textSecondary,
  },
}); 