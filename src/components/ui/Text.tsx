import React from 'react';
import {
  Text as RNText,
  TextStyle,
  StyleSheet,
  StyleProp,
} from 'react-native';
import { colors, textStyles } from '../../theme';

interface TextProps {
  children: React.ReactNode;
  variant?: keyof typeof textStyles;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onPress?: () => void;
}

export const Text: React.FC<TextProps> = ({
  children,
  variant = 'bodyMedium',
  color,
  style,
  numberOfLines,
  onPress,
}) => {
  const textStyle: StyleProp<TextStyle> = [
    styles.base,
    textStyles[variant],
    color ? { color } : undefined,
    style,
  ];

  return (
    <RNText
      style={textStyle}
      numberOfLines={numberOfLines}
      onPress={onPress}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    color: colors.text.primary,
  },
});

export default Text; 