import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '../../components/ui';
import { Button } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { CORE_LESSONS } from '../../data/lessons';
import { useApp } from '../../store/AppStore';

interface DashboardScreenProps {
  navigation: any;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { 
    lessons, 
    userProgress, 
    getTotalLessonsCompleted, 
    getAverageScore,
    getProgressForLesson,
    loadUserProgress,
    loadingLessons
  } = useApp();

  useEffect(() => {
    // Load user progress when component mounts
    loadUserProgress();
  }, [loadUserProgress]);
  const handleStartLesson = (lessonId: string) => {
    navigation.navigate('ConversationScreen', { lessonId });
  };

  const renderLessonCard = (lesson: any) => {
    const levelColors: Record<string, string> = {
      beginner: colors.success[500],
      elementary: colors.warning[500],
      intermediate: colors.error[500],
      advanced: colors.primary[500],
    };
    const levelColor = levelColors[lesson.level] || colors.primary[500];

    // Get progress for this lesson
    const progress = getProgressForLesson(lesson.id);
    const isCompleted = progress?.mastery_level === 'mastered';
    const bestScore = progress?.best_score || 0;

    return (
      <TouchableOpacity
        key={lesson.id}
        style={[styles.lessonCard, isCompleted && styles.completedLessonCard]}
        onPress={() => handleStartLesson(lesson.id)}
      >
        <View style={styles.lessonHeader}>
          <Text variant="h3" style={styles.lessonTitle}>
            {lesson.title}
          </Text>
          <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
            <Text variant="caption" style={styles.levelText}>
              {lesson.level.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <Text variant="bodyMedium" style={styles.lessonDescription}>
          {lesson.description}
        </Text>
        
        <View style={styles.lessonMeta}>
          <Text variant="caption" style={styles.metaText}>
            📝 {lesson.category} • ⏱️ {lesson.duration} min
          </Text>
          <Text variant="caption" style={styles.metaText}>
            🎯 {lesson.learning_goals.length} learning goals
          </Text>
        </View>
        
        {/* Progress indicator */}
        {progress && (
          <View style={styles.progressIndicator}>
            <Text variant="caption" style={styles.progressText}>
              {isCompleted ? '✅ Completed' : '📊 In Progress'} • Best Score: {bestScore}%
            </Text>
          </View>
        )}
        
        <View style={styles.vocabularyPreview}>
          <Text variant="caption" style={styles.vocabularyTitle}>
            Key vocabulary:
          </Text>
          <Text variant="caption" style={styles.vocabularyText}>
            {lesson.vocabulary.slice(0, 3).map((v: any) => v.spanish).join(', ')}
            {lesson.vocabulary.length > 3 && '...'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
      
      <View style={styles.header}>
        <Text variant="h2" style={styles.title}>
          SpeakFlow Dashboard
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Choose a lesson to start practicing Spanish with Sofia
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text variant="h3" style={styles.statNumber}>{CORE_LESSONS.length}</Text>
            <Text variant="caption" style={styles.statLabel}>Lessons Available</Text>
          </View>
          <View style={styles.statCard}>
            <Text variant="h3" style={styles.statNumber}>{getTotalLessonsCompleted()}</Text>
            <Text variant="caption" style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text variant="h3" style={styles.statNumber}>{getAverageScore()}%</Text>
            <Text variant="caption" style={styles.statLabel}>Avg Score</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <Button
            title="📊 View Detailed Progress"
            variant="secondary"
            onPress={() => navigation.navigate('Progress')}
            style={styles.actionButton}
          />
          <Button
            title="📚 Browse Content Packs"
            variant="secondary"
            onPress={() => navigation.navigate('ContentPacks')}
            style={styles.actionButton}
          />
          <Button
            title="🎓 Get Certified"
            variant="secondary"
            onPress={() => navigation.navigate('Certification')}
            style={styles.actionButton}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text variant="h3" style={styles.sectionTitle}>
            Available Lessons
          </Text>
          <Text variant="caption" style={styles.sectionSubtitle}>
            Tap any lesson to start practicing
          </Text>
        </View>

        <View style={styles.lessonsContainer}>
          {CORE_LESSONS.map(renderLessonCard)}
        </View>

        <View style={styles.quickStart}>
          <Text variant="h3" style={styles.quickStartTitle}>
            Quick Start
          </Text>
          <Text variant="bodyMedium" style={styles.quickStartDescription}>
            New to Spanish? Start with our beginner-friendly coffee ordering lesson.
          </Text>
          <Button
            title="Start First Lesson"
            onPress={() => handleStartLesson('ordering-coffee')}
            style={styles.quickStartButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  
  header: {
    padding: spacing.lg,
    backgroundColor: colors.primary[500],
    paddingTop: spacing.xl,
  },
  
  title: {
    color: colors.text.inverse,
    marginBottom: spacing.xs,
  },
  
  subtitle: {
    color: colors.text.inverse,
    opacity: 0.9,
  },
  
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  
  statCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  
  statNumber: {
    color: colors.primary[500],
    marginBottom: spacing.xs,
  },
  
  statLabel: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  
  actionButtons: {
    gap: spacing.small,
    marginBottom: spacing.large,
  },
  actionButton: {
    width: '100%',
  },
  
  sectionHeader: {
    marginBottom: spacing.lg,
  },
  
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  
  sectionSubtitle: {
    color: colors.text.secondary,
  },
  
  lessonsContainer: {
    marginBottom: spacing.xl,
  },
  
  lessonCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  completedLessonCard: {
    borderColor: colors.success[500],
    borderWidth: 2,
  },
  
  progressIndicator: {
    backgroundColor: colors.primary[50],
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  
  progressText: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  
  lessonTitle: {
    flex: 1,
    marginRight: spacing.md,
  },
  
  levelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  
  levelText: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  
  lessonDescription: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  
  lessonMeta: {
    marginBottom: spacing.md,
  },
  
  metaText: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  
  vocabularyPreview: {
    backgroundColor: colors.background.secondary,
    padding: spacing.sm,
    borderRadius: 8,
  },
  
  vocabularyTitle: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  
  vocabularyText: {
    color: colors.text.primary,
    fontStyle: 'italic',
  },
  
  quickStart: {
    backgroundColor: colors.primary[500],
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  
  quickStartTitle: {
    color: colors.text.inverse,
    marginBottom: spacing.sm,
  },
  
  quickStartDescription: {
    color: colors.text.inverse,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  
  quickStartButton: {
    backgroundColor: colors.text.inverse,
    paddingHorizontal: spacing.lg,
  },
});

export default DashboardScreen; 