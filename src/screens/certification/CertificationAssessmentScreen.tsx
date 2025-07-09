import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Text, Button } from '../../components/ui';
import { certificationService, CertificationLevel } from '../../services/certificationService';
import { audioService } from '../../services/audioService';
import { colors, spacing } from '../../theme';

interface RouteParams {
  attemptId: string;
  levelId: string;
}

export const CertificationAssessmentScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { attemptId, levelId } = route.params as RouteParams;

  const [level, setLevel] = useState<CertificationLevel | null>(null);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [scores, setScores] = useState<{
    speaking: number[];
    grammar: number[];
    vocabulary: number[];
  }>({
    speaking: [],
    grammar: [],
    vocabulary: []
  });

  useEffect(() => {
    loadCertificationLevel();
  }, []);

  const loadCertificationLevel = async () => {
    try {
      const levels = await certificationService.getCertificationLevels();
      const currentLevel = levels.find(l => l.id === levelId);
      if (currentLevel) {
        setLevel(currentLevel);
      } else {
        throw new Error('Level not found');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load certification level');
      console.error(error);
    }
  };

  const handleStartRecording = async () => {
    try {
      await audioService.startRecording();
      setRecording(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
      console.error(error);
    }
  };

  const handleStopRecording = async () => {
    try {
      const blob = await audioService.stopRecording();
      setRecording(false);
      setAudioBlob(blob);
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording');
      console.error(error);
    }
  };

  const handleSubmitResponse = async () => {
    if (!audioBlob || !level) return;

    try {
      const currentTopic = level.speaking_topics[currentTopicIndex];
      const evaluation = await certificationService.evaluateSpeaking(
        attemptId,
        audioBlob,
        currentTopic
      );

      // Update scores
      setScores(prev => ({
        speaking: [...prev.speaking, evaluation.score],
        grammar: [...prev.grammar, evaluation.score * 0.8], // Simplified scoring
        vocabulary: [...prev.vocabulary, evaluation.score * 0.9], // Simplified scoring
      }));

      // Move to next topic or complete certification
      if (currentTopicIndex < level.speaking_topics.length - 1) {
        setCurrentTopicIndex(prev => prev + 1);
        setAudioBlob(null);
      } else {
        await completeCertification();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to evaluate response');
      console.error(error);
    }
  };

  const completeCertification = async () => {
    try {
      const finalScores = {
        speaking: Math.round(scores.speaking.reduce((a, b) => a + b, 0) / scores.speaking.length),
        grammar: Math.round(scores.grammar.reduce((a, b) => a + b, 0) / scores.grammar.length),
        vocabulary: Math.round(scores.vocabulary.reduce((a, b) => a + b, 0) / scores.vocabulary.length),
      };

      const result = await certificationService.completeCertification(
        attemptId,
        finalScores
      );

      navigation.navigate('CertificationResults', { attemptId });
    } catch (error) {
      Alert.alert('Error', 'Failed to complete certification');
      console.error(error);
    }
  };

  if (!level) {
    return (
      <View style={styles.container}>
        <Text>Loading assessment...</Text>
      </View>
    );
  }

  const currentTopic = level.speaking_topics[currentTopicIndex];
  const progress = ((currentTopicIndex + 1) / level.speaking_topics.length) * 100;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <Text variant="h2" style={styles.title}>
        Speaking Assessment
      </Text>

      <Text variant="body1" style={styles.subtitle}>
        Topic {currentTopicIndex + 1} of {level.speaking_topics.length}
      </Text>

      <View style={styles.topicCard}>
        <Text variant="h3">Current Topic:</Text>
        <Text variant="body1" style={styles.topic}>
          {currentTopic}
        </Text>
      </View>

      <View style={styles.recordingSection}>
        {recording ? (
          <>
            <Text variant="body1" style={styles.recordingText}>
              Recording... Speak about the topic above.
            </Text>
            <Button
              title="Stop Recording"
              variant="primary"
              onPress={handleStopRecording}
            />
          </>
        ) : audioBlob ? (
          <>
            <Text variant="body1" style={styles.recordingText}>
              Recording complete! Review or submit your response.
            </Text>
            <View style={styles.actionButtons}>
              <Button
                title="Record Again"
                variant="secondary"
                onPress={handleStartRecording}
              />
              <Button
                title="Submit Response"
                variant="primary"
                onPress={handleSubmitResponse}
              />
            </View>
          </>
        ) : (
          <>
            <Text variant="body1" style={styles.recordingText}>
              Press the button below to start recording your response.
            </Text>
            <Button
              title="Start Recording"
              variant="primary"
              onPress={handleStartRecording}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border.light,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  title: {
    marginTop: spacing.large,
    marginBottom: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  subtitle: {
    marginBottom: spacing.large,
    paddingHorizontal: spacing.medium,
    color: colors.textSecondary,
  },
  topicCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing.medium,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.large,
    borderRadius: 8,
  },
  topic: {
    marginTop: spacing.small,
    fontSize: 18,
  },
  recordingSection: {
    padding: spacing.medium,
    alignItems: 'center',
  },
  recordingText: {
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.medium,
  },
}); 