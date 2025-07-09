import React, { createContext } from 'react';
import { create } from 'zustand';
import { Lesson, ConversationSession, UserProgress } from '../config/supabase';
import { progressService } from '../services/progressService';
import { achievementService, Achievement, UserAchievement } from '../services/achievementService';

interface AppState {
  // UI State
  isOnboarding: boolean;
  currentLesson: Lesson | null;
  currentSession: ConversationSession | null;
  
  // Data State
  lessons: Lesson[];
  userProgress: UserProgress[];
  achievements: Achievement[];
  userAchievements: UserAchievement[];
  
  // Loading States
  loadingLessons: boolean;
  loadingSession: boolean;
  loadingAchievements: boolean;
  
  // Achievement Notification
  currentAchievementNotification: Achievement | null;
  
  // Actions
  setOnboarding: (isOnboarding: boolean) => void;
  setCurrentLesson: (lesson: Lesson | null) => void;
  setCurrentSession: (session: ConversationSession | null) => void;
  setLessons: (lessons: Lesson[]) => void;
  setUserProgress: (progress: UserProgress[]) => void;
  setLoadingLessons: (loading: boolean) => void;
  setLoadingSession: (loading: boolean) => void;
  
  // Progress actions
  loadUserProgress: () => Promise<void>;
  refreshProgress: () => Promise<void>;
  
  // Achievement actions
  loadAchievements: () => Promise<void>;
  hideAchievementNotification: () => void;
  
  // Computed values
  getProgressForLesson: (lessonId: string) => UserProgress | null;
  getCompletedLessons: () => UserProgress[];
  getTotalLessonsCompleted: () => number;
  getAverageScore: () => number;
  getAchievementProgress: (achievementId: string) => number;
  isAchievementUnlocked: (achievementId: string) => boolean;
}

const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isOnboarding: true,
  currentLesson: null,
  currentSession: null,
  lessons: [],
  userProgress: [],
  achievements: [],
  userAchievements: [],
  loadingLessons: false,
  loadingSession: false,
  loadingAchievements: false,
  currentAchievementNotification: null,
  
  // Actions
  setOnboarding: (isOnboarding) => set({ isOnboarding }),
  setCurrentLesson: (lesson) => set({ currentLesson: lesson }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setLessons: (lessons) => set({ lessons }),
  setUserProgress: (progress) => set({ userProgress: progress }),
  setLoadingLessons: (loading) => set({ loadingLessons: loading }),
  setLoadingSession: (loading) => set({ loadingSession: loading }),
  
  // Progress actions
  loadUserProgress: async () => {
    try {
      set({ loadingLessons: true });
      await progressService.initialize();
      const progress = await progressService.getUserProgress();
      set({ userProgress: progress });
    } catch (error) {
      console.error('Failed to load user progress:', error);
    } finally {
      set({ loadingLessons: false });
    }
  },
  
  refreshProgress: async () => {
    try {
      const progress = await progressService.getUserProgress();
      set({ userProgress: progress });
    } catch (error) {
      console.error('Failed to refresh progress:', error);
    }
  },
  
  // Achievement actions
  loadAchievements: async () => {
    try {
      set({ loadingAchievements: true });
      await achievementService.initialize();
      const allAchievements = achievementService.getAchievements();
      const userAchievements = await achievementService.getUserAchievements();
      set({ 
        achievements: allAchievements,
        userAchievements
      });

      // Register achievement unlock callback
      progressService.onAchievementUnlock(({ achievement }) => {
        set({ currentAchievementNotification: achievement });
      });
    } catch (error) {
      console.error('Failed to load achievements:', error);
    } finally {
      set({ loadingAchievements: false });
    }
  },

  hideAchievementNotification: () => {
    set({ currentAchievementNotification: null });
  },
  
  // Computed values
  getProgressForLesson: (lessonId: string) => {
    const { userProgress } = get();
    return userProgress.find(p => p.lesson_id === lessonId) || null;
  },
  
  getCompletedLessons: () => {
    const { userProgress } = get();
    return userProgress.filter(p => p.mastery_level === 'mastered');
  },
  
  getTotalLessonsCompleted: () => {
    const { userProgress } = get();
    return userProgress.filter(p => p.mastery_level === 'mastered').length;
  },
  
  getAverageScore: () => {
    const { userProgress } = get();
    if (userProgress.length === 0) return 0;
    const totalScore = userProgress.reduce((sum, p) => sum + p.best_score, 0);
    return Math.round(totalScore / userProgress.length);
  },

  getAchievementProgress: (achievementId: string) => {
    const { userAchievements } = get();
    const achievement = userAchievements.find(ua => ua.achievement_id === achievementId);
    return achievement?.progress || 0;
  },

  isAchievementUnlocked: (achievementId: string) => {
    const { userAchievements } = get();
    const achievement = userAchievements.find(ua => ua.achievement_id === achievementId);
    return !!achievement?.unlocked_at;
  }
}));

export const useApp = useAppStore;

// Create a context for the app store
export const AppContext = createContext<typeof useAppStore | null>(null); 