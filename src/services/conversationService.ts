import { aiService, AIResponse, ConversationContext } from './aiService';
import { speechService, SpeechAnalysis } from './speechService';
import { audioService, RecordingState } from './audioService';
import { Lesson, getLessonById } from '../data/lessons';
import { progressService } from './progressService';
import { supabase } from '../config/supabase';
import encryptionService from './encryptionService';
import monitoring from '../config/monitoring';

export interface ConversationState {
  status: 'idle' | 'listening' | 'processing' | 'responding' | 'completed' | 'error';
  current_lesson: Lesson | null;
  conversation_history: Array<{
    id: string;
    speaker: 'user' | 'ai';
    message: string;
    timestamp: Date;
    pronunciation_score?: number;
    feedback?: string;
  }>;
  current_step: number;
  user_mistakes: string[];
  session_stats: {
    total_exchanges: number;
    average_pronunciation_score: number;
    vocabulary_learned: string[];
    completion_percentage: number;
    start_time: Date;
  };
  userId?: string;
}

export interface ConversationResponse {
  success: boolean;
  ai_response?: AIResponse;
  speech_analysis?: SpeechAnalysis;
  next_action: 'continue' | 'repeat' | 'complete' | 'error';
  error_message?: string;
}

class ConversationService {
  private state: ConversationState = {
    status: 'idle',
    current_lesson: null,
    conversation_history: [],
    current_step: 0,
    user_mistakes: [],
    session_stats: {
      total_exchanges: 0,
      average_pronunciation_score: 0,
      vocabulary_learned: [],
      completion_percentage: 0,
      start_time: new Date(),
    }
  };

  private listeners: Array<(state: ConversationState) => void> = [];

  constructor() {
    this.setupAudioListener();
  }

  /**
   * Setup audio recording state listener
   */
  private setupAudioListener() {
    audioService.addStateListener((recordingState: RecordingState) => {
      if (recordingState.status === 'recording') {
        this.updateState({ status: 'listening' });
      } else if (recordingState.status === 'stopped') {
        this.updateState({ status: 'processing' });
      }
    });
  }

  /**
   * Start a new conversation lesson
   */
  async startLesson(lessonId: string): Promise<boolean> {
    try {
      const lesson = getLessonById(lessonId);
      if (!lesson) {
        throw new Error(`Lesson not found: ${lessonId}`);
      }

      // Reset conversation state
      this.state = {
        status: 'idle',
        current_lesson: lesson,
        conversation_history: [],
        current_step: 0,
        user_mistakes: [],
        session_stats: {
          total_exchanges: 0,
          average_pronunciation_score: 0,
          vocabulary_learned: [],
          completion_percentage: 0,
          start_time: new Date(),
        }
      };

      // Start with first AI message
      const firstStep = lesson.dialogue[0];
      if (firstStep && firstStep.speaker === 'ai') {
        this.addMessageToHistory('ai', firstStep.text);
        this.updateState({ status: 'responding' });
      }

      console.log(`Started lesson: ${lesson.title}`);
      return true;

    } catch (error) {
      console.error('Failed to start lesson:', error);
      this.updateState({ status: 'error' });
      return false;
    }
  }

  /**
   * Start recording user's speech
   */
  async startRecording(): Promise<void> {
    try {
      await audioService.startRecording();
      this.updateState({ status: 'listening' });
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.updateState({ status: 'error' });
      throw error;
    }
  }

