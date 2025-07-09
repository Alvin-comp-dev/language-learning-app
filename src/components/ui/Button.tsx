import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, textStyles, spacing, radius, dimensions } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const buttonStyle = [
    styles.base,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const titleStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  const handlePress = () => {
    if (!disabled && !loading) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.text.inverse : colors.primary[500]}
          size="small"
        />
      ) : (
        <Text style={titleStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Base styles
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  
  // Size variants
  small: {
    height: dimensions.button.small.height,
    minWidth: dimensions.button.small.minWidth,
    paddingHorizontal: spacing.md,
  },
  medium: {
    height: dimensions.button.medium.height,
    minWidth: dimensions.button.medium.minWidth,
    paddingHorizontal: spacing.lg,
  },
  large: {
    height: dimensions.button.large.height,
    minWidth: dimensions.button.large.minWidth,
    paddingHorizontal: spacing.xl,
  },
  
  // Color variants
  primary: {
    backgroundColor: colors.primary[500],
  },
  secondary: {
    backgroundColor: colors.neutral[100],
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.primary[500],
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  
  // Text styles
  text: {
    textAlign: 'center',
    fontWeight: textStyles.buttonMedium.fontWeight,
  },
  
  // Text size variants
  smallText: {
    fontSize: textStyles.buttonMedium.fontSize,
    lineHeight: textStyles.buttonMedium.lineHeight,
  },
  mediumText: {
    fontSize: textStyles.buttonLarge.fontSize,
    lineHeight: textStyles.buttonLarge.lineHeight,
  },
  largeText: {
    fontSize: textStyles.buttonLarge.fontSize,
    lineHeight: textStyles.buttonLarge.lineHeight,
  },
  
  // Text color variants
  primaryText: {
    color: colors.text.inverse,
  },
  secondaryText: {
    color: colors.text.primary,
  },
  outlineText: {
    color: colors.primary[500],
  },
  ghostText: {
    color: colors.primary[500],
  },
  
  // States
  disabled: {
    backgroundColor: colors.neutral[200],
    borderColor: colors.neutral[200],
  },
  disabledText: {
    color: colors.text.tertiary,
  },
  
  // Layout
  fullWidth: {
    width: '100%',
  },
});

export default Button; 