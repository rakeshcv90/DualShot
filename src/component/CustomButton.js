import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import { COLORS, SPACING } from '../theme/theme';

import { useTheme } from '../hooks/useTheme';

const CustomButton = ({ title, onPress, style, textStyle, variant = 'primary', icon }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'primary' 
          ? { backgroundColor: colors.buttonBg } 
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.grey },
        style
      ]}
    >
      <Text style={[styles.text, { color: colors.buttonText }, textStyle]}>{title}</Text>
      {icon && icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  text: {
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
});

export default CustomButton;

