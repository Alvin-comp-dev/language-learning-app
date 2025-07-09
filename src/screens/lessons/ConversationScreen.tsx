import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui';
import { Button } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { conversationService, ConversationState, ConversationResponse } from '../../services/conversationService';
import { observer } from 'mobx-react-lite';
import { PronunciationFeedback } from '../../components/ui/PronunciationFeedback';
import { speechService } from '../../services/speechService';
import { progressService } from '../../services/progressService';
import { useStore } from '../../store/AppStore';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useNavigation, useRoute } from '@react-navigation/native';
import aiService from '../../services/aiService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  corrections?: Array<{
    original: string;
    correction: string;
    explanation: string;
  }>;
  feedback?: {
    grammar: string;
    vocabulary: string;
    fluency: string;
  };
}

interface ConversationScreenProps {
  lessonId: string;
  language: string;
  proficiencyLevel: string;
  learningGoals: string[];
}

const ConversationScreen: React.FC = observer(() => {
  const { progressStore } = useStore();
  const navigation = useNavigation();
  const route = useRoute();
  const { lessonId, language, proficiencyLevel, learningGoals } = route.params as ConversationScreenProps;

  const [conversationState, setConversationState] = useState<ConversationState>(
    conversationService.getState()
  );
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [pronunciationResult, setPronunciationResult] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [suggestedResponses, setSuggestedResponses] = useState<string[]>([]);
  const [showCorrections, setShowCorrections] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const conversationContext = useRef({
    lessonId,
    language,
    proficiencyLevel,
    learningGoals,
    previousExchanges: [] as Array<{ role: 'user' | 'assistant'; content: string }>
  });

  useEffect(() => {
    // Subscribe to conversation state changes
    const unsubscribe = conversationService.addStateListener(setConversationState);
    
    // Start the lesson when component mounts
    startLesson();
    
    // Initialize audio session
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    // Start conversation with AI greeting
    handleAIResponse('¡Hola! ¿Cómo estás?');
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    loadNextPhrase();
  }, []);

  const startLesson = async () => {
    const success = await conversationService.startLesson(lessonId);
    if (!success) {
      Alert.alert('Error', 'Failed to start lesson. Please try again.');
    }
  };

  const loadNextPhrase = async () => {
    const phrase = await conversationService.getNextPhrase();
    setCurrentPhrase(phrase);
    setShowFeedback(false);
    setPronunciationResult(null);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const newRecording = new Audio.Recording();
        await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await newRecording.startAsync();
        setRecording(newRecording);
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      setIsProcessing(true);
      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();
      if (!uri) throw new Error('Recording URI is null');

      // Convert audio file to blob
      const audioData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const audioBlob = new Blob([Buffer.from(audioData, 'base64')], {
        type: 'audio/wav',
      });

      // Get speech recognition result
      const transcription = await speechService.transcribe(audioBlob, language);
      
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        text: transcription.text,
        sender: 'user',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Update conversation context
      conversationContext.current.previousExchanges.push({
        role: 'user',
        content: transcription.text,
      });

      // Get AI response
      const aiResponse = await aiService.generateResponse(
        transcription.text,
        conversationContext.current
      );

      // Add AI message
      handleAIResponse(aiResponse.text, aiResponse.corrections, aiResponse.feedback);

      // Update suggested responses
      setSuggestedResponses(aiResponse.nextPrompts);

    } catch (error) {
      console.error('Failed to process recording:', error);
    } finally {
      setIsProcessing(false);
      setRecording(null);
    }
  };

  const handleAIResponse = (
    text: string,
    corrections?: Message['corrections'],
    feedback?: Message['feedback']
  ) => {
    const aiMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'ai',
      timestamp: Date.now(),
      corrections,
      feedback,
    };

    setMessages(prev => [...prev, aiMessage]);
    conversationContext.current.previousExchanges.push({
      role: 'assistant',
      content: text,
    });

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleTextInput = async (text: string) => {
    if (!text.trim()) return;
    
    try {
      const response = await conversationService.processTextInput(text);
      handleConversationResponse(response);
      setTextInput('');
      setShowTextInput(false);
    } catch (error) {
      console.error('Text input error:', error);
      Alert.alert('Error', 'Failed to process your message. Please try again.');
    }
  };

  const handleConversationResponse = (response: ConversationResponse) => {
    if (!response.success) {
      Alert.alert('Error', response.error_message || 'Something went wrong');
      return;
    }

    if (response.next_action === 'complete') {
      const stats = conversationState.session_stats;
      Alert.alert(
        'Lesson Complete! 🎉',
        `Amazing work! Here's your summary:
        
✅ Pronunciation Score: ${stats.average_pronunciation_score}%
🔄 Total Exchanges: ${stats.total_exchanges}
📚 Vocabulary Learned: ${stats.vocabulary_learned.length} words
📈 Completion: ${stats.completion_percentage}%`,
        [
          { text: 'View Progress', onPress: () => {
            navigation.goBack();
            navigation.navigate('ProgressScreen');
          }},
          { text: 'Continue', onPress: () => navigation.goBack() }
        ]
      );
    }
  };

  const handleNext = () => {
    loadNextPhrase();
  };

  const renderConversationHistory = () => {
    return messages.map((message) => (
      <View key={message.id} style={[
        styles.messageContainer,
        message.sender === 'user' ? styles.userMessage : styles.aiMessage
      ]}>
        <Text variant="caption" style={styles.speakerLabel}>
          {message.sender === 'user' ? 'You' : 'Sofia'}
        </Text>
        <Text variant="bodyMedium" style={styles.messageText}>
          {message.text}
        </Text>
        {message.corrections && (
          <TouchableOpacity
            style={styles.correctionsButton}
            onPress={() => setShowCorrections(
              showCorrections === message.id ? null : message.id
            )}
          >
            <Text style={styles.correctionsButtonText}>
              {showCorrections === message.id ? 'Hide Corrections' : 'Show Corrections'}
            </Text>
          </TouchableOpacity>
        )}
        {showCorrections === message.id && (
          <View style={styles.correctionsContainer}>
            {message.corrections?.map((correction, index) => (
              <View key={index} style={styles.correctionItem}>
                <Text style={styles.correctionOriginal}>
                  Original: {correction.original}
                </Text>
                <Text style={styles.correctionSuggested}>
                  Correction: {correction.correction}
                </Text>
                <Text style={styles.correctionExplanation}>
                  {correction.explanation}
                </Text>
              </View>
            ))}
          </View>
        )}
        {message.feedback && (
          <PronunciationFeedback
            grammar={message.feedback.grammar}
            vocabulary={message.feedback.vocabulary}
            fluency={message.feedback.fluency}
          />
        )}
      </View>
    ));
  };

  const renderSuggestedResponses = () => {
    return (
      <View style={styles.suggestedResponsesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestedResponsesContent}
        >
          {suggestedResponses.map((response, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestedResponseButton}
              onPress={() => {
                const userMessage: Message = {
                  id: Date.now().toString(),
                  text: response,
                  sender: 'user',
                  timestamp: Date.now(),
                };
                setMessages(prev => [...prev, userMessage]);
                
                // Update context and get AI response
                conversationContext.current.previousExchanges.push({
                  role: 'user',
                  content: response,
                });
                
                aiService.generateResponse(
                  response,
                  conversationContext.current
                ).then(aiResponse => {
                  handleAIResponse(
                    aiResponse.text,
                    aiResponse.corrections,
                    aiResponse.feedback
                  );
                  setSuggestedResponses(aiResponse.nextPrompts);
                });
              }}
            >
              <Text style={styles.suggestedResponseText}>{response}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderRecordingInterface = () => {
    const { status } = conversationState;
    
    if (status === 'completed') {
      return (
        <View style={styles.completedContainer}>
          <Text variant="h3" style={styles.completedText}>
            🎉 Lesson Complete!
          </Text>
          <Button
            title="Back to Dashboard"
            onPress={() => navigation.goBack()}
            style={styles.actionButton}
          />
        </View>
      );
    }

    return (
      <View style={styles.recordingContainer}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
            status === 'processing' && styles.recordButtonProcessing
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={status === 'processing'}
        >
          <Text variant="h3" style={styles.recordButtonText}>
            {status === 'processing' ? '🔄' : isRecording ? '🛑' : '🎤'}
          </Text>
        </TouchableOpacity>
        
        <Text variant="bodyMedium" style={styles.recordingPrompt}>
          {status === 'processing' ? 'Processing your speech...' :
           isRecording ? 'Tap to stop recording' : 
           'Tap to start speaking'}
        </Text>

        <Button
          title={showTextInput ? 'Hide Text Input' : 'Use Text Instead'}
          variant="secondary"
          onPress={() => setShowTextInput(!showTextInput)}
          style={styles.textInputToggle}
        />

        {showTextInput && (
          <View style={styles.textInputContainer}>
            <Text variant="bodyMedium" style={styles.textInputLabel}>
              Type your response:
            </Text>
            <View style={styles.textInputRow}>
              <Button
                title="Send"
                onPress={() => handleTextInput(textInput)}
                disabled={!textInput.trim()}
                style={styles.sendButton}
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderCurrentLesson = () => {
    if (!conversationState.current_lesson) return null;

    return (
      <View style={styles.lessonHeader}>
        <Text variant="h3" style={styles.lessonTitle}>
          {conversationState.current_lesson.title}
        </Text>
        <Text variant="caption" style={styles.lessonDescription}>
          {conversationState.current_lesson.description}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary[500]} />
      
      {renderCurrentLesson()}
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.conversationContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderConversationHistory()}
      </ScrollView>

      {renderSuggestedResponses()}

      {renderRecordingInterface()}

      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Progress: {lessonProgress}/10 phrases
        </Text>
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  lessonHeader: {
    padding: spacing.lg,
    backgroundColor: colors.primary[500],
    paddingTop: spacing.xl,
  },
  lessonTitle: {
    color: colors.text.inverse,
    marginBottom: spacing.xs,
  },
  lessonDescription: {
    color: colors.text.inverse,
    opacity: 0.9,
    marginBottom: spacing.md,
  },
  conversationContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  messageContainer: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: colors.primary[500],
    alignSelf: 'flex-end',
  },
  aiMessage: {
    backgroundColor: colors.background.secondary,
    alignSelf: 'flex-start',
  },
  speakerLabel: {
    marginBottom: spacing.xs,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  messageText: {
    color: colors.text.primary,
  },
  correctionsButton: {
    marginTop: spacing.small,
    padding: spacing.small,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  correctionsButtonText: {
    color: colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  correctionsContainer: {
    marginTop: spacing.small,
    padding: spacing.small,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  correctionItem: {
    marginVertical: spacing.small,
  },
  correctionOriginal: {
    color: colors.error[500],
    fontSize: 14,
  },
  correctionSuggested: {
    color: colors.success[500],
    fontSize: 14,
    marginTop: 2,
  },
  correctionExplanation: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  suggestedResponsesContainer: {
    backgroundColor: colors.background.secondary,
    padding: spacing.medium,
  },
  suggestedResponsesContent: {
    paddingHorizontal: spacing.medium,
  },
  suggestedResponseButton: {
    backgroundColor: colors.primary[500],
    padding: spacing.medium,
    borderRadius: 20,
    marginHorizontal: spacing.medium,
  },
  suggestedResponseText: {
    color: colors.text.inverse,
    fontSize: 14,
  },
  recordingContainer: {
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  recordButtonActive: {
    backgroundColor: colors.error[500],
  },
  recordButtonProcessing: {
    backgroundColor: colors.warning[500],
  },
  recordButtonText: {
    fontSize: 32,
  },
  recordingPrompt: {
    textAlign: 'center',
    marginBottom: spacing.md,
    color: colors.text.secondary,
  },
  textInputToggle: {
    marginTop: spacing.md,
  },
  textInputContainer: {
    width: '100%',
    marginTop: spacing.md,
  },
  textInputLabel: {
    marginBottom: spacing.xs,
    color: colors.text.secondary,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendButton: {
    marginLeft: spacing.md,
  },
  actionButton: {
    marginTop: spacing.md,
  },
  completedContainer: {
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
  },
  completedText: {
    color: colors.success[500],
    marginBottom: spacing.md,
  },
  progressContainer: {
    marginTop: spacing.md,
  },
  progressText: {
    fontSize: 16,
    color: colors.text,
  },
});

export default ConversationScreen; 