import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import { useDispatch } from 'react-redux';
import { setIntroDone } from '../redux/slices/onboardingSlice';
import { DARK_COLORS as colors, COLORS, SPACING } from '../theme/theme';
import CustomText from '../component/CustomText';
import CustomButton from '../component/CustomButton';
import Container from '../component/Container';
import { useTranslation } from '../hooks/useTranslation';

const { width } = Dimensions.get('window');

const IntroScreen = ({ navigation }) => {
  const { t } = useTranslation();
  
  const DATA = [
    {
      id: '1',
      title: t('intro1Title'),
      highlight: t('intro1Highlight'),
      description: t('intro1Desc'),
      image: require('../assets/images/intro_mockup.jpg'),
    },
    {
      id: '2',
      title: t('intro2Title'),
      highlight: t('intro2Highlight'),
      description: t('intro2Desc'),
      image: require('../assets/images/intro_mockup_security.jpg'),
    },
    {
      id: '3',
      title: t('intro3Title'),
      highlight: t('intro3Highlight'),
      description: t('intro3Desc'),
      image: require('../assets/images/intro_mockup_creators.jpg'),
    },
  ];
  const dispatch = useDispatch();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const handleSkip = useCallback(() => {
    dispatch(setIntroDone(true));
    navigation.replace('OnboardingQuestions');
  }, [dispatch, navigation]);

  const handleNext = useCallback(() => {
    if (currentIndex < DATA.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      dispatch(setIntroDone(true));
      navigation.replace('OnboardingQuestions');
    }
  }, [currentIndex, dispatch, navigation]);

  const renderImageItem = useCallback(
    ({ item }) => (
      <View style={styles.imageSlide}>
        <Image
          source={item.image}
          style={styles.mockupImage}
          resizeMode="contain"
        />
      </View>
    ),
    [],
  );

  return (
    <Container edges={['top', 'bottom', 'left', 'right']} backgroundColor={colors.background}>
      {/* Top Navigation */}
      <View style={styles.header}>
        <View style={styles.progressBarContainer}>
          {DATA.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                { backgroundColor: colors.border },
                index <= currentIndex && { backgroundColor: colors.primary },
              ]}
            />
          ))}
        </View>
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={DATA}
        renderItem={renderImageItem}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={item => item.id}
        decelerationRate="fast"
        style={styles.flatList}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      />

      {/* Text Section - Each slide text fades based on scroll */}
      <View style={styles.footer}>
        <View style={styles.textContainer}>
          {DATA.map((item, index) => {
            const inputRange = [
              (index - 0.5) * width,
              index * width,
              (index + 0.5) * width,
            ];

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });

            const translateY = scrollX.interpolate({
              inputRange,
              outputRange: [moderateScale(20), 0, moderateScale(20)],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={item.id}
                style={[
                  styles.textSlide,
                  {
                    opacity,
                    transform: [{ translateY }],
                  },
                ]}
                pointerEvents={index === currentIndex ? 'auto' : 'none'}
              >
                <CustomText variant="h1" style={[styles.title, { color: colors.text }]}>
                  {item.title}{' '}
                  <CustomText variant="h1" color={colors.primary}>
                    {item.highlight}
                  </CustomText>
                </CustomText>
                <CustomText style={[styles.description, { color: colors.mutedText }]}>
                  {item.description}
                </CustomText>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {/* Fixed Button */}
      <View style={styles.buttonContainer}>
        <CustomButton
          title={currentIndex === DATA.length - 1 ? t('getStarted') : t('next')}
          onPress={handleNext}
          style={styles.nextButton}
          icon={<CustomText style={[styles.arrow, { color: colors.buttonText }]}> →</CustomText>}
        />
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    zIndex: 10,
  },
  progressBarContainer: {
    flexDirection: 'row',
    flex: 1,
    marginRight: SPACING.xl,
  },
  progressSegment: {
    flex: 1,
    height: moderateScale(3),
    backgroundColor: '#333',
    marginHorizontal: moderateScale(2),
    borderRadius: moderateScale(2),
  },
  activeSegment: {
    backgroundColor: COLORS.white,
  },
  skipText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  imageSlide: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  mockupImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
    position: 'relative',
    minHeight: moderateScale(140), // Increased height to prevent cutting
  },
  textSlide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: moderateScale(4),
  },
  description: {
    textAlign: 'center',
    color: COLORS.mutedText,
    fontSize: moderateScale(15), // Slightly smaller font to fit better
    lineHeight: moderateScale(20),
    paddingHorizontal: SPACING.md,
  },
  buttonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: moderateScale(25),
    marginTop: SPACING.xs,
  },

  nextButton: {
    width: '100%',
  },
  arrow: {
    fontSize: moderateScale(20),
    fontWeight: 'bold',
    color: COLORS.buttonText,
  },
});

export default IntroScreen;
