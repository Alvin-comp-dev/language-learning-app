import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import { theme } from '../../theme';

import lessonService from '../../services/lessonService';
import { Lesson, LessonDifficulty, LessonScenario } from '../../types/lessons';
import { LESSON_SCENARIOS, DIFFICULTY_LEVELS } from '../../data/lessons';

interface LessonCardProps {
  lesson: Lesson;
  isLocked: boolean;
  progress?: number;
  onPress: () => void;
}

const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  isLocked,
  progress = 0,
  onPress
}) => (
  <TouchableOpacity onPress={onPress} disabled={isLocked}>
    <Card style={styles.lessonCard}>
      <LinearGradient
        colors={isLocked ? ['#666', '#444'] : [theme.colors.primary, theme.colors.secondary]}
        style={styles.cardGradient}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            <View style={styles.difficultyBadge}>
              <Text style={styles.difficultyText}>
                {DIFFICULTY_LEVELS[lesson.difficulty].name}
              </Text>
            </View>
          </View>

          <View style={styles.lessonInfo}>
            <Text style={styles.infoText}>
              {lesson.estimatedDuration} min • {lesson.xpReward} XP
            </Text>
            {isLocked && (
              <View style={styles.lockContainer}>
                <Image
                  source={require('../../../assets/icons/lock.png')}
                  style={styles.lockIcon}
                />
                <Text style={styles.lockText}>Complete prerequisites first</Text>
              </View>
            )}
          </View>

          {progress > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, progress)}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Card>
  </TouchableOpacity>
);

const LessonSelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [userProgress, setUserProgress] = useState<{
    completedLessons: string[];
    lessonProgress: Record<string, { score: number }>;
  }>({ completedLessons: [], lessonProgress: {} });
  
  const [selectedDifficulty, setSelectedDifficulty] = useState<LessonDifficulty | 'ALL'>('ALL');
  const [selectedScenario, setSelectedScenario] = useState<LessonScenario | 'ALL'>('ALL');

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      // In a real app, get the actual user ID
      const userId = 'current-user-id';
      const lessons = await lessonService.getAvailableLessons(userId);
      setAvailableLessons(lessons);
      
      // Get user progress
      const progress = await lessonService.getUserProgress(userId);
      if (progress) {
        setUserProgress({
          completedLessons: progress.completedLessons,
          lessonProgress: progress.lessonProgress
        });
      }
    } catch (error) {
      console.error('Failed to load lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLessons = availableLessons.filter(lesson => {
    const matchesDifficulty = selectedDifficulty === 'ALL' || lesson.difficulty === selectedDifficulty;
    const matchesScenario = selectedScenario === 'ALL' || lesson.scenario === selectedScenario;
    return matchesDifficulty && matchesScenario;
  });

  const isLessonLocked = (lesson: Lesson): boolean => {
    if (lesson.prerequisites.length === 0) return false;
    return !lesson.prerequisites.every(prereq => 
      userProgress.completedLessons.includes(prereq)
    );
  };

  const getLessonProgress = (lessonId: string): number => {
    const progress = userProgress.lessonProgress[lessonId];
    return progress ? progress.score : 0;
  };

  const handleLessonPress = (lesson: Lesson) => {
    navigation.navigate('ConversationScreen', {
      lessonId: lesson.id,
      language: 'Spanish', // This would come from user settings
      proficiencyLevel: lesson.difficulty,
      learningGoals: ['Speaking', 'Pronunciation'] // This would come from user settings
    });
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
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {/* Difficulty filters */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedDifficulty === 'ALL' && styles.filterChipSelected
            ]}
            onPress={() => setSelectedDifficulty('ALL')}
          >
            <Text style={styles.filterText}>All Levels</Text>
          </TouchableOpacity>
          {Object.entries(DIFFICULTY_LEVELS).map(([key, value]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterChip,
                selectedDifficulty === key && styles.filterChipSelected
              ]}
              onPress={() => setSelectedDifficulty(key as LessonDifficulty)}
            >
              <Text style={styles.filterText}>{value.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {/* Scenario filters */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedScenario === 'ALL' && styles.filterChipSelected
            ]}
            onPress={() => setSelectedScenario('ALL')}
          >
            <Text style={styles.filterText}>All Scenarios</Text>
          </TouchableOpacity>
          {Object.entries(LESSON_SCENARIOS).map(([key, value]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterChip,
                selectedScenario === key && styles.filterChipSelected
              ]}
              onPress={() => setSelectedScenario(key as LessonScenario)}
            >
              <Text style={styles.filterText}>{value}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.lessonsContainer}>
        {filteredLessons.map(lesson => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            isLocked={isLessonLocked(lesson)}
            progress={getLessonProgress(lesson.id)}
            onPress={() => handleLessonPress(lesson)}
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
  filtersContainer: {
    padding: theme.spacing.medium
  },
  filterScroll: {
    marginBottom: theme.spacing.small
  },
  filterChip: {
    paddingHorizontal: theme.spacing.medium,
    paddingVertical: theme.spacing.small,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    marginRight: theme.spacing.small
  },
  filterChipSelected: {
    backgroundColor: theme.colors.primary
  },
  filterText: {
    color: theme.colors.text.primary,
    fontSize: 14
  },
  lessonsContainer: {
    flex: 1,
    padding: theme.spacing.medium
  },
  lessonCard: {
    marginBottom: theme.spacing.medium,
    overflow: 'hidden'
  },
  cardGradient: {
    padding: theme.spacing.medium,
    borderRadius: theme.spacing.small
  },
  cardContent: {
    gap: theme.spacing.small
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  lessonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.inverse,
    flex: 1
  },
  difficultyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.small,
    paddingVertical: 4,
    borderRadius: 12
  },
  difficultyText: {
    color: theme.colors.text.inverse,
    fontSize: 12
  },
  lessonInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  infoText: {
    color: theme.colors.text.inverse,
    fontSize: 14,
    opacity: 0.8
  },
  lockContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  lockIcon: {
    width: 16,
    height: 16,
    marginRight: theme.spacing.small,
    tintColor: theme.colors.text.inverse
  },
  lockText: {
    color: theme.colors.text.inverse,
    fontSize: 12,
    opacity: 0.8
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.small
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.text.inverse,
    borderRadius: 2
  },
  progressText: {
    color: theme.colors.text.inverse,
    fontSize: 12,
    opacity: 0.8
  }
});

export default LessonSelectionScreen; 