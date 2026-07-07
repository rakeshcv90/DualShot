import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { LIGHT_COLORS, DARK_COLORS } from '../theme/theme';

export const useTheme = () => {
  const systemScheme = useColorScheme();
  const { themeMode } = useSelector(state => state.settings);

  // Determine current theme
  const isDark = themeMode === 'system' 
    ? systemScheme === 'dark' 
    : themeMode === 'dark';

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return {
    isDark,
    colors,
    themeMode,
  };
};
