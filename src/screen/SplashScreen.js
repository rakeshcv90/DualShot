import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Dimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import { moderateScale } from 'react-native-size-matters';
import { DARK_COLORS as colors, COLORS } from '../theme/theme';
import CustomText from '../component/CustomText';
import Container from '../component/Container';
import { useTranslation } from '../hooks/useTranslation';
const isDark = true;
import { storage } from '../storage/storage';

const { width } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { isOnboardingDone, isIntroDone } = useSelector(state => state.onboarding);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const translateYAnim = useRef(new Animated.Value(40)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bgPulse = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequence of animations for a "premium" feel
    Animated.stagger(200, [
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 25,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
      ]),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();

    // Progress bar animation (cannot use native driver for width)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3500,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.quad),
    }).start();

    // Background pulsing loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(bgPulse, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ]),
    ).start();

    // Shutter pulse loop for the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    const timer = setTimeout(() => {
      console.log('SplashScreen Navigation State:', { isOnboardingDone, isIntroDone });
      if (isOnboardingDone) {
        navigation.replace('Home');
      } else if (isIntroDone) {
        navigation.replace('OnboardingQuestions');
      } else {
        navigation.replace('Intro');
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [navigation, isOnboardingDone, isIntroDone]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '0deg'],
  });

  return (
    <Container center backgroundColor={colors.background}>
      {/* Dynamic Background Glows */}
      <Animated.View
        style={[
          styles.bgAura,
          {
            opacity: bgPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.05, 0.15],
            }),
            transform: [
              {
                scale: bgPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.2],
                }),
              },
            ],
          },
        ]}
      />
      <View style={styles.bgGlowContainer}>
        <Animated.View
          style={[
            styles.bgGlow,
            {
              backgroundColor: COLORS.primary,
              transform: [
                {
                  scale: bgPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.3],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bgGlowRight,
            {
              backgroundColor: COLORS.secondary,
              transform: [
                {
                  scale: bgPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.5],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: translateYAnim },
              { rotate: rotation },
            ],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={[styles.iconRing, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
            <Image
              source={require('../assets/images/playstore.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0.5, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <CustomText variant="logo" style={[styles.mainTitle, { color: colors.text }]}>
            DUALSHOT
          </CustomText>
          <View style={styles.badgeLine}>
            <View style={styles.dot} />
            <CustomText variant="caption" style={[styles.subtitle, { color: colors.mutedText }]}>
              {t('nextGenCamera')}
            </CustomText>
            <View style={styles.dot} />
          </View>
        </Animated.View>
      </Animated.View>

      {/* Modern Loader */}
      <View style={styles.footer}>
        <View style={[styles.loaderTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
          <Animated.View
            style={[
              styles.loaderBar,
              {
                backgroundColor: colors.primary,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          >
            <View style={styles.shimmer} />
          </Animated.View>
        </View>
        <CustomText style={[styles.loadingText, { color: colors.mutedText }]}>
          {t('initializing')}
        </CustomText>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  bgAura: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    backgroundColor: '#fff',
    zIndex: 0,
  },
  bgGlowContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  bgGlow: {
    position: 'absolute',
    width: moderateScale(300),
    height: moderateScale(300),
    borderRadius: moderateScale(150),
    opacity: 0.1,
    filter: 'blur(80px)',
  },
  bgGlowRight: {
    position: 'absolute',
    width: moderateScale(250),
    height: moderateScale(250),
    borderRadius: moderateScale(125),
    opacity: 0.15,
    top: '20%',
    left: '10%',
    filter: 'blur(60px)',
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  iconRing: {
    padding: moderateScale(4),
    borderRadius: moderateScale(30),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  logoImage: {
    width: moderateScale(120),
    height: moderateScale(120),
  },
  textContainer: {
    alignItems: 'center',
    marginTop: moderateScale(20),
  },
  mainTitle: {
    fontSize: moderateScale(32),
    letterSpacing: 4,
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(8),
    gap: moderateScale(10),
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.secondary,
  },
  subtitle: {
    letterSpacing: 3,
    fontWeight: '700',
    color: '#888',
    fontSize: moderateScale(10),
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: moderateScale(60),
    width: '70%',
    alignItems: 'center',
  },
  loaderTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: moderateScale(12),
  },
  loaderBar: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 2,
  },
  shimmer: {
    width: '50%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    position: 'absolute',
    right: 0,
  },
  loadingText: {
    color: '#444',
    fontSize: moderateScale(10),
    fontWeight: '600',
    letterSpacing: 1,
  },
});

export default SplashScreen;
