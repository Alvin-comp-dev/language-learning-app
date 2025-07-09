import React from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Text } from '../../components/ui';
import { colors, spacing, globalStyles } from '../../theme';

const AssessmentScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
      
      <View style={styles.content}>
        <Text variant="h2" style={styles.title}>
          Assessment Screen
        </Text>
        
        <Text variant="bodyMedium" style={styles.subtitle}>
          Coming soon - Quick skill assessment
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    ...globalStyles.container,
  },
  
  content: {
    flex: 1,
    ...globalStyles.screenPadding,
    ...globalStyles.centerContent,
  },
  
  title: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  
  subtitle: {
    textAlign: 'center',
    color: colors.text.secondary,
  },
});

export default AssessmentScreen; 