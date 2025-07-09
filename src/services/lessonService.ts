import { supabase } from '../config/supabase';
import { 
  Lesson,
  LessonProgress,
  UserProgress,
  LessonResult,
  LessonDifficulty 
} from '../types/lessons';
import { LESSONS, getNextLessons, calculateUserLevel } from '../data/lessons';
import monitoring from '../config/monitoring';

class LessonService {
  private readonly STREAK_THRESHOLD_HOURS = 36; // Allow some buffer for timezone differences
  private readonly MIN_PASS_SCORE = 70;
  private readonly PROGRESS_TABLE = 'user_progress';
  private readonly RESULTS_TABLE = 'lesson_results';

  /**
   * Get available lessons for user
   */
  public async getAvailableLessons(userId: string): Promise<Lesson[]> {
    try {
      const progress = await this.getUserProgress(userId);
      if (!progress) {
        // New user - return beginner lessons
        return LESSONS.filter(lesson => lesson.difficulty === 'BEGINNER');
      }

      return getNextLessons(progress.completedLessons);
    } catch (error) {
      await monitoring.logError({
        type: 'lesson_availability_check_failed',
        error
      });
      throw new Error('Failed to get available lessons');
    }
  }

  /**
   * Start a new lesson
   */
  public async startLesson(userId: string, lessonId: string): Promise<{
    lesson: Lesson;
    userProgress: UserProgress;
  }> {
    try {
      const lesson = LESSONS.find(l => l.id === lessonId);
      if (!lesson) {
        throw new Error('Lesson not found');
      }

      let progress = await this.getUserProgress(userId);
      
      // Create progress if doesn't exist
      if (!progress) {
        progress = {
          userId,
          totalXP: 0,
          currentLevel: 'BEGINNER',
          completedLessons: [],
          lessonProgress: {},
          streakDays: 0,
          lastPracticeDate: new Date().toISOString()
        };
        await this.saveUserProgress(progress);
      }

      // Initialize lesson progress if first attempt
      if (!progress.lessonProgress[lessonId]) {
        progress.lessonProgress[lessonId] = {
          lessonId,
          completed: false,
          score: 0,
          attempts: 0,
          lastAttemptDate: new Date().toISOString(),
          pronunciationScores: [],
          grammarScores: [],
          vocabularyScores: []
        };
        await this.saveUserProgress(progress);
      }

      return { lesson, userProgress: progress };
    } catch (error) {
      await monitoring.logError({
        type: 'lesson_start_failed',
        error
      });
      throw new Error('Failed to start lesson');
    }
  }

  /**
   * Complete a lesson and save results
   */
  public async completeLessonAttempt(
    userId: string,
    lessonResult: LessonResult
  ): Promise<{
    userProgress: UserProgress;
    leveledUp: boolean;
    earnedXP: number;
  }> {
    try {
      const lesson = LESSONS.find(l => l.id === lessonResult.lessonId);
      if (!lesson) {
        throw new Error('Lesson not found');
      }

      let progress = await this.getUserProgress(userId);
      if (!progress) {
        throw new Error('User progress not found');
      }

      // Update lesson progress
      const lessonProgress = progress.lessonProgress[lessonResult.lessonId] || {
        lessonId: lessonResult.lessonId,
        completed: false,
        score: 0,
        attempts: 0,
        lastAttemptDate: new Date().toISOString(),
        pronunciationScores: [],
        grammarScores: [],
        vocabularyScores: []
      };

      lessonProgress.attempts += 1;
      lessonProgress.lastAttemptDate = new Date().toISOString();
      lessonProgress.pronunciationScores.push(lessonResult.pronunciationScore);
      lessonProgress.grammarScores.push(lessonResult.grammarScore);
      lessonProgress.vocabularyScores.push(lessonResult.vocabularyScore);

      // Check if lesson is completed
      const isCompleted = lessonResult.score >= this.MIN_PASS_SCORE;
      const isFirstCompletion = isCompleted && !lessonProgress.completed;
      
      if (isCompleted) {
        lessonProgress.completed = true;
        lessonProgress.score = Math.max(lessonProgress.score, lessonResult.score);
      }

      // Calculate XP earned
      const earnedXP = this.calculateXPEarned(
        lesson,
        lessonResult,
        isFirstCompletion
      );

      // Update user progress
      progress.lessonProgress[lessonResult.lessonId] = lessonProgress;
      
      if (isFirstCompletion) {
        progress.completedLessons.push(lessonResult.lessonId);
      }

      const oldLevel = progress.currentLevel;
      progress.totalXP += earnedXP;
      progress.currentLevel = calculateUserLevel(progress.totalXP);
      
      // Update streak
      progress = this.updateStreak(progress);

      // Save progress
      await this.saveUserProgress(progress);

      // Save lesson result
      await this.saveLessonResult(userId, lessonResult);

      return {
        userProgress: progress,
        leveledUp: progress.currentLevel !== oldLevel,
        earnedXP
      };
    } catch (error) {
      await monitoring.logError({
        type: 'lesson_completion_failed',
        error
      });
      throw new Error('Failed to complete lesson');
    }
  }

