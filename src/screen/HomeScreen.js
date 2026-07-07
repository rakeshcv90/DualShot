import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Image,
  Animated,
  Platform,
  Modal,
  Alert,
  Linking,
  AppState,
  PanResponder,
  BackHandler,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { COLORS } from '../theme/theme';
import CustomText from '../component/CustomText';
import { useTranslation } from '../hooks/useTranslation';
import ProcessingOverlay from '../component/ProcessingOverlay';
import {
  DualCameraMainView,
  DualCameraPipView,
  useDualCamera,
} from '../component/DualCameraView';
import MediaToolkit from 'react-native-media-toolkit';
import { loadImage } from 'react-native-nitro-image';
// import PaywallModal from '../component/PaywallModal';

const { width, height } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { resolution, fps, fileFormat } = useSelector(state => state.settings);
  const [mode, setMode] = useState('video');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('back');
  const [flashMode, setFlashMode] = useState('off');
  const [timer, setTimer] = useState(0);
  const [lastMedia, setLastMedia] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [portraitDone, setPortraitDone] = useState(false);
  const [landscapeDone, setLandscapeDone] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const [pipSize, setPipSize] = useState(1);
  const [cameraReady, setCameraReady] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, gestureState) => {
        // Only capture if the user actually moves their finger significantly
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    }),
  ).current;

  const PIP_SIZES = [
    { w: moderateScale(110) },
    { w: moderateScale(150) },
    { w: moderateScale(200) },
  ];

  const currentPip = PIP_SIZES[pipSize];

  const timerRef = useRef(null);
  const recordPulse = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const dualCamera = useDualCamera();

  // Open camera on mount
  useEffect(() => {
    dualCamera.openCamera(cameraPosition, { resolution, fps });
    setCameraReady(true);

    return () => {
      dualCamera.closeCamera();
    };
  }, []);

  // Handle Back Button for Exit
  useEffect(() => {
    const backAction = () => {
      if (navigation.isFocused()) {
        setShowExitModal(true);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [navigation]);

  // Restart camera when app returns from background (e.g. after opening gallery)
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const handleAppState = nextState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        // App returned to foreground - restart camera
        dualCamera.closeCamera();
        setTimeout(() => {
          dualCamera.openCamera(cameraPosition);
        }, 300);
      }
      appStateRef.current = nextState;
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [cameraPosition]);

  // Update camera when settings change
  useEffect(() => {
    if (cameraReady) {
      dualCamera.openCamera(cameraPosition, { resolution, fps });
    }
  }, [resolution, fps, cameraPosition, cameraReady]);

  // Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimer(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Pulse animation
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordPulse, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(recordPulse, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      recordPulse.setValue(1);
    }
  }, [isRecording]);

  const formatTime = s => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const toggleFlash = () => {
    const next = flashMode === 'off' ? 'on' : 'off';
    setFlashMode(next);
    dualCamera.setTorch(next === 'on');
  };

  const openGallery = async () => {
    try {
      if (Platform.OS === 'ios') {
        // Direct launch of iOS native Apple Photos app
        await Linking.openURL('photos-redirect://');
      } else {
        // Launch Android native gallery/media app
        await Linking.openURL('content://media/internal/images/media');
      }
    } catch (err) {
      console.log('Open native gallery error:', err);
      Alert.alert(t('gallery'), t('galleryDescription'));
    }
  };

  const flipCamera = () => {
    const next = cameraPosition === 'back' ? 'front' : 'back';
    setCameraPosition(next);
    dualCamera.switchCamera(next);
  };

  const processVideo = async videoPath => {
    setIsProcessing(true);
    setPortraitDone(false);
    setLandscapeDone(false);

    const videoUri = `file://${videoPath}`;

    try {
      await CameraRoll.save(videoUri, { type: 'video', album: 'DualShot' });
      setPortraitDone(true);
    } catch (err) {
      console.log('Portrait save error:', err);
      setPortraitDone(true);
    }

    try {
      let cropX = 0;
      let cropY = 0.2891;
      let cropW = 1.0;
      let cropH = 0.4219;

      try {
        const info = await MediaToolkit.getMediaMetadata(videoUri);
        if (info && info.width && info.height) {
          console.log(
            `Video Metadata: ${info.width}x${info.height} @ ${
              info.fps || 'N/A'
            }fps`,
          );

          const w = info.width;
          const h = info.height;
          const currentRatio = w / h;

          const targetRatio = currentRatio > 1 ? 9 / 16 : 16 / 9;

          if (currentRatio > targetRatio) {
            cropW = targetRatio / currentRatio;
            cropX = (1 - cropW) / 2;
            cropH = 1.0;
            cropY = 0;
          } else {
            // Target is wider than current (e.g. cropping landscape from portrait)
            cropH = currentRatio / targetRatio;
            cropY = (1 - cropH) / 2;
            cropW = 1.0;
            cropX = 0;
          }
        }
      } catch (infoErr) {
        console.log('Video info error, using defaults:', infoErr);
      }

      const landscapeResult = await MediaToolkit.cropVideo(videoUri, {
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
      });

      // Ensure the output path has file:// prefix for CameraRoll
      let outPath = landscapeResult.uri;
      if (!outPath.startsWith('file://')) {
        outPath = `file://${outPath}`;
      }

      await CameraRoll.save(outPath, { type: 'video', album: 'DualShot' });
      setLandscapeDone(true);
    } catch (err) {
      console.log('Landscape save error:', err);
      Alert.alert(
        t('processingError'),
        `${t('landscapeSaveError')}: ${err.message || err}`,
      );
      setLandscapeDone(true); // Close the overlay eventually
    }

    // // Generate a thumbnail from the recorded video for the gallery preview
    // try {
    //   const thumb = await MediaToolkit.getThumbnail(videoUri, {
    //     timeMs: 0,
    //     quality: Platform.OS === 'ios' ? 0 : 80,
    //   });
    //   setLastMedia({ type: 'video', path: videoPath, thumbnail: thumb.uri });
    // } catch (thumbErr) {
    //   console.log('Thumbnail error:', thumbErr);
    //   setLastMedia({ type: 'video', path: videoPath, thumbnail: null });
    // }

    setTimeout(() => setIsProcessing(false), 1000);
  };

  const processPhoto = async photoPath => {
    let photoUri = photoPath;
    if (!photoUri.startsWith('file://')) {
      photoUri = `file://${photoPath}`;
    }

    // On Android, the native code already saves the portrait photo to gallery via MediaStore.
    // It returns a cache file path for JS-side cropping.
    if (Platform.OS === 'android') {
      setPortraitDone(true);
    } else {
      try {
        await CameraRoll.save(photoUri, { type: 'photo', album: 'DualShot' });
        setPortraitDone(true);
      } catch (err) {
        console.log('Portrait photo save error:', err);
        setPortraitDone(true);
      }
    }

    try {
      let image = await loadImage({ filePath: photoPath });

      // Smart Dual-Crop: Always produce the "opposite" orientation.
      // If we have landscape, crop a portrait center. If we have portrait, crop a landscape center.
      const currentRatio = image.width / image.height;
      const targetRatio = currentRatio > 1 ? 9 / 16 : 16 / 9;

      let cropX = 0;
      let cropY = 0;
      let cropW = image.width;
      let cropH = image.height;

      if (currentRatio > targetRatio) {
        // Image is wider than target (e.g. cropping portrait from landscape)
        cropW = image.height * targetRatio;
        cropX = (image.width - cropW) / 2;
      } else {
        // Image is taller than target (e.g. cropping landscape from portrait)
        cropH = image.width / targetRatio;
        cropY = (image.height - cropH) / 2;
      }

      const croppedImage = await image.cropAsync(
        cropX,
        cropY,
        cropX + cropW,
        cropY + cropH,
      );

      const quality = Platform.OS === 'ios' ? 0 : 100;
      const croppedPath = await croppedImage.saveToTemporaryFileAsync(
        'jpg',
        quality,
      );

      let outPath = croppedPath;
      if (!outPath.startsWith('file://')) {
        outPath = `file://${outPath}`;
      }

      await dualCamera.savePhotoToGallery(croppedPath);
      setLandscapeDone(true);

      setLastMedia({ type: 'photo', path: croppedPath, thumbnail: outPath });
    } catch (err) {
      console.log('Landscape photo save error:', err);
      Alert.alert(
        t('processingError'),
        `${t('landscapeSaveError')}: ${err.message || err}`,
      );
      setLandscapeDone(true);
    }

    setTimeout(() => setIsProcessing(false), 1000);
  };

  const handleRecord = async () => {
    if (isProcessing) return;

    if (mode === 'video') {
      if (isRecording) {
        setIsRecording(false);
        try {
          const path = await dualCamera.stopRecording();
          if (path) {
            processVideo(path);
          }
        } catch (e) {
          console.log('Stop recording error:', e);
        }
      } else {
        try {
          setIsRecording(true);
          await dualCamera.startRecording({ resolution, fps, fileFormat });
        } catch (e) {
          setIsRecording(false);
        }
      }
    } else if (mode === 'photo') {
      setIsProcessing(true); // Disable button immediately
      setPortraitDone(false);
      setLandscapeDone(false);
      try {
        const photoPath = await dualCamera.takePhoto();
        if (photoPath) {
          processPhoto(photoPath);
        } else {
          setIsProcessing(false);
        }
      } catch (e) {
        console.log('Take photo error:', e);
        setIsProcessing(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ===== CAMERA PREVIEW WITH MARGINS ===== */}
      <View style={styles.cameraContainer}>
        <DualCameraMainView style={StyleSheet.absoluteFill} />
      </View>

      {/* ===== FLOATING UI OVERLAY ===== */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* TOP OVERLAY (Flash/Settings) */}
        <View style={[styles.topOverlay, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={toggleFlash} style={styles.topBtn}>
            <Ionicons
              name={flashMode === 'on' ? 'flash' : 'flash-off'}
              size={moderateScale(24)}
              color={flashMode === 'on' ? '#FFD700' : COLORS.white}
            />
          </TouchableOpacity>

          <View style={styles.centerTopContainer}>
            {mode === 'video' && isRecording ? (
              <View style={styles.timerContainer}>
                <View style={styles.recDot} />
                <CustomText style={styles.timerText}>
                  {formatTime(timer)}
                </CustomText>
              </View>
            ) : (
              <CustomText style={styles.timerText}>00:00:00</CustomText>
            )}

            {/* 0:10 free badge */}
          </View>

          <View style={styles.rightTopButtons}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.topBtn}
            >
              <Ionicons
                name="settings"
                size={moderateScale(24)}
                color={COLORS.white}
              />
            </TouchableOpacity>

            {/* <TouchableOpacity
              onPress={() => setShowPaywall(true)}
              style={styles.proHeaderBadge}
            >
              <Ionicons name="star" size={moderateScale(12)} color="#fff" />
              <CustomText style={styles.proHeaderText}>PRO</CustomText>
            </TouchableOpacity> */}
          </View>
        </View>

        {/* Floating PIP - Draggable and Resizable */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.pipContainer,
            {
              width: currentPip.w,
              height: currentPip.w * (9 / 16),
              transform: pan.getTranslateTransform(),
              bottom: moderateScale(160), // Move it up a bit
            },
          ]}
        >
          <View style={styles.pipInternal}>
            <DualCameraPipView style={StyleSheet.absoluteFill} />
          </View>

          <TouchableOpacity
            style={styles.pipResize}
            onPress={() => setPipSize(prev => (prev + 1) % 3)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={pipSize < 2 ? 'expand-outline' : 'contract-outline'}
              size={moderateScale(12)}
              color={COLORS.white}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* BOTTOM OVERLAY (Record + Mode tabs) */}
        <View
          style={[
            styles.bottomOverlay,
            { paddingBottom: insets.bottom + moderateScale(20) },
          ]}
        >
          {/* Record Button Area */}
          <View style={styles.recordArea}>
            <Animated.View
              style={[
                styles.recordBtnOuterImmersive,
                { transform: [{ scale: recordPulse }] },
              ]}
            >
              <TouchableOpacity
                onPress={handleRecord}
                activeOpacity={0.7}
                style={[
                  styles.recordBtnInnerImmersive,
                  mode === 'video' && styles.videoBtn,
                  mode === 'photo' && styles.photoBtn,
                  isRecording && styles.recordingBtn,
                ]}
              >
                {isRecording && <View style={styles.recordingSquare} />}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Mode Tabs and Extras */}
          <View style={styles.bottomBarImmersive}>
            <TouchableOpacity onPress={openGallery} style={styles.bottomBtn}>
              <Ionicons
                name="images"
                size={moderateScale(28)}
                color={COLORS.white}
              />
            </TouchableOpacity>

            <View style={styles.modeTabsImmersive}>
              <TouchableOpacity
                onPress={() => setMode('video')}
                style={[styles.modeTab]}
              >
                <CustomText
                  style={[
                    styles.modeTabTextImmersive,
                    mode === 'video' && styles.modeTabTextActive,
                  ]}
                >
                  {t('video')}
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('photo')}
                style={[styles.modeTab]}
              >
                <CustomText
                  style={[
                    styles.modeTabTextImmersive,
                    mode === 'photo' && styles.modeTabTextActive,
                  ]}
                >
                  {t('photo')}
                </CustomText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={flipCamera}
              style={styles.bottomBtn}
              disabled={isRecording}
            >
              <Ionicons
                name="repeat"
                size={moderateScale(28)}
                color={isRecording ? '#555' : COLORS.white}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ProcessingOverlay
        visible={isProcessing}
        portraitDone={portraitDone}
        landscapeDone={landscapeDone}
        resolution={resolution}
      />

      {/* <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      /> */}

      {/* Exit Modal */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.exitCard}>
            {/* Glossy Header Bar */}
            <View style={styles.exitCardHeader} />

            <View style={styles.exitIconContainer}>
              <View style={styles.exitIconInner}>
                <Ionicons
                  name="power"
                  size={moderateScale(36)}
                  color="#FF3B30"
                />
              </View>
              {/* Pulse rings for effect */}
              <View style={styles.exitPulse1} />
              <View style={styles.exitPulse2} />
            </View>

            <View style={styles.exitTextContainer}>
              <CustomText style={styles.exitTitle}>{t('exitTitle')}</CustomText>
              <CustomText style={styles.exitMessage}>
                {t('exitMessage')}
              </CustomText>
            </View>

            <View style={styles.exitButtons}>
              <TouchableOpacity
                style={styles.exitBtnCancel}
                onPress={() => setShowExitModal(false)}
                activeOpacity={0.7}
              >
                <CustomText style={styles.exitBtnTextCancel}>
                  {t('cancel')}
                </CustomText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exitBtnConfirm}
                onPress={() => BackHandler.exitApp()}
                activeOpacity={0.8}
              >
                <CustomText style={styles.exitBtnTextConfirm}>
                  {t('exitConfirm')}
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    position: 'absolute',
    top: moderateScale(80),
    bottom: moderateScale(150),
    left: 0,
    right: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // Immersive Overlays
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: moderateScale(80),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(14),
    backgroundColor: '#000',
  },
  centerTopContainer: {
    alignItems: 'center',
    gap: moderateScale(4),
  },
  rightTopButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(5),
    borderRadius: moderateScale(15),
    marginTop: moderateScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  freeBadgeText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '700',
    marginRight: moderateScale(6),
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: moderateScale(180),
    alignItems: 'center',
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  bottomBarImmersive: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(25),
  },
  topBtn: {
    width: moderateScale(48),
    height: moderateScale(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(20),
  },
  proHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: moderateScale(4),
  },
  proHeaderText: {
    color: '#fff',
    fontSize: moderateScale(11),
    fontWeight: '800',
    marginLeft: moderateScale(4),
  },
  modeTabsImmersive: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: moderateScale(25),
    paddingHorizontal: moderateScale(4),
    paddingVertical: moderateScale(4),
  },
  modeTabTextImmersive: {
    color: '#fff',
    fontSize: moderateScale(14),
    fontWeight: '800',
    letterSpacing: 1,
  },
  recordBtnOuterImmersive: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordBtnInnerImmersive: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },
  exitCard: {
    width: '100%',
    maxWidth: moderateScale(340),
    backgroundColor: '#121212',
    borderRadius: moderateScale(32),
    paddingTop: moderateScale(40),
    paddingBottom: moderateScale(24),
    paddingHorizontal: moderateScale(24),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  exitCardHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: moderateScale(4),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  exitIconContainer: {
    width: moderateScale(100),
    height: moderateScale(100),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(30),
  },
  exitIconInner: {
    width: moderateScale(70),
    height: moderateScale(70),
    borderRadius: moderateScale(35),
    backgroundColor: 'rgba(255,59,48,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,59,48,0.3)',
    zIndex: 2,
  },
  exitPulse1: {
    position: 'absolute',
    width: moderateScale(85),
    height: moderateScale(85),
    borderRadius: moderateScale(43),
    backgroundColor: 'rgba(255,59,48,0.05)',
    zIndex: 1,
  },
  exitPulse2: {
    position: 'absolute',
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    backgroundColor: 'rgba(255,59,48,0.03)',
    zIndex: 0,
  },
  exitTextContainer: {
    alignItems: 'center',
    marginBottom: moderateScale(35),
  },
  exitTitle: {
    fontSize: moderateScale(26),
    fontWeight: '900',
    color: '#fff',
    marginBottom: moderateScale(12),
    letterSpacing: 0.5,
  },
  exitMessage: {
    fontSize: moderateScale(15),
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: moderateScale(22),
    paddingHorizontal: moderateScale(10),
  },
  exitButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: moderateScale(12),
  },
  exitBtnCancel: {
    flex: 1,
    height: moderateScale(58),
    borderRadius: moderateScale(18),
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  exitBtnConfirm: {
    flex: 1,
    height: moderateScale(58),
    borderRadius: moderateScale(18),
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  exitBtnTextCancel: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#fff',
  },
  exitBtnTextConfirm: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: '#fff',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: moderateScale(6),
  },
  timerText: {
    color: COLORS.white,
    fontSize: moderateScale(14),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // PIP
  pipContainer: {
    position: 'absolute',
    bottom: moderateScale(200),
    alignSelf: 'center',
    borderRadius: moderateScale(18), // More rounded for modern look
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)', // Brighter border
    backgroundColor: '#000',
    zIndex: 10,

    // Premium Shadow/Glow for iOS
    shadowColor: '#fff', // Subtle light glow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,

    // Shadow for Android
    elevation: 25,
  },
  pipInternal: {
    flex: 1,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  pipLabel: {
    position: 'absolute',
    top: moderateScale(4),
    left: moderateScale(4),
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(1),
    borderRadius: moderateScale(4),
    zIndex: 2,
  },
  pipLabelText: {
    color: COLORS.white,
    fontSize: moderateScale(8),
    fontWeight: '800',
  },
  pipResize: {
    position: 'absolute',
    bottom: moderateScale(4),
    right: moderateScale(4),
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(11),
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },

  // Record
  recordArea: {
    alignItems: 'center',
    marginBottom: moderateScale(15),
  },
  recordBtnOuter: {
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordBtnInner: {
    width: moderateScale(58),
    height: moderateScale(58),
    borderRadius: moderateScale(29),
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBtn: {
    backgroundColor: '#FF3B30',
  },
  photoBtn: {
    backgroundColor: COLORS.white,
  },
  recordingBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: moderateScale(14),
    width: moderateScale(46),
    height: moderateScale(46),
  },
  recordingSquare: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(4),
    backgroundColor: COLORS.white,
  },

  // Bottom
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(6),
    backgroundColor: '#000',
  },
  bottomBtn: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bottomThumb: {
    width: '100%',
    height: '100%',
    borderRadius: moderateScale(22),
  },
  thumbVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: moderateScale(22),
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: moderateScale(25),
    padding: moderateScale(3),
  },
  modeTab: {
    paddingHorizontal: moderateScale(22),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(22),
  },
  modeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  modeTabText: {
    color: '#888',
    fontSize: moderateScale(12),
    fontWeight: '700',
    letterSpacing: 1,
  },
  modeTabTextActive: {
    color: COLORS.primary,
  },

  // Settings
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  settingsCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    padding: moderateScale(24),
    paddingBottom: moderateScale(40),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(24),
  },
  settingsTitle: {
    color: COLORS.white,
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  settingsLabel: {
    color: '#999',
    fontSize: moderateScale(12),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: moderateScale(10),
    marginTop: moderateScale(16),
  },
  settingsRow: {
    flexDirection: 'row',
    gap: moderateScale(10),
  },
  settingsChip: {
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  settingsChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  settingsChipText: {
    color: '#888',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  settingsChipTextActive: {
    color: COLORS.white,
  },
  settingsInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: moderateScale(8),
    marginTop: moderateScale(24),
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: moderateScale(12),
    borderRadius: moderateScale(12),
  },
  settingsInfoText: {
    flex: 1,
    color: '#666',
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  settingsDoneBtn: {
    marginTop: moderateScale(20),
    backgroundColor: COLORS.primary,
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(14),
    alignItems: 'center',
  },
  settingsDoneBtnText: {
    color: COLORS.white,
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
});

export default HomeScreen;
