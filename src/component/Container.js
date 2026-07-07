import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

const Container = ({
  children,
  style,
  scroll = false,
  center = false,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor,
  statusBarProps,
}) => {
  const { colors, isDark } = useTheme();
  const bg = backgroundColor || colors.background;
  const ContentWrapper = scroll ? ScrollView : View;
  
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]} edges={edges}>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={bg} 
        {...statusBarProps} 
      />
      <ContentWrapper 
        style={[
          styles.container, 
          center && styles.center, 
          style,
          { backgroundColor: bg }
        ]}
        contentContainerStyle={scroll ? [styles.scrollContent, center && styles.center, { backgroundColor: bg }] : undefined}
      >
        {children}
      </ContentWrapper>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Container;
