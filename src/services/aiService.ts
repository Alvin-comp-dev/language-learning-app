import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import monitoring from '../config/monitoring';
import { Anthropic } from '@anthropic-ai/sdk';

export interface AIResponse {
  message: string;
  feedback: string;
  encouragement: string;
  next_prompt: string;
  difficulty_adjustment: 'easier' | 'same' | 'harder';
  vocabulary_introduced: string[];
  grammar_points: string[];
}

export interface ConversationContext {
  lesson_id: string;
  user_level: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
  conversation_history: Array<{
    speaker: 'user' | 'ai';
    message: string;
    timestamp: string;
  }>;
  current_scenario: string;
  learning_goals: string[];
  user_mistakes: string[];
}

export interface TutorPersonality {
  name: string;
  description: string;
  language: string;
  accent: string;
  teaching_style: string[];
  personality_traits: string[];
}

interface SpeakingEvaluation {
  transcription: string;
  topic: string;
  criteria: string[];
}

interface CertificationFeedback {
  scores: {
    speaking: number;
    grammar: number;
    vocabulary: number;
  };
  overallScore: number;
}

interface ConversationResponse {
  text: string;
  corrections: Array<{
    original: string;
    correction: string;
    explanation: string;
  }>;
  feedback: {
    grammar: string;
    vocabulary: string;
    fluency: string;
  };
  nextPrompts: string[];
}

/**
 * Handles AI-powered language tutoring conversations
 */
