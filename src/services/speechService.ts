import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import monitoring from '../config/monitoring';

export interface SpeechAnalysis {
  transcription: string;
  confidence: number;
  pronunciation_score: number;
  detected_language: string;
  processing_time: number;
}

export interface PronunciationFeedback {
  overall_score: number;
  vowel_accuracy: number;
  consonant_accuracy: number;
  fluency_score: number;
  detailed_feedback: string[];
  corrections: Array<{
    word: string;
    expected: string;
    actual: string;
    suggestion: string;
  }>;
}

interface PronunciationResult {
  accuracy: number;
  phonemeScores: {
    phoneme: string;
    score: number;
    isCorrect: boolean;
  }[];
  suggestions: string[];
  overallFeedback: string;
}

interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  language: string;
  segments: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

interface PronunciationAnalysis {
  score: number;
  issues: Array<{
    type: 'phoneme' | 'stress' | 'intonation';
    text: string;
    start: number;
    end: number;
    suggestion: string;
  }>;
  feedback: string;
}

class SpeechService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';
  private audio: Audio.Sound | null = null;
  private transcriptionCache: Map<string, { result: SpeechAnalysis; timestamp: number }> = new Map();
  private CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
  private MAX_AUDIO_SIZE = 1024 * 1024; // 1MB
  private readonly WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
  private readonly SUPPORTED_LANGUAGES = ['es', 'fr', 'de', 'it', 'pt', 'ja'];
  private readonly AUDIO_FORMAT = {
    sampleRate: 16000,
    channels: 1,
    encoding: 'LINEAR16'
  };

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OpenAI API key not found. Speech recognition will not work.');
    }

    // Clean cache every 24 hours
    setInterval(() => this.cleanCache(), this.CACHE_DURATION);
  }

  /**
   * Compress audio file if needed
   */
  private async compressAudioIfNeeded(audioUri: string): Promise<string> {
    const audioInfo = await FileSystem.getInfoAsync(audioUri);
    if (!audioInfo.exists) {
      throw new Error('Audio file not found');
    }

    // If file is small enough, return original
    if (audioInfo.size <= this.MAX_AUDIO_SIZE) {
      return audioUri;
    }

    // Create compressed file path
    const compressedUri = `${audioUri.replace('.m4a', '')}_compressed.m4a`;

    try {
      // Check if compressed version exists
      const compressedInfo = await FileSystem.getInfoAsync(compressedUri);
      if (compressedInfo.exists) {
        return compressedUri;
      }

      // Configure audio compression
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      // Load original audio
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { progressUpdateIntervalMillis: 100 }
      );

      // Record compressed version
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 32000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_LOW,
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 32000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      // Play original and record compressed
      await recording.startAsync();
      await sound.playAsync();
      
      // Wait for playback to finish
      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate(async (status: any) => {
          if (status.didJustFinish) {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            await sound.unloadAsync();
            resolve(uri || audioUri);
          }
        });
      });

    } catch (error) {
      console.error('Audio compression error:', error);
      return audioUri; // Fall back to original file
    }
  }

  /**
   * Generate cache key for transcription
   */
  private async generateCacheKey(audioUri: string): Promise<string> {
    const audioInfo = await FileSystem.getInfoAsync(audioUri);
    return `${audioUri}_${audioInfo.size}_${audioInfo.modificationTime}`;
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribeAudio(audioUri: string, targetLanguage = 'es'): Promise<SpeechAnalysis> {
    if (!this.apiKey) {
      console.warn('OpenAI API key not configured. Returning mock transcription.');
      // Return a mock SpeechAnalysis object for MVP development without API key
      return {
        transcription: 'Hola, ¿cómo estás? (mocked)',
        confidence: 0.95,
        pronunciation_score: 85,
        detected_language: targetLanguage || 'es',
        processing_time: 100,
      };
    }

    try {
      const startTime = Date.now();

      // Generate cache key
      const cacheKey = await this.generateCacheKey(audioUri);
      
      // Check memory cache
      const cachedResult = this.transcriptionCache.get(cacheKey);
      if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_DURATION) {
        return cachedResult.result;
      }

      // Check persistent cache
      const persistedResult = await AsyncStorage.getItem(`transcription:${cacheKey}`);
      if (persistedResult) {
        const { result, timestamp } = JSON.parse(persistedResult);
        if (Date.now() - timestamp < this.CACHE_DURATION) {
          this.transcriptionCache.set(cacheKey, { result, timestamp });
          return result;
        }
      }

      // Compress audio if needed
      const compressedUri = await this.compressAudioIfNeeded(audioUri);

      // Create form data for Whisper API
      const formData = new FormData();
      formData.append('file', {
        uri: compressedUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('language', targetLanguage);
      formData.append('response_format', 'verbose_json');

      // Call Whisper API
      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
      const errorText = await response.text();
      console.error(`Whisper API error: ${response.status}`, errorText);
      // Fallback to mock transcription on API error during development
      monitoring.logError({
        type: 'whisper_api_error',
        error: `Whisper API error: ${response.status} ${errorText}`
      }).catch(console.error);
      return {
        transcription: 'API error, mock response. (mocked)',
        confidence: 0.50,
        pronunciation_score: 50,
        detected_language: targetLanguage || 'es',
        processing_time: 150,
      };
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      // Calculate scores
      const pronunciationScore = this.calculatePronunciationScore(
        result.text,
        result.segments || []
      );

      const analysis: SpeechAnalysis = {
        transcription: result.text || '',
        confidence: this.calculateConfidence(result.segments || []),
        pronunciation_score: pronunciationScore,
        detected_language: result.language || targetLanguage,
        processing_time: processingTime,
      };

      // Cache the result
      const timestamp = Date.now();
      this.transcriptionCache.set(cacheKey, { result: analysis, timestamp });
      await AsyncStorage.setItem(
        `transcription:${cacheKey}`,
        JSON.stringify({ result: analysis, timestamp })
      );

      // Clean up compressed file if it was created
      if (compressedUri !== audioUri) {
        await FileSystem.deleteAsync(compressedUri, { idempotent: true });
      }

      return analysis;

    } catch (error) {
      const err = error as Error;
      console.error('Speech transcription error:', err);
      monitoring.logError({
        type: 'speech_transcription_error',
        error: err.message,
        details: err.stack
      }).catch(console.error);
      // Fallback to mock transcription on general error during development
      return {
        transcription: 'Error during transcription, mock response. (mocked)',
        confidence: 0.40,
        pronunciation_score: 40,
        detected_language: targetLanguage || 'es',
        processing_time: 200,
      };
    }
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanCache() {
    const now = Date.now();
    
    // Clean memory cache
    for (const [key, value] of this.transcriptionCache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.transcriptionCache.delete(key);
      }
    }

    // Clean persistent cache
    try {
      const keys = await AsyncStorage.getAllKeys();
      const transcriptionKeys = keys.filter(key => key.startsWith('transcription:'));
      
      for (const key of transcriptionKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const { timestamp } = JSON.parse(data);
          if (now - timestamp > this.CACHE_DURATION) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  /**
   * Analyze pronunciation and provide detailed feedback
   */
  async analyzePronunciation(
    spokenText: string,
    targetText: string
  ): Promise<PronunciationResult> {
    // TODO: In a production app, this would call a real speech analysis API
    // For now, we'll simulate analysis with a basic comparison
    const normalizedSpoken = spokenText.toLowerCase().trim();
    const normalizedTarget = targetText.toLowerCase().trim();
    
    // Calculate basic accuracy
    const accuracy = this.calculateSimilarity(normalizedSpoken, normalizedTarget);
    
    // Analyze phonemes (simplified)
    const phonemeScores = this.analyzePhonemes(normalizedSpoken, normalizedTarget);
    
    // Generate feedback
    const suggestions = this.generateSuggestions(phonemeScores);
    const overallFeedback = this.generateOverallFeedback(accuracy, phonemeScores);
    
    return {
      accuracy,
      phonemeScores,
      suggestions,
      overallFeedback
    };
  }
  
  private calculateSimilarity(spoken: string, target: string): number {
    let matches = 0;
    const spokenChars = spoken.split('');
    const targetChars = target.split('');
    
    for (let i = 0; i < Math.min(spokenChars.length, targetChars.length); i++) {
      if (spokenChars[i] === targetChars[i]) matches++;
    }
    
    return matches / Math.max(spokenChars.length, targetChars.length);
  }
  
  private analyzePhonemes(spoken: string, target: string): { phoneme: string; score: number; isCorrect: boolean; }[] {
    // Simplified phoneme analysis - in production this would use a proper phoneme recognition system
    const spokenPhonemes = this.textToPhonemes(spoken);
    const targetPhonemes = this.textToPhonemes(target);
    
    return spokenPhonemes.map((phoneme, index) => {
      const targetPhoneme = targetPhonemes[index] || '';
      const score = phoneme === targetPhoneme ? 1.0 : 0.5;
      
      return {
        phoneme,
        score,
        isCorrect: score > 0.8
      };
    });
  }
  
  private textToPhonemes(text: string): string[] {
    // Simplified phoneme conversion - in production this would use a proper phoneme dictionary
    return text.split('').map(char => {
      // Basic vowel and consonant sounds
      const phonemeMap: { [key: string]: string } = {
        'a': 'ah',
        'e': 'eh',
        'i': 'ee',
        'o': 'oh',
        'u': 'oo'
      };
      return phonemeMap[char] || char;
    });
  }
  
  private generateSuggestions(phonemeScores: { phoneme: string; score: number; isCorrect: boolean; }[]): string[] {
    const suggestions: string[] = [];
    
    phonemeScores.forEach(score => {
      if (!score.isCorrect) {
        suggestions.push(`Focus on the "${score.phoneme}" sound`);
      }
    });
    
    return suggestions;
  }
  
  private generateOverallFeedback(accuracy: number, phonemeScores: { phoneme: string; score: number; isCorrect: boolean; }[]): string {
    const incorrectPhonemes = phonemeScores.filter(score => !score.isCorrect).length;
    
    if (accuracy > 0.9) {
      return "Excellent pronunciation!";
    } else if (accuracy > 0.7) {
      return "Good pronunciation with some room for improvement.";
    } else {
      return `Practice needed. Focus on ${incorrectPhonemes} sounds that need improvement.`;
    }
  }

  /**
   * Calculate pronunciation score from Whisper segments
   */
  private calculatePronunciationScore(text: string, segments: any[]): number {
    if (!segments || segments.length === 0) {
      return text.length > 0 ? 75 : 0; // Default score if no segments
    }

    // Calculate average confidence from segments
    const avgConfidence = segments.reduce((sum, segment) => {
      return sum + (segment.avg_logprob || -1);
    }, 0) / segments.length;

    // Convert log probability to percentage (simplified)
    const score = Math.max(0, Math.min(100, (avgConfidence + 1) * 100));
    return Math.round(score);
  }

  /**
   * Calculate overall confidence from segments
   */
  private calculateConfidence(segments: any[]): number {
    if (!segments || segments.length === 0) return 0.5;

    const totalConfidence = segments.reduce((sum, segment) => {
      return sum + (segment.no_speech_prob ? 1 - segment.no_speech_prob : 0.8);
    }, 0);

    return Math.min(1, totalConfidence / segments.length);
  }

  /**
   * Transcribe speech to text using Whisper API
   */
  public async transcribe(audioBlob: Blob, language?: string): Promise<SpeechRecognitionResult> {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      if (language && this.SUPPORTED_LANGUAGES.includes(language)) {
        formData.append('language', language);
      }
      formData.append('response_format', 'verbose_json');

      const response = await fetch(this.WHISPER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Speech recognition failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Format the response
      const transcription: SpeechRecognitionResult = {
        text: result.text,
        confidence: result.segments.reduce((acc: number, seg: any) => acc + seg.confidence, 0) / result.segments.length,
        language: result.language,
        segments: result.segments.map((seg: any) => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
          confidence: seg.confidence
        }))
      };

      // Cache successful transcription for analytics
      await this.cacheTranscription(transcription);

      return transcription;
    } catch (error) {
      await monitoring.logError({
        type: 'speech_recognition_failed',
        error
      });
      throw new Error('Speech recognition failed. Please try again.');
    }
  }

  /**
   * Analyze pronunciation accuracy
   */
  public async analyzePronunciation(
    audioBlob: Blob,
    expectedText: string,
    language: string
  ): Promise<PronunciationAnalysis> {
    try {
      // First get the actual transcription
      const transcription = await this.transcribe(audioBlob, language);

      // Compare with expected text using specialized comparison
      const analysis = await this.compareWithExpected(transcription.text, expectedText);

      // Generate helpful feedback
      const feedback = this.generateFeedback(analysis);

      return {
        score: analysis.score,
        issues: analysis.issues,
        feedback
      };
    } catch (error) {
      await monitoring.logError({
        type: 'pronunciation_analysis_failed',
        error
      });
      throw new Error('Pronunciation analysis failed. Please try again.');
    }
  }

  /**
   * Compare spoken text with expected text
   */
  private async compareWithExpected(
    actual: string,
    expected: string
  ): Promise<{ score: number; issues: PronunciationAnalysis['issues'] }> {
    // Normalize both texts
    const normalizedActual = actual.toLowerCase().trim();
    const normalizedExpected = expected.toLowerCase().trim();

    // Split into words
    const actualWords = normalizedActual.split(' ');
    const expectedWords = normalizedExpected.split(' ');

    const issues: PronunciationAnalysis['issues'] = [];
    let totalScore = 0;
    let wordCount = 0;

    // Compare word by word
    for (let i = 0; i < expectedWords.length; i++) {
      const expectedWord = expectedWords[i];
      const actualWord = actualWords[i] || '';

      if (actualWord === expectedWord) {
        totalScore += 1;
      } else if (actualWord) {
        // Calculate similarity score
        const similarity = this.calculateSimilarity(actualWord, expectedWord);
        totalScore += similarity;

        if (similarity < 0.8) {
          issues.push({
            type: 'phoneme',
            text: actualWord,
            start: i,
            end: i + 1,
            suggestion: expectedWord
          });
        }
      }
      wordCount++;
    }

    // Calculate final score (0-100)
    const finalScore = (totalScore / wordCount) * 100;

    return {
      score: Math.round(finalScore),
      issues
    };
  }

  /**
   * Generate user-friendly feedback
   */
  private generateFeedback(analysis: { score: number; issues: PronunciationAnalysis['issues'] }): string {
    if (analysis.score >= 95) {
      return "Excellent pronunciation! Keep up the great work!";
    } else if (analysis.score >= 85) {
      return "Very good pronunciation. Focus on the highlighted words to perfect it.";
    } else if (analysis.score >= 70) {
      return "Good effort! Practice the suggested corrections to improve further.";
    } else {
      return "Keep practicing! Focus on pronouncing each word clearly.";
    }
  }

  /**
   * Cache transcription for analytics
   */
  private async cacheTranscription(transcription: SpeechRecognitionResult): Promise<void> {
    try {
      await supabase.from('speech_analytics').insert({
        text: transcription.text,
        confidence: transcription.confidence,
        language: transcription.language,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Non-critical error, just log it
      await monitoring.logError({
        type: 'transcription_cache_failed',
        error
      });
    }
  }

  // ... existing methods for recording and playback ...
}

export default new SpeechService(); 