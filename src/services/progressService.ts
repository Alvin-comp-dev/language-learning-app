import { supabase, UserProgress, ConversationSession, User } from '../config/supabase';
import { ConversationState } from './conversationService';
import { achievementService, Achievement } from './achievementService';

export interface ProgressUpdateData {
  lesson_id: string;
  pronunciation_score: number;
  completion_percentage: number;
  session_data: any;
  vocabulary_learned: string[];
  grammar_corrections: string[];
}

export interface SessionStats {
  total_lessons_completed: number;
  average_pronunciation_score: number;
  total_speaking_time: number;
  streak_count: number;
  vocabulary_learned_count: number;
  strongest_areas: string[];
  improvement_areas: string[];
}

interface AchievementUnlockEvent {
  achievement: Achievement;
  timestamp: Date;
}

interface LessonProgress {
  lessonId: string;
  completed: boolean;
  score: number;
  timeSpent: number;
  correctPhrases: number;
  totalPhrases: number;
  lastAttemptDate: Date;
}

interface LessonSection {
  type: 'pronunciation' | 'vocabulary' | 'grammar';
  score: number;
  completed: boolean;
}

interface LessonStats {
  totalPhrases: number;
  correctPhrases: number;
  averageAccuracy: number;
  timeSpent: number;
}

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

interface StreakData {
  currentStreak: number;
  lastPracticeDate: string;
  bestStreak: number;
  totalDaysPracticed: number;
}

class ProgressService {
  private currentUserId: string | null = null;
  private achievementUnlockCallbacks: ((event: AchievementUnlockEvent) => void)[] = [];
  private currentLessonStartTime: number = 0;
  private lessonStats: Partial<LessonStats> = {
    totalPhrases: 0,
    correctPhrases: 0,
    timeSpent: 0,
  };

