import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import { Card } from '../../components/ui/Card';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useSubscription } from '../../hooks/useSubscription';
import { SUBSCRIPTION_TIERS, SubscriptionTier } from '../../services/paymentService';

export const UpgradeScreen = observer(() => {
  const navigation = useNavigation();
  const { currentTier, upgradeSubscription } = useSubscription();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (!selectedTier) return;

    try {
      setIsLoading(true);
      setError(null);
      await upgradeSubscription(selectedTier.id);
      navigation.goBack();
    } catch (err) {
      setError('Failed to process payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderTierCard = (tier: SubscriptionTier) => {
    const isSelected = selectedTier?.id === tier.id;
    const isCurrentTier = currentTier?.id === tier.id;

    return (
      <Card
        key={tier.id}
        style={[
          styles.tierCard,
          isSelected && styles.selectedCard,
          isCurrentTier && styles.currentTierCard,
        ]}
        onPress={() => setSelectedTier(tier)}
      >
        {isCurrentTier && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>Current Plan</Text>
          </View>
        )}

        <Text style={styles.tierName}>{tier.name}</Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            ${tier.price}
          </Text>
          <Text style={styles.interval}>
            /{tier.interval}
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          {tier.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Text style={styles.featureCheck}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {tier.id === 'premium_yearly' && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save 37%</Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Upgrade to Premium
          </Text>
          <Text style={styles.subtitle}>
            Unlock all features and accelerate your language learning journey
          </Text>
        </View>

        <View style={styles.tiersContainer}>
          {SUBSCRIPTION_TIERS.filter(tier => tier.id !== 'free').map(renderTierCard)}
        </View>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <View style={styles.bottomContainer}>
          <Button
            onPress={handleUpgrade}
            disabled={!selectedTier || isLoading}
            style={styles.upgradeButton}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              `Upgrade to ${selectedTier?.name || 'Premium'}`
            )}
          </Button>

          <Text style={styles.disclaimer}>
            You can cancel your subscription at any time. By upgrading, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: spacing.large,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.small,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tiersContainer: {
    padding: spacing.medium,
  },
  tierCard: {
    marginBottom: spacing.medium,
    padding: spacing.large,
  },
  selectedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  currentTierCard: {
    backgroundColor: colors.background,
    opacity: 0.7,
  },
  currentBadge: {
    position: 'absolute',
    top: spacing.medium,
    right: spacing.medium,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  tierName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: spacing.small,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.medium,
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  interval: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: spacing.xsmall,
  },
  featuresContainer: {
    marginTop: spacing.medium,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: spacing.small,
  },
  featureCheck: {
    color: colors.success,
    marginRight: spacing.small,
    fontWeight: '600',
  },
  featureText: {
    flex: 1,
    color: colors.text,
  },
  savingsBadge: {
    position: 'absolute',
    top: spacing.medium,
    left: spacing.medium,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    borderRadius: 12,
  },
  savingsText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomContainer: {
    padding: spacing.large,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.medium,
    borderRadius: 8,
    marginBottom: spacing.medium,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
}); 