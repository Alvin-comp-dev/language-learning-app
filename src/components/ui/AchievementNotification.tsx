import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from './Text';
import { colors, spacing } from '../../theme';
import { Achievement } from '../../services/achievementService';

interface AchievementNotificationProps {
  achievement: Achievement;
  onHide: () => void;
}

const AchievementNotification: React.FC<AchievementNotificationProps> = ({ 
  achievement,
  onHide
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Show animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();

    // Hide after 3 seconds
    const hideTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        onHide();
      });
    }, 3000);

    return () => clearTimeout(hideTimer);
  }, []);

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity
        }
      ]}
    >
      <View style={styles.content}>
        <Text variant="h2" style={styles.icon}>
          {achievement.icon}
        </Text>
        
        <View style={styles.textContainer}>
          <Text variant="bodyLarge" style={styles.title}>
            Achievement Unlocked!
          </Text>
          
          <Text variant="bodyMedium" style={styles.achievementTitle}>
            {achievement.title}
          </Text>
          
          {achievement.reward && (
            <Text variant="caption" style={styles.reward}>
              🎁 {achievement.reward}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.xl + spacing.lg, // Account for status bar
    paddingHorizontal: spacing.lg,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  icon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.success[500],
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  achievementTitle: {
    fontWeight: '500',
    marginBottom: achievement => achievement.reward ? spacing.xs : 0,
  },
  reward: {
    color: colors.primary[500],
  },
});

export default AchievementNotification; 