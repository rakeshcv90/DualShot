import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import { useTheme } from '../hooks/useTheme';
import { COLORS } from '../theme/theme';

const CustomText = ({
  children,
  style,
  variant = 'regular',
  color,
  ...props
}) => {
  const { colors } = useTheme();
  const textColor = color || colors.text;

  const getStyle = () => {
    switch (variant) {
      case 'h1':
        return styles.h1;
      case 'h2':
        return styles.h2;
      case 'body':
        return styles.body;
      case 'caption':
        return [styles.caption, { color: colors.mutedText }];
      case 'bold':
        return styles.bold;
      case 'logo':
        return styles.logo;
      default:
        return styles.regular;
    }
  };

  return (
    <Text style={[getStyle(), { color: textColor }, style]} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontSize: moderateScale(42),
    fontWeight: '900',
    lineHeight: moderateScale(48),
  },
  h2: {
    fontSize: moderateScale(32),
    fontWeight: '800',
    lineHeight: moderateScale(38),
  },
  body: {
    fontSize: moderateScale(16),
    fontWeight: '400',
    lineHeight: moderateScale(24),
  },
  bold: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  caption: {
    fontSize: moderateScale(14),
    fontWeight: '400',
    color: COLORS.mutedText,
  },
  logo: {
    fontSize: moderateScale(48),
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  regular: {
    fontSize: moderateScale(16),
    fontWeight: '400',
  },
});

export default CustomText;