  /**
   * Get user's progress
   */
  private async getUserProgress(userId: string): Promise<UserProgress | null> {
    const { data, error } = await supabase
      .from(this.PROGRESS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Save user's progress
   */
  private async saveUserProgress(progress: UserProgress): Promise<void> {
    const { error } = await supabase
      .from(this.PROGRESS_TABLE)
      .upsert({
        user_id: progress.userId,
        total_xp: progress.totalXP,
        current_level: progress.currentLevel,
        completed_lessons: progress.completedLessons,
        lesson_progress: progress.lessonProgress,
        streak_days: progress.streakDays,
        last_practice_date: progress.lastPracticeDate
      });

    if (error) {
      throw error;
    }
  }

  /**
   * Save lesson result
   */
  private async saveLessonResult(
    userId: string,
    result: LessonResult
  ): Promise<void> {
    const { error } = await supabase
      .from(this.RESULTS_TABLE)
      .insert({
        user_id: userId,
        lesson_id: result.lessonId,
        completed: result.completed,
        score: result.score,
        pronunciation_score: result.pronunciationScore,
        grammar_score: result.grammarScore,
        vocabulary_score: result.vocabularyScore,
        duration: result.duration,
        mistakes: result.mistakes,
        feedback: result.feedback,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw error;
    }
  }

  /**
   * Calculate XP earned for lesson attempt
   */
  private calculateXPEarned(
    lesson: Lesson,
    result: LessonResult,
    isFirstCompletion: boolean
  ): number {
    let xp = 0;

    // Base XP for attempt
    xp += Math.round(lesson.xpReward * (result.score / 100));

    // Bonus XP for first completion
    if (isFirstCompletion) {
      xp += Math.round(lesson.xpReward * 0.5);
    }

    // Bonus XP for perfect scores
    if (result.score >= 95) {
      xp += Math.round(lesson.xpReward * 0.2);
    }

    // Bonus XP for quick completion
    const expectedDuration = lesson.estimatedDuration * 60; // convert to seconds
    if (result.duration < expectedDuration * 0.8) {
      xp += Math.round(lesson.xpReward * 0.1);
    }

    return xp;
  }

  /**
   * Update user's streak
   */
  private updateStreak(progress: UserProgress): UserProgress {
    const now = new Date();
    const lastPractice = new Date(progress.lastPracticeDate);
    const hoursSinceLastPractice = (now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastPractice <= this.STREAK_THRESHOLD_HOURS) {
      // Within streak threshold - increment if it's a new day
      if (now.getDate() !== lastPractice.getDate()) {
        progress.streakDays += 1;
      }
    } else {
      // Streak broken
      progress.streakDays = 1;
    }

    progress.lastPracticeDate = now.toISOString();
    return progress;
  }

  /**
   * Get lesson statistics
   */
  public async getLessonStats(
    userId: string,
    lessonId: string
  ): Promise<{
    attempts: number;
    bestScore: number;
    averageScore: number;
    completionTime: number;
    commonMistakes: Array<{
      type: string;
      count: number;
      examples: string[];
    }>;
  }> {
    try {
      const { data: results, error } = await supabase
        .from(this.RESULTS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId);

      if (error) {
        throw error;
      }

      if (!results.length) {
        return {
          attempts: 0,
          bestScore: 0,
          averageScore: 0,
          completionTime: 0,
          commonMistakes: []
        };
      }

      // Calculate statistics
      const scores = results.map(r => r.score);
      const bestScore = Math.max(...scores);
      const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const completionTime = results
        .map(r => r.duration)
        .reduce((a, b) => a + b, 0) / results.length;

      // Analyze mistakes
      const mistakes = results.flatMap(r => r.mistakes);
      const mistakesByType = mistakes.reduce((acc, mistake) => {
        if (!acc[mistake.type]) {
          acc[mistake.type] = {
            count: 0,
            examples: []
          };
        }
        acc[mistake.type].count += 1;
        if (acc[mistake.type].examples.length < 3) {
          acc[mistake.type].examples.push(mistake.original);
        }
        return acc;
      }, {} as Record<string, { count: number; examples: string[] }>);

      const commonMistakes = Object.entries(mistakesByType)
        .map(([type, data]) => ({
          type,
          count: data.count,
          examples: data.examples
        }))
        .sort((a, b) => b.count - a.count);

      return {
        attempts: results.length,
        bestScore,
        averageScore,
        completionTime,
        commonMistakes
      };
    } catch (error) {
      await monitoring.logError({
        type: 'lesson_stats_retrieval_failed',
        error
      });
      throw new Error('Failed to get lesson statistics');
    }
  }
}

export default new LessonService(); 