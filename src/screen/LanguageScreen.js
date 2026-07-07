import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { moderateScale } from 'react-native-size-matters';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { setLanguage } from '../redux/slices/settingsSlice';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import Container from '../component/Container';
import CustomText from '../component/CustomText';
import { SPACING } from '../theme/theme';

const LANGUAGES = [
  { id: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { id: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { id: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { id: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { id: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  { id: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { id: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { id: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { id: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { id: 'ja', name: 'Japanese', nativeName: '日本', flag: '🇯🇵' },
  { id: 'ko', name: 'Korean', nativeName: '한국인', flag: '🇰🇷' },
  { id: 'zh', name: 'Chinese', nativeName: '中国人', flag: '🇨🇳' },
  { id: 'id', name: 'Indonesian', nativeName: 'Indonesian', flag: '🇮🇩' },
  { id: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { id: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { id: 'ar', name: 'Arabic', nativeName: 'عربي', flag: '🇸🇦' },
  { id: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { id: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { id: 'pl', name: 'Polish', nativeName: 'Dialekt', flag: '🇵🇱' },
  { id: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
];

const LanguageScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const currentLanguage = useSelector(state => state.settings.language);

  const handleSelect = (id) => {
    dispatch(setLanguage(id));
    navigation.goBack();
  };

  return (
    <Container edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={moderateScale(24)} color={colors.text} />
        </TouchableOpacity>
        <CustomText style={[styles.headerTitle, { color: colors.text }]}>{t('language')}</CustomText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {LANGUAGES.map((lang) => {
          const isSelected = currentLanguage === lang.id;
          return (
            <TouchableOpacity 
              key={lang.id}
              style={[
                styles.langItem, 
                { 
                  backgroundColor: colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                }
              ]}
              onPress={() => handleSelect(lang.id)}
              activeOpacity={0.7}
            >
              <View style={styles.langLeft}>
                <View style={[styles.flagCircle, { backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9' }]}>
                  <CustomText style={styles.flagEmoji}>{lang.flag}</CustomText>
                </View>
                <View style={styles.langTextContainer}>
                  <CustomText style={[styles.langNativeName, { color: colors.text }]}>
                    {lang.nativeName}
                  </CustomText>
                  <CustomText style={[styles.langName, { color: colors.mutedText }]}>
                    {lang.name}
                  </CustomText>
                </View>
              </View>
              
              {isSelected && (
                <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                  <Ionicons name="checkmark" size={moderateScale(14)} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
  },
  backBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(30),
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: moderateScale(12),
    borderRadius: moderateScale(16),
    marginBottom: moderateScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  langLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagCircle: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(15),
  },
  flagEmoji: {
    fontSize: moderateScale(24),
  },
  langTextContainer: {
    justifyContent: 'center',
  },
  langNativeName: {
    fontSize: moderateScale(17),
    fontWeight: '700',
  },
  langName: {
    fontSize: moderateScale(13),
    marginTop: moderateScale(2),
  },
  checkCircle: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LanguageScreen;
