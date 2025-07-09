import { supabase } from '../config/supabase';
import { aiService } from './aiService';
import { speechService } from './speechService';

export interface CertificationLevel {
  id: string;
  name: string;
  description: string;
  required_score: number;
  speaking_topics: string[];
  grammar_requirements: string[];
  vocabulary_requirements: string[];
}

export interface CertificationAttempt {
  id: string;
  user_id: string;
  certification_level: string;
  overall_score: number;
  speaking_score: number;
  grammar_score: number;
  vocabulary_score: number;
  feedback: {
    strengths: string[];
    areas_for_improvement: string[];
    recommendations: string[];
  };
  completed_at: string;
  certificate_url?: string;
}

export const CERTIFICATION_LEVELS: CertificationLevel[] = [
  {
    id: 'a1',
    name: 'Beginner',
    description: 'Can understand and use familiar everyday expressions and basic phrases.',
    required_score: 70,
    speaking_topics: [
      'Personal introductions',
      'Basic needs',
      'Daily routines',
      'Simple descriptions'
    ],
    grammar_requirements: [
      'Present tense of regular verbs',
      'Basic pronouns',
      'Simple questions',
      'Numbers and basic adjectives'
    ],
    vocabulary_requirements: [
      'Greetings and farewells',
      'Family members',
      'Common objects',
      'Basic actions'
    ]
  },
  {
    id: 'a2',
    name: 'Elementary',
    description: 'Can communicate in simple and routine tasks requiring direct exchange of information.',
    required_score: 75,
    speaking_topics: [
      'Work and studies',
      'Shopping and services',
      'Travel and transportation',
      'Past experiences'
    ],
    grammar_requirements: [
      'Past tenses',
      'Future expressions',
      'Comparatives',
      'Modal verbs'
    ],
    vocabulary_requirements: [
      'Work and professions',
      'Shopping and prices',
      'Travel and directions',
      'Time expressions'
    ]
  },
  {
    id: 'b1',
    name: 'Intermediate',
    description: 'Can deal with most situations likely to arise while traveling.',
    required_score: 80,
    speaking_topics: [
      'Current events',
      'Personal opinions',
      'Future plans',
      'Cultural topics'
    ],
    grammar_requirements: [
      'All major tenses',
      'Conditionals',
      'Passive voice',
      'Reported speech'
    ],
    vocabulary_requirements: [
      'Current affairs',
      'Cultural terms',
      'Abstract concepts',
      'Idiomatic expressions'
    ]
  }
];

class CertificationService {
  // Get available certification levels
  async getCertificationLevels(): Promise<CertificationLevel[]> {
    return CERTIFICATION_LEVELS;
  }

  // Get user's certification attempts
  async getUserCertifications(userId: string): Promise<CertificationAttempt[]> {
    const { data, error } = await supabase
      .from('certification_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // Start a certification assessment
  async startCertification(userId: string, levelId: string): Promise<string> {
    const level = CERTIFICATION_LEVELS.find(l => l.id === levelId);
    if (!level) throw new Error('Invalid certification level');

    const { data, error } = await supabase
      .from('certification_attempts')
      .insert({
        user_id: userId,
        certification_level: levelId,
        status: 'in_progress'
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  // Evaluate speaking assessment
  async evaluateSpeaking(
    attemptId: string,
    audioRecording: Blob,
    topic: string
  ): Promise<{
    score: number;
    feedback: string[];
  }> {
    // Transcribe audio
    const transcription = await speechService.transcribeAudio(audioRecording);

    // Get AI evaluation
    const evaluation = await aiService.evaluateSpeaking({
      transcription,
      topic,
      criteria: [
        'Pronunciation accuracy',
        'Fluency and pace',
        'Vocabulary usage',
        'Grammar accuracy',
        'Topic relevance'
      ]
    });

    return evaluation;
  }

  // Complete certification attempt
  async completeCertification(
    attemptId: string,
    scores: {
      speaking: number;
      grammar: number;
      vocabulary: number;
    }
  ): Promise<CertificationAttempt> {
    const overallScore = Math.round(
      (scores.speaking + scores.grammar + scores.vocabulary) / 3
    );

    // Generate feedback using AI
    const feedback = await aiService.generateCertificationFeedback({
      scores,
      overallScore
    });

    // Generate certificate if passed
    let certificateUrl;
    if (overallScore >= 70) {
      certificateUrl = await this.generateCertificate(attemptId);
    }

    // Update attempt in database
    const { data, error } = await supabase
      .from('certification_attempts')
      .update({
        overall_score: overallScore,
        speaking_score: scores.speaking,
        grammar_score: scores.grammar,
        vocabulary_score: scores.vocabulary,
        feedback,
        certificate_url: certificateUrl,
        completed_at: new Date().toISOString(),
        status: 'completed'
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Generate certificate PDF
  private async generateCertificate(attemptId: string): Promise<string> {
    // TODO: Implement certificate generation with a PDF library
    // For now, return a placeholder URL
    return `https://api.speakflow.com/certificates/${attemptId}`;
  }
}

export const certificationService = new CertificationService(); 