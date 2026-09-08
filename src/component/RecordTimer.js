import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import CustomText from './CustomText';
import { COLORS } from '../theme/theme';

const formatTime = s => {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
};

/**
 * Owns its own 1s interval so the ticking clock doesn't re-render the whole
 * HomeScreen (camera preview, overlays, buttons) every second while recording.
 */
const RecordTimer = ({ active }) => {
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (active) {
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
  }, [active]);

  if (!active) {
    return <CustomText style={styles.timerText}>00:00:00</CustomText>;
  }

  return (
    <View style={styles.timerContainer}>
      <View style={styles.recDot} />
      <CustomText style={styles.timerText}>{formatTime(timer)}</CustomText>
    </View>
  );
};

const styles = StyleSheet.create({
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(20),
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
});

export default React.memo(RecordTimer);
