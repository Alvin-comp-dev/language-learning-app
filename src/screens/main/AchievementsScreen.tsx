import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Text from '../../components/ui/Text';
import AchievementCard from '../../components/ui/AchievementCard';
import { theme } from '../../theme';
import achievementService, { Achievement, UserAchievement } from '../../services/achievementService';

const AchievementsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [stats, setStats] = useState({
    totalXP: 0,
    completedCount: 0,
    nextTier: ''
  });

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      setLoading(true);
      // In a real app, get the actual user ID
      const userId = 'current-user-id';
      
      // Get user achievements
      const userAchievs = await achievementService.getUserAchievements(userId);
      setUserAchievements(userAchievs);

      // Calculate stats
      let totalXP = 0;
      const completedAchievements = userAchievs.filter(ua => ua.dateUnlocked);
      
      completedAchievements.forEach(ua => {
        const achievement = achievementService.getAchievementDetails(ua.achievementId);
        if (achievement) {
          totalXP += achievement.xpReward;
        }
      });

      // Determine next tier to unlock
      const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
      const unlockedTiers = new Set(completedAchievements.map(ua => {
        const achievement = achievementService.getAchievementDetails(ua.achievementId);
        return achievement?.tier;
      }));
      
      const nextTier = tiers.find(tier => !unlockedTiers.has(tier)) || 'PLATINUM';

      setStats({
        totalXP,
        completedCount: completedAchievements.length,
        nextTier
      });

    } catch (error) {
      console.error('Failed to load achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAchievements();
    setRefreshing(false);
  };

  const getAchievementProgress = (achievementId: string): number => {
    const userAchievement = userAchievements.find(
      ua => ua.achievementId === achievementId
    );
    return userAchievement?.progress || 0;
  };

  const isAchievementUnlocked = (achievementId: string): boolean => {
    return userAchievements.some(
      ua => ua.achievementId === achievementId && ua.dateUnlocked
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalXP}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.nextTier}</Text>
          <Text style={styles.statLabel}>Next Tier</Text>
        </View>
      </View>

      {/* Achievements List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        <Text style={styles.sectionTitle}>Your Achievements</Text>
        {Object.entries(achievementService.getAchievementDetails('')).map(([_, achievement]) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            progress={getAchievementProgress(achievement.id)}
            isUnlocked={isAchievementUnlocked(achievement.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statsContainer: {
    flexDirection: 'row',
    padding: theme.spacing.medium,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.medium,
    margin: theme.spacing.medium,
    justifyContent: 'space-around'
  },
  statCard: {
    alignItems: 'center'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 4
  },
  scrollView: {
    flex: 1
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginHorizontal: theme.spacing.medium,
    marginBottom: theme.spacing.medium
  }
});

export default AchievementsScreen; 