import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Text from './Text';
import { theme } from '../../theme';
import { Achievement } from '../../services/achievementService';

interface AchievementCardProps {
  achievement: Achievement;
  progress: number;
  isUnlocked: boolean;
  onPress?: () => void;
}

const TIER_COLORS = {
  BRONZE: ['#CD7F32', '#B87333'],
  SILVER: ['#C0C0C0', '#A8A8A8'],
  GOLD: ['#FFD700', '#DAA520'],
  PLATINUM: ['#E5E4E2', '#A9A9A9']
};

const AchievementCard: React.FC<AchievementCardProps> = ({
  achievement,
  progress,
  isUnlocked,
  onPress
}) => {
  const progressPercentage = Math.min(
    100,
    (progress / achievement.criteria.threshold) * 100
  );

  const gradientColors = TIER_COLORS[achievement.tier];

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <LinearGradient
        colors={isUnlocked ? gradientColors : ['#666', '#444']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialCommunityIcons
              name={achievement.icon}
              size={24}
              color={isUnlocked ? '#FFF' : 'rgba(255,255,255,0.5)'}
              style={styles.icon}
            />
            <View style={styles.titleContainer}>
              <Text style={[
                styles.title,
                !isUnlocked && styles.lockedText
              ]}>
                {achievement.title}
              </Text>
              <Text style={[
                styles.description,
                !isUnlocked && styles.lockedText
              ]}>
                {achievement.description}
              </Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercentage}%`,
                    backgroundColor: isUnlocked ? '#FFF' : 'rgba(255,255,255,0.3)'
                  }
                ]}
              />
            </View>
            <Text style={[
              styles.progressText,
              !isUnlocked && styles.lockedText
            ]}>
              {isUnlocked ? 'Completed!' : `${Math.round(progressPercentage)}%`}
            </Text>
          </View>

          {isUnlocked && (
            <View style={styles.rewardContainer}>
              <MaterialCommunityIcons
                name="star"
                size={16}
                color="#FFF"
                style={styles.rewardIcon}
              />
              <Text style={styles.rewardText}>
                +{achievement.xpReward} XP
              </Text>
            </View>
          )}

          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>
              {achievement.tier}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.spacing.medium,
    marginBottom: theme.spacing.medium,
    overflow: 'hidden'
  },
  content: {
    padding: theme.spacing.medium
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.small
  },
  icon: {
    marginRight: theme.spacing.small
  },
  titleContainer: {
    flex: 1
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 2
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)'
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.small
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    marginRight: theme.spacing.small
  },
  progressFill: {
    height: '100%',
    borderRadius: 2
  },
  progressText: {
    fontSize: 12,
    color: '#FFF',
    minWidth: 50,
    textAlign: 'right'
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.small
  },
  rewardIcon: {
    marginRight: 4
  },
  rewardText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: 'bold'
  },
  tierBadge: {
    position: 'absolute',
    top: theme.spacing.small,
    right: theme.spacing.small,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: theme.spacing.small,
    paddingVertical: 2,
    borderRadius: 12
  },
  tierText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold'
  },
  lockedText: {
    opacity: 0.5
  }
});

export default AchievementCard; 