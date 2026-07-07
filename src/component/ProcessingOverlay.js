import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../theme/theme';
import CustomText from '../component/CustomText';
import { useTranslation } from '../hooks/useTranslation';

const ProcessingOverlay = ({ visible, portraitDone, landscapeDone, resolution }) => {
  const { t } = useTranslation();
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [visible]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Spinner */}
          <Animated.View
            style={[styles.spinnerWrap, { transform: [{ rotate: spin }] }]}
          >
            <View style={styles.spinnerRing} />
          </Animated.View>

          <CustomText style={styles.title}>
            {t('generating')} {resolution ? `(${resolution})` : ''}
          </CustomText>
          <CustomText style={styles.subtitle}>
            {t('generatingDesc')}
          </CustomText>

          {/* Progress Items */}
          <View style={styles.progressList}>
            <View style={styles.progressItem}>
              <View
                style={[
                  styles.progressIcon,
                  portraitDone && styles.progressDone,
                ]}
              >
                {portraitDone ? (
                  <Ionicons
                    name="checkmark"
                    size={moderateScale(14)}
                    color={COLORS.white}
                  />
                ) : (
                  <View style={styles.progressDot} />
                )}
              </View>
              <View style={styles.progressInfo}>
                <CustomText style={styles.progressLabel}>
                  {t('portrait')} (9:16)
                </CustomText>
                <CustomText style={styles.progressDesc}>
                  {portraitDone ? t('savedToGallery') : t('processing') + '...'}
                </CustomText>
              </View>
            </View>

            <View style={styles.progressItem}>
              <View
                style={[
                  styles.progressIcon,
                  landscapeDone && styles.progressDone,
                ]}
              >
                {landscapeDone ? (
                  <Ionicons
                    name="checkmark"
                    size={moderateScale(14)}
                    color={COLORS.white}
                  />
                ) : (
                  <View style={styles.progressDot} />
                )}
              </View>
              <View style={styles.progressInfo}>
                <CustomText style={styles.progressLabel}>
                  {t('landscape')} (16:9)
                </CustomText>
                <CustomText style={styles.progressDesc}>
                  {landscapeDone
                    ? t('savedToGallery')
                    : portraitDone
                    ? t('processing') + '...'
                    : t('waiting')}
                </CustomText>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(30),
  },
  card: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: moderateScale(24),
    padding: moderateScale(30),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  spinnerWrap: {
    width: moderateScale(56),
    height: moderateScale(56),
    marginBottom: moderateScale(20),
  },
  spinnerRing: {
    width: '100%',
    height: '100%',
    borderRadius: moderateScale(28),
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: COLORS.primary,
    borderRightColor: COLORS.primary,
  },
  title: {
    color: COLORS.white,
    fontSize: moderateScale(18),
    fontWeight: '700',
    marginBottom: moderateScale(6),
    textAlign: 'center',
  },
  subtitle: {
    color: '#777',
    fontSize: moderateScale(13),
    marginBottom: moderateScale(24),
    textAlign: 'center',
  },
  progressList: {
    width: '100%',
    gap: moderateScale(14),
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    gap: moderateScale(12),
  },
  progressIcon: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(15),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDone: {
    backgroundColor: '#34C759',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#555',
  },
  progressInfo: {
    flex: 1,
  },
  progressLabel: {
    color: COLORS.white,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  progressDesc: {
    color: '#777',
    fontSize: moderateScale(11),
    marginTop: moderateScale(2),
  },
});

export default ProcessingOverlay;
