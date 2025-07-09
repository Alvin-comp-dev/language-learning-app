import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import monitoring from '../config/monitoring';

interface BackupMetadata {
  timestamp: string;
  type: 'full' | 'incremental';
  size: number;
  status: 'success' | 'failed';
  error?: string;
}

class BackupService {
  private static instance: BackupService;
  private backupScheduleInterval: NodeJS.Timeout | null = null;
  private readonly BACKUP_BUCKET = 'backups';
  private readonly LOCAL_BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;
  private readonly BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_LOCAL_BACKUPS = 3;

  private constructor() {
    this.initializeBackupDirectory();
  }

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  private async initializeBackupDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.LOCAL_BACKUP_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.LOCAL_BACKUP_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to initialize backup directory:', error);
      monitoring.trackError(error as Error, { context: 'initializeBackupDirectory' });
    }
  }

  async startAutomatedBackups() {
    if (this.backupScheduleInterval) {
      clearInterval(this.backupScheduleInterval);
    }

    // Perform initial backup
    await this.performBackup();

    // Schedule regular backups
    this.backupScheduleInterval = setInterval(async () => {
      await this.performBackup();
    }, this.BACKUP_INTERVAL);
  }

  async stopAutomatedBackups() {
    if (this.backupScheduleInterval) {
      clearInterval(this.backupScheduleInterval);
      this.backupScheduleInterval = null;
    }
  }

  private async performBackup(): Promise<void> {
    try {
      // Start backup transaction
      const timestamp = new Date().toISOString();
      const backupId = `backup_${timestamp}`;

      // Get all user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*');

      if (userError) throw userError;

      // Get all lesson progress
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*');

      if (progressError) throw progressError;

      // Get all conversation sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('conversation_sessions')
        .select('*');

      if (sessionError) throw sessionError;

      // Combine all data
      const backupData = {
        timestamp,
        users: userData,
        progress: progressData,
        sessions: sessionData,
      };

      // Save backup locally
      await this.saveLocalBackup(backupId, backupData);

      // Upload to Supabase Storage
      await this.uploadBackup(backupId, backupData);

      // Clean up old backups
      await this.cleanupOldBackups();

      // Record backup metadata
      await this.recordBackupMetadata({
        timestamp,
        type: 'full',
        size: JSON.stringify(backupData).length,
        status: 'success',
      });

      console.log(`Backup completed successfully: ${backupId}`);
    } catch (error) {
      console.error('Backup failed:', error);
      monitoring.trackError(error as Error, { context: 'performBackup' });

      // Record failed backup
      await this.recordBackupMetadata({
        timestamp: new Date().toISOString(),
        type: 'full',
        size: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async saveLocalBackup(backupId: string, data: any): Promise<void> {
    try {
      const backupPath = `${this.LOCAL_BACKUP_DIR}${backupId}.json`;
      await FileSystem.writeAsStringAsync(backupPath, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save local backup:', error);
      throw error;
    }
  }

  private async uploadBackup(backupId: string, data: any): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.BACKUP_BUCKET)
        .upload(`${backupId}.json`, JSON.stringify(data));

      if (error) throw error;
    } catch (error) {
      console.error('Failed to upload backup:', error);
      throw error;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      // Clean local backups
      const localBackups = await FileSystem.readDirectoryAsync(this.LOCAL_BACKUP_DIR);
      if (localBackups.length > this.MAX_LOCAL_BACKUPS) {
        const sortedBackups = localBackups.sort();
        const backupsToDelete = sortedBackups.slice(0, sortedBackups.length - this.MAX_LOCAL_BACKUPS);
        
        for (const backup of backupsToDelete) {
          await FileSystem.deleteAsync(`${this.LOCAL_BACKUP_DIR}${backup}`);
        }
      }

      // Clean remote backups (keep last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: remoteBackups, error } = await supabase.storage
        .from(this.BACKUP_BUCKET)
        .list();

      if (error) throw error;

      for (const backup of remoteBackups || []) {
        const backupDate = new Date(backup.created_at);
        if (backupDate < thirtyDaysAgo) {
          await supabase.storage
            .from(this.BACKUP_BUCKET)
            .remove([backup.name]);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
      monitoring.trackError(error as Error, { context: 'cleanupOldBackups' });
    }
  }

  private async recordBackupMetadata(metadata: BackupMetadata): Promise<void> {
    try {
      const { error } = await supabase
        .from('backup_metadata')
        .insert(metadata);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to record backup metadata:', error);
      monitoring.trackError(error as Error, { context: 'recordBackupMetadata' });
    }
  }

  async restoreFromBackup(backupId: string): Promise<boolean> {
    try {
      // First try to get from local backup
      const localBackupPath = `${this.LOCAL_BACKUP_DIR}${backupId}.json`;
      const localBackupExists = await FileSystem.getInfoAsync(localBackupPath);

      let backupData: any;

      if (localBackupExists.exists) {
        const backupContent = await FileSystem.readAsStringAsync(localBackupPath);
        backupData = JSON.parse(backupContent);
      } else {
        // Try to get from remote backup
        const { data, error } = await supabase.storage
          .from(this.BACKUP_BUCKET)
          .download(`${backupId}.json`);

        if (error) throw error;

        const reader = new FileReader();
        reader.readAsText(data);
        backupData = JSON.parse(await new Promise(resolve => {
          reader.onload = () => resolve(reader.result as string);
        }));
      }

      // Start restoration process
      const { error: usersError } = await supabase
        .from('users')
        .upsert(backupData.users);

      if (usersError) throw usersError;

      const { error: progressError } = await supabase
        .from('user_progress')
        .upsert(backupData.progress);

      if (progressError) throw progressError;

      const { error: sessionsError } = await supabase
        .from('conversation_sessions')
        .upsert(backupData.sessions);

      if (sessionsError) throw sessionsError;

      console.log(`Restore completed successfully from backup: ${backupId}`);
      return true;
    } catch (error) {
      console.error('Restore failed:', error);
      monitoring.trackError(error as Error, { context: 'restoreFromBackup' });
      return false;
    }
  }
}

export default BackupService.getInstance(); 