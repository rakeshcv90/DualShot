import { moderateScale } from 'react-native-size-matters';

export const LIGHT_COLORS = {
  primary: '#f97316',
  secondary: '#38bdf8',
  background: '#f8fafc',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#0f172a',
  mutedText: '#64748b',
  border: '#e2e8f0',
  white: '#FFFFFF',
  grey: '#94a3b8',
  buttonBg: '#0f172a',
  buttonText: '#FFFFFF',
};

export const DARK_COLORS = {
  primary: '#f97316',
  secondary: '#38bdf8',
  background: '#000000',
  surface: '#121212',
  card: '#161616',
  text: '#FFFFFF',
  mutedText: '#94a3b8',
  border: '#1f2937',
  white: '#FFFFFF',
  grey: '#94a3b8',
  buttonBg: '#f1f5f9',
  buttonText: '#000000',
};

// Keeping this for backward compatibility during transition
export const COLORS = DARK_COLORS;

export const FONTS = {
  bold: 'System',
  semiBold: 'System',
  medium: 'System',
  regular: 'System',
};

export const SPACING = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(16),
  lg: moderateScale(24),
  xl: moderateScale(32),
  xxl: moderateScale(48),
};
