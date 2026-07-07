/* eslint-disable react/no-unstable-nested-components */
import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { moderateScale } from 'react-native-size-matters';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import CustomText from './CustomText';

import { useTranslation } from '../hooks/useTranslation';

const { width, height } = Dimensions.get('window');

const PaywallModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = React.useState('year');

  const FeatureItem = ({ text }) => (
    <View style={styles.featureItem}>
      <View style={styles.checkCircle}>
        <Ionicons name="checkmark" size={moderateScale(14)} color="#000" />
      </View>
      <CustomText style={styles.featureText}>{text}</CustomText>
    </View>
  );

  const PlanOption = ({ id, title, price, subPrice, badge, selected }) => (
    <TouchableOpacity
      style={[styles.planOption, selected && styles.planOptionSelected]}
      onPress={() => setSelectedPlan(id)}
      activeOpacity={0.8}
    >
      <View style={styles.planLeft}>
        <View
          style={[styles.radioOuter, selected && styles.radioOuterSelected]}
        >
          {selected && (
            <Ionicons name="checkmark" size={moderateScale(14)} color="#000" />
          )}
        </View>
        <View style={styles.planInfo}>
          <CustomText style={styles.planTitle}>{title}</CustomText>
          <CustomText style={styles.planSubPrice}>{subPrice}</CustomText>
        </View>
      </View>
      <View style={styles.planRight}>
        <CustomText style={styles.planPrice}>{price}</CustomText>
        <CustomText style={styles.planPerWeek}>{t('perWeek')}</CustomText>
      </View>
      {badge && (
        <View style={styles.saveBadge}>
          <CustomText style={styles.saveBadgeText}>{badge}</CustomText>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={moderateScale(24)} color="#fff" />
            </TouchableOpacity>

            {/* Header Mockup */}
            <View style={styles.mockupContainer}>
              <Image
                source={require('../assets/images/intro_mockup.jpg')}
                style={styles.mockupImage}
                resizeMode="contain"
              />
              {/* Optional: Add a subtle glow behind the mockup */}
              <View style={styles.mockupGlow} />
            </View>

            {/* Title & Badge */}
            <View style={styles.headerTextContainer}>
              <View style={styles.titleRow}>
                <CustomText style={styles.mainTitle}>DualShot</CustomText>
                <View style={styles.proBadge}>
                  <Ionicons name="star" size={moderateScale(12)} color="#fff" />
                  <CustomText style={styles.proBadgeText}>PRO</CustomText>
                </View>
              </View>
              <CustomText style={styles.subtitle}>
                {t('paywallSubtitle')}
              </CustomText>
            </View>

            {/* Features List */}
            <View style={styles.featuresContainer}>
              <FeatureItem text={t('feature1')} />
              <FeatureItem text={t('feature2')} />
              <FeatureItem text={t('feature3')} />
            </View>

            {/* Promo Banner */}
            <View style={styles.promoBanner}>
              <View style={styles.promoArrow} />
              <MaterialCommunityIcons
                name="fire"
                size={moderateScale(20)}
                color="#FF8A00"
              />
              <CustomText style={styles.promoText}>
                27482 {t('promoJoined')}
              </CustomText>
            </View>

            {/* Plans */}
            <View style={styles.plansContainer}>
              <PlanOption
                id="year"
                title={t('oneYear')}
                subPrice={`${t('perYear')} ₹3,350.00`}
                price="₹64.42"
                badge={`${t('bestValue')} 90%`}
                selected={selectedPlan === 'year'}
              />
              <PlanOption
                id="week"
                title={t('oneWeek')}
                price="₹650.00"
                selected={selectedPlan === 'week'}
              />
            </View>

            <CustomText style={styles.autoRenewText}>
              {t('autoRenewable')}
            </CustomText>

            {/* Continue Button */}
            <TouchableOpacity style={styles.continueBtn} activeOpacity={0.8}>
              <CustomText style={styles.continueText}>
                {t('continue')}
              </CustomText>
              <Ionicons
                name="chevron-forward"
                size={moderateScale(20)}
                color="#000"
              />
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.securedRow}>
                <Image
                  source={require('../assets/images/playstore.png')}
                  style={styles.playIcon}
                  resizeMode="contain"
                />
                <CustomText style={styles.securedText}>
                  {t('securedPlayStore')}
                </CustomText>
              </View>
              <View style={styles.linksRow}>
                <TouchableOpacity>
                  <CustomText style={styles.footerLink}>
                    {t('restorePurchases')}
                  </CustomText>
                </TouchableOpacity>
                <CustomText style={styles.footerDot}>•</CustomText>
                <TouchableOpacity>
                  <CustomText style={styles.footerLink}>
                    {t('privacy')}
                  </CustomText>
                </TouchableOpacity>
                <CustomText style={styles.footerDot}>•</CustomText>
                <TouchableOpacity>
                  <CustomText style={styles.footerLink}>
                    {t('terms')}
                  </CustomText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(30),
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: moderateScale(10),
  },
  mockupContainer: {
    height: height * 0.35,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: moderateScale(-10),
  },
  mockupImage: {
    width: '100%',
    height: '100%',
  },
  mockupGlow: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: width * 0.3,
    zIndex: -1,
  },
  headerTextContainer: {
    marginTop: moderateScale(10),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  mainTitle: {
    fontSize: moderateScale(36),
    fontWeight: '900',
    color: '#fff',
    marginRight: moderateScale(12),
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  proBadgeText: {
    color: '#fff',
    fontSize: moderateScale(12),
    fontWeight: '800',
    marginLeft: moderateScale(4),
  },
  subtitle: {
    fontSize: moderateScale(16),
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  featuresContainer: {
    marginTop: moderateScale(24),
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(14),
  },
  checkCircle: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(11),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  featureText: {
    fontSize: moderateScale(16),
    color: '#fff',
    fontWeight: '600',
  },
  promoBanner: {
    backgroundColor: '#00C853',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(12),
    marginTop: moderateScale(20),
    position: 'relative',
  },
  promoArrow: {
    position: 'absolute',
    bottom: -moderateScale(8),
    left: moderateScale(24),
    width: 0,
    height: 0,
    borderLeftWidth: moderateScale(8),
    borderLeftColor: 'transparent',
    borderRightWidth: moderateScale(8),
    borderRightColor: 'transparent',
    borderTopWidth: moderateScale(8),
    borderTopColor: '#00C853',
  },
  promoText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '700',
    marginLeft: moderateScale(8),
  },
  plansContainer: {
    marginTop: moderateScale(20),
  },
  planOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: moderateScale(24),
    padding: moderateScale(16),
    paddingHorizontal: moderateScale(20),
    marginBottom: moderateScale(12),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  planOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: '#fff',
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(16),
  },
  radioOuterSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  planInfo: {
    justifyContent: 'center',
  },
  planTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#fff',
  },
  planSubPrice: {
    fontSize: moderateScale(13),
    color: 'rgba(255,255,255,0.5)',
    marginTop: moderateScale(2),
  },
  planRight: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#fff',
  },
  planPerWeek: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  saveBadge: {
    position: 'absolute',
    top: -moderateScale(10),
    right: moderateScale(20),
    backgroundColor: '#007F36',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#00C853',
  },
  saveBadgeText: {
    color: '#fff',
    fontSize: moderateScale(11),
    fontWeight: '900',
  },
  autoRenewText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginTop: moderateScale(4),
    marginBottom: moderateScale(12),
  },
  continueBtn: {
    backgroundColor: '#E0E0E0',
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  continueText: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#000',
    marginRight: moderateScale(10),
  },
  footer: {
    marginTop: moderateScale(24),
    alignItems: 'center',
  },
  securedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  playIcon: {
    width: moderateScale(16),
    height: moderateScale(16),
    marginRight: moderateScale(6),
  },
  securedText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLink: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: moderateScale(10),
    fontWeight: '500',
  },
  footerDot: {
    color: 'rgba(255,255,255,0.2)',
    marginHorizontal: moderateScale(6),
    fontSize: moderateScale(10),
  },
});

export default PaywallModal;
