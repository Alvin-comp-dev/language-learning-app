import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Create Supabase client with AsyncStorage for persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types (will be generated from Supabase later)
export interface User {
  id: string;
  email: string;
  subscription_tier: 'free' | 'premium' | 'family';
  target_language: string;
  proficiency_level: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
  created_at: string;
  daily_goal_minutes?: number;
  streak_count?: number;
  total_lessons_completed?: number;
  total_speaking_time?: number;
}

export interface Lesson {
  id: string;
  title: string;
  language: string;
  difficulty_level: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
  scenario_type: 'travel' | 'business' | 'social' | 'emergency' | 'general';
  content: {
    description: string;
    learning_goals: string[];
    vocabulary: {
      word: string;
      translation: string;
      pronunciation: string;
    }[];
    conversation_flow: {
      speaker: 'ai' | 'user';
      text: string;
      audio_url?: string;
    }[];
  };
  estimated_duration: number;
  created_at: string;
}

export interface ConversationSession {
  id: string;
  user_id: string;
  lesson_id: string;
  session_data: {
    exchanges: {
      user_input: string;
      ai_response: string;
      pronunciation_score: number;
      grammar_corrections: string[];
      timestamp: string;
    }[];
  };
  pronunciation_scores: {
    overall: number;
    vowels: number;
    consonants: number;
    fluency: number;
  };
  completion_percentage: number;
  started_at: string;
  completed_at?: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  best_score: number;
  attempts_count: number;
  last_attempt_at: string;
  mastery_level: 'not_started' | 'learning' | 'practicing' | 'mastered';
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string | null;
  progress: number;
  created_at: string;
}

// Database Types
export interface UserProfile {
  id: string;
  email: string;
  subscription_tier: string;
  target_language: string;
  proficiency_level: string;
  created_at: string;
}

export interface StripeCustomer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  created_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  stripe_subscription_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  practice_date: string;
  duration_minutes: number;
  completed: boolean;
  created_at: string;
}

export interface UserStreak {
  id: string;
  user_id: string;
  current_streak: number;
  best_streak: number;
  last_practice_date: string;
  total_days_practiced: number;
  created_at: string;
  updated_at: string;
}

export interface PronunciationStats {
  id: string;
  user_id: string;
  overall_score: number;
  vowels_score: number;
  consonants_score: number;
  rolling_r_score: number;
  updated_at: string;
}

// Add new types for content packs
export interface ContentPack {
  id: string;
  name: string;
  description: string;
  type: 'business' | 'cultural' | 'travel' | 'exam_prep';
  language: string;
  price: number;
  lessons: string[]; // Array of lesson IDs
  created_at: string;
  updated_at: string;
}

export interface UserContentPack {
  id: string;
  user_id: string;
  content_pack_id: string;
  purchase_date: string;
  status: 'active' | 'expired';
  created_at: string;
}

// Database Schema
export const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR UNIQUE NOT NULL,
  subscription_tier VARCHAR DEFAULT 'free',
  target_language VARCHAR NOT NULL,
  proficiency_level VARCHAR DEFAULT 'beginner',
  streak_count INTEGER DEFAULT 0,
  total_lessons_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR NOT NULL,
  language VARCHAR NOT NULL,
  difficulty_level VARCHAR NOT NULL,
  scenario_type VARCHAR NOT NULL,
  content JSONB NOT NULL,
  estimated_duration INTEGER
);

-- User Progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  lesson_id UUID REFERENCES lessons(id),
  best_score INTEGER DEFAULT 0,
  attempts_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  mastery_level VARCHAR DEFAULT 'not_started',
  UNIQUE(user_id, lesson_id)
);

-- Conversation Sessions table
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  lesson_id UUID REFERENCES lessons(id),
  encrypted_data JSONB NOT NULL,
  completion_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Encrypted Data table
CREATE TABLE IF NOT EXISTS user_encrypted_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  data_type VARCHAR NOT NULL,
  encrypted_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  achievement_id VARCHAR NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);

-- Content Packs table
CREATE TABLE IF NOT EXISTS content_packs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR NOT NULL,
  language VARCHAR NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  lessons JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Content Packs table
CREATE TABLE IF NOT EXISTS user_content_packs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  content_pack_id UUID REFERENCES content_packs(id),
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, content_pack_id)
);

-- Backup Metadata table
CREATE TABLE IF NOT EXISTS backup_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  type VARCHAR NOT NULL,
  size INTEGER NOT NULL,
  status VARCHAR NOT NULL,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Security Events table
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR NOT NULL,
  severity VARCHAR NOT NULL,
  details JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID REFERENCES users(id),
  ip VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Active Sessions table
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  session_id VARCHAR NOT NULL,
  ip_address VARCHAR,
  user_agent VARCHAR,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, session_id)
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id VARCHAR NOT NULL,
  user_id UUID REFERENCES users(id),
  changes JSONB,
  metadata JSONB,
  ip_address VARCHAR,
  user_agent VARCHAR,
  status VARCHAR NOT NULL,
  error TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  language_preference VARCHAR,
  notification_settings JSONB,
  data_retention_days INTEGER DEFAULT 30,
  data_processing_consent BOOLEAN DEFAULT false,
  marketing_consent BOOLEAN DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Data Processing Records table
CREATE TABLE IF NOT EXISTS data_processing_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  processing_type VARCHAR NOT NULL,
  purpose VARCHAR NOT NULL,
  legal_basis VARCHAR NOT NULL,
  retention_period INTEGER,
  categories_of_data TEXT[],
  recipients TEXT[],
  international_transfers BOOLEAN DEFAULT false,
  security_measures TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data Subject Requests table
CREATE TABLE IF NOT EXISTS data_subject_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  request_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Health Checks table
CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service VARCHAR NOT NULL,
  status BOOLEAN NOT NULL,
  details JSONB,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System Configuration table
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key VARCHAR NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(config_key)
);

-- System Events table
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR NOT NULL,
  severity VARCHAR NOT NULL,
  details JSONB,
  handled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_timestamp ON backup_metadata(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_active ON active_sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_user_encrypted_data_user_id ON user_encrypted_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_encrypted_data_type ON user_encrypted_data(data_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_last_activity ON user_preferences(last_activity);
CREATE INDEX IF NOT EXISTS idx_data_processing_records_user_id ON data_processing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_user_id ON data_subject_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_events_handled ON system_events(handled);
`; 