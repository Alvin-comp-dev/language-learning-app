export const spacing = {
  // Base spacing unit (4px)
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
  '7xl': 80,
  '8xl': 96,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const dimensions = {
  // Screen dimensions (will be dynamic in practice)
  screen: {
    width: 375, // iPhone base width
    height: 812, // iPhone base height
  },
  
  // Component dimensions
  button: {
    small: {
      height: 36,
      minWidth: 80,
    },
    medium: {
      height: 44,
      minWidth: 120,
    },
    large: {
      height: 52,
      minWidth: 160,
    },
  },
  
  // Touch targets
  touchTarget: {
    minimum: 44, // iOS HIG minimum
    comfortable: 48,
  },
  
  // Icons
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    '2xl': 40,
    '3xl': 48,
  },
  
  // Headers
  header: {
    height: 56,
    heightLarge: 64,
  },
  
  // Cards
  card: {
    minHeight: 120,
    defaultPadding: spacing.lg,
  },
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
} as const;

export type SpacingToken = typeof spacing;
export type RadiusToken = typeof radius;
export type DimensionsToken = typeof dimensions;
export type ShadowToken = typeof shadows; 