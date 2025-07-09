import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Alert } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import Analytics from '../../config/firebase';

type FeedbackType = 'bug' | 'feature' | 'usability' | 'other';

interface BetaFeedbackProps {
  onClose: () => void;
}

export const BetaFeedback: React.FC<BetaFeedbackProps> = ({ onClose }) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    try {
      await Analytics.trackFeedback(feedbackType, rating, comment);
      Alert.alert(
        'Thank You!',
        'Your feedback helps us improve SpeakFlow.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to submit feedback. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Beta Feedback</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>Feedback Type</Text>
        <View style={styles.buttonGroup}>
          <Button 
            onPress={() => setFeedbackType('bug')}
            variant={feedbackType === 'bug' ? 'primary' : 'secondary'}
            style={styles.typeButton}
          >
            Bug Report
          </Button>
          <Button 
            onPress={() => setFeedbackType('feature')}
            variant={feedbackType === 'feature' ? 'primary' : 'secondary'}
            style={styles.typeButton}
          >
            Feature Request
          </Button>
          <Button 
            onPress={() => setFeedbackType('usability')}
            variant={feedbackType === 'usability' ? 'primary' : 'secondary'}
            style={styles.typeButton}
          >
            Usability
          </Button>
          <Button 
            onPress={() => setFeedbackType('other')}
            variant={feedbackType === 'other' ? 'primary' : 'secondary'}
            style={styles.typeButton}
          >
            Other
          </Button>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Rating (1-5)</Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Button
              key={value}
              onPress={() => setRating(value)}
              variant={rating === value ? 'primary' : 'secondary'}
              style={styles.ratingButton}
            >
              {value.toString()}
            </Button>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Comments</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={4}
          value={comment}
          onChangeText={setComment}
          placeholder="Please describe your feedback in detail..."
          placeholderTextColor="#6B7280"
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button onPress={onClose} variant="secondary" style={styles.button}>
          Cancel
        </Button>
        <Button 
          onPress={handleSubmit} 
          variant="primary" 
          style={styles.button}
          disabled={!comment.trim()}
        >
          Submit Feedback
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    maxWidth: 500,
    width: '100%'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  section: {
    marginBottom: 20
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  typeButton: {
    flex: 1,
    minWidth: '45%'
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  ratingButton: {
    flex: 1
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 16
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20
  },
  button: {
    minWidth: 120
  }
}); 