/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Switch,
  Image,
  Clipboard,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  setResolution,
  setFps,
  setFileFormat,
  setThemeMode,
  setLanguage,
} from '../redux/slices/settingsSlice';
import { useTheme } from '../hooks/useTheme';
import { COLORS, SPACING } from '../theme/theme';
import CustomText from '../component/CustomText';
import Container from '../component/Container';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { generateRandomUserId, getAppVersionString } from '../utils/generateUserId';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { moderateScale } from 'react-native-size-matters';
import { useTranslation } from '../hooks/useTranslation';
// import PaywallModal from '../component/PaywallModal';
// TODO: Uncomment PaywallModal when Pro features are needed

const { width } = Dimensions.get('window');

const LANG_MAP = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  fa: 'فارسی',
  ru: 'Русский',
  hi: 'हिन्दी',
  pt: 'Português',
  es: 'Español',
  ja: '日本',
  ko: '한국인',
  zh: '中国人',
  id: 'Indonesian',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  ar: 'Arabic',
  nl: 'Nederlands',
  uk: 'Українська',
  pl: 'Dialekt',
  he: 'Hebrew',
};

const SettingsScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { resolution, fps, fileFormat, themeMode, language } = useSelector(
    state => state.settings,
  );
  const { colors, isDark } = useTheme();
  // const [showPaywall, setShowPaywall] = useState(false);
  // TODO: Uncomment showPaywall state when Pro features are needed
  const [userId] = useState(() => generateRandomUserId());

  const handleCopyUserId = () => {
    Clipboard.setString(userId);
  };

  const SectionHeader = ({ title, isOpen = true }) => (
    <View style={styles.sectionHeader}>
      <CustomText
        style={[styles.sectionTitle, { color: colors.text, fontWeight: '800' }]}
      >
        {title}
      </CustomText>
      <TouchableOpacity>
        <View
          style={[
            styles.headerIconCircle,
            { backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9' },
          ]}
        >
          <Ionicons
            name={isOpen ? 'arrow-up' : 'arrow-down'}
            size={moderateScale(12)}
            color={colors.text}
          />
        </View>
      </TouchableOpacity>
    </View>
  );

  const SegmentedControl = ({ options, activeValue, onSelect }) => (
    <View
      style={[
        styles.segmentedContainer,
        {
          backgroundColor: isDark ? '#0f0f0f' : '#f1f5f9',
          borderWidth: isDark ? 0 : 1,
          borderColor: '#e2e8f0',
        },
      ]}
    >
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.segmentBtn,
            activeValue === opt && {
              backgroundColor: isDark ? '#d1d5db' : colors.primary,
            },
          ]}
          onPress={() => onSelect(opt)}
        >
          <CustomText
            style={[
              styles.segmentText,
              {
                color:
                  activeValue === opt
                    ? isDark
                      ? '#000'
                      : '#fff'
                    : isDark
                    ? '#888'
                    : '#666',
              },
            ]}
          >
            {opt}
          </CustomText>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Container edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons
            name="chevron-back"
            size={moderateScale(24)}
            color={colors.text}
          />
        </TouchableOpacity>
        <CustomText style={[styles.headerTitle, { color: colors.text }]}>
          {t('settings')}
        </CustomText>
        <View style={{ width: moderateScale(40) }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Pro Banner - Commented out for now */}
        {/* TODO: Uncomment Pro Banner when Pro features are needed    */}
        {/* <View
          style={[
            styles.proBanner,
            {
              backgroundColor: isDark ? '#1a1a1a' : colors.white,
              borderColor: colors.primary,
              borderWidth: 1.5,
              shadowColor: isDark ? '#000' : colors.primary,
              shadowOpacity: isDark ? 0.5 : 0.2,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            },
          ]}
        >
          <View style={styles.proContent}>
            <View
              style={[
                styles.proIconBox,
                { backgroundColor: colors.primary + '20' },
              ]}
            >
              <MaterialCommunityIcons
                name="crown"
                size={moderateScale(38)}
                color={colors.primary}
              />
            </View>
            <View style={styles.proTextBox}>
              <CustomText style={[styles.proTitle, { color: colors.text }]}>
                {t('proAccess')}
              </CustomText>
              <CustomText
                style={[styles.proSubtext, { color: colors.mutedText }]}
              >
                {t('proBenefit')}
              </CustomText>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.proButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowPaywall(true)}
          >
            <CustomText style={[styles.proButtonText, { color: colors.white }]}>
              {t('upgradeNow')}
            </CustomText>
            <Ionicons
              name="arrow-forward"
              size={moderateScale(16)}
              color={colors.white}
            />
          </TouchableOpacity>
        </View> */}
    

        {/* Camera Section */}
        <View style={styles.section}>
          <SectionHeader title={t('camera')} />

          <View style={styles.settingItem}>
            <View style={styles.itemLabelRow}>
              <MaterialCommunityIcons
                name="video-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.itemTitle, { color: colors.text }]}>
                {t('videoQuality')}
              </CustomText>
            </View>
            <SegmentedControl
              options={['1080p', '4K']}
              activeValue={resolution}
              onSelect={val => dispatch(setResolution(val))}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.itemLabelRow}>
              <MaterialCommunityIcons
                name="timer-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.itemTitle, { color: colors.text }]}>
                {t('frameRate')}
              </CustomText>
            </View>
            <SegmentedControl
              options={['24 fps', '30 fps', '60 fps']}
              activeValue={fps + ' fps'}
              onSelect={val => dispatch(setFps(parseInt(val)))}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.itemLabelRow}>
              <MaterialCommunityIcons
                name="movie-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.itemTitle, { color: colors.text }]}>
                {t('fileFormat')}
              </CustomText>
            </View>
            <SegmentedControl
              options={['MOV', 'MP4']}
              activeValue={fileFormat}
              onSelect={val => dispatch(setFileFormat(val))}
            />
          </View>

          <View style={styles.usageInfo}>
            <Ionicons
              name="information-circle"
              size={moderateScale(16)}
              color={colors.mutedText}
            />
            <CustomText style={[styles.usageText, { color: colors.mutedText }]}>
              ~240 MB/min (both files)
            </CustomText>
          </View>
        </View>

        {/* Account Section - PRO+ commented out for now */}
        {/* TODO: Uncomment PRO+ section when Pro features are needed
        <View style={styles.section}>
          <SectionHeader title={t('account')} />
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => setShowPaywall(true)}
          >
            <View style={styles.rowLeft}>
              <MaterialCommunityIcons
                name="diamond-stone"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.rowText, { color: colors.text }]}>
                PRO+
              </CustomText>
            </View>
            <Ionicons
              name="arrow-forward-circle"
              size={moderateScale(20)}
              color={colors.mutedText}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <MaterialCommunityIcons
                name="refresh"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.rowText, { color: colors.text }]}>
                {t('restorePurchases')}
              </CustomText>
            </View>
            <Ionicons
              name="arrow-forward-circle"
              size={moderateScale(20)}
              color={colors.mutedText}
            />
          </TouchableOpacity>
        </View>
        */}

        {/* Preferences Section */}
        <View style={styles.section}>
          <SectionHeader title={t('preferences')} />
          <View style={[styles.settingItem, { marginTop: moderateScale(10) }]}>
            <View style={styles.itemLabelRow}>
              <Ionicons
                name="moon-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.itemTitle, { color: colors.text }]}>
                {t('appTheme')}
              </CustomText>
            </View>
            <SegmentedControl
              options={[t('system'), t('light'), t('dark')]}
              activeValue={
                (themeMode || 'system').charAt(0).toUpperCase() +
                (themeMode || 'system').slice(1)
              }
              onSelect={val => dispatch(setThemeMode(val.toLowerCase()))}
            />
          </View>
          <TouchableOpacity style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <Ionicons
                name="notifications-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.rowText, { color: colors.text }]}>
                {t('notifications')}
              </CustomText>
            </View>
            <Ionicons
              name="arrow-forward-circle"
              size={moderateScale(20)}
              color={colors.mutedText}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => navigation.navigate('Language')}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="language-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.rowText, { color: colors.text }]}>
                {t('language')}
              </CustomText>
            </View>
            <View style={styles.rowRight}>
              <CustomText
                style={[
                  styles.rowValue,
                  { color: colors.mutedText, marginRight: moderateScale(8) },
                ]}
              >
                {LANG_MAP[language] || 'English'}
              </CustomText>
              <Ionicons
                name="arrow-forward-circle"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <SectionHeader title={t('appInfo')} />

          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Ionicons
                name="star-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.rowText, { color: colors.text }]}>
                {t('name')}
              </CustomText>
            </View>
            <CustomText style={[styles.rowValue, { color: colors.mutedText }]}>
              DualShot
            </CustomText>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Ionicons
                name="information-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.rowText, { color: colors.text }]}>
                {t('version')}
              </CustomText>
            </View>
            <CustomText style={[styles.rowValue, { color: colors.mutedText }]}>
              {getAppVersionString()}
            </CustomText>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Ionicons
                name="phone-portrait-outline"
                size={moderateScale(20)}
                color={colors.mutedText}
              />
              <CustomText style={[styles.rowText, { color: colors.text }]}>
                {t('userId')}
              </CustomText>
            </View>
            <View style={styles.userIdBox}>
              <CustomText
                numberOfLines={1}
                style={[styles.rowValue, { width: 100 }]}
              >
                {userId}
              </CustomText>
              <TouchableOpacity onPress={handleCopyUserId}>
                <Ionicons
                  name="copy-outline"
                  size={moderateScale(16)}
                  color="#666"
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: moderateScale(40) }} />
      </ScrollView>
     
      {/* TODO: Uncomment PaywallModal when Pro features are needed
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
      */}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {},
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
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
  scrollContent: {
    padding: moderateScale(16),
  },
  proBanner: {
    borderRadius: moderateScale(20),
    padding: moderateScale(20),
    marginBottom: moderateScale(30),
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  proContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(20),
  },
  proIconBox: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(15),
  },
  proTextBox: {
    flex: 1,
  },
  proTitle: {
    fontSize: moderateScale(20),
    fontWeight: '900',
    marginBottom: moderateScale(4),
  },
  proSubtext: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
  },
  proButton: {
    height: moderateScale(48),
    borderRadius: moderateScale(12),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    marginRight: moderateScale(8),
  },
  section: {
    marginBottom: moderateScale(25),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  sectionTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  headerIconCircle: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingItem: {
    marginBottom: moderateScale(20),
  },
  itemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  itemTitle: {
    fontSize: moderateScale(15),
    marginLeft: moderateScale(10),
    fontWeight: '600',
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: moderateScale(12),
    padding: moderateScale(4),
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: moderateScale(10),
    alignItems: 'center',
    borderRadius: moderateScale(8),
  },
  segmentBtnActive: {},
  segmentText: {
    fontWeight: '600',
    fontSize: moderateScale(13),
  },
  segmentTextActive: {},
  usageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(-5),
  },
  usageText: {
    fontSize: moderateScale(12),
    marginLeft: moderateScale(8),
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(15),
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowText: {
    fontSize: moderateScale(16),
    marginLeft: moderateScale(15),
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: moderateScale(14),
    marginRight: moderateScale(8),
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(15),
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIdBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default SettingsScreen;
