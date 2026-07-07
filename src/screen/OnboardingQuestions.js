import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  setSelectedQ1,
  setSelectedQ2,
  setOnboardingDone,
} from '../redux/slices/onboardingSlice';
import { moderateScale } from 'react-native-size-matters';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  requestNotifications,
  checkNotifications,
  openSettings,
} from 'react-native-permissions';
import { DARK_COLORS as colors, COLORS, SPACING } from '../theme/theme';
import CustomText from '../component/CustomText';
import CustomButton from '../component/CustomButton';
import Container from '../component/Container';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from '../hooks/useTranslation';
const isDark = true;

// QUESTIONS moved inside component for localization parity

const OnboardingQuestions = ({ navigation }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { selectedQ1, selectedQ2 } = useSelector(state => state.onboarding);

  const QUESTIONS = [
    {
      id: 'q1',
      question: t('question1Title'),
      subtext: t('question1Subtext'),
      options: [
        {
          id: 'yt',
          title: t('ytTitle'),
          desc: t('ytDesc'),
          iconFamily: 'FontAwesome5',
          iconName: 'youtube',
          iconColor: '#FF0000',
        },
        {
          id: 'tk',
          title: t('tkTitle'),
          desc: t('tkDesc'),
          iconFamily: 'FontAwesome5',
          iconName: 'tiktok',
          iconColor: '#FFFFFF',
        },
        {
          id: 'pod',
          title: t('podTitle'),
          desc: t('podDesc'),
          iconFamily: 'MaterialCommunityIcons',
          iconName: 'microphone',
          iconColor: '#A78BFA',
        },
        {
          id: 'else',
          title: t('elseTitle'),
          desc: t('elseDesc'),
          iconFamily: 'Ionicons',
          iconName: 'sparkles',
          iconColor: '#FBBF24',
        },
      ],
    },
    {
      id: 'q2',
      question: t('question2Title'),
      subtext: t('question2Subtext'),
      options: [
        {
          id: 'tiktok',
          title: t('tiktokTitle'),
          desc: t('tiktokDesc'),
          iconFamily: 'FontAwesome5',
          iconName: 'tiktok',
          iconColor: '#FFFFFF',
        },
        {
          id: 'insta',
          title: t('instaTitle'),
          desc: t('instaDesc'),
          iconFamily: 'FontAwesome5',
          iconName: 'instagram',
          iconColor: '#E1306C',
        },
        {
          id: 'youtube',
          title: t('youtubeTitle'),
          desc: t('youtubeDesc'),
          iconFamily: 'FontAwesome5',
          iconName: 'youtube',
          iconColor: '#FF0000',
        },
        {
          id: 'other',
          title: t('otherTitle'),
          desc: t('otherDesc'),
          iconFamily: 'Ionicons',
          iconName: 'globe-outline',
          iconColor: '#60A5FA',
        },
      ],
    },
  ];
  const [currentStep, setCurrentStep] = useState(0);
  const [permissions, setPermissions] = useState({
    camera: false,
    microphone: false,
    photos: false,
  });
  const [loadingPermission, setLoadingPermission] = useState(null);
  const [setupStep, setSetupStep] = useState(0);
  const [isSetupFinished, setIsSetupFinished] = useState(false);
  const [isNotificationGranted, setIsNotificationGranted] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTargetStep, setAlertTargetStep] = useState(2);
  const [blockedPermission, setBlockedPermission] = useState(null);

  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateX = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const fadeStep = (callback, direction = 'forward') => {
    const exitX = direction === 'forward' ? -30 : 30;
    const enterX = direction === 'forward' ? 30 : -30;

    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(stepTranslateX, {
        toValue: exitX,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      stepTranslateX.setValue(enterX);

      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(stepOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(stepTranslateX, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  };

  React.useEffect(() => {
    if (currentStep === 4) {
      setSetupStep(0);
      setIsSetupFinished(false);

      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ).start();

      let step = 0;
      const interval = setInterval(() => {
        step += 1;
        setSetupStep(step);
        if (step >= 4) {
          clearInterval(interval);
          setTimeout(() => setIsSetupFinished(true), 500);
        }
      }, 1200);
      return () => {
        clearInterval(interval);
        rotateAnim.setValue(0);
      };
    }
  }, [currentStep]);

  React.useEffect(() => {
    if (currentStep === 2 || currentStep === 3) {
      checkAllPermissions();
    }
  }, [currentStep]);

  const checkAllPermissions = async () => {
    const types = ['camera', 'microphone', 'photos'];
    for (const type of types) {
      let permissionType;
      if (Platform.OS === 'android') {
        if (type === 'camera') permissionType = PERMISSIONS.ANDROID.CAMERA;
        if (type === 'microphone')
          permissionType = PERMISSIONS.ANDROID.RECORD_AUDIO;
        if (type === 'photos') {
          permissionType =
            Platform.Version >= 33
              ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
              : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
        }
      } else {
        if (type === 'camera') permissionType = PERMISSIONS.IOS.CAMERA;
        if (type === 'microphone') permissionType = PERMISSIONS.IOS.MICROPHONE;
        if (type === 'photos') permissionType = PERMISSIONS.IOS.PHOTO_LIBRARY;
      }

      if (permissionType) {
        const result = await check(permissionType);
        if (result === RESULTS.GRANTED) {
          setPermissions(prev => ({ ...prev, [type]: true }));
        }
      }
    }

    try {
      const notifStatus = await checkNotifications();
      if (notifStatus.status === RESULTS.GRANTED) {
        setIsNotificationGranted(true);
      }
    } catch (e) {}
  };

  const finishOnboarding = () => {
    dispatch(setOnboardingDone(true));
    navigation.replace('Home');
  };

  const handleNext = () => {
    if (!isStepComplete()) {
      return;
    }
    if (currentStep < 4) {
      fadeStep(() => setCurrentStep(currentStep + 1), 'forward');
    } else {
      finishOnboarding();
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const result = await requestNotifications(['alert', 'sound', 'badge']);
      console.log('Notification permission result:', result);
    } catch (error) {
      console.log('Notification permission error:', error);
    } finally {
      handleNext();
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      navigation.goBack();
    } else {
      fadeStep(() => setCurrentStep(currentStep - 1), 'back');
    }
  };

  const toggleQ2 = id => {
    const newSelected = selectedQ2.includes(id)
      ? selectedQ2.filter(x => x !== id)
      : [...selectedQ2, id];
    dispatch(setSelectedQ2(newSelected));
  };

  const requestPermission = async type => {
    let permissionType;
    if (Platform.OS === 'android') {
      if (type === 'camera') permissionType = PERMISSIONS.ANDROID.CAMERA;
      if (type === 'microphone')
        permissionType = PERMISSIONS.ANDROID.RECORD_AUDIO;
      if (type === 'photos') {
        if (Platform.Version >= 33) {
          permissionType = PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;
        } else {
          permissionType = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
        }
      }
    } else {
      if (type === 'camera') permissionType = PERMISSIONS.IOS.CAMERA;
      if (type === 'microphone') permissionType = PERMISSIONS.IOS.MICROPHONE;
      if (type === 'photos') permissionType = PERMISSIONS.IOS.PHOTO_LIBRARY;
    }

    if (!permissionType) return;
    setLoadingPermission(type);

    try {
      // If already permanently denied, the OS will not show its native
      // prompt again on either platform — request() would just resolve
      // straight to BLOCKED. Send the user to Settings instead.
      const currentStatus = await check(permissionType);
      const result =
        currentStatus === RESULTS.BLOCKED
          ? currentStatus
          : await request(permissionType);

      if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
        setPermissions(prev => ({ ...prev, [type]: true }));
      } else if (result === RESULTS.BLOCKED || result === RESULTS.UNAVAILABLE) {
        setBlockedPermission(type);
      }
    } catch (error) {
      console.log('Permission error:', error);
    } finally {
      setLoadingPermission(null);
    }
  };

  const permissionLabel = type => {
    if (type === 'camera') return t('permissionCamera');
    if (type === 'microphone') return t('permissionAudio');
    if (type === 'photos') return t('permissionStorage');
    return '';
  };

  const handleOpenSettings = () => {
    setBlockedPermission(null);
    openSettings().catch(() => {});
  };

  const renderQuestion = (questionData, isMulti = false) => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <CustomText style={[styles.stepIndicator, { color: colors.mutedText }]}>
        QUESTION {currentStep + 1} OF 2
      </CustomText>
      <CustomText
        variant="h1"
        style={[styles.mainTitle, { color: colors.text }]}
      >
        {questionData.question}
      </CustomText>
      <CustomText style={[styles.subtext, { color: colors.mutedText }]}>
        {questionData.subtext}
      </CustomText>

      <View style={styles.optionsList}>
        {questionData.options.map(opt => {
          const isSelected = isMulti
            ? selectedQ2.includes(opt.id)
            : selectedQ1 === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.optionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                isSelected && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              onPress={() =>
                isMulti ? toggleQ2(opt.id) : dispatch(setSelectedQ1(opt.id))
              }
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9' },
                ]}
              >
                {opt.iconFamily === 'FontAwesome5' && (
                  <FontAwesome5
                    name={opt.iconName}
                    size={moderateScale(18, 0.3)}
                    color={
                      opt.iconColor === '#FFFFFF' || opt.iconColor === '#ffffff'
                        ? colors.text
                        : opt.iconColor
                    }
                  />
                )}
                {opt.iconFamily === 'Ionicons' && (
                  <Ionicons
                    name={opt.iconName}
                    size={moderateScale(18, 0.3)}
                    color={
                      opt.iconColor === '#FFFFFF' || opt.iconColor === '#ffffff'
                        ? colors.text
                        : opt.iconColor
                    }
                  />
                )}
                {opt.iconFamily === 'MaterialCommunityIcons' && (
                  <MaterialCommunityIcons
                    name={opt.iconName}
                    size={moderateScale(18, 0.3)}
                    color={
                      opt.iconColor === '#FFFFFF' || opt.iconColor === '#ffffff'
                        ? colors.text
                        : opt.iconColor
                    }
                  />
                )}
              </View>

              <View style={styles.textDetails}>
                <CustomText
                  style={[styles.optionTitle, { color: colors.text }]}
                >
                  {opt.title}
                </CustomText>
                <CustomText
                  style={[styles.optionDesc, { color: colors.mutedText }]}
                >
                  {opt.desc}
                </CustomText>
              </View>

              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.border },
                  isSelected && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                {isSelected && (
                  <CustomText
                    style={[styles.checkMark, { color: colors.white }]}
                  >
                    ✓
                  </CustomText>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderPermissions = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topIconCircle}>
        <CustomText style={{ fontSize: moderateScale(40) }}>📹</CustomText>
      </View>
      <CustomText
        variant="h1"
        style={[styles.mainTitle, { color: colors.text }]}
      >
        {t('readyToRecord')}
      </CustomText>
      <CustomText style={[styles.subtext, { color: colors.mutedText }]}>
        {t('readyToRecordDesc')}
      </CustomText>

      <View style={styles.optionsList}>
        {[
          {
            id: 'camera',
            name: t('permissionCamera'),
            desc: t('permissionCameraDesc'),
            icon: '📷',
          },
          {
            id: 'microphone',
            name: t('permissionAudio'),
            desc: t('permissionAudioDesc'),
            icon: '🎙️',
          },
          {
            id: 'photos',
            name: t('permissionStorage'),
            desc: t('permissionStorageDesc'),
            icon: '🖼️',
          },
        ].map(p => (
          <View
            key={p.id}
            style={[
              styles.permissionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              permissions[p.id] && { borderColor: '#34C759' },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9' },
              ]}
            >
              <CustomText>{p.icon}</CustomText>
            </View>
            <View style={styles.textDetails}>
              <CustomText style={[styles.optionTitle, { color: colors.text }]}>
                {p.name}
              </CustomText>
              <CustomText
                style={[styles.optionDesc, { color: colors.mutedText }]}
              >
                {p.desc}
              </CustomText>
            </View>
            {permissions[p.id] ? (
              <View style={[styles.tickCircle, { backgroundColor: '#34C759' }]}>
                <Ionicons
                  name="checkmark"
                  size={moderateScale(16, 0.3)}
                  color={colors.white}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.allowBtn,
                  { backgroundColor: colors.primary },
                  loadingPermission === p.id && { opacity: 0.7 },
                ]}
                onPress={() => requestPermission(p.id)}
                disabled={loadingPermission === p.id}
              >
                {loadingPermission === p.id ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <CustomText
                    style={[styles.allowBtnText, { color: colors.white }]}
                  >
                    Allow
                  </CustomText>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
      <CustomText
        style={[
          styles.hint,
          { color: colors.mutedText, marginBottom: SPACING.xl },
        ]}
      >
        {t('tapContinue')}
      </CustomText>
    </ScrollView>
  );

  const renderSetup = () => {
    const creatorType =
      QUESTIONS[0].options
        .find(opt => opt.id === selectedQ1)
        ?.title.split(' ')[0] || 'Content';

    // Improved platform text logic to prevent extreme length
    let platformList = selectedQ2.map(
      id => QUESTIONS[1].options.find(opt => opt.id === id)?.title,
    );
    if (platformList.length > 2) {
      platformList = [...platformList.slice(0, 2), 'More'];
    }
    const platforms = platformList.join(' & ') || 'Social';

    const setupItems = [
      t('cameraConnected'),
      t('dualConfigured'),
      `${creatorType} & ${platforms} ${t('workflowSet')}`,
      t('ready4k'),
    ];

    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={[styles.scrollContent, { flex: 1, alignItems: 'center' }]}>
        <View
          style={[
            styles.setupMainCircle,
            { backgroundColor: colors.card, borderColor: colors.border },
            isSetupFinished && {
              borderColor: '#34C759',
              backgroundColor: '#34C759',
            },
          ]}
        >
          {isSetupFinished ? (
            <Ionicons
              name="checkmark"
              size={moderateScale(50, 0.3)}
              color={colors.white}
            />
          ) : (
            <Animated.View
              style={[
                styles.setupSpinner,
                { borderColor: colors.primary, transform: [{ rotate: spin }] },
              ]}
            >
              <View
                style={[styles.spinnerDot, { backgroundColor: colors.primary }]}
              />
            </Animated.View>
          )}
        </View>

        <View style={styles.setupTextContainer}>
          <CustomText
            variant="h1"
            style={[
              styles.mainTitle,
              { textAlign: 'center', color: colors.text },
            ]}
          >
            {t('readyToShoot')}
          </CustomText>
          <CustomText
            variant="h1"
            style={[
              styles.mainTitle,
              {
                textAlign: 'center',
                color: colors.primary,
                marginTop: -moderateScale(5, 0.3),
              },
            ]}
          >
            {creatorType} videos.
          </CustomText>

          <CustomText
            style={[
              styles.subtext,
              {
                textAlign: 'center',
                marginTop: moderateScale(4, 0.3),
                color: colors.mutedText,
              },
            ]}
          >
            {t('readyToShootDesc')}
          </CustomText>
        </View>

        <View style={[styles.optionsList, { width: '100%' }]}>
          {setupItems.map((item, index) => {
            const isDone = setupStep > index;
            const isProcessing = setupStep === index;

            return (
              <View
                key={index}
                style={[
                  styles.setupItem,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isDone && { borderColor: '#34C759' },
                  !isDone && !isProcessing && { opacity: 0.3 },
                ]}
              >
                <View
                  style={[
                    styles.setupTick,
                    { borderColor: colors.border },
                    isDone && {
                      backgroundColor: '#34C759',
                      borderColor: '#34C759',
                    },
                  ]}
                >
                  {isDone ? (
                    <Ionicons
                      name="checkmark"
                      size={moderateScale(14, 0.3)}
                      color={colors.white}
                    />
                  ) : isProcessing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View
                      style={[
                        styles.setupDot,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}
                </View>
                <CustomText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.setupText,
                    { flex: 1, color: colors.mutedText },
                    isDone && { color: colors.text },
                  ]}
                >
                  {item}
                </CustomText>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderNotifications = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { justifyContent: 'center', alignItems: 'center', flexGrow: 1 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.notifCircle}>
        <CustomText style={{ fontSize: moderateScale(50) }}>🔔</CustomText>
      </View>
      <CustomText
        variant="h1"
        style={[styles.mainTitle, { textAlign: 'center', color: colors.text }]}
      >
        {t('neverMissRender')}
      </CustomText>
      <CustomText
        style={[
          styles.subtext,
          { textAlign: 'center', color: colors.mutedText },
        ]}
      >
        {t('neverMissRenderDesc')}
      </CustomText>

      <View style={{ height: SPACING.xl }} />

      <CustomButton
        title={isNotificationGranted ? `${t('enabled')} ✓` : t('notifications')}
        onPress={isNotificationGranted ? handleNext : handleEnableNotifications}
        style={
          isNotificationGranted
            ? [{ backgroundColor: '#34C759' }]
            : { backgroundColor: colors.text }
        }
        textStyle={{
          color: isNotificationGranted ? colors.white : colors.background,
          fontWeight: '700',
        }}
      />
      <TouchableOpacity onPress={handleNext} style={styles.notNowBtn}>
        <CustomText style={[styles.notNowText, { color: colors.mutedText }]}>
          {isNotificationGranted ? t('continue') : t('notNow')}
        </CustomText>
      </TouchableOpacity>
    </ScrollView>
  );

  const isStepComplete = () => {
    if (currentStep === 0) return !!selectedQ1;
    if (currentStep === 1) return selectedQ2.length > 0;
    if (currentStep === 2) {
      return permissions.camera && permissions.microphone && permissions.photos;
    }
    if (currentStep === 4) return isSetupFinished;
    return true;
  };

  return (
    <Container edges={['top', 'bottom', 'left', 'right']} backgroundColor={colors.background}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons
            name="chevron-back"
            size={moderateScale(24, 0.3)}
            color={colors.text}
          />
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          {[0, 1, 2, 3, 4].map(i => (
            <View
              key={i}
              style={[
                styles.segment,
                { backgroundColor: colors.border },
                i <= currentStep && { backgroundColor: colors.primary },
              ]}
            />
          ))}
        </View>
        <View style={{ width: moderateScale(40) }} />
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: stepOpacity,
          transform: [{ translateX: stepTranslateX }],
        }}
      >
        {currentStep === 0 && renderQuestion(QUESTIONS[0])}
        {currentStep === 1 && renderQuestion(QUESTIONS[1], true)}
        {currentStep === 2 && renderPermissions()}
        {currentStep === 3 && renderNotifications()}
        {currentStep === 4 && renderSetup()}
      </Animated.View>

      {currentStep < 5 && (
        <View
          style={[
            styles.footer,
            { borderTopWidth: isDark ? 0 : 1, borderTopColor: colors.border },
          ]}
        >
          <CustomButton
            title={t('continue')}
            onPress={handleNext}
            disabled={!isStepComplete()}
            style={
              isStepComplete()
                ? { backgroundColor: colors.text }
                : { backgroundColor: colors.border }
            }
            textStyle={
              isStepComplete()
                ? { color: colors.background }
                : { color: colors.mutedText }
            }
            icon={
              <CustomText
                style={[
                  styles.btnArrow,
                  {
                    color: isStepComplete()
                      ? colors.background
                      : colors.mutedText,
                  },
                ]}
              >
                {' '}
                →
              </CustomText>
            }
          />
        </View>
      )}

      {/* Custom Setup Alert Modal */}
      <Modal visible={showAlertModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: isDark ? 0 : 1,
              },
            ]}
          >
            <View style={styles.modalIconWrap}>
              <CustomText style={{ fontSize: moderateScale(28) }}>
                ⚠️
              </CustomText>
            </View>
            <CustomText style={[styles.modalTitle, { color: colors.text }]}>
              {t('setupIncomplete')}
            </CustomText>
            <CustomText
              style={[styles.modalSubtext, { color: colors.mutedText }]}
            >
              {t('setupIncompleteDesc')}
            </CustomText>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9' },
                ]}
                onPress={() => setShowAlertModal(false)}
                activeOpacity={0.7}
              >
                <CustomText
                  style={[styles.modalCancelText, { color: colors.text }]}
                >
                  {t('dismiss')}
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  setShowAlertModal(false);
                  fadeStep(() => setCurrentStep(alertTargetStep), 'forward');
                }}
                activeOpacity={0.7}
              >
                <CustomText
                  style={[styles.modalConfirmText, { color: colors.white }]}
                >
                  Take me there
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Blocked Permission Modal */}
      <Modal visible={!!blockedPermission} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: isDark ? 0 : 1,
              },
            ]}
          >
            <View style={styles.modalIconWrap}>
              <CustomText style={{ fontSize: moderateScale(28) }}>
                🔒
              </CustomText>
            </View>
            <CustomText style={[styles.modalTitle, { color: colors.text }]}>
              {permissionLabel(blockedPermission)} {t('permissionBlockedTitle')}
            </CustomText>
            <CustomText
              style={[styles.modalSubtext, { color: colors.mutedText }]}
            >
              {t('permissionBlockedDesc')}
            </CustomText>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9' },
                ]}
                onPress={() => setBlockedPermission(null)}
                activeOpacity={0.7}
              >
                <CustomText
                  style={[styles.modalCancelText, { color: colors.text }]}
                >
                  {t('notNow')}
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleOpenSettings}
                activeOpacity={0.7}
              >
                <CustomText
                  style={[styles.modalConfirmText, { color: colors.white }]}
                >
                  {t('openSettings')}
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20, 0.3),
    paddingTop: moderateScale(12, 0.3),
  },
  progressContainer: {
    flexDirection: 'row',
    flex: 1,
    marginHorizontal: moderateScale(16, 0.3),
  },
  segment: {
    flex: 1,
    height: moderateScale(3, 0.3),
    backgroundColor: '#333',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  segmentActive: { backgroundColor: COLORS.white },
  navIcon: {
    fontSize: moderateScale(20, 0.3),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  skipBtn: {
    fontSize: moderateScale(16, 0.3),
    fontWeight: '600',
    color: COLORS.white,
  },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: moderateScale(20, 0.3),
    paddingTop: moderateScale(24, 0.3),
    paddingBottom: moderateScale(16, 0.3),
  },
  stepIndicator: {
    color: '#666',
    fontSize: moderateScale(11, 0.3),
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: moderateScale(12, 0.3),
  },

  mainTitle: {
    textAlign: 'left',
    marginBottom: moderateScale(4, 0.3),
    fontSize: moderateScale(28, 0.3),
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  subtext: {
    color: '#888',
    textAlign: 'left',
    fontSize: moderateScale(14, 0.3),
    marginBottom: moderateScale(24, 0.3),
    lineHeight: moderateScale(20, 0.3),
    fontWeight: '500',
  },

  optionsList: { marginTop: moderateScale(4, 0.3) },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingVertical: moderateScale(14, 0.3),
    paddingHorizontal: moderateScale(14, 0.3),
    borderRadius: moderateScale(16, 0.3),
    marginBottom: moderateScale(10, 0.3),
    borderWidth: 1.5,
    borderColor: '#1a1a1a',
  },
  selectedOption: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255, 122, 0, 0.08)',
  },
  iconBox: {
    width: moderateScale(42, 0.3),
    height: moderateScale(42, 0.3),
    backgroundColor: '#1a1a1a',
    borderRadius: moderateScale(12, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12, 0.3),
  },
  emoji: { fontSize: moderateScale(20, 0.3) },
  textDetails: { flex: 1 },
  optionTitle: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: moderateScale(15, 0.3),
  },
  optionDesc: {
    color: '#666',
    fontSize: moderateScale(12, 0.3),
    marginTop: 2,
    fontWeight: '500',
  },

  radioCircle: {
    width: moderateScale(22, 0.3),
    height: moderateScale(22, 0.3),
    borderRadius: moderateScale(11, 0.3),
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioActiveBg: { backgroundColor: COLORS.primary },

  checkbox: {
    width: moderateScale(22, 0.3),
    height: moderateScale(22, 0.3),
    borderRadius: moderateScale(6, 0.3),
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  checkMark: {
    color: COLORS.white,
    fontSize: moderateScale(11, 0.3),
    fontWeight: '900',
    marginTop: -1,
  },

  topIconCircle: {
    width: moderateScale(70, 0.3),
    height: moderateScale(70, 0.3),
    backgroundColor: '#111',
    borderRadius: moderateScale(35, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(24, 0.3),
    alignSelf: 'center',
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingVertical: moderateScale(14, 0.3),
    paddingHorizontal: moderateScale(14, 0.3),
    borderRadius: moderateScale(16, 0.3),
    marginBottom: moderateScale(10, 0.3),
  },
  permissionCardAllowed: {
    borderColor: '#4CAF50',
    borderWidth: 1.5,
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  tickCircle: {
    width: moderateScale(32, 0.3),
    height: moderateScale(32, 0.3),
    borderRadius: moderateScale(16, 0.3),
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allowBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(16, 0.3),
    paddingVertical: moderateScale(8, 0.3),
    borderRadius: moderateScale(20, 0.3),
  },
  allowedBtn: { backgroundColor: '#222' },
  allowBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: moderateScale(12, 0.3),
  },
  hint: {
    color: '#666',
    textAlign: 'center',
    marginTop: moderateScale(16, 0.3),
    fontSize: moderateScale(12, 0.3),
  },

  notifCircle: {
    width: moderateScale(90, 0.3),
    height: moderateScale(90, 0.3),
    backgroundColor: '#111',
    borderRadius: moderateScale(45, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(24, 0.3),
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  notNowBtn: {
    marginTop: moderateScale(16, 0.3),
    padding: moderateScale(12, 0.3),
  },
  notNowText: { color: '#666', fontSize: moderateScale(14, 0.3) },

  setupMainCircle: {
    width: moderateScale(80, 0.3),
    height: moderateScale(80, 0.3),
    backgroundColor: '#111',
    borderRadius: moderateScale(40, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: moderateScale(0, 0.3),
    borderWidth: 2,
    borderColor: '#333',
  },
  setupMainCircleActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#1B2E1D',
  },
  setupSpinner: {
    width: moderateScale(70, 0.3),
    height: moderateScale(70, 0.3),
    borderRadius: moderateScale(35, 0.3),
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: COLORS.primary,
    borderRightColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    top: 5,
  },
  setupTextContainer: {
    marginVertical: moderateScale(8, 0.3),
    alignItems: 'center',
  },
  setupPulse: {
    width: moderateScale(60, 0.3),
    height: moderateScale(60, 0.3),
    borderRadius: moderateScale(30, 0.3),
    backgroundColor: 'rgba(255, 122, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  setupPulseInner: {
    width: moderateScale(8, 0.3),
    height: moderateScale(8, 0.3),
    borderRadius: moderateScale(4, 0.3),
    backgroundColor: COLORS.primary,
  },
  setupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: moderateScale(12, 0.3),
    borderRadius: moderateScale(16, 0.3),
    marginBottom: moderateScale(10, 0.3),
    borderWidth: 1,
    borderColor: '#222',
  },
  setupItemDone: {
    borderColor: 'rgba(76, 175, 80, 0.3)',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  setupTick: {
    width: moderateScale(24, 0.3),
    height: moderateScale(24, 0.3),
    borderRadius: moderateScale(12, 0.3),
    borderWidth: 1.5,
    borderColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12, 0.3),
  },
  setupTickActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  setupDot: {
    width: moderateScale(4, 0.3),
    height: moderateScale(4, 0.3),
    borderRadius: 2,
    backgroundColor: '#444',
  },
  setupText: {
    color: '#888',
    fontSize: moderateScale(14, 0.3),
    fontWeight: '600',
  },

  footer: {
    paddingHorizontal: moderateScale(20, 0.3),
    paddingBottom: moderateScale(30, 0.3),
  },
  whiteButton: {
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(28, 0.3),
    height: moderateScale(52, 0.3),
    justifyContent: 'center',
  },
  grayButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: moderateScale(28, 0.3),
    height: moderateScale(52, 0.3),
    justifyContent: 'center',
  },
  btnArrow: { fontSize: moderateScale(18, 0.3), fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(30),
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: moderateScale(24),
    padding: moderateScale(24),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalIconWrap: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  modalTitle: {
    color: '#FFFFFFFF',
    fontSize: moderateScale(18),
    fontWeight: '700',
    marginBottom: moderateScale(8),
    textAlign: 'center',
  },
  modalSubtext: {
    color: '#888',
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
    marginBottom: moderateScale(24),
    textAlign: 'center',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: moderateScale(12),
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#aaa',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1.2,
    backgroundColor: '#FFFFFFFF',
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#000000',
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
});

export default OnboardingQuestions;
