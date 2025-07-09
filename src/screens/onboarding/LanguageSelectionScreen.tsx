import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';

import { Button, Text } from '../../components/ui';
import { colors, spacing, globalStyles, radius } from '../../theme';

type LanguageSelectionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'LanguageSelection'
>;

interface Language {
  id: string;
  name: string;
  flag: string;
  learners: string;
  available: boolean;
}

const LANGUAGES: Language[] = [
  {
    id: 'spanish',
    name: 'Spanish',
    flag: '🇪🇸',
    learners: '500k learners',
    available: true,
  },
  {
    id: 'french',
    name: 'French',
    flag: '🇫🇷',
    learners: '300k learners',
    available: true,
  },
  {
    id: 'german',
    name: 'German',
    flag: '🇩🇪',
    learners: '200k learners',
    available: false,
  },
  {
    id: 'italian',
    name: 'Italian',
    flag: '🇮🇹',
    learners: 'Coming Soon',
    available: false,
  },
  {
    id: 'portuguese',
    name: 'Portuguese',
    flag: '🇵🇹',
    learners: 'Coming Soon',
    available: false,
  },
  {
    id: 'japanese',
    name: 'Japanese',
    flag: '🇯🇵',
    learners: 'Coming Soon',
    available: false,
  },
];

const LanguageSelectionScreen: React.FC = () => {
  const navigation = useNavigation<LanguageSelectionScreenNavigationProp>();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const handleLanguageSelect = (languageId: string) => {
    setSelectedLanguage(languageId);
  };

  const handleContinue = () => {
    if (selectedLanguage) {
      navigation.navigate('Assessment');
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Text variant="bodyMedium" color={colors.primary[500]}>
            ← Back
          </Text>
        </TouchableOpacity>
        
        <Text variant="h2" style={styles.title}>
          Choose Your Language
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="bodyLarge" style={styles.subtitle}>
          What language would you like to learn today?
        </Text>

        <View style={styles.languageGrid}>
          {LANGUAGES.map((language) => (
            <TouchableOpacity
              key={language.id}
              onPress={() => language.available && handleLanguageSelect(language.id)}
              style={[
                styles.languageCard,
                selectedLanguage === language.id && styles.selectedCard,
                !language.available && styles.disabledCard,
              ]}
              disabled={!language.available}
            >
              <View style={styles.languageContent}>
                <Text style={styles.flag}>{language.flag}</Text>
                <Text 
                  variant="h3" 
                  style={[
                    styles.languageName,
                    !language.available && styles.disabledText,
                  ].filter(Boolean)}
                >
                  {language.name}
                </Text>
                <Text 
                  variant="bodySmall" 
                  style={[
                    styles.learnerCount,
                    !language.available && styles.disabledText,
                  ].filter(Boolean)}
                >
                  {language.available ? `✓ ${language.learners}` : language.learners}
                </Text>
              </View>
              
              {selectedLanguage === language.id && (
                <View style={styles.selectedIndicator}>
                  <Text style={styles.checkmark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text variant="bodyMedium" color={colors.text.secondary}>
            💡 Starting with Spanish? Great choice! It's our most feature-complete language with advanced AI conversation practice.
          </Text>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actions}>
        <Button
          title={selectedLanguage ? `Continue with ${LANGUAGES.find(l => l.id === selectedLanguage)?.name}` : 'Select a language'}
          onPress={handleContinue}
          size="large"
          fullWidth
          disabled={!selectedLanguage}
          style={styles.continueButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    ...globalStyles.container,
  },
  
  header: {
    ...globalStyles.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  
  backButton: {
    marginBottom: spacing.lg,
  },
  
  title: {
    textAlign: 'center',
  },
  
  content: {
    flex: 1,
    ...globalStyles.screenPadding,
  },
  
  subtitle: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginBottom: spacing['2xl'],
  },
  
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing['2xl'],
  },
  
  languageCard: {
    width: '48%',
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    position: 'relative',
    minHeight: 120,
  },
  
  selectedCard: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  
  disabledCard: {
    opacity: 0.5,
    borderColor: colors.border.light,
  },
  
  languageContent: {
    alignItems: 'center',
  },
  
  flag: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  
  languageName: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  
  learnerCount: {
    textAlign: 'center',
    color: colors.text.secondary,
  },
  
  disabledText: {
    color: colors.text.tertiary,
  },
  
  selectedIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    ...globalStyles.centerContent,
  },
  
  checkmark: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  infoSection: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  
  actions: {
    ...globalStyles.screenPadding,
    paddingBottom: spacing.lg,
  },
  
  continueButton: {
    marginTop: spacing.md,
  },
});

export default LanguageSelectionScreen; 