class AIService {
  private readonly anthropic: Anthropic;
  private readonly CONTEXT_WINDOW = 10; // Number of previous exchanges to maintain
  private readonly MAX_RETRIES = 3;
  private readonly TUTOR_PERSONALITIES = {
    default: {
      name: 'Sofia',
      style: 'friendly and encouraging',
      expertise: 'general conversation'
    },
    business: {
      name: 'Dr. Martinez',
      style: 'professional and formal',
      expertise: 'business communication'
    },
    travel: {
      name: 'Carlos',
      style: 'casual and practical',
      expertise: 'travel situations'
    }
  };

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * Generate AI tutor response
   */
  public async generateResponse(
    userInput: string,
    context: ConversationContext,
    tutorType: keyof typeof this.TUTOR_PERSONALITIES = 'default'
  ): Promise<ConversationResponse> {
    try {
      // Prepare conversation history
      const recentExchanges = context.conversation_history
        .slice(-this.CONTEXT_WINDOW)
        .map(exchange => ({
          role: exchange.speaker,
          content: exchange.message
        }));

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(context, tutorType);

      // Generate response
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet',
        max_tokens: 1000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          ...recentExchanges,
          { role: 'user', content: userInput }
        ]
      });

      // Parse and structure the response
      const structuredResponse = this.parseResponse(response.content[0].text);

      // Cache the interaction
      await this.cacheInteraction(userInput, structuredResponse, context);

      return structuredResponse;
    } catch (error) {
      await monitoring.logError({
        type: 'ai_response_generation_failed',
        error
      });
      throw new Error('Failed to generate AI response. Please try again.');
    }
  }

  /**
   * Build system prompt based on context and tutor personality
   */
  private buildSystemPrompt(
    context: ConversationContext,
    tutorType: keyof typeof this.TUTOR_PERSONALITIES
  ): string {
    const tutor = this.TUTOR_PERSONALITIES[tutorType];
    const { user_level, current_scenario, learning_goals } = context;

    return `You are ${tutor.name}, a ${tutor.style} language tutor specializing in ${tutor.expertise}.
Your student is learning Spanish at a ${user_level} level.
Their learning goals are: ${learning_goals.join(', ')}.

Provide responses in the following JSON structure:
{
  "text": "Your conversational response",
  "corrections": [
    {
      "original": "incorrect phrase",
      "correction": "correct phrase",
      "explanation": "why this correction is needed"
    }
  ],
  "feedback": {
    "grammar": "specific grammar feedback",
    "vocabulary": "vocabulary usage feedback",
    "fluency": "fluency assessment"
  },
  "nextPrompts": ["2-3 suggested responses to continue the conversation"]
}

Keep corrections focused on the most important issues.
Maintain a supportive and encouraging tone.
Adapt language complexity to the student's level.
Focus on practical, real-world usage.`;
  }

  /**
   * Parse and validate AI response
   */
  private parseResponse(rawResponse: string): ConversationResponse {
    try {
      // Extract JSON from response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.text || !Array.isArray(parsed.corrections) || !parsed.feedback) {
        throw new Error('Missing required fields in response');
      }

      return {
        text: parsed.text,
        corrections: parsed.corrections,
        feedback: {
          grammar: parsed.feedback.grammar || '',
          vocabulary: parsed.feedback.vocabulary || '',
          fluency: parsed.feedback.fluency || ''
        },
        nextPrompts: Array.isArray(parsed.nextPrompts) ? parsed.nextPrompts : []
      };
    } catch (error) {
      throw new Error('Failed to parse AI response');
    }
  }

  /**
   * Cache interaction for analytics and improvement
   */
  private async cacheInteraction(
    userInput: string,
    response: ConversationResponse,
    context: ConversationContext
  ): Promise<void> {
    try {
      await supabase.from('conversation_analytics').insert({
        lesson_id: context.lesson_id,
        user_input: userInput,
        ai_response: response,
        language: 'Spanish',
        proficiency_level: context.user_level,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Non-critical error, just log it
      await monitoring.logError({
        type: 'conversation_cache_failed',
        error
      });
    }
  }

  /**
   * Get conversation suggestions based on context
   */
  public async getSuggestions(
    context: ConversationContext
  ): Promise<string[]> {
    try {
      const { data: suggestions } = await supabase
        .from('conversation_suggestions')
        .select('text')
        .match({
          language: 'Spanish',
          proficiency_level: context.user_level
        })
        .limit(3);

      return suggestions?.map(s => s.text) || [];
    } catch (error) {
      await monitoring.logError({
        type: 'suggestion_retrieval_failed',
        error
      });
      return [];
    }
  }

  /**
   * Analyze conversation quality
   */
  public async analyzeConversation(
    exchanges: ConversationContext['conversation_history']
  ): Promise<{
    fluencyScore: number;
    vocabularyDiversity: number;
    grammarAccuracy: number;
    recommendations: string[];
  }> {
    try {
      const userMessages = exchanges.filter(e => e.speaker === 'user');
      
      // Calculate metrics
      const fluencyScore = this.calculateFluencyScore(userMessages);
      const vocabularyDiversity = this.calculateVocabularyDiversity(userMessages);
      const grammarAccuracy = this.calculateGrammarAccuracy(userMessages);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        fluencyScore,
        vocabularyDiversity,
        grammarAccuracy
      );

      return {
        fluencyScore,
        vocabularyDiversity,
        grammarAccuracy,
        recommendations
      };
    } catch (error) {
      await monitoring.logError({
        type: 'conversation_analysis_failed',
        error
      });
      throw new Error('Failed to analyze conversation');
    }
  }

  /**
   * Calculate fluency score based on response times and complexity
   */
  private calculateFluencyScore(messages: Array<{ message: string }>): number {
    // Implement fluency scoring logic
    // Consider factors like:
    // - Message length
    // - Vocabulary complexity
    // - Response time (if available)
    return 0.85; // Placeholder
  }

  /**
   * Calculate vocabulary diversity score
   */
  private calculateVocabularyDiversity(messages: Array<{ message: string }>): number {
    const words = messages
      .map(m => m.message.toLowerCase().split(/\s+/))
      .flat();
    const uniqueWords = new Set(words);
    return uniqueWords.size / words.length;
  }

  /**
   * Calculate grammar accuracy score
   */
  private calculateGrammarAccuracy(messages: Array<{ message: string }>): number {
    // Implement grammar analysis logic
    // Consider factors like:
    // - Common error patterns
    // - Sentence structure
    // - Agreement rules
    return 0.75; // Placeholder
  }

  /**
   * Generate learning recommendations
   */
  private generateRecommendations(
    fluency: number,
    vocabulary: number,
    grammar: number
  ): string[] {
    const recommendations: string[] = [];

    if (fluency < 0.7) {
      recommendations.push('Practice speaking more frequently to improve fluency');
    }
    if (vocabulary < 0.6) {
      recommendations.push('Focus on expanding your vocabulary range');
    }
    if (grammar < 0.8) {
      recommendations.push('Review common grammar patterns and rules');
    }

    return recommendations;
  }
}

export default new AIService(); 