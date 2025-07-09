import { supabase } from '../config/supabase';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  criteria: {
    type: 'LESSONS_COMPLETED' | 'STREAK_DAYS' | 'PERFECT_SCORES' | 'VOCABULARY_MASTERED' | 'SPEAKING_TIME';
    threshold: number;
  };
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  dateUnlocked: Date;
  progress: number;
}

class AchievementService {
  private static ACHIEVEMENTS: Achievement[] = [
    {
      id: 'first-lesson',
      title: 'First Steps',
      description: 'Complete your first lesson',
      icon: 'footsteps',
      xpReward: 50,
      criteria: {
        type: 'LESSONS_COMPLETED',
        threshold: 1
      },
      tier: 'BRONZE'
    },
    {
      id: 'week-streak',
      title: 'Consistency is Key',
      description: 'Maintain a 7-day learning streak',
      icon: 'calendar-check',
      xpReward: 100,
      criteria: {
        type: 'STREAK_DAYS',
        threshold: 7
      },
      tier: 'SILVER'
    },
    {
      id: 'perfect-10',
      title: 'Perfect 10',
      description: 'Get perfect scores in 10 lessons',
      icon: 'star',
      xpReward: 200,
      criteria: {
        type: 'PERFECT_SCORES',
        threshold: 10
      },
      tier: 'GOLD'
    },
    {
      id: 'vocabulary-master',
      title: 'Vocabulary Master',
      description: 'Master 100 vocabulary words',
      icon: 'book',
      xpReward: 300,
      criteria: {
        type: 'VOCABULARY_MASTERED',
        threshold: 100
      },
      tier: 'PLATINUM'
    },
    {
      id: 'speaking-pro',
      title: 'Speaking Pro',
      description: 'Complete 2 hours of speaking practice',
      icon: 'microphone',
      xpReward: 250,
      criteria: {
        type: 'SPEAKING_TIME',
        threshold: 7200 // 2 hours in seconds
      },
      tier: 'GOLD'
    }
  ];

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user achievements:', error);
      throw error;
    }

    return data || [];
  }

  async checkAndAwardAchievements(userId: string, stats: {
    lessonsCompleted: number;
    streakDays: number;
    perfectScores: number;
    vocabularyMastered: number;
    speakingTimeSeconds: number;
  }): Promise<Achievement[]> {
    const userAchievements = await this.getUserAchievements(userId);
    const unlockedAchievements: Achievement[] = [];

    for (const achievement of AchievementService.ACHIEVEMENTS) {
      // Skip if already unlocked
      if (userAchievements.some(ua => ua.achievementId === achievement.id)) {
        continue;
      }

      let progress = 0;
      switch (achievement.criteria.type) {
        case 'LESSONS_COMPLETED':
          progress = stats.lessonsCompleted;
          break;
        case 'STREAK_DAYS':
          progress = stats.streakDays;
          break;
        case 'PERFECT_SCORES':
          progress = stats.perfectScores;
          break;
        case 'VOCABULARY_MASTERED':
          progress = stats.vocabularyMastered;
          break;
        case 'SPEAKING_TIME':
          progress = stats.speakingTimeSeconds;
          break;
      }

      if (progress >= achievement.criteria.threshold) {
        await this.unlockAchievement(userId, achievement.id, progress);
        unlockedAchievements.push(achievement);
      } else {
        // Update progress
        await this.updateAchievementProgress(userId, achievement.id, progress);
      }
    }

    return unlockedAchievements;
  }

  private async unlockAchievement(userId: string, achievementId: string, progress: number): Promise<void> {
    const { error } = await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        achievement_id: achievementId,
        date_unlocked: new Date().toISOString(),
        progress
      });

    if (error) {
      console.error('Error unlocking achievement:', error);
      throw error;
    }

    // Award XP
    const achievement = AchievementService.ACHIEVEMENTS.find(a => a.id === achievementId);
    if (achievement) {
      await this.awardXP(userId, achievement.xpReward);
    }
  }

  private async updateAchievementProgress(userId: string, achievementId: string, progress: number): Promise<void> {
    const { error } = await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        achievement_id: achievementId,
        progress
      });

    if (error) {
      console.error('Error updating achievement progress:', error);
      throw error;
    }
  }

  private async awardXP(userId: string, xp: number): Promise<void> {
    const { error } = await supabase.rpc('award_xp', {
      p_user_id: userId,
      p_xp_amount: xp
    });

    if (error) {
      console.error('Error awarding XP:', error);
      throw error;
    }
  }

  getAchievementDetails(achievementId: string): Achievement | undefined {
    return AchievementService.ACHIEVEMENTS.find(a => a.id === achievementId);
  }

  async getAchievementProgress(userId: string, achievementId: string): Promise<number> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('progress')
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .single();

    if (error) {
      console.error('Error fetching achievement progress:', error);
      return 0;
    }

    return data?.progress || 0;
  }
}

export default new AchievementService(); 