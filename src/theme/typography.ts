import { TextStyle } from 'react-native';

export const typography = {
  // Font Families
  fontFamily: {
    regular: 'System', // Default system font
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  
  // Font Sizes
  fontSize: {
    xs: 12,    // Caption
    sm: 14,    // Body Small
    base: 16,  // Body Medium
    lg: 18,    // Body Large
    xl: 20,    // Headline 3
    '2xl': 24, // Headline 2
    '3xl': 32, // Headline 1
  },
  
  // Line Heights
  lineHeight: {
    xs: 16,    // 12px font
    sm: 20,    // 14px font
    base: 24,  // 16px font
    lg: 28,    // 18px font
    xl: 28,    // 20px font
    '2xl': 32, // 24px font
    '3xl': 40, // 32px font
  },
  
  // Font Weights
  fontWeight: {
    normal: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
  },
} as const;

// Pre-defined text styles based on Phase 4 specifications
export const textStyles = {
  // Headlines
  h1: {
    fontSize: typography.fontSize['3xl'], // 32px
    lineHeight: typography.lineHeight['3xl'], // 40px
    fontWeight: typography.fontWeight.bold,
  },
  h2: {
    fontSize: typography.fontSize['2xl'], // 24px
    lineHeight: typography.lineHeight['2xl'], // 32px
    fontWeight: typography.fontWeight.bold,
  },
  h3: {
    fontSize: typography.fontSize.xl, // 20px
    lineHeight: typography.lineHeight.xl, // 28px
    fontWeight: typography.fontWeight.semibold,
  },
  
  // Body Text
  bodyLarge: {
    fontSize: typography.fontSize.lg, // 18px
    lineHeight: typography.lineHeight.lg, // 28px
    fontWeight: typography.fontWeight.normal,
  },
  bodyMedium: {
    fontSize: typography.fontSize.base, // 16px
    lineHeight: typography.lineHeight.base, // 24px
    fontWeight: typography.fontWeight.normal,
  },
  bodySmall: {
    fontSize: typography.fontSize.sm, // 14px
    lineHeight: typography.lineHeight.sm, // 20px
    fontWeight: typography.fontWeight.normal,
  },
  
  // Caption
  caption: {
    fontSize: typography.fontSize.xs, // 12px
    lineHeight: typography.lineHeight.xs, // 16px
    fontWeight: typography.fontWeight.normal,
  },
  
  // Button Text
  buttonLarge: {
    fontSize: typography.fontSize.base, // 16px
    lineHeight: typography.lineHeight.base, // 24px
    fontWeight: typography.fontWeight.semibold,
  },
  buttonMedium: {
    fontSize: typography.fontSize.sm, // 14px
    lineHeight: typography.lineHeight.sm, // 20px
    fontWeight: typography.fontWeight.semibold,
  },
} as const;

export type TextStyleToken = typeof textStyles; 