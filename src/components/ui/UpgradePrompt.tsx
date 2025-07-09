import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface UpgradePromptProps {
  title?: string;
  message?: string;
  feature?: string;
  style?: any;
  variant?: 'banner' | 'inline' | 'modal';
  onClose?: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  title = 'Unlock Premium Features',
  message = 'Upgrade to access all premium features and accelerate your learning journey.',
  feature,
  style,
  variant = 'inline',
  onClose,
}) => {
  const navigation = useNavigation();

  const handleUpgrade = () => {
    navigation.navigate('UpgradeScreen' as never);
    onClose?.();
  };

  if (variant === 'banner') {
    return (
      <View style={[styles.bannerContainer, style]}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerText}>
            {feature ? `✨ Unlock ${feature} with Premium` : title}
          </Text>
          <TouchableOpacity
            style={styles.bannerButton}
            onPress={handleUpgrade}
          >
            <Text style={styles.bannerButtonText}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (variant === 'modal') {
    return (
      <View style={[styles.modalContainer, style]}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>
            {feature
              ? `Upgrade to Premium to unlock ${feature} and many more features!`
              : message}
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={handleUpgrade}
          >
            <Text style={styles.modalButtonText}>Upgrade to Premium</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={onClose}
            >
              <Text style={styles.modalCloseText}>Maybe Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Default inline variant
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {feature ? `✨ Unlock ${feature}` : title}
        </Text>
        <Text style={styles.message}>
          {feature
            ? `Upgrade to Premium to access ${feature} and all other premium features.`
            : message}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleUpgrade}
      >
        <Text style={styles.buttonText}>Upgrade</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.medium,
    marginVertical: spacing.small,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    marginBottom: spacing.small,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xsmall,
    color: colors.text,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  bannerContainer: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerText: {
    color: colors.white,
    fontSize: 14,
    flex: 1,
  },
  bannerButton: {
    backgroundColor: colors.white,
    paddingVertical: spacing.xsmall,
    paddingHorizontal: spacing.small,
    borderRadius: 4,
    marginLeft: spacing.small,
  },
  bannerButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.large,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing.small,
    textAlign: 'center',
    color: colors.text,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: spacing.large,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.medium,
    borderRadius: 8,
    marginBottom: spacing.small,
  },
  modalButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalCloseButton: {
    paddingVertical: spacing.small,
  },
  modalCloseText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
}); 