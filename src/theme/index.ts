import { colors } from './colors';
import { typography, textStyles } from './typography';
import { spacing, radius, dimensions, shadows } from './spacing';

export const theme = {
  colors,
  typography,
  textStyles,
  spacing,
  radius,
  dimensions,
  shadows,
} as const;

// Export individual modules for direct import
export { colors } from './colors';
export { typography, textStyles } from './typography';
export { spacing, radius, dimensions, shadows } from './spacing';

// Theme type for TypeScript
export type Theme = typeof theme;

// Common style utilities
export const globalStyles = {
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  
  screenPadding: {
    paddingHorizontal: spacing.lg,
  },
  
  centerContent: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  
  column: {
    flexDirection: 'column' as const,
  },
  
  spaceBetween: {
    justifyContent: 'space-between' as const,
  },
  
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  
  input: {
    height: dimensions.button.medium.height,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.primary,
    ...textStyles.bodyMedium,
    color: colors.text.primary,
  },
} as const; 