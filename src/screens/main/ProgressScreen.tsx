import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { observer } from 'mobx-react-lite';
import { Card } from '../../components/ui/Card';
import { Text } from '../../components/ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useStore } from '../../store/AppStore';
import { progressService } from '../../services/progressService';

interface WeeklyStats {
  day: string;
  minutes: number;
  completed: boolean;
}

interface PronunciationStats {
  overall: number;
  vowels: number;
  consonants: number;
  rollingR: number;
}

export const ProgressScreen = observer(() => {
  const { progressStore } = useStore();
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [pronunciationStats, setPronunciationStats] = useState<PronunciationStats>({
    overall: 0,
    vowels: 0,
    consonants: 0,
    rollingR: 0,
  });

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      // Load weekly stats
      const stats = await progressService.getWeeklyStats();
      setWeeklyStats(stats);

      // Load streak
      const streak = await progressService.getCurrentStreak();
      setCurrentStreak(streak);

      // Load pronunciation stats
      const pronStats = await progressService.getPronunciationStats();
      setPronunciationStats(pronStats);
    } catch (error) {
      console.error('Error loading progress data:', error);
    }
  };

  const renderWeeklyProgress = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return (
      <Card style={styles.weeklyCard}>
        <Text style={styles.sectionTitle}>This Week's Stats</Text>
        <View style={styles.weeklyGrid}>
          {days.map((day, index) => {
            const dayStats = weeklyStats.find(s => s.day === day) || {
              minutes: 0,
              completed: false,
            };
            
            return (
              <View key={day} style={styles.dayColumn}>
                <Text style={styles.dayLabel}>{day}</Text>
                <View style={[
                  styles.dayIndicator,
                  dayStats.completed && styles.dayCompleted
                ]}>
                  {dayStats.completed ? '✓' : ''}
                </View>
                <Text style={styles.minutesLabel}>{dayStats.minutes}m</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.streakContainer}>
          <Text style={styles.streakText}>
            🔥 {currentStreak} day streak
          </Text>
          <Text style={styles.streakSubtext}>
            Goal: 5/7 days
          </Text>
        </View>
      </Card>
    );
  };

  const renderPronunciationProgress = () => {
    return (
      <Card style={styles.pronunciationCard}>
        <Text style={styles.sectionTitle}>Pronunciation Progress</Text>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Overall</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pronunciationStats.overall}%` }]} />
          </View>
          <Text style={styles.statValue}>{pronunciationStats.overall}%</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Vowels</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pronunciationStats.vowels}%` }]} />
          </View>
          <Text style={styles.statValue}>{pronunciationStats.vowels}%</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Consonants</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pronunciationStats.consonants}%` }]} />
          </View>
          <Text style={styles.statValue}>{pronunciationStats.consonants}%</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Rolling R</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pronunciationStats.rollingR}%` }]} />
          </View>
          <Text style={styles.statValue}>{pronunciationStats.rollingR}%</Text>
        </View>
      </Card>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome back! 👋
        </Text>
        <Text style={styles.subtitle}>
          Track your learning journey
        </Text>
      </View>

      {renderWeeklyProgress()}
      {renderPronunciationProgress()}

      <Card style={styles.achievementsCard}>
        <Text style={styles.sectionTitle}>Recent Achievements</Text>
        <View style={styles.achievementRow}>
          <View style={styles.achievement}>
            <Text style={styles.achievementEmoji}>🎯</Text>
            <Text style={styles.achievementText}>First Perfect Score</Text>
          </View>
          <View style={styles.achievement}>
            <Text style={styles.achievementEmoji}>🔥</Text>
            <Text style={styles.achievementText}>3 Day Streak</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.large,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.small,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  weeklyCard: {
    margin: spacing.medium,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.medium,
  },
  weeklyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
  },
  dayColumn: {
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 14,
    marginBottom: spacing.small,
  },
  dayIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.small,
  },
  dayCompleted: {
    backgroundColor: colors.success,
  },
  minutesLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  streakContainer: {
    alignItems: 'center',
    marginTop: spacing.medium,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xsmall,
  },
  streakSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  pronunciationCard: {
    margin: spacing.medium,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  statLabel: {
    width: 100,
    fontSize: 14,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginHorizontal: spacing.medium,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  statValue: {
    width: 50,
    fontSize: 14,
    textAlign: 'right',
  },
  achievementsCard: {
    margin: spacing.medium,
    marginBottom: spacing.large,
  },
  achievementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  achievement: {
    alignItems: 'center',
  },
  achievementEmoji: {
    fontSize: 32,
    marginBottom: spacing.small,
  },
  achievementText: {
    fontSize: 14,
    textAlign: 'center',
  },
}); 