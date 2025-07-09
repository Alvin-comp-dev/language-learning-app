export type LessonScenario = 
  | 'COFFEE_SHOP'
  | 'DIRECTIONS'
  | 'RESTAURANT'
  | 'HOTEL'
  | 'SHOPPING'
  | 'INTRODUCTION'
  | 'EMERGENCY'
  | 'TRANSPORTATION'
  | 'BUSINESS_MEETING'
  | 'SOCIAL_EVENT';

export type LessonDifficulty = 
  | 'BEGINNER'
  | 'ELEMENTARY'
  | 'INTERMEDIATE'
  | 'ADVANCED';

export interface ExpectedResponse {
  phrase: string;
  variations: string[];
}

export interface LessonContent {
  phrases: string[];
  vocabulary: string[];
  grammarPoints: string[];
  expectedResponses: ExpectedResponse[];
}

export interface Lesson {
  id: string;
  title: string;
  scenario: LessonScenario;
  difficulty: LessonDifficulty;
  xpReward: number;
  estimatedDuration: number; // in minutes
  prerequisites: string[]; // lesson IDs that must be completed first
  content: LessonContent;
}

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  score: number;
  attempts: number;
  lastAttemptDate: string;
  pronunciationScores: number[];
  grammarScores: number[];
  vocabularyScores: number[];
}

export interface UserProgress {
  userId: string;
  totalXP: number;
  currentLevel: LessonDifficulty;
  completedLessons: string[];
  lessonProgress: Record<string, LessonProgress>;
  streakDays: number;
  lastPracticeDate: string;
}

export interface LessonResult {
  lessonId: string;
  completed: boolean;
  score: number;
  pronunciationScore: number;
  grammarScore: number;
  vocabularyScore: number;
  duration: number; // in seconds
  mistakes: Array<{
    type: 'pronunciation' | 'grammar' | 'vocabulary';
    original: string;
    expected: string;
    feedback: string;
  }>;
  feedback: {
    strengths: string[];
    improvements: string[];
    nextSteps: string[];
  };
} 