  /**
   * Initialize progress service with current user
   */
  async initialize(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUserId = user?.id || null;
      await achievementService.initialize();
    } catch (error) {
      console.error('Failed to initialize progress service:', error);
    }
  }

  /**
   * Register callback for achievement unlocks
   */
  onAchievementUnlock(callback: (event: AchievementUnlockEvent) => void): void {
    this.achievementUnlockCallbacks.push(callback);
  }

  /**
   * Update user progress for a lesson
   */
  async updateLessonProgress(data: ProgressUpdateData): Promise<boolean> {
    try {
      if (!this.currentUserId) {
        console.error('No authenticated user for progress update');
        return false;
      }

      // First, get or create user progress record
      let { data: existingProgress, error: fetchError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', this.currentUserId)
        .eq('lesson_id', data.lesson_id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // Determine mastery level based on completion and score
      const masteryLevel = this.calculateMasteryLevel(
        data.completion_percentage,
        data.pronunciation_score
      );

      const progressData: Partial<UserProgress> = {
        user_id: this.currentUserId,
        lesson_id: data.lesson_id,
        best_score: existingProgress 
          ? Math.max(existingProgress.best_score, data.pronunciation_score)
          : data.pronunciation_score,
        attempts_count: existingProgress ? existingProgress.attempts_count + 1 : 1,
        last_attempt_at: new Date().toISOString(),
        mastery_level: masteryLevel,
      };

      // Update or insert progress record
      const { error: upsertError } = await supabase
        .from('user_progress')
        .upsert(progressData, { 
          onConflict: 'user_id,lesson_id',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        throw upsertError;
      }

      // Also save conversation session
      await this.saveConversationSession(data);

      // Update user statistics
      await this.updateUserStatistics();

      // Check achievements
      await this.checkAchievements(data);

      return true;
    } catch (error) {
      console.error('Failed to update lesson progress:', error);
      return false;
    }
  }

  /**
   * Check and update achievements
   */
  private async checkAchievements(data: ProgressUpdateData): Promise<void> {
    try {
      // Get current stats
      const stats = await this.getSessionStats();
      const { data: userData } = await supabase
        .from('users')
        .select('streak_count')
        .eq('id', this.currentUserId)
        .single();

      // Check achievements
      const newlyUnlocked = await achievementService.checkAchievements({
        lessonsCompleted: stats.total_lessons_completed,
        pronunciationScore: data.pronunciation_score,
        streakDays: userData?.streak_count || 0,
        vocabularyLearned: data.vocabulary_learned.length
      });

      // Notify about newly unlocked achievements
      if (newlyUnlocked.length > 0) {
        const timestamp = new Date();
        newlyUnlocked.forEach(achievement => {
          this.achievementUnlockCallbacks.forEach(callback => {
            callback({ achievement, timestamp });
          });
        });
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  }

  /**
   * Save conversation session data
   */
  private async saveConversationSession(data: ProgressUpdateData): Promise<void> {
    try {
      if (!this.currentUserId) return;

      const sessionData: Partial<ConversationSession> = {
        user_id: this.currentUserId,
        lesson_id: data.lesson_id,
        session_data: data.session_data,
        pronunciation_scores: {
          overall: data.pronunciation_score,
          vowels: data.pronunciation_score * 0.9, // Placeholder calculation
          consonants: data.pronunciation_score * 0.8, // Placeholder calculation
          fluency: data.pronunciation_score * 0.95, // Placeholder calculation
        },
        completion_percentage: data.completion_percentage,
        started_at: new Date().toISOString(),
        completed_at: data.completion_percentage >= 100 ? new Date().toISOString() : undefined,
      };

      const { error } = await supabase
        .from('conversation_sessions')
        .insert(sessionData);

      if (error) {
        console.error('Failed to save conversation session:', error);
      }
    } catch (error) {
      console.error('Error saving conversation session:', error);
    }
  }

  /**
   * Get user progress for all lessons
   */
  async getUserProgress(): Promise<UserProgress[]> {
    try {
      if (!this.currentUserId) return [];

      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', this.currentUserId);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get user progress:', error);
      return [];
    }
  }

  /**
   * Get detailed session statistics
   */
  async getSessionStats(): Promise<SessionStats> {
    try {
      if (!this.currentUserId) {
        return this.getEmptyStats();
      }

      // Get user progress
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', this.currentUserId);

      if (progressError) {
        throw progressError;
      }

      // Get conversation sessions for more detailed stats
      const { data: sessionData, error: sessionError } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', this.currentUserId)
        .order('started_at', { ascending: false });

      if (sessionError) {
        throw sessionError;
      }

      // Get user data for streak info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', this.currentUserId)
        .single();

      if (userError) {
        throw userError;
      }

      return this.calculateSessionStats(progressData || [], sessionData || [], userData);
    } catch (error) {
      console.error('Failed to get session stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Calculate mastery level based on completion and score
   */
  private calculateMasteryLevel(
    completionPercentage: number,
    pronunciationScore: number
  ): UserProgress['mastery_level'] {
    if (completionPercentage >= 100 && pronunciationScore >= 90) {
      return 'mastered';
    } else if (completionPercentage >= 100 && pronunciationScore >= 70) {
      return 'practicing';
    } else if (completionPercentage > 0) {
      return 'learning';
    }
    return 'not_started';
  }

  /**
   * Update user statistics
   */
  private async updateUserStatistics(): Promise<void> {
    try {
      if (!this.currentUserId) return;

      const progress = await this.getUserProgress();
      const completedLessons = progress.filter(p => p.mastery_level === 'mastered');
      
      const { error } = await supabase
        .from('users')
        .update({
          total_lessons_completed: completedLessons.length,
          // Add other stats as needed
        })
        .eq('id', this.currentUserId);

      if (error) {
        console.error('Failed to update user statistics:', error);
      }
    } catch (error) {
      console.error('Error updating user statistics:', error);
    }
  }

  /**
   * Calculate comprehensive session statistics
   */
  private calculateSessionStats(
    progressData: UserProgress[],
    sessionData: ConversationSession[],
    userData: User
  ): SessionStats {
    const completedLessons = progressData.filter(p => p.mastery_level === 'mastered');
    const totalScore = progressData.reduce((sum, p) => sum + p.best_score, 0);
    const averageScore = progressData.length > 0 ? Math.round(totalScore / progressData.length) : 0;

    // Calculate speaking time from sessions (placeholder calculation)
    const totalSpeakingTime = sessionData.reduce((sum, s) => {
      return sum + (s.completion_percentage / 100) * 10; // Assume 10 minutes per completed lesson
    }, 0);

    // Identify strongest and weakest areas
    const scoresByArea = progressData.reduce((acc, p) => {
      // This would need to be enhanced with actual lesson category data
      const category = 'general'; // Placeholder
      if (!acc[category]) acc[category] = [];
      acc[category].push(p.best_score);
      return acc;
    }, {} as Record<string, number[]>);

    const strongestAreas = Object.entries(scoresByArea)
      .map(([area, scores]) => ({
        area,
        avgScore: scores.reduce((sum, s) => sum + s, 0) / scores.length
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(item => item.area);

    const improvementAreas = Object.entries(scoresByArea)
      .map(([area, scores]) => ({
        area,
        avgScore: scores.reduce((sum, s) => sum + s, 0) / scores.length
      }))
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 3)
      .map(item => item.area);

    return {
      total_lessons_completed: completedLessons.length,
      average_pronunciation_score: averageScore,
      total_speaking_time: Math.round(totalSpeakingTime),
      streak_count: userData.streak_count || 0,
      vocabulary_learned_count: 0, // Would need to be calculated from session data
      strongest_areas: strongestAreas,
      improvement_areas: improvementAreas,
    };
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(): SessionStats {
    return {
      total_lessons_completed: 0,
      average_pronunciation_score: 0,
      total_speaking_time: 0,
      streak_count: 0,
      vocabulary_learned_count: 0,
      strongest_areas: [],
      improvement_areas: [],
    };
  }

  /**
   * Save conversation state to progress
   */
  async saveConversationProgress(state: ConversationState): Promise<boolean> {
    if (!state.current_lesson) return false;

    const progressData: ProgressUpdateData = {
      lesson_id: state.current_lesson.id,
      pronunciation_score: state.session_stats.average_pronunciation_score,
      completion_percentage: state.session_stats.completion_percentage,
      session_data: {
        exchanges: state.conversation_history.map(msg => ({
          speaker: msg.speaker,
          message: msg.message,
          pronunciation_score: msg.pronunciation_score,
          feedback: msg.feedback,
          timestamp: msg.timestamp.toISOString(),
        })),
        total_exchanges: state.session_stats.total_exchanges,
        vocabulary_learned: state.session_stats.vocabulary_learned,
      },
      vocabulary_learned: state.session_stats.vocabulary_learned,
      grammar_corrections: state.user_mistakes,
    };

    return await this.updateLessonProgress(progressData);
  }

  startLesson(lessonId: string) {
    this.currentLessonStartTime = Date.now();
    this.lessonStats = {
      totalPhrases: 0,
      correctPhrases: 0,
      timeSpent: 0,
    };
  }

  async completeLessonSection(section: LessonSection): Promise<void> {
    try {
      const { data: existingProgress, error: fetchError } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('lesson_id', this.getCurrentLessonId())
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const updates = {
        [`${section.type}_score`]: section.score,
        [`${section.type}_completed`]: section.completed,
        last_attempt_date: new Date().toISOString(),
      };

      if (existingProgress) {
        const { error: updateError } = await supabase
          .from('lesson_progress')
          .update(updates)
          .eq('lesson_id', this.getCurrentLessonId());

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('lesson_progress')
          .insert({
            lesson_id: this.getCurrentLessonId(),
            ...updates,
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      throw error;
    }
  }

  updatePhraseResult(correct: boolean, accuracy: number) {
    this.lessonStats.totalPhrases! += 1;
    if (correct) {
      this.lessonStats.correctPhrases! += 1;
    }
    // Update running average accuracy
    const currentTotal = this.lessonStats.averageAccuracy || 0;
    this.lessonStats.averageAccuracy = (currentTotal * (this.lessonStats.totalPhrases! - 1) + accuracy) / this.lessonStats.totalPhrases!;
  }

  async completeLessonWithStats(): Promise<LessonStats> {
    const endTime = Date.now();
    this.lessonStats.timeSpent = Math.round((endTime - this.currentLessonStartTime) / 1000);

    try {
      const { error } = await supabase
        .from('lesson_progress')
        .update({
          completed: true,
          total_phrases: this.lessonStats.totalPhrases,
          correct_phrases: this.lessonStats.correctPhrases,
          average_accuracy: this.lessonStats.averageAccuracy,
          time_spent: this.lessonStats.timeSpent,
          completion_date: new Date().toISOString(),
        })
        .eq('lesson_id', this.getCurrentLessonId());

      if (error) throw error;

      return this.lessonStats as LessonStats;
    } catch (error) {
      console.error('Error completing lesson:', error);
      throw error;
    }
  }

  private getCurrentLessonId(): string {
    // This should be stored in state management or passed through the app
    // For now, returning a placeholder
    return 'current_lesson_id';
  }

  async getLessonProgress(lessonId: string): Promise<LessonProgress | null> {
    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('lesson_id', lessonId)
        .single();

      if (error) throw error;

      return data ? {
        lessonId: data.lesson_id,
        completed: data.completed,
        score: data.average_accuracy,
        timeSpent: data.time_spent,
        correctPhrases: data.correct_phrases,
        totalPhrases: data.total_phrases,
        lastAttemptDate: new Date(data.last_attempt_date),
      } : null;
    } catch (error) {
      console.error('Error fetching lesson progress:', error);
      throw error;
    }
  }

  async getWeeklyStats(): Promise<WeeklyStats[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 6); // Last 7 days

      const { data, error } = await supabase
        .from('practice_sessions')
        .select('practice_date, duration_minutes, completed')
        .gte('practice_date', startDate.toISOString())
        .lte('practice_date', endDate.toISOString())
        .order('practice_date', { ascending: true });

      if (error) throw error;

      // Initialize all days of the week
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weeklyStats = days.map(day => ({
        day,
        minutes: 0,
        completed: false
      }));

      // Fill in actual practice data
      data?.forEach(session => {
        const sessionDate = new Date(session.practice_date);
        const dayIndex = sessionDate.getDay();
        const dayName = days[dayIndex === 0 ? 6 : dayIndex - 1]; // Adjust Sunday from 0 to 6

        const existingStat = weeklyStats.find(stat => stat.day === dayName);
        if (existingStat) {
          existingStat.minutes += session.duration_minutes;
          existingStat.completed = existingStat.completed || session.completed;
        }
      });

      return weeklyStats;
    } catch (error) {
      console.error('Error fetching weekly stats:', error);
      throw error;
    }
  }

  async getCurrentStreak(): Promise<number> {
    try {
      const { data: streakData, error } = await supabase
        .from('user_streaks')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!streakData) {
        return 0;
      }

      const lastPractice = new Date(streakData.last_practice_date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      // Check if streak is broken
      if (lastPractice < yesterday) {
        await this.resetStreak();
        return 0;
      }

      return streakData.current_streak;
    } catch (error) {
      console.error('Error getting current streak:', error);
      throw error;
    }
  }

  async updateStreak(practiceDate: Date = new Date()): Promise<void> {
    try {
      const { data: existingStreak, error: fetchError } = await supabase
        .from('user_streaks')
        .select('*')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (!existingStreak) {
        // First time practicing
        const { error: insertError } = await supabase
          .from('user_streaks')
          .insert({
            current_streak: 1,
            best_streak: 1,
            last_practice_date: practiceDate.toISOString(),
            total_days_practiced: 1
          });

        if (insertError) throw insertError;
        return;
      }

      const lastPractice = new Date(existingStreak.last_practice_date);
      const today = new Date(practiceDate);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      // Format dates to compare only the date part
      const lastPracticeDate = lastPractice.toISOString().split('T')[0];
      const todayDate = today.toISOString().split('T')[0];
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      let newStreak = existingStreak.current_streak;
      let totalDays = existingStreak.total_days_practiced;

      if (lastPracticeDate === todayDate) {
        // Already practiced today, no streak update needed
        return;
      } else if (lastPracticeDate === yesterdayDate) {
        // Practiced yesterday, increment streak
        newStreak += 1;
        totalDays += 1;
      } else {
        // Streak broken
        newStreak = 1;
        totalDays += 1;
      }

      const { error: updateError } = await supabase
        .from('user_streaks')
        .update({
          current_streak: newStreak,
          best_streak: Math.max(newStreak, existingStreak.best_streak),
          last_practice_date: todayDate,
          total_days_practiced: totalDays
        })
        .eq('id', existingStreak.id);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating streak:', error);
      throw error;
    }
  }

  private async resetStreak(): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_streaks')
        .update({
          current_streak: 0,
          last_practice_date: new Date().toISOString()
        })
        .not('id', 'is', null);

      if (error) throw error;
    } catch (error) {
      console.error('Error resetting streak:', error);
      throw error;
    }
  }

  async getPronunciationStats(): Promise<PronunciationStats> {
    try {
      const { data, error } = await supabase
        .from('pronunciation_stats')
        .select('*')
        .single();

      if (error) throw error;

      return {
        overall: data?.overall_score || 0,
        vowels: data?.vowels_score || 0,
        consonants: data?.consonants_score || 0,
        rollingR: data?.rolling_r_score || 0
      };
    } catch (error) {
      console.error('Error fetching pronunciation stats:', error);
      throw error;
    }
  }

  async updatePronunciationStats(stats: Partial<PronunciationStats>): Promise<void> {
    try {
      const { error } = await supabase
        .from('pronunciation_stats')
        .upsert({
          overall_score: stats.overall,
          vowels_score: stats.vowels,
          consonants_score: stats.consonants,
          rolling_r_score: stats.rollingR,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating pronunciation stats:', error);
      throw error;
    }
  }
}

export const progressService = new ProgressService(); 