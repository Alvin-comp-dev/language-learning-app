import { supabase } from '../config/supabase';
import encryptionService from './encryptionService';
import auditLogService from './auditLogService';
import monitoring from '../config/monitoring';

interface UserDataExport {
  personalInfo: any;
  learningProgress: any;
  conversations: any;
  preferences: any;
  subscriptions: any;
  achievements: any;
  lastAccess: string;
}

class GDPRService {
  private static instance: GDPRService;
  private readonly RETENTION_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days

  private constructor() {}

  static getInstance(): GDPRService {
    if (!GDPRService.instance) {
      GDPRService.instance = new GDPRService();
    }
    return GDPRService.instance;
  }

  async exportUserData(userId: string): Promise<UserDataExport> {
    try {
      // Log data export request
      await auditLogService.logUserAction(
        'data_export',
        'user',
        userId,
        userId,
        undefined,
        { reason: 'GDPR data export request' }
      );

      // Get user personal information
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Get learning progress
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);

      if (progressError) throw progressError;

      // Get conversation history
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId);

      if (conversationError) throw conversationError;

      // Decrypt conversation data
      const decryptedConversations = await Promise.all(
        conversationData.map(async (session) => ({
          ...session,
          data: session.encrypted_data
            ? await encryptionService.decryptData(userId, session.encrypted_data)
            : null,
        }))
      );

      // Get user preferences
      const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId);

      if (preferencesError) throw preferencesError;

      // Get subscription information
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subscriptionError) throw subscriptionError;

      // Get achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);

      if (achievementsError) throw achievementsError;

      const exportData: UserDataExport = {
        personalInfo: this.sanitizePersonalInfo(userData),
        learningProgress: progressData,
        conversations: decryptedConversations,
        preferences: preferencesData,
        subscriptions: this.sanitizeSubscriptionData(subscriptionData),
        achievements: achievementsData,
        lastAccess: new Date().toISOString(),
      };

      // Log successful export
      await auditLogService.logUserAction(
        'data_export_complete',
        'user',
        userId,
        userId,
        undefined,
        { dataTypes: Object.keys(exportData) }
      );

      return exportData;
    } catch (error) {
      console.error('Failed to export user data:', error);
      monitoring.trackError(error as Error, { context: 'exportUserData' });
      throw error;
    }
  }

  async deleteUserData(userId: string, reason?: string): Promise<void> {
    try {
      // Log deletion request
      await auditLogService.logUserAction(
        'data_deletion',
        'user',
        userId,
        userId,
        undefined,
        { reason: reason || 'GDPR deletion request' }
      );

      // Delete data in specific order to maintain referential integrity
      await this.deleteUserConversations(userId);
      await this.deleteUserProgress(userId);
      await this.deleteUserPreferences(userId);
      await this.deleteUserSubscriptions(userId);
      await this.deleteUserAchievements(userId);
      await this.deleteUserAccount(userId);

      // Clear encryption keys
      await encryptionService.clearUserEncryption(userId);

      // Log successful deletion
      await auditLogService.logUserAction(
        'data_deletion_complete',
        'user',
        userId,
        userId
      );
    } catch (error) {
      console.error('Failed to delete user data:', error);
      monitoring.trackError(error as Error, { context: 'deleteUserData' });
      throw error;
    }
  }

  private async deleteUserConversations(userId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_sessions')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  private async deleteUserProgress(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_progress')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  private async deleteUserPreferences(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  private async deleteUserSubscriptions(userId: string): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  private async deleteUserAchievements(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_achievements')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  private async deleteUserAccount(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
  }

  private sanitizePersonalInfo(userData: any): any {
    const { password, auth_tokens, security_questions, ...safeData } = userData;
    return safeData;
  }

  private sanitizeSubscriptionData(subscriptionData: any): any {
    return subscriptionData.map((sub: any) => {
      const { payment_method, card_details, ...safeData } = sub;
      return safeData;
    });
  }

  async updateDataRetentionPolicy(userId: string, retentionDays: number): Promise<void> {
    try {
      // Update user preferences
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          data_retention_days: retentionDays,
        });

      if (error) throw error;

      // Log policy update
      await auditLogService.logUserAction(
        'retention_policy_update',
        'user',
        userId,
        userId,
        { retentionDays },
        { reason: 'User preference update' }
      );
    } catch (error) {
      console.error('Failed to update retention policy:', error);
      monitoring.trackError(error as Error, { context: 'updateDataRetentionPolicy' });
      throw error;
    }
  }

  async cleanupExpiredData(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.RETENTION_PERIOD);

      // Get users with expired data
      const { data: expiredData, error } = await supabase
        .from('user_preferences')
        .select('user_id, data_retention_days')
        .lt('last_activity', cutoffDate.toISOString());

      if (error) throw error;

      // Process each user's expired data
      for (const userData of expiredData || []) {
        const retentionPeriod = userData.data_retention_days * 24 * 60 * 60 * 1000;
        const userCutoffDate = new Date(Date.now() - retentionPeriod);

        // Delete expired conversations
        await supabase
          .from('conversation_sessions')
          .delete()
          .eq('user_id', userData.user_id)
          .lt('created_at', userCutoffDate.toISOString());

        // Log cleanup
        await auditLogService.logUserAction(
          'data_cleanup',
          'user',
          userData.user_id,
          'system',
          undefined,
          { cutoffDate: userCutoffDate.toISOString() }
        );
      }
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
      monitoring.trackError(error as Error, { context: 'cleanupExpiredData' });
    }
  }

  async handleDataRequest(
    userId: string,
    requestType: 'export' | 'delete',
    reason?: string
  ): Promise<void> {
    try {
      if (requestType === 'export') {
        const data = await this.exportUserData(userId);
        // Here you would typically send the data to the user via email or download
        console.log('Data exported successfully');
      } else if (requestType === 'delete') {
        await this.deleteUserData(userId, reason);
        console.log('Data deleted successfully');
      }
    } catch (error) {
      console.error('Failed to handle data request:', error);
      monitoring.trackError(error as Error, { context: 'handleDataRequest' });
      throw error;
    }
  }
}

export default GDPRService.getInstance(); 