import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, User } from '../config/supabase';
import abTesting from '../config/abTesting';
import monitoring from '../config/monitoring';
import securityMonitoring from '../services/securityMonitoringService';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          abTesting.resetUser(); // Reset A/B tests when user logs out
          monitoring.clearUserContext(); // Clear monitoring context
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        monitoring.trackError(error as Error, { context: 'fetchUserProfile' });
      } else {
        setUser(data);
        // Initialize A/B testing and monitoring for the user
        abTesting.initializeUser(userId);
        monitoring.setUserContext(userId, {
          subscription_tier: data.subscription_tier,
          target_language: data.target_language,
          proficiency_level: data.proficiency_level
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      monitoring.trackError(error as Error, { context: 'fetchUserProfile' });
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Check rate limit before attempting sign in
      const canAttempt = await securityMonitoring.checkRateLimit('auth', email);
      if (!canAttempt) {
        return { error: new Error('Too many login attempts. Please try again later.') };
      }

      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await securityMonitoring.logFailedAuth(email, 'unknown');
        monitoring.trackError(error, { context: 'signIn' });
      } else {
        monitoring.trackEvent('user_sign_in', { email });
      }

      return { error };
    } catch (error) {
      monitoring.trackError(error as Error, { context: 'signIn' });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Create user profile
      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: data.user.email,
              subscription_tier: 'free',
              target_language: userData.target_language || 'spanish',
              proficiency_level: userData.proficiency_level || 'beginner',
              daily_goal_minutes: userData.daily_goal_minutes || 15,
              streak_count: 0,
              total_lessons_completed: 0,
              total_speaking_time: 0,
              created_at: new Date().toISOString(),
            },
          ]);

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          monitoring.trackError(profileError as Error, { context: 'signUp_createProfile' });
          return { error: profileError };
        }

        // Track successful sign up
        monitoring.trackEvent('user_sign_up', {
          target_language: userData.target_language,
          proficiency_level: userData.proficiency_level
        });
      }

      return { error: null };
    } catch (error) {
      monitoring.trackError(error as Error, { context: 'signUp' });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      abTesting.resetUser();
      monitoring.clearUserContext();
      monitoring.trackEvent('user_sign_out');
    } catch (error) {
      console.error('Error signing out:', error);
      monitoring.trackError(error as Error, { context: 'signOut' });
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        monitoring.trackError(error as Error, { context: 'updateUserProfile' });
        return { error };
      }

      // Update local state
      setUser({ ...user, ...updates });
      
      // Update monitoring context with new user data
      monitoring.setUserContext(user.id, {
        ...updates,
        subscription_tier: updates.subscription_tier || user.subscription_tier,
        target_language: updates.target_language || user.target_language,
        proficiency_level: updates.proficiency_level || user.proficiency_level
      });

      monitoring.trackEvent('user_profile_updated', updates);
      return { error: null };
    } catch (error) {
      monitoring.trackError(error as Error, { context: 'updateUserProfile' });
      return { error };
    }
  };

  const value: AuthState = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 