import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Share } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Text, Button, Card } from '../../components/ui';
import { certificationService, CertificationAttempt } from '../../services/certificationService';
import { colors, spacing } from '../../theme';

interface RouteParams {
  attemptId: string;
}

export const CertificationResultsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { attemptId } = route.params as RouteParams;

  const [attempt, setAttempt] = useState<CertificationAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const certifications = await certificationService.getUserCertifications(attemptId);
      const currentAttempt = certifications.find(c => c.id === attemptId);
      if (currentAttempt) {
        setAttempt(currentAttempt);
      } else {
        throw new Error('Certification attempt not found');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load certification results');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!attempt) return;

    try {
      const message = `I just got certified in Spanish at ${attempt.certification_level} level with a score of ${attempt.overall_score}%! Check out my certificate: ${attempt.certificate_url}`;
      await Share.share({
        message,
        title: 'My Language Certification'
      });
    } catch (error) {
      console.error('Error sharing certificate:', error);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!attempt?.certificate_url) return;

    try {
      // TODO: Implement certificate download
      Alert.alert('Success', 'Certificate downloaded successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to download certificate');
      console.error(error);
    }
  };

  if (loading || !attempt) {
    return (
      <View style={styles.container}>
        <Text>Loading results...</Text>
      </View>
    );
  }

  const passed = attempt.overall_score >= 70;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="h1" style={styles.title}>
          Certification Results
        </Text>

        {passed ? (
          <Text variant="h2" style={[styles.resultText, styles.passedText]}>
            🎉 Congratulations!
          </Text>
        ) : (
          <Text variant="h2" style={[styles.resultText, styles.failedText]}>
            Keep Practicing
          </Text>
        )}
      </View>

      <Card style={styles.scoreCard}>
        <Text variant="h3">Overall Score</Text>
        <Text variant="h1" style={styles.scoreText}>
          {attempt.overall_score}%
        </Text>

        <View style={styles.scoreBreakdown}>
          <View style={styles.scoreItem}>
            <Text variant="body2">Speaking</Text>
            <Text variant="h3">{attempt.speaking_score}%</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text variant="body2">Grammar</Text>
            <Text variant="h3">{attempt.grammar_score}%</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text variant="body2">Vocabulary</Text>
            <Text variant="h3">{attempt.vocabulary_score}%</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.feedbackCard}>
        <Text variant="h3" style={styles.feedbackTitle}>
          Your Performance
        </Text>

        <View style={styles.feedbackSection}>
          <Text variant="h4" style={styles.sectionTitle}>
            Strengths
          </Text>
          {attempt.feedback.strengths.map((strength, index) => (
            <Text key={index} variant="body1" style={styles.feedbackItem}>
              ✓ {strength}
            </Text>
          ))}
        </View>

        <View style={styles.feedbackSection}>
          <Text variant="h4" style={styles.sectionTitle}>
            Areas for Improvement
          </Text>
          {attempt.feedback.areas_for_improvement.map((area, index) => (
            <Text key={index} variant="body1" style={styles.feedbackItem}>
              • {area}
            </Text>
          ))}
        </View>

        <View style={styles.feedbackSection}>
          <Text variant="h4" style={styles.sectionTitle}>
            Recommendations
          </Text>
          {attempt.feedback.recommendations.map((rec, index) => (
            <Text key={index} variant="body1" style={styles.feedbackItem}>
              → {rec}
            </Text>
          ))}
        </View>
      </Card>

      {passed && attempt.certificate_url && (
        <View style={styles.certificateActions}>
          <Button
            title="Download Certificate"
            variant="primary"
            onPress={handleDownloadCertificate}
            style={styles.actionButton}
          />
          <Button
            title="Share Achievement"
            variant="secondary"
            onPress={handleShare}
            style={styles.actionButton}
          />
        </View>
      )}

      <Button
        title="Return to Dashboard"
        variant="secondary"
        onPress={() => navigation.navigate('Dashboard')}
        style={styles.returnButton}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.medium,
    alignItems: 'center',
  },
  title: {
    marginBottom: spacing.small,
  },
  resultText: {
    marginBottom: spacing.large,
  },
  passedText: {
    color: colors.success[500],
  },
  failedText: {
    color: colors.error[500],
  },
  scoreCard: {
    margin: spacing.medium,
    padding: spacing.medium,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 48,
    color: colors.primary[500],
    marginVertical: spacing.medium,
  },
  scoreBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: spacing.medium,
  },
  scoreItem: {
    alignItems: 'center',
  },
  feedbackCard: {
    margin: spacing.medium,
    padding: spacing.medium,
  },
  feedbackTitle: {
    marginBottom: spacing.medium,
  },
  feedbackSection: {
    marginBottom: spacing.large,
  },
  sectionTitle: {
    marginBottom: spacing.small,
  },
  feedbackItem: {
    marginBottom: spacing.small,
    paddingLeft: spacing.small,
  },
  certificateActions: {
    padding: spacing.medium,
    gap: spacing.small,
  },
  actionButton: {
    marginBottom: spacing.small,
  },
  returnButton: {
    margin: spacing.medium,
  },
}); 