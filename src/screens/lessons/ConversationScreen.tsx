import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { Text, Button as UiButton } from '../../components/ui'; // Renamed Button to UiButton to avoid conflict
import { colors, spacing } from '../../theme';
// import { conversationService, ConversationState, ConversationResponse } from '../../services/conversationService'; // Keep for later
import { observer } from 'mobx-react-lite';
import { PronunciationFeedback } from '../../components/ui/PronunciationFeedback';
// import { progressService } from '../../services/progressService'; // Keep for later
import { useStore } from '../../store/AppStore';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system'; // Needed for reading audio file
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import SpeechService from '../../services/speechService'; // Uncomment and use
import AiService, { ConversationContext } from '../../services/aiService'; // Uncomment and use
import MvpLessonService from '../../services/mvpLessonService'; // Import MVP Lesson Service
import { Lesson as MvpLesson, DialogueStep } from '../../data/lessons'; // Import Lesson type for MVP
import { RootStackParamList } from '../../../App'; // Adjust path as needed

// Define Message type for conversation history
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  pronunciationScore?: number; // Added for user messages
  // Keep corrections and feedback for future compatibility with aiService response
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

// Define route params more specifically if possible, using RootStackParamList
type ConversationScreenRouteProp = RouteProp<RootStackParamList, 'Conversation'>;

