import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Text, Button, Card } from '../../components/ui';
import { certificationService, CertificationLevel, CertificationAttempt } from '../../services/certificationService';
import { useStore } from '../../store/AppStore';
import { colors, spacing } from '../../theme';

export const CertificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useStore();
  
  const [levels, setLevels] = useState<CertificationLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<CertificationAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCertificationLevels();
  }, []);

  const loadCertificationLevels = async () => {
    try {
      const availableLevels = await certificationService.getCertificationLevels();
      setLevels(availableLevels);
    } catch (error) {
      Alert.alert('Error', 'Failed to load certification levels');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCertification = async () => {
    if (!selectedLevel) {
      Alert.alert('Error', 'Please select a certification level');
      return;
    }

    try {
      const attemptId = await certificationService.startCertification(user.id, selectedLevel);
      navigation.navigate('CertificationAssessment', { attemptId, levelId: selectedLevel });
    } catch (error) {
      Alert.alert('Error', 'Failed to start certification');
      console.error(error);
    }
  };

  const renderCertificationLevel = (level: CertificationLevel) => {
    const isSelected = selectedLevel === level.id;

    return (
      <Card
        key={level.id}
        style={[styles.levelCard, isSelected && styles.selectedCard]}
        onPress={() => setSelectedLevel(level.id)}
      >
        <View style={styles.levelHeader}>
          <Text variant="h3">{level.name}</Text>
          <Text variant="body2" style={styles.requiredScore}>
            Required: {level.required_score}%
          </Text>
        </View>

        <Text variant="body1" style={styles.description}>
          {level.description}
        </Text>

        <View style={styles.requirementSection}>
          <Text variant="h4">Speaking Topics:</Text>
          {level.speaking_topics.map((topic, index) => (
            <Text key={index} variant="body2" style={styles.requirement}>
              • {topic}
            </Text>
          ))}
        </View>

        <View style={styles.requirementSection}>
          <Text variant="h4">Grammar Requirements:</Text>
          {level.grammar_requirements.map((req, index) => (
            <Text key={index} variant="body2" style={styles.requirement}>
              • {req}
            </Text>
          ))}
        </View>

        <View style={styles.requirementSection}>
          <Text variant="h4">Vocabulary Requirements:</Text>
          {level.vocabulary_requirements.map((req, index) => (
            <Text key={index} variant="body2" style={styles.requirement}>
              • {req}
            </Text>
          ))}
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading certification levels...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text variant="h1" style={styles.title}>
        Language Certification
      </Text>

      <Text variant="body1" style={styles.subtitle}>
        Get officially certified in your language skills. Choose your certification level below.
      </Text>

      <View style={styles.levelsList}>
        {levels.map(renderCertificationLevel)}
      </View>

      <Button
        title="Start Certification"
        variant="primary"
        onPress={handleStartCertification}
        disabled={!selectedLevel}
        style={styles.startButton}
      />
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
  levelsList: {
    gap: spacing.medium,
  },
  levelCard: {
    padding: spacing.medium,
  },
  selectedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  requiredScore: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  description: {
    marginBottom: spacing.medium,
  },
  requirementSection: {
    marginBottom: spacing.medium,
  },
  requirement: {
    marginLeft: spacing.small,
    marginTop: spacing.xsmall,
    color: colors.textSecondary,
  },
  startButton: {
    marginTop: spacing.large,
    marginBottom: spacing.large,
  },
}); 