  /**
   * Stop recording and process user's speech
   */
  async stopRecording(): Promise<ConversationResponse> {
    try {
      this.updateState({ status: 'processing' });

      // Stop recording and get audio file
      const audioUri = await audioService.stopRecording();
      if (!audioUri) {
        throw new Error('No audio recorded');
      }

      // Process the speech
      const response = await this.processUserSpeech(audioUri);
      
      // Clean up audio file
      await audioService.deleteAudioFile(audioUri);

      return response;

    } catch (error) {
      console.error('Failed to process recording:', error);
      this.updateState({ status: 'error' });
      return {
        success: false,
        next_action: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process user's speech input
   */
  private async processUserSpeech(audioUri: string): Promise<ConversationResponse> {
    try {
      if (!this.state.current_lesson) {
        throw new Error('No active lesson');
      }

      // Get expected response from current dialogue step
      const currentStep = this.state.current_lesson.dialogue[this.state.current_step];
      const expectedText = currentStep?.expectedResponse || '';

      // Analyze speech
      const speechAnalysis = await speechService.transcribeAudio(audioUri, 'es');
      
      // Get pronunciation feedback if we have expected text
      const pronunciationFeedback = expectedText ? 
        await speechService.analyzePronunciation(audioUri, expectedText, 'es') : null;

      // Add user message to history
      this.addMessageToHistory('user', speechAnalysis.transcription, speechAnalysis.pronunciation_score);

      // Build conversation context
      const context: ConversationContext = {
        lesson_id: this.state.current_lesson.id,
        user_level: this.state.current_lesson.level,
        conversation_history: this.state.conversation_history.map(msg => ({
          speaker: msg.speaker,
          message: msg.message,
          timestamp: msg.timestamp.toISOString()
        })),
        current_scenario: this.state.current_lesson.scenario_context,
        learning_goals: this.state.current_lesson.learning_goals,
        user_mistakes: this.state.user_mistakes
      };

      // Generate AI response
      const aiResponse = await aiService.generateResponse(
        speechAnalysis.transcription,
        context,
        speechAnalysis.pronunciation_score
      );

      // Add AI response to history
      this.addMessageToHistory('ai', aiResponse.message, undefined, aiResponse.feedback);

      // Update session stats
      this.updateSessionStats(speechAnalysis.pronunciation_score, aiResponse.vocabulary_introduced);

      // Check if lesson is complete
      const isComplete = this.checkLessonCompletion();
      
      this.updateState({ 
        status: isComplete ? 'completed' : 'responding',
        current_step: this.state.current_step + 1
      });

      return {
        success: true,
        ai_response: aiResponse,
        speech_analysis: speechAnalysis,
        next_action: isComplete ? 'complete' : 'continue'
      };

    } catch (error) {
      console.error('Failed to process user speech:', error);
      return {
        success: false,
        next_action: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process text input (fallback for when speech fails)
   */
  async processTextInput(text: string): Promise<ConversationResponse> {
    try {
      if (!this.state.current_lesson) {
        throw new Error('No active lesson');
      }

      // Add user message to history
      this.addMessageToHistory('user', text);

      // Build conversation context
      const context: ConversationContext = {
        lesson_id: this.state.current_lesson.id,
        user_level: this.state.current_lesson.level,
        conversation_history: this.state.conversation_history.map(msg => ({
          speaker: msg.speaker,
          message: msg.message,
          timestamp: msg.timestamp.toISOString()
        })),
        current_scenario: this.state.current_lesson.scenario_context,
        learning_goals: this.state.current_lesson.learning_goals,
        user_mistakes: this.state.user_mistakes
      };

      // Generate AI response
      const aiResponse = await aiService.generateResponse(text, context);

      // Add AI response to history
      this.addMessageToHistory('ai', aiResponse.message, undefined, aiResponse.feedback);

      // Update session stats
      this.updateSessionStats(75, aiResponse.vocabulary_introduced); // Default score for text input

      // Check if lesson is complete
      const isComplete = this.checkLessonCompletion();
      
      this.updateState({ 
        status: isComplete ? 'completed' : 'responding',
        current_step: this.state.current_step + 1
      });

      return {
        success: true,
        ai_response: aiResponse,
        next_action: isComplete ? 'complete' : 'continue'
      };

    } catch (error) {
      console.error('Failed to process text input:', error);
      return {
        success: false,
        next_action: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return { ...this.state };
  }

  /**
   * Add state change listener
   */
  addStateListener(listener: (state: ConversationState) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * End current conversation
   */
  endConversation(): void {
    this.updateState({ status: 'completed' });
  }

  /**
   * Reset conversation state
   */
  reset(): void {
    this.state = {
      status: 'idle',
      current_lesson: null,
      conversation_history: [],
      current_step: 0,
      user_mistakes: [],
      session_stats: {
        total_exchanges: 0,
        average_pronunciation_score: 0,
        vocabulary_learned: [],
        completion_percentage: 0,
        start_time: new Date(),
      }
    };
    this.updateState({ status: 'idle' });
  }

  /**
   * Add message to conversation history
   */
  private addMessageToHistory(
    speaker: 'user' | 'ai',
    message: string,
    pronunciationScore?: number,
    feedback?: string
  ): void {
    const historyItem = {
      id: `${Date.now()}-${Math.random()}`,
      speaker,
      message,
      timestamp: new Date(),
      pronunciation_score: pronunciationScore,
      feedback
    };

    this.state.conversation_history.push(historyItem);
  }

  /**
   * Update session statistics
   */
  private updateSessionStats(pronunciationScore: number, vocabularyLearned: string[]): void {
    const stats = this.state.session_stats;
    
    stats.total_exchanges++;
    
    // Update average pronunciation score
    const totalScore = stats.average_pronunciation_score * (stats.total_exchanges - 1) + pronunciationScore;
    stats.average_pronunciation_score = Math.round(totalScore / stats.total_exchanges);
    
    // Add new vocabulary
    vocabularyLearned.forEach(word => {
      if (!stats.vocabulary_learned.includes(word)) {
        stats.vocabulary_learned.push(word);
      }
    });
    
    // Update completion percentage
    if (this.state.current_lesson) {
      const expectedExchanges = this.state.current_lesson.dialogue.length;
      stats.completion_percentage = Math.round((stats.total_exchanges / expectedExchanges) * 100);
    }
  }

  /**
   * Check if lesson is complete
   */
  private checkLessonCompletion(): boolean {
    if (!this.state.current_lesson) return false;
    
    const criteria = this.state.current_lesson.completion_criteria;
    const stats = this.state.session_stats;
    
    // Check minimum exchanges
    if (stats.total_exchanges < criteria.min_exchanges) {
      return false;
    }
    
    // Check pronunciation score
    if (stats.average_pronunciation_score < criteria.target_pronunciation_score) {
      return false;
    }
    
    // Check required vocabulary
    const hasRequiredVocabulary = criteria.required_vocabulary.every(word =>
      stats.vocabulary_learned.includes(word) ||
      this.state.conversation_history.some(msg => msg.message.toLowerCase().includes(word))
    );
    
    const isComplete = hasRequiredVocabulary;
    
    // Save progress when lesson is completed
    if (isComplete) {
      this.saveProgressToDatabase();
    }
    
    return isComplete;
  }

  /**
   * Save progress to database
   */
  private async saveProgressToDatabase(): Promise<void> {
    try {
      const userId = this.state.userId;
      if (!userId) throw new Error('No user ID found');

      // Encrypt conversation data before saving
      const encryptedData = await encryptionService.encryptConversation(
        userId,
        this.state
      );

      // Save encrypted data
      const { error } = await supabase
        .from('conversation_sessions')
        .insert({
          user_id: userId,
          lesson_id: this.state.current_lesson?.id,
          encrypted_data: encryptedData,
          completion_percentage: this.state.session_stats.completion_percentage,
          started_at: this.state.session_stats.start_time,
          completed_at: this.state.session_stats.completion_percentage >= 100 
            ? new Date().toISOString() 
            : null,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save progress:', error);
      monitoring.trackError(error as Error, { context: 'saveProgressToDatabase' });
    }
  }

  async loadConversationHistory(userId: string, lessonId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      if (data?.encrypted_data) {
        // Decrypt conversation data
        const decryptedData = await encryptionService.decryptData(
          userId,
          data.encrypted_data
        );

        // Update state with decrypted data
        this.state = {
          ...this.state,
          ...decryptedData,
          userId,
        };
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      monitoring.trackError(error as Error, { context: 'loadConversationHistory' });
    }
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<ConversationState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const conversationService = new ConversationService(); 