const ConversationScreen: React.FC = observer(() => {
  // const { progressStore } = useStore(); // Keep for later
  const navigation = useNavigation();
  const route = useRoute<ConversationScreenRouteProp>();
  // Assuming lessonId is passed as a param, adjust if structure is different
  const lessonId = route.params?.lessonId || 'mvp1'; // Default to mvp1 if no ID passed

  const [currentLesson, setCurrentLesson] = useState<MvpLesson | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // To show loading/processing state
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);

  // For displaying current AI prompt or user's turn instruction
  const [currentDialogueStep, setCurrentDialogueStep] = useState<DialogueStep | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);


  const scrollViewRef = useRef<ScrollView>(null);
  const conversationHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);


  useEffect(() => {
    const loadLesson = async () => {
      setIsLoading(true);
      const lesson = MvpLessonService.getLessonById(lessonId);
      if (lesson) {
        setCurrentLesson(lesson);
        if (lesson.dialogue && lesson.dialogue.length > 0) {
          const firstStep = lesson.dialogue[0];
          setCurrentDialogueStep(firstStep);
          setCurrentStepIndex(0);

          if (firstStep.speaker === 'ai') {
            setMessages([{
              id: `ai-init-${Date.now()}`,
              text: firstStep.text,
              sender: 'ai',
              timestamp: Date.now(),
            }]);
          }
          // If firstStep.speaker is 'user', currentDialogueStep will serve as the prompt
        }
      } else {
        Alert.alert('Error', 'Lesson not found.');
        navigation.goBack();
      }
      setIsLoading(false);
    };

    loadLesson();

    // Initialize audio session - can be kept
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      // interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX, // Consider if needed now
      // interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      // shouldDuckAndroid: true,
      // playThroughEarpieceAndroid: false,
      staysActiveInBackground: false, // Important for background behavior
    }).catch(error => console.error("Failed to set audio mode", error));

    // No automatic conversationService subscription or AI greeting for Part 1
    // return unsubscribe; // if conversationService was used
  }, [lessonId, navigation]);


  // Simplified startRecording for Part 1 - just UI
  const startRecording = async () => {
    console.log('Record button pressed (Part 1) - recording not implemented yet');
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert("Permissions required", "Microphone permission is needed to record audio.");
      return;
    }
    setIsRecording(true);
    try {
      await Audio.setAudioModeAsync({ // Ensure audio mode is set before recording
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true, // Important for recording UX
      });
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      setRecordingInstance(newRecording);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecordingAndProcess = async () => {
    if (!recordingInstance) return;

    console.log('Stopping recording...');
    setIsRecording(false);
    setIsProcessing(true);
    try {
      await recordingInstance.stopAndUnloadAsync();
      const uri = recordingInstance.getURI();
      setRecordingInstance(null); // Clear the recording instance

      if (!uri) {
        throw new Error('Recording URI is null or undefined.');
      }
      console.log('Recording stopped, URI:', uri);

      // 1. Transcribe Audio
      // Note: speechService.transcribeAudio returns a mock if API key is missing
      const speechResult = await SpeechService.transcribeAudio(uri, currentLesson?.category === 'travel' ? 'es' : 'es'); // Example language
      console.log('Transcription result:', speechResult.transcription);

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        text: speechResult.transcription,
        sender: 'user',
        timestamp: Date.now(),
        pronunciationScore: speechResult.pronunciation_score, // Store pronunciation score
      };
      setMessages(prevMessages => [...prevMessages, userMessage]);
      conversationHistoryRef.current.push({ role: 'user', content: speechResult.transcription });

      // 2. Get AI Response
      if (currentLesson) {
        const context: ConversationContext = {
          lesson_id: currentLesson.id,
          user_level: currentLesson.level,
          conversation_history: conversationHistoryRef.current.slice(-5), // Send last 5 exchanges
          current_scenario: currentLesson.scenario_context,
          learning_goals: currentLesson.learning_goals,
          user_mistakes: [], // Placeholder for actual mistake tracking
        };
        // Note: aiService.generateResponse returns a mock if API key is missing
        const aiResponse = await AiService.generateResponse(speechResult.transcription, context);
        console.log('AI Response:', aiResponse.text);

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          text: aiResponse.text,
          sender: 'ai',
          timestamp: Date.now(),
          corrections: aiResponse.corrections,
          feedback: aiResponse.feedback
        };
        setMessages(prevMessages => [...prevMessages, aiMessage]);
        conversationHistoryRef.current.push({ role: 'assistant', content: aiResponse.text });

        // 3. Advance Dialogue or Handle End
        advanceDialogueStep();
      }

    } catch (error) {
      console.error('Error processing audio:', error);
      Alert.alert('Error', 'Could not process audio. Please try again.');
      // Add a generic error message to UI if needed
      setMessages(prevMessages => [...prevMessages, {
        id: `error-${Date.now()}`,
        text: "Sorry, I couldn't process that. Please try again.",
        sender: 'ai',
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
      // Clean up the recording file
      if (uri) {
        FileSystem.deleteAsync(uri).catch(e => console.error("Failed to delete recording file", e));
      }
    }
  };

  const advanceDialogueStep = () => {
    if (!currentLesson) return;

    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < currentLesson.dialogue.length) {
      const nextStep = currentLesson.dialogue[nextStepIndex];
      setCurrentDialogueStep(nextStep);
      setCurrentStepIndex(nextStepIndex);

      if (nextStep.speaker === 'ai') {
        // If the next step is AI's turn based on predefined dialogue, add it.
        // This might be adjusted if AI response from Claude is always preferred.
        // For MVP, we might let Claude drive and use lesson dialogue for user prompts.
        // For now, let's assume Claude's response is the primary AI message.
        // If Claude's response is to be followed by a scripted AI line, this is where it would go.
        // For example:
        // const scriptedAiMessage: Message = {
        //   id: `ai-scripted-${Date.now()}`,
        //   text: nextStep.text,
        //   sender: 'ai',
        //   timestamp: Date.now(),
        // };
        // setMessages(prevMessages => [...prevMessages, scriptedAiMessage]);
        // conversationHistoryRef.current.push({ role: 'assistant', content: nextStep.text });
        // And then potentially advance again if the *next* is a user prompt.
      }
    } else {
      // Lesson dialogue finished
      setCurrentDialogueStep(null); // No more prompts from lesson structure
      console.log('Lesson dialogue finished.');
      // Add a concluding message from AI or a summary.
      // For now, let Claude's last response be the end, or add a generic one.
      if (messages[messages.length -1].sender === 'user') { // Ensure AI has the last word if lesson ends on user turn
        const finalAiMessage: Message = {
          id: `ai-final-${Date.now()}`,
          text: "¡Buen trabajo! Has completado esta parte de la lección. (mocked ending)",
          sender: 'ai',
          timestamp: Date.now(),
        };
        setMessages(prevMessages => [...prevMessages, finalAiMessage]);
        conversationHistoryRef.current.push({ role: 'assistant', content: finalAiMessage.text });
      }
       Alert.alert("Lesson Complete!", "You've reached the end of this lesson's dialogue.");
    }
  };

  // Placeholder for text input handling - can be added later if needed
  // const handleTextInput = async (text: string) => { /* ... */ };


  const renderConversationHistory = () => {
    // This existing structure is good, will render messages from state
    return messages.map((message) => (
      <View key={message.id} style={[
        styles.messageContainer,
        message.sender === 'user' ? styles.userMessage : styles.aiMessage
      ]}>
        <Text variant="caption" style={styles.speakerLabel}>
          {message.sender === 'user' ? 'You' : currentLesson?.aiTutor || 'AI Tutor'}
        </Text>
        <Text variant="bodyMedium" style={styles.messageText}>
          {message.text}
        </Text>
        {message.sender === 'user' && typeof message.pronunciationScore === 'number' && (
          <View style={styles.pronunciationScoreContainer}>
            <Text style={styles.pronunciationScoreText}>
              Pronunciation Score: {message.pronunciationScore}/100 (mocked)
            </Text>
          </View>
        )}
        {message.sender === 'ai' && message.corrections && message.corrections.length > 0 && (
          <TouchableOpacity
            style={styles.correctionsButton}
            onPress={() => toggleCorrectionsForMessage(message.id)}
          >
            <Text style={styles.correctionsButtonText}>
              {/* This assumes a state like 'expandedCorrections[message.id]' exists */}
              {/* For simplicity, text might need to be managed by such a state */}
              Show/Hide Corrections
            </Text>
          </TouchableOpacity>
        )}
        {/* Placeholder for expanded corrections logic based on a state variable */}
        {/* {expandedCorrections[message.id] && message.corrections?.map(...)} */}

        {message.sender === 'ai' && message.feedback && (
          <PronunciationFeedback // This component seems designed for AI feedback
            grammar={message.feedback.grammar}
            vocabulary={message.feedback.vocabulary}
            fluency={message.feedback.fluency}
          />
        )}
      </View>
    ));
  };

  // Helper state and function for toggling corrections visibility
  // This is a simplified example; a more robust solution might be needed.
  const [expandedCorrections, setExpandedCorrections] = useState<Record<string, boolean>>({});
  const toggleCorrectionsForMessage = (messageId: string) => {
    setExpandedCorrections(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const renderCurrentPrompt = () => {
    if (!currentDialogueStep || currentDialogueStep.speaker !== 'user') {
      return null; // Only show prompt when it's user's turn and it's a prompt
    }
    return (
      <View style={styles.promptContainer}>
        <Text style={styles.promptText}>Your turn: {currentDialogueStep.text}</Text>
        {currentDialogueStep.translation && (
          <Text style={styles.promptTranslation}>({currentDialogueStep.translation})</Text>
        )}
      </View>
    );
  };


  const renderRecordingInterface = () => {
    // Simplified for Part 1
    return (
      <View style={styles.recordingContainer}>
        {renderCurrentPrompt()}
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
            isProcessing && styles.recordButtonProcessing
          ]}
          onPress={isRecording ? stopRecordingAndProcess : startRecording}
          disabled={isProcessing}
        >
          <Text variant="h3" style={styles.recordButtonText}>
            {isProcessing ? '🔄' : isRecording ? '🛑' : '🎤'}
          </Text>
        </TouchableOpacity>

        <Text variant="bodyMedium" style={styles.recordingPrompt}>
          {isProcessing ? 'Processing your speech...' :
           isRecording ? 'Tap to stop recording' :
           (currentDialogueStep?.speaker === 'user' ? 'Tap to speak your response' : 'Tap to start speaking')}
        </Text>
        {/* Text input toggle can be kept for future use or removed for pure voice MVP */}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} style={{flex: 1}} />
      </SafeAreaView>
    );
  }

  if (!currentLesson) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{textAlign: 'center', marginTop: 20}}>Lesson could not be loaded.</Text>
      </SafeAreaView>
    );
  }

  const renderCurrentLessonHeader = () => {
    if (!currentLesson) return null;

    return (
      <View style={styles.lessonHeader}>
        <Text variant="h3" style={styles.lessonTitle}>
          {currentLesson.title}
        </Text>
        <Text variant="caption" style={styles.lessonDescription}>
          {currentLesson.description}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary[500]} />

      {renderCurrentLessonHeader()}

      <ScrollView
        ref={scrollViewRef}
        style={styles.conversationContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }} // Ensure space for record button
      >
        {renderConversationHistory()}
      </ScrollView>

      {/* Suggested responses can be added in Part 2 or later */}
      {/* {renderSuggestedResponses()} */}

      {renderRecordingInterface()}

      {/* Progress text can be simplified or removed for Part 1 */}
      {/* <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Progress: {lessonProgress}/10 phrases
        </Text>
      </View> */}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
  // Simplified startRecording for Part 1 - just UI
  const startRecording = async () => {
    console.log('Record button pressed (Part 1) - recording not implemented yet');
    // Basic permission check example, full logic in Part 2
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert("Permissions required", "Microphone permission is needed to record audio.");
      return;
    }
    setIsRecording(true); // Toggle UI state
    // Actual recording logic will be in Part 2
  };

  // Simplified stopRecording for Part 1 - just UI
  const stopRecording = async () => {
    console.log('Stop recording (Part 1) - processing not implemented yet');
    setIsRecording(false); // Toggle UI state
    // Actual processing and transcription will be in Part 2
  };

  // Placeholder for handleAIResponse - will be used in Part 2
  // const handleAIResponse = ( /* ... params ... */ ) => { /* ... */ };

  // Placeholder for text input handling - can be added later if needed
  // const handleTextInput = async (text: string) => { /* ... */ };


  const renderConversationHistory = () => {
    // This existing structure is good, will render messages from state
    return messages.map((message) => (
      <View key={message.id} style={[
        styles.messageContainer,
        message.sender === 'user' ? styles.userMessage : styles.aiMessage
      ]}>
        <Text variant="caption" style={styles.speakerLabel}>
          {message.sender === 'user' ? 'You' : currentLesson?.aiTutor || 'AI Tutor'}
        </Text>
        <Text variant="bodyMedium" style={styles.messageText}>
          {message.text}
        </Text>
        {/* Corrections and feedback display can be kept for Part 2 */}
      </View>
    ));
  };

  const renderCurrentPrompt = () => {
    if (!currentDialogueStep || currentDialogueStep.speaker !== 'user') {
      return null; // Only show prompt when it's user's turn and it's a prompt
    }
    return (
      <View style={styles.promptContainer}>
        <Text style={styles.promptText}>Your turn: {currentDialogueStep.text}</Text>
        {currentDialogueStep.translation && (
          <Text style={styles.promptTranslation}>({currentDialogueStep.translation})</Text>
        )}
      </View>
    );
  };


  const renderRecordingInterface = () => {
    // Simplified for Part 1
    return (
      <View style={styles.recordingContainer}>
        {renderCurrentPrompt()}
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
            // status === 'processing' && styles.recordButtonProcessing // For Part 2
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          // disabled={status === 'processing'} // For Part 2
        >
          <Text variant="h3" style={styles.recordButtonText}>
            {/* {status === 'processing' ? '🔄' : isRecording ? '🛑' : '🎤'}  // For Part 2 */}
            {isRecording ? '🛑' : '🎤'}
          </Text>
        </TouchableOpacity>

        <Text variant="bodyMedium" style={styles.recordingPrompt}>
          {/* {status === 'processing' ? 'Processing your speech...' : // For Part 2 */}
           {isRecording ? 'Tap to stop recording' :
           'Tap to start speaking'}
        </Text>
        {/* Text input toggle can be kept for future use or removed for pure voice MVP */}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} style={{flex: 1}} />
      </SafeAreaView>
    );
  }

  if (!currentLesson) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{textAlign: 'center', marginTop: 20}}>Lesson could not be loaded.</Text>
      </SafeAreaView>
    );
  }

  const renderCurrentLessonHeader = () => {
    if (!currentLesson) return null;

    return (
      <View style={styles.lessonHeader}>
        <Text variant="h3" style={styles.lessonTitle}>
          {currentLesson.title}
        </Text>
        <Text variant="caption" style={styles.lessonDescription}>
          {currentLesson.description}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary[500]} />

      {renderCurrentLessonHeader()}

      <ScrollView
        ref={scrollViewRef}
        style={styles.conversationContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }} // Ensure space for record button
      >
        {renderConversationHistory()}
      </ScrollView>

      {/* Suggested responses can be added in Part 2 or later */}
      {/* {renderSuggestedResponses()} */}

      {renderRecordingInterface()}

      {/* Progress text can be simplified or removed for Part 1 */}
      {/* <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Progress: {lessonProgress}/10 phrases
        </Text>
      </View> */}
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
    paddingTop: spacing.xl, // Adjusted for status bar
    // borderBottomWidth: 1,
    // borderBottomColor: colors.border
  },
  lessonTitle: {
    color: colors.text.inverse,
    marginBottom: spacing.xs,
  },
  lessonDescription: {
    color: colors.text.inverse,
    opacity: 0.9,
    // marginBottom: spacing.md, // Removed to keep header compact
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg, // Only horizontal padding
    paddingTop: spacing.md,
  },
  messageContainer: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    maxWidth: '85%', // Slightly increased max width
  },
  userMessage: {
    backgroundColor: colors.primary[500],
    alignSelf: 'flex-end',
    borderTopRightRadius: 0, // Bubble tail
  },
  aiMessage: {
    backgroundColor: colors.background.secondary, // Use secondary background for AI
    alignSelf: 'flex-start',
    borderTopLeftRadius: 0, // Bubble tail
  },
  speakerLabel: { // Used for sender name like "You" or "Sofia"
    marginBottom: spacing.xs,
    fontWeight: 'bold', // Make sender name bold
    color: colors.text.secondary, // Use secondary text color
  },
  userMessage .speakerLabel: { // Target speaker label within user message
    color: colors.text.inverse, // User message speaker label inverse
    opacity: 0.8,
  },
  aiMessage .speakerLabel: {
     color: colors.primary[700],
  },
  messageText: {
    color: colors.text.primary,
  },
  userMessage .messageText: {
    color: colors.text.inverse,
  },
  pronunciationScoreContainer: {
    marginTop: spacing.sm,
    padding: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
  },
  pronunciationScoreText: {
    fontSize: 12,
    color: colors.text.inverse, // Assuming user message background is dark
    textAlign: 'right',
  },
  aiMessage .pronunciationScoreText: { // Style for pronunciation score if ever on AI message
    color: colors.text.secondary,
  },
  correctionsButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  userMessage .correctionsButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  correctionsButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  userMessage .correctionsButtonText: {
    color: colors.text.inverse,
  },
  // Prompt styling
  promptContainer: {
    backgroundColor: colors.background.tertiary, // A slightly different background for prompt
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  promptText: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  promptTranslation: {
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.xs,
  },

  recordingContainer: {
    paddingVertical: spacing.lg, // Vertical padding only
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.primary, // Match overall background
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recordButton: {
    width: 70, // Slightly smaller
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm, // Reduced margin
    // Shadow from original can be kept or adjusted
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  recordButtonActive: {
    backgroundColor: colors.error[500],
  },
  recordButtonProcessing: { // Style for when processing
    backgroundColor: colors.warning[500],
  },
  recordButtonText: {
    fontSize: 30,
    color: colors.text.inverse,
  },
  recordingPrompt: {
    textAlign: 'center',
    color: colors.text.secondary,
    minHeight: 20,
  },
  // textInputToggle, textInputContainer from original can be added back later if text input is desired
  // progressContainer from original can be added back or redesigned later
  // actionButton, completedContainer, completedText from original are for post-MVP
});

export default ConversationScreen;
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