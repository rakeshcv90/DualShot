import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
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
import RecordTimer from '../component/RecordTimer';
import {
  DualCameraMainView,
  DualCameraPipView,
  useDualCamera,
} from '../component/DualCameraView';
import MediaToolkit from 'react-native-media-toolkit';
import { loadImage } from 'react-native-nitro-image';
import PaywallModal from '../component/PaywallModal';
import { storage } from '../storage/storage';
import { FFmpegKit, ReturnCode } from '@wokcito/ffmpeg-kit-react-native';

const { width, height } = Dimensions.get('window');

/**
 * Android's MediaRecorder has no native QuickTime/.mov muxer (see
 * DualCameraController.kt) — a recorded file is always genuinely MP4
 * content. When "MOV" is selected, this remuxes it into a real QuickTime
 * container via a stream copy (-c copy — no re-encode, fast, lossless).
 * Falls back to the original MP4 path if the remux fails for any reason,
 * so a conversion hiccup never loses the recording. iOS doesn't need this:
 * its native capture output already is QuickTime (see
 * DualCameraController.swift's RecordingDelegate).
 */
const remuxToMov = async mp4Path => {
  const movPath = mp4Path.replace(/\.mp4$/i, '.mov');
  try {
    const session = await FFmpegKit.executeWithArguments([
      '-y',
      '-i',
      mp4Path,
      '-c',
      'copy',
      '-f',
      'mov',
      movPath,
    ]);
    const returnCode = await session.getReturnCode();
    if (ReturnCode.isSuccess(returnCode)) {
      return movPath;
    }
    console.log('MOV remux failed (non-zero return code), keeping MP4');
  } catch (err) {
    console.log('MOV remux error, keeping MP4:', err);
  }
  return mp4Path;
};

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { resolution, fps, fileFormat } = useSelector(state => state.settings);
  const isPro = useSelector(state => state.user?.isPro);
  const [mode, setMode] = useState('video');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('back');
  const [flashMode, setFlashMode] = useState('off');
  const [lastMedia, setLastMedia] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [portraitDone, setPortraitDone] = useState(false);
  const [landscapeDone, setLandscapeDone] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [videoSegments, setVideoSegments] = useState([]);
  const [isFlipping, setIsFlipping] = useState(false);

  const [pipSize, setPipSize] = useState(2);
  const isFocused = useIsFocused();

  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, gestureState) => {
        // Only capture if the user actually moves their finger significantly
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      // PanResponder calls onPanResponderMove as a plain direct function
      // call (see PanResponder.js's _updateGestureStateOnMove) — it doesn't
      // go through the special native-prop attachment that onScroll etc.
      // use, so Animated.event's useNativeDriver:true form (which returns
      // an AnimatedEvent object, not a callable function) crashes here with
      // "Object is not a function" the moment a drag starts. Native driver
      // genuinely isn't usable with plain PanResponder at this call site.
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    }),
  ).current;

  const PIP_SIZES = [
    { w: moderateScale(150) },
    { w: moderateScale(180) },
    { w: moderateScale(220) },
    { w: moderateScale(250) },
  ];

  const currentPip = PIP_SIZES[pipSize];

  const recordPulse = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const dualCamera = useDualCamera();

  // Open camera on mount
  const appliedCameraConfig = useRef({ resolution, fps });
  const isMountEffectDone = useRef(false);

  // Both the AppState resume handler and the settings-change effect below
  // need to close then reopen the camera. This is now done entirely on the
  // native side via dualCamera.reopenCamera(), which waits for the real
  // CameraDevice.onClosed() callback before opening the new camera —
  // no more fixed-delay setTimeout guesswork that could race with the HAL.
  const isReopening = useRef(false);

  useEffect(() => {
    dualCamera.openCamera(cameraPosition, { resolution, fps });
    isMountEffectDone.current = true;

    return () => {
      dualCamera.closeCamera();
    };
  }, []);

  // SUBSCRIPTION GATE DISABLED FOR NOW — uncomment to re-enable the
  // auto-paywall-after-free-shot flow. useIAP/useProValidation keep running
  // in the background regardless, so isPro stays accurate for whenever this
  // is switched back on.
  // useEffect(() => {
  //   if (isPro === false && storage.getBoolean('hasUsedFreeShot')) {
  //     setShowPaywall(true);
  //   }
  // }, [isPro]);

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

  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const handleAppState = nextState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        // Don't reopen while recording — the recording owns the camera
        // lifecycle, and reopening mid-record would corrupt the session.
        if (isRecording) return;
        // Don't reopen if another reopen is already in flight.
        if (isReopening.current) return;
        isReopening.current = true;
        // Native reopenCamera waits for the real onClosed() callback
        // before opening — no fixed-delay guesswork.
        dualCamera
          .reopenCamera(cameraPosition, { resolution, fps })
          .catch(e => console.log('Reopen camera on resume error:', e))
          .finally(() => {
            isReopening.current = false;
          });
      }
      appStateRef.current = nextState;
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [cameraPosition, resolution, fps, isRecording]);

  // Re-apply resolution/fps to the live camera when they change in Settings.
  // Settings/Language stay mounted on the nav stack underneath Home, so this
  // only actually reopens the camera once Home is focused again — otherwise
  // it would reopen a camera that's hidden behind another screen. It also
  // skips the run that fires right after the mount effect above (which
  // already opened the camera with these exact settings) and no-ops if
  // nothing actually changed while the screen was unfocused.
  useEffect(() => {
    if (!isMountEffectDone.current) return;
    if (!isFocused) return;

    const changed =
      appliedCameraConfig.current.resolution !== resolution ||
      appliedCameraConfig.current.fps !== fps;
    if (!changed) return;

    // Must close before reopening — the camera is already open at this
    // point (this effect only reopens an existing session, unlike the
    // mount effect), and calling Camera2's openCamera() again on an
    // already-open device without closing it first is invalid usage. It
    // doesn't reliably fail cleanly; it can corrupt the existing session's
    // preview instead, which is what produced the stretched preview after
    // changing a setting and returning to Home. Native reopenCamera also
    // guards against this racing an overlapping AppState-triggered reopen.
    if (isReopening.current) return;
    isReopening.current = true;
    dualCamera
      .reopenCamera(cameraPosition, { resolution, fps })
      .catch(e => console.log('Reopen camera on settings change error:', e))
      .finally(() => {
        isReopening.current = false;
      });
    appliedCameraConfig.current = { resolution, fps };
  }, [resolution, fps, isFocused]);

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

  const toggleFlash = () => {
    const next = flashMode === 'off' ? 'on' : 'off';
    setFlashMode(next);
    dualCamera.setTorch(next === 'on');
  };

  const openGallery = async () => {
    try {
      await dualCamera.openGallery();
    } catch (err) {
      console.log('Open native gallery error:', err);
      Alert.alert(t('gallery'), t('galleryDescription'));
    }
  };

  const flipCamera = () => {
    if (isFlipping) return;

    if (isRecording) {
      setIsFlipping(true);

      dualCamera
        .stopRecording()
        .then(path => {
          if (path) {
            setVideoSegments(prev => [...prev, path]);
          }

          const next = cameraPosition === 'back' ? 'front' : 'back';
          setCameraPosition(next);

          dualCamera
            .switchCamera(next)
            .then(() => {
              dualCamera
                .startRecording({ resolution, fps, fileFormat })
                .then(() => {
                  setIsFlipping(false);
                })
                .catch(err => {
                  console.log('Resume recording failed', err);
                  setIsFlipping(false);
                  setIsRecording(false);

                  // Try to salvage what was recorded
                  if (videoSegments.length > 0) {
                    concatSegments(videoSegments).then(finalPath => {
                      if (finalPath) processVideo(finalPath);
                      setVideoSegments([]);
                    });
                  }
                });
            })
            .catch(err => {
              console.log('Switch camera failed', err);
              setIsFlipping(false);
              setIsRecording(false);
            });
        })
        .catch(err => {
          console.log('Stop segment failed', err);
          setIsFlipping(false);
        });
    } else {
      setIsFlipping(true);
      const next = cameraPosition === 'back' ? 'front' : 'back';
      setCameraPosition(next);
      dualCamera
        .switchCamera(next, { resolution, fps })
        .catch(e => console.log('Switch err', e))
        .finally(() => setIsFlipping(false));
      // const next = cameraPosition === 'back' ? 'front' : 'back';
      // setCameraPosition(next);
      // dualCamera.switchCamera(next, { resolution, fps }).catch(e => console.log("Switch err", e));
    }
  };

  const concatSegments = async segments => {
    if (!segments || segments.length === 0) return null;
    if (segments.length === 1) return segments[0];

    console.log('Concatenating segments:', segments);
    const timestamp = Date.now();
    // Derive output path from the first segment's path
    const outPath = segments[0].replace(/\.[^.]+$/, `_concat_${timestamp}.mp4`);

    let inputs = [];
    let filterStr = '';
    for (let i = 0; i < segments.length; i++) {
      inputs.push('-i', segments[i]);
      // Use scale with standard dimensions, but force standard SAR and allow
      // FFmpeg to auto-rotate if needed. We use a safe scaling approach.
      filterStr += `[${i}:v]scale=${
        resolution === '4K' ? '3840:2160' : '1920:1080'
      }:force_original_aspect_ratio=decrease,pad=${
        resolution === '4K' ? '3840:2160' : '1920:1080'
      }:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]; `;
    }

    let concatStr = '';
    for (let i = 0; i < segments.length; i++) {
      concatStr += `[v${i}][${i}:a]`;
    }
    filterStr += `${concatStr}concat=n=${segments.length}:v=1:a=1[outv][outa]`;

    const args = [
      '-y',
      ...inputs,
      '-filter_complex',
      filterStr,
      '-map',
      '[outv]',
      '-map',
      '[outa]',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      outPath,
    ];

    try {
      const session = await FFmpegKit.executeWithArguments(args);
      const returnCode = await session.getReturnCode();
      if (ReturnCode.isSuccess(returnCode)) {
        return outPath;
      }
      const logs = await session.getOutput();
      console.log('FFmpeg concat failed', logs);
    } catch (e) {
      console.log('Concat error', e);
    }
    // Fallback to first segment if concat fails
    return segments[0];
  };

  const processVideo = async videoPath => {
    setIsProcessing(true);
    setPortraitDone(false);
    setLandscapeDone(false);

    // See remuxToMov above — iOS's raw recording is already QuickTime, so
    // only Android needs this conversion when MOV is selected. The crop
    // step below always reads from the original (unremuxed) recording —
    // MediaToolkit's crop pipeline is only exercised against MP4 input
    // today, so this keeps that behavior unchanged and only converts each
    // *output* file to MOV once it's ready.
    const wantsMov = Platform.OS === 'android' && fileFormat === 'MOV';
    const videoUri = `file://${videoPath}`;

    try {
      const portraitPath = wantsMov ? await remuxToMov(videoPath) : videoPath;
      await CameraRoll.save(`file://${portraitPath}`, {
        type: 'video',
        album: 'DualShot',
      });
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

      let outPath = landscapeResult.uri;
      const outLocalPath = outPath.startsWith('file://')
        ? outPath.slice('file://'.length)
        : outPath;

      if (wantsMov) {
        const movPath = await remuxToMov(outLocalPath);
        outPath = `file://${movPath}`;
      } else if (!outPath.startsWith('file://')) {
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

    setTimeout(() => setIsProcessing(false), 1000);
  };

  const processPhoto = async photoPath => {
    let photoUri = photoPath;
    if (!photoUri.startsWith('file://')) {
      photoUri = `file://${photoPath}`;
    }

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
    if (isProcessing || isFlipping) return;

    // SUBSCRIPTION GATE DISABLED FOR NOW — recording/photo capture is
    // unlimited for everyone regardless of Pro status. Uncomment this block
    // (and the two hasUsedFreeShot tracking lines below) to re-enable the
    // one-free-shot-then-paywall flow.
    // // Check if free user is trying to capture more than their one free shot
    // if (isPro === false) {
    //   const hasUsedFreeShot = storage.getBoolean('hasUsedFreeShot');
    //
    //   // If they've used it, and they aren't currently trying to STOP a recording they started
    //   if (hasUsedFreeShot && !isRecording) {
    //     setShowPaywall(true);
    //     return;
    //   }
    // }

    if (mode === 'video') {
      if (isRecording) {
        setIsRecording(false);
        setIsProcessing(true); // Show overlay while concatenating/processing
        try {
          const path = await dualCamera.stopRecording();
          const allSegments = path ? [...videoSegments, path] : videoSegments;
          setVideoSegments([]);

          if (allSegments.length > 0) {
            const finalVideoPath = await concatSegments(allSegments);
            if (finalVideoPath) {
              processVideo(finalVideoPath);
            } else {
              setIsProcessing(false);
            }
          } else {
            setIsProcessing(false);
          }
        } catch (e) {
          console.log('Stop recording error:', e);
          setIsProcessing(false);
        }
      } else {
        try {
          setIsRecording(true);
          setVideoSegments([]);
          await dualCamera.startRecording({ resolution, fps, fileFormat });
        } catch (e) {
          console.log('Start recording error:', e);
          setIsRecording(false);
          // Camera error 4 (fatal) kills the camera device — reopen it
          // so the user sees a live preview instead of a frozen frame.
          dualCamera
            .reopenCamera(cameraPosition, { resolution, fps })
            .catch(err => console.log('Reopen after recording failure:', err));
        }
      }
    } else if (mode === 'photo') {
      setIsProcessing(true); // Disable button immediately
      // if (isPro === false) storage.set('hasUsedFreeShot', true);
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

      {/* ===== FULL-BLEED CAMERA PREVIEW ===== */}
      <View style={styles.cameraContainer}>
        <DualCameraMainView style={StyleSheet.absoluteFill} />
      </View>

      {/* ===== FLOATING UI OVERLAY ===== */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* TOP OVERLAY (Flash/Settings) */}
        <View style={[styles.topOverlay, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={toggleFlash}
            style={styles.topBtn}
            accessibilityRole="button"
            accessibilityLabel={
              flashMode === 'on' ? 'Turn flash off' : 'Turn flash on'
            }
          >
            <Ionicons
              name={flashMode === 'on' ? 'flash' : 'flash-off'}
              size={moderateScale(24)}
              color={flashMode === 'on' ? '#FFD700' : COLORS.white}
            />
          </TouchableOpacity>

          <View style={styles.centerTopContainer}>
            {mode === 'video' && <RecordTimer active={isRecording} />}

            {/* SUBSCRIPTION UI DISABLED FOR NOW — uncomment alongside the
                handleRecord gate above to restore the free-shot badge. */}
            {/* {isPro === false && !storage.getBoolean('hasUsedFreeShot') && (
              <View style={styles.freeBadge}>
                <CustomText style={styles.freeBadgeText}>
                  {t('freeShotBadge')}
                </CustomText>
              </View>
            )} */}
          </View>

          <View style={styles.rightTopButtons}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.topBtn}
              accessibilityRole="button"
              accessibilityLabel={t('settings')}
            >
              <Ionicons
                name="settings"
                size={moderateScale(24)}
                color={COLORS.white}
              />
            </TouchableOpacity>

            {/* SUBSCRIPTION UI DISABLED FOR NOW — uncomment to restore the
                PRO upgrade badge. */}
            {/* {!isPro && (
              <TouchableOpacity
                onPress={() => setShowPaywall(true)}
                style={styles.proHeaderBadge}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Pro"
              >
                <Ionicons name="star" size={moderateScale(12)} color="#fff" />
                <CustomText style={styles.proHeaderText}>PRO</CustomText>
              </TouchableOpacity>
            )} */}
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
              bottom: moderateScale(210),
            },
          ]}
        >
          <View style={styles.pipInternal}>
            <DualCameraPipView style={StyleSheet.absoluteFill} />
          </View>

          <TouchableOpacity
            style={styles.pipResize}
            onPress={() => setPipSize(prev => (prev + 1) % PIP_SIZES.length)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Resize picture-in-picture view"
          >
            <Ionicons
              name={
                pipSize < PIP_SIZES.length - 1
                  ? 'expand-outline'
                  : 'contract-outline'
              }
              size={moderateScale(12)}
              color={COLORS.white}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* BOTTOM OVERLAY (Record + Mode tabs) */}
        <View style={styles.bottomOverlay}>
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
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'video'
                    ? isRecording
                      ? 'Stop recording'
                      : 'Start recording'
                    : 'Take photo'
                }
              >
                {isRecording && <View style={styles.recordingSquare} />}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Mode Tabs and Extras */}
          <View
            style={[
              styles.bottomBarImmersive,
              // All bottom safe-area inset lives here, inside the black
              // background, not on the outer bottomOverlay — otherwise a
              // transparent gap remains below the bar whenever insets.bottom
              // is non-zero (e.g. Android gesture nav; insets.bottom is 0
              // with 3-button nav, which is why this only showed up on some
              // devices/nav modes and not others).
              { paddingBottom: insets.bottom + moderateScale(12) + moderateScale(20) },
            ]}
          >
            <TouchableOpacity
              onPress={openGallery}
              style={styles.bottomBtn}
              disabled={isRecording}
              accessibilityRole="button"
              accessibilityLabel={t('gallery')}
            >
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
                disabled={isRecording}
              >
                <CustomText
                  style={[
                    styles.modeTabTextImmersive,
                    mode === 'video' && styles.modeTabTextActive,
                    isRecording && { opacity: 0.5 },
                  ]}
                >
                  {t('video')}
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('photo')}
                style={[styles.modeTab]}
                disabled={isRecording}
              >
                <CustomText
                  style={[
                    styles.modeTabTextImmersive,
                    mode === 'photo' && styles.modeTabTextActive,
                    isRecording && { opacity: 0.5 },
                  ]}
                >
                  {t('photo')}
                </CustomText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={flipCamera}
              style={styles.bottomBtn}
              disabled={isFlipping}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <Ionicons
                name="repeat"
                size={moderateScale(28)}
                color={isFlipping ? '#555' : COLORS.white}
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

      {/* Mounted only when actually needed — PaywallModal's useIAP() hook
          fires an expensive product-fetch on mount (observed to hang ~9s
          on some devices/sandbox setups), and this was previously mounted
          unconditionally, so every cold launch paid that cost immediately
          on the Home screen regardless of whether the paywall was ever
          shown — including while the subscription gate is disabled. */}
      {showPaywall && (
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
        />
      )}

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
    // Full-bleed: fills the entire screen edge-to-edge. The native preview
    // (DualCameraMainViewManager.kt) is in center-crop mode, so it always
    // covers this whole area with no black margins — at the cost of showing
    // a narrower field of view on screen than what actually gets recorded.
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // Immersive Overlays — transparent so the live camera feed shows through
  // behind the floating controls, matching the full-bleed design.
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  bottomBarImmersive: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(25),
    paddingTop: moderateScale(12),
    backgroundColor: '#000',
  },
  topBtn: {
    width: moderateScale(48),
    height: moderateScale(48),
    justifyContent: 'center',
    alignItems: 'center',
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
    // No pill/capsule background — VIDEO/PHOTO float directly over the
    // preview like the flash/settings icons, matching the reference design.
    flexDirection: 'row',
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
    // backgroundColor: 'rgba(0,0,0,0.92)',
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
  // PIP
  pipContainer: {
    position: 'absolute',
    bottom: moderateScale(210),
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
