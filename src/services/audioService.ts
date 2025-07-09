import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  uri: string | null;
  status: 'idle' | 'recording' | 'stopped' | 'processing';
}

export interface AudioPermissions {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

class AudioService {
  private recording: Audio.Recording | null = null;
  private recordingState: RecordingState = {
    isRecording: false,
    duration: 0,
    uri: null,
    status: 'idle'
  };
  private listeners: Array<(state: RecordingState) => void> = [];

  constructor() {
    this.setupAudio();
  }

  /**
   * Setup audio recording configuration
   */
  private async setupAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (error) {
      console.error('Failed to setup audio:', error);
    }
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<AudioPermissions> {
    try {
      const permission = await Audio.requestPermissionsAsync();
      
      return {
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
        status: permission.status,
      };
    } catch (error) {
      console.error('Failed to request audio permissions:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'denied',
      };
    }
  }

  /**
   * Check if microphone permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const permission = await Audio.getPermissionsAsync();
      return permission.granted;
    } catch (error) {
      console.error('Failed to check audio permissions:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      // Check permissions first
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const permission = await this.requestPermissions();
        if (!permission.granted) {
          throw new Error('Microphone permission denied');
        }
      }

      // Stop any existing recording
      if (this.recording) {
        await this.stopRecording();
      }

              // Configure recording options for speech
        const recordingOptions: Audio.RecordingOptions = {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 64000,
          },
        };

      // Create and start recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();

      // Update state
      this.updateState({
        isRecording: true,
        duration: 0,
        uri: null,
        status: 'recording'
      });

      console.log('Recording started');

    } catch (error) {
      console.error('Failed to start recording:', error);
      this.updateState({
        isRecording: false,
        duration: 0,
        uri: null,
        status: 'idle'
      });
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop recording and return the audio file URI
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording) {
        console.warn('No recording in progress');
        return null;
      }

      this.updateState({
        ...this.recordingState,
        status: 'processing'
      });

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      // Clean up
      this.recording = null;

      // Update state
      this.updateState({
        isRecording: false,
        duration: 0,
        uri: uri,
        status: 'stopped'
      });

      console.log('Recording stopped, saved to:', uri);
      return uri;

    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recording = null;
      this.updateState({
        isRecording: false,
        duration: 0,
        uri: null,
        status: 'idle'
      });
      throw new Error(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel current recording without saving
   */
  async cancelRecording(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }

      this.updateState({
        isRecording: false,
        duration: 0,
        uri: null,
        status: 'idle'
      });

      console.log('Recording cancelled');
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }

  /**
   * Get current recording duration (in seconds)
   */
  async getRecordingDuration(): Promise<number> {
    try {
      if (!this.recording) return 0;
      
      const status = await this.recording.getStatusAsync();
      return status.durationMillis ? status.durationMillis / 1000 : 0;
    } catch (error) {
      console.error('Failed to get recording duration:', error);
      return 0;
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState(): RecordingState {
    return { ...this.recordingState };
  }

  /**
   * Add listener for recording state changes
   */
  addStateListener(listener: (state: RecordingState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Delete audio file
   */
  async deleteAudioFile(uri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri);
        console.log('Audio file deleted:', uri);
      }
    } catch (error) {
      console.error('Failed to delete audio file:', error);
    }
  }

  /**
   * Play audio file for testing/preview
   */
  async playAudio(uri: string): Promise<void> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      // Automatically unload when finished
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });

    } catch (error) {
      console.error('Failed to play audio:', error);
      throw new Error(`Failed to play audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update recording state and notify listeners
   */
  private updateState(newState: RecordingState): void {
    this.recordingState = { ...newState };
    this.listeners.forEach(listener => listener(this.recordingState));
  }

  /**
   * Get audio file info
   */
  async getAudioFileInfo(uri: string): Promise<{
    exists: boolean;
    size: number;
    duration?: number;
  }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        return { exists: false, size: 0 };
      }

      // Get duration by loading the sound
      let duration = 0;
      try {
        const { sound } = await Audio.Sound.createAsync({ uri });
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          duration = status.durationMillis / 1000;
        }
        await sound.unloadAsync();
      } catch (error) {
        console.warn('Could not get audio duration:', error);
      }

      return {
        exists: true,
        size: fileInfo.size || 0,
        duration,
      };

    } catch (error) {
      console.error('Failed to get audio file info:', error);
      return { exists: false, size: 0 };
    }
  }
}

export const audioService = new AudioService(); 