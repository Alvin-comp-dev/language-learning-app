import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, Card, Button } from '../../components/ui';
import { contentPackService } from '../../services/contentPackService';
import { useStore } from '../../store/AppStore';
import type { ContentPack, UserContentPack } from '../../config/supabase';
import { colors, spacing } from '../../theme';

export const ContentPacksScreen = () => {
  const navigation = useNavigation();
  const { user, targetLanguage } = useStore();
  const [contentPacks, setContentPacks] = useState<ContentPack[]>([]);
  const [userPacks, setUserPacks] = useState<UserContentPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContentPacks();
  }, [targetLanguage]);

  const loadContentPacks = async () => {
    try {
      setLoading(true);
      const [packs, userOwnedPacks] = await Promise.all([
        contentPackService.getContentPacks(targetLanguage),
        contentPackService.getUserContentPacks(user.id),
      ]);
      setContentPacks(packs);
      setUserPacks(userOwnedPacks);
    } catch (error) {
      Alert.alert('Error', 'Failed to load content packs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pack: ContentPack) => {
    try {
      await contentPackService.purchaseContentPack(user.id, pack.id);
      Alert.alert('Success', 'Content pack purchased successfully!');
      loadContentPacks(); // Refresh the list
    } catch (error) {
      Alert.alert('Error', 'Failed to purchase content pack');
      console.error(error);
    }
  };

  const isPackOwned = (packId: string) => {
    return userPacks.some(up => up.content_pack_id === packId);
  };

  const renderContentPack = (pack: ContentPack) => {
    const owned = isPackOwned(pack.id);

    return (
      <Card key={pack.id} style={styles.packCard}>
        <View style={styles.packHeader}>
          <Text variant="h3">{pack.name}</Text>
          <Text variant="body2" style={styles.price}>
            ${pack.price.toFixed(2)}
          </Text>
        </View>

        <Text variant="body1" style={styles.description}>
          {pack.description}
        </Text>

        <View style={styles.buttonContainer}>
          {owned ? (
            <Button
              variant="primary"
              onPress={() => navigation.navigate('Lessons', { contentPackId: pack.id })}
            >
              Start Learning
            </Button>
          ) : (
            <Button
              variant="secondary"
              onPress={() => handlePurchase(pack)}
            >
              Purchase
            </Button>
          )}
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading content packs...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text variant="h1" style={styles.title}>
        Specialized Content Packs
      </Text>
      
      <Text variant="body1" style={styles.subtitle}>
        Enhance your learning with specialized content for your needs
      </Text>

      <View style={styles.packsList}>
        {contentPacks.map(renderContentPack)}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.medium,
  },
  title: {
    marginBottom: spacing.small,
  },
  subtitle: {
    marginBottom: spacing.large,
    color: colors.textSecondary,
  },
  packsList: {
    gap: spacing.medium,
  },
  packCard: {
    padding: spacing.medium,
  },
  packHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  price: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  description: {
    marginBottom: spacing.medium,
  },
  buttonContainer: {
    alignItems: 'flex-end',
  },
}); 