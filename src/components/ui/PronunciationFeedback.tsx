import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface PronunciationFeedbackProps {
  accuracy: number;
  phonemeScores: {
    phoneme: string;
    score: number;
    isCorrect: boolean;
  }[];
  suggestions: string[];
  overallFeedback: string;
}

export const PronunciationFeedback: React.FC<PronunciationFeedbackProps> = ({
  accuracy,
  phonemeScores,
  suggestions,
  overallFeedback,
}) => {
  const progressAnimation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: accuracy,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [accuracy]);

  const progressWidth = progressAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>Accuracy: {Math.round(accuracy * 100)}%</Text>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressWidth,
                backgroundColor: accuracy > 0.7 ? colors.success : colors.warning,
              },
            ]}
          />
        </View>
      </View>

      {/* Phoneme Analysis */}
      <View style={styles.phonemesContainer}>
        <Text style={styles.sectionTitle}>Pronunciation Details</Text>
        <View style={styles.phonemeGrid}>
          {phonemeScores.map((score, index) => (
            <View
              key={index}
              style={[
                styles.phonemeItem,
                { backgroundColor: score.isCorrect ? colors.success + '20' : colors.warning + '20' },
              ]}
            >
              <Text style={styles.phonemeText}>{score.phoneme}</Text>
              <View
                style={[
                  styles.phonemeIndicator,
                  { backgroundColor: score.isCorrect ? colors.success : colors.warning },
                ]}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
          {suggestions.map((suggestion, index) => (
            <Text key={index} style={styles.suggestion}>
              • {suggestion}
            </Text>
          ))}
        </View>
      )}

      {/* Overall Feedback */}
      <View style={styles.feedbackContainer}>
        <Text style={styles.overallFeedback}>{overallFeedback}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.medium,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginVertical: spacing.small,
  },
  progressContainer: {
    marginBottom: spacing.medium,
  },
  progressLabel: {
    marginBottom: spacing.xsmall,
    fontSize: 16,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  phonemesContainer: {
    marginBottom: spacing.medium,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.small,
  },
  phonemeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xsmall,
  },
  phonemeItem: {
    padding: spacing.small,
    margin: spacing.xsmall,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 40,
  },
  phonemeText: {
    fontSize: 14,
    marginBottom: spacing.xsmall,
  },
  phonemeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  suggestionsContainer: {
    marginBottom: spacing.medium,
  },
  suggestion: {
    fontSize: 14,
    marginBottom: spacing.xsmall,
    color: colors.text,
  },
  feedbackContainer: {
    padding: spacing.medium,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
  },
  overallFeedback: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.primary,
  },
}); 