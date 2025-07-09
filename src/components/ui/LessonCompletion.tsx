import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { Card } from './Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface LessonCompletionProps {
  lessonStats: {
    totalPhrases: number;
    correctPhrases: number;
    averageAccuracy: number;
    timeSpent: number;
  };
  onContinue: () => void;
  onReviewLesson: () => void;
}

export const LessonCompletion: React.FC<LessonCompletionProps> = ({
  lessonStats,
  onContinue,
  onReviewLesson,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getGrade = (accuracy: number): string => {
    if (accuracy >= 0.9) return 'Excellent!';
    if (accuracy >= 0.8) return 'Great Job!';
    if (accuracy >= 0.7) return 'Good Work!';
    return 'Keep Practicing!';
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Lesson Complete!</Text>
          <Text style={styles.grade}>{getGrade(lessonStats.averageAccuracy)}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.round(lessonStats.averageAccuracy * 100)}%
            </Text>
            <Text style={styles.statLabel}>Average Accuracy</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {lessonStats.correctPhrases}/{lessonStats.totalPhrases}
            </Text>
            <Text style={styles.statLabel}>Phrases Mastered</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(lessonStats.timeSpent)}</Text>
            <Text style={styles.statLabel}>Time Spent</Text>
          </View>
        </View>

        <View style={styles.suggestionsContainer}>
          <Text style={styles.sectionTitle}>Next Steps</Text>
          <Text style={styles.suggestion}>
            • Practice challenging sounds more to improve accuracy
          </Text>
          <Text style={styles.suggestion}>
            • Try speaking at a natural pace for better fluency
          </Text>
          <Text style={styles.suggestion}>
            • Focus on intonation and rhythm in conversations
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            onPress={onReviewLesson}
            style={[styles.button, styles.reviewButton]}
            textStyle={styles.reviewButtonText}
          >
            Review Lesson
          </Button>
          <Button onPress={onContinue} style={styles.button}>
            Continue
          </Button>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.medium,
  },
  card: {
    padding: spacing.large,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.small,
  },
  grade: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.success,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.large,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xsmall,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  suggestionsContainer: {
    marginBottom: spacing.large,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.medium,
  },
  suggestion: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.small,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: spacing.xsmall,
  },
  reviewButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reviewButtonText: {
    color: colors.primary,
  },
}); 