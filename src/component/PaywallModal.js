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
import { useIAP } from '../hooks/useIAP';
import { useSelector } from 'react-redux';
import { Platform, ActivityIndicator, Alert } from 'react-native';

import { useTranslation } from '../hooks/useTranslation';
import { SUBSCRIPTION_SKUS } from '../utils/iapSkus';

const { width, height } = Dimensions.get('window');

const FeatureItem = ({ text }) => (
  <View style={styles.featureItem}>
    <View style={styles.checkCircle}>
      <Ionicons name="checkmark" size={moderateScale(14)} color="#000" />
    </View>
    <CustomText style={styles.featureText}>{text}</CustomText>
  </View>
);

const PlanOption = ({
  id,
  title,
  price,
  subPrice,
  badge,
  selected,
  periodText,
  isActive,
  onSelect,
}) => (
  <TouchableOpacity
    style={[styles.planOption, selected && styles.planOptionSelected]}
    onPress={() => onSelect(id)}
    activeOpacity={0.8}
  >
    <View style={styles.planLeft}>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
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
      <CustomText style={styles.planPerWeek}>{periodText}</CustomText>
    </View>
    {badge && !isActive && (
      <View style={styles.saveBadge}>
        <CustomText style={styles.saveBadgeText}>{badge}</CustomText>
      </View>
    )}
    {isActive && (
      <View
        style={[
          styles.saveBadge,
          { backgroundColor: '#00C853', borderColor: '#00C853' },
        ]}
      >
        <CustomText style={styles.saveBadgeText}>Current Plan</CustomText>
      </View>
    )}
  </TouchableOpacity>
);

const PaywallModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const isPro = useSelector(state => state.user?.isPro);
  const activePlanId = useSelector(state => state.user?.activePlanId);
  const [selectedPlan, setSelectedPlan] = React.useState('yearly');
  const [alertConfig, setAlertConfig] = React.useState({ visible: false, title: '', message: '', isSuccess: true });
  const { requestBuySubscription, isPurchasing, subscriptions, restorePurchases, error } = useIAP();

  React.useEffect(() => {
    if (error) {
      if (error === 'USER_CANCELLED') {
        setAlertConfig({
          visible: true,
          isSuccess: false,
          title: 'Purchase Cancelled',
          message: 'You have cancelled the purchase process.'
        });
      } else {
        setAlertConfig({
          visible: true,
          isSuccess: false,
          title: 'Purchase Failed',
          message: error
        });
      }
    }
  }, [error]);

  // Helper to extract localized price from react-native-iap product object
  const getSubPrice = (sku) => {
    const sub = subscriptions?.find(s => s.productId === sku || s.id === sku);
    if (!sub) return null;
    
    if (sub.displayPrice) return sub.displayPrice;
    if (sub.localizedPrice) return sub.localizedPrice;

    if (Platform.OS === 'ios') {
      return sub.localizedPrice;
    } else {
      // Android Play Billing v6+ (v15 of IAP)
      if (sub.subscriptionOfferDetailsAndroid && sub.subscriptionOfferDetailsAndroid.length > 0) {
        return sub.subscriptionOfferDetailsAndroid[0].pricingPhases?.pricingPhaseList?.[0]?.formattedPrice;
      }
      if (sub.subscriptionOfferDetails && sub.subscriptionOfferDetails.length > 0) {
        return sub.subscriptionOfferDetails[0].pricingPhases?.pricingPhaseList?.[0]?.formattedPrice;
      }
    }
    return null;
  };

  // No hardcoded currency fallback here: subscriptions are region-priced, so a
  // fixed default would show the wrong currency to non-Indian users whenever
  // the store fetch is still loading or fails. `null` means "not ready yet"
  // and the UI below shows a placeholder + disables purchase instead.
  const yearlyPrice = getSubPrice(
    Platform.OS === 'ios' ? SUBSCRIPTION_SKUS.ios.yearly : SUBSCRIPTION_SKUS.android.yearly,
  );
  const monthlyPrice = getSubPrice(
    Platform.OS === 'ios' ? SUBSCRIPTION_SKUS.ios.monthly : SUBSCRIPTION_SKUS.android.monthly,
  );
  const pricesReady = !!(yearlyPrice && monthlyPrice);

  const getWeeklyPriceString = (formattedPrice) => {
    if (!formattedPrice) return null;
    const numericMatch = formattedPrice.match(/[\d,.]+/);
    if (!numericMatch) return formattedPrice;
    
    let numericString = numericMatch[0].replace(/,/g, '');
    const priceAmount = parseFloat(numericString);
    if (isNaN(priceAmount)) return formattedPrice;
    
    const weeklyPrice = (priceAmount / 52).toFixed(2);
    return formattedPrice.replace(numericMatch[0], weeklyPrice);
  };

  const yearlyWeeklyPrice = getWeeklyPriceString(yearlyPrice);

  const handleContinue = async () => {
    if (!pricesReady) return;

    const skus = Platform.OS === 'ios' ? SUBSCRIPTION_SKUS.ios : SUBSCRIPTION_SKUS.android;
    const sku = selectedPlan === 'yearly' ? skus.yearly : skus.monthly;

    // Check if user already has this exact plan active
    if (isPro && activePlanId === sku) {
      setAlertConfig({
        visible: true,
        isSuccess: true,
        title: 'Already Subscribed',
        message: `You already have the ${selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'} plan active. Enjoy your Pro features!`,
      });
      return;
    }

    await requestBuySubscription(sku);
  };

  const handleRestore = async () => {
    const result = await restorePurchases();
    if (result.success) {
      setAlertConfig({
        visible: true,
        isSuccess: true,
        title: 'Restore Complete',
        message: result.count > 0 ? `Successfully restored ${result.count} purchase(s).` : 'No active subscriptions found to restore.'
      });
    } else {
      setAlertConfig({
        visible: true,
        isSuccess: false,
        title: 'Restore Failed',
        message: result.error?.message || 'Could not restore purchases.'
      });
    }
  };

  const isSelectedActive =
    (selectedPlan === 'yearly' && activePlanId?.includes('year')) ||
    (selectedPlan === 'monthly' && activePlanId?.includes('month'));

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
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
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

                <View style={styles.plansContainer}>
                  <PlanOption
                    id="yearly"
                    title={t('oneYear')}
                    subPrice={
                      yearlyPrice ? `${t('perYear')} ${yearlyPrice}` : t('perYear')
                    }
                    price={yearlyWeeklyPrice || '···'}
                    periodText={t('perWeek')}
                    badge={`${t('bestValue')} 90%`}
                    selected={selectedPlan === 'yearly'}
                    isActive={activePlanId?.includes('year')}
                    onSelect={setSelectedPlan}
                  />
                  <PlanOption
                    id="monthly"
                    title={t('oneMonth')}
                    price={monthlyPrice || '···'}
                    periodText={t('perMonth')}
                    selected={selectedPlan === 'monthly'}
                    isActive={activePlanId?.includes('month')}
                    onSelect={setSelectedPlan}
                  />
                </View>

                <CustomText style={styles.autoRenewText}>
                  {t('autoRenewable')}
                </CustomText>

                {/* Continue Button */}
                <TouchableOpacity
                  style={[
                    styles.continueBtn,
                    !pricesReady && styles.continueBtnDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={handleContinue}
                  disabled={isPurchasing || !pricesReady}
                >
                  {isPurchasing || !pricesReady ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <CustomText style={styles.continueText}>
                        {isSelectedActive ? 'Subscribed' : t('continue')}
                      </CustomText>
                      {!isSelectedActive && (
                        <Ionicons
                          name="chevron-forward"
                          size={moderateScale(20)}
                          color="#000"
                        />
                      )}
                    </>
                  )}
                </TouchableOpacity>

            {/* Restore Button */}
            <TouchableOpacity 
              style={styles.restoreBtn} 
              activeOpacity={0.7}
              onPress={handleRestore}
              disabled={isPurchasing}
            >
              <CustomText style={styles.restoreBtnText}>
                {t('restorePurchases')}
              </CustomText>
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.securedRow}>
                {Platform.OS === 'ios' ? (
                  <Ionicons name="logo-apple" size={moderateScale(16)} color="#fff" style={styles.playIcon} />
                ) : (
                  <Image
                    source={require('../assets/images/playstore.png')}
                    style={styles.playIcon}
                    resizeMode="contain"
                  />
                )}
                <CustomText style={styles.securedText}>
                  {Platform.OS === 'ios' ? t('securedAppStore') : t('securedPlayStore')}
                </CustomText>
              </View>
              <View style={styles.linksRow}>
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

      {/* Custom Alert Modal */}
      <Modal
        visible={alertConfig.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <View style={[styles.alertIconContainer, { backgroundColor: alertConfig.isSuccess ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 59, 48, 0.1)' }]}>
              <Ionicons 
                name={alertConfig.isSuccess ? 'checkmark-circle' : 'close-circle'} 
                size={moderateScale(40)} 
                color={alertConfig.isSuccess ? '#00C853' : '#FF3B30'} 
              />
            </View>
            <CustomText style={styles.alertTitle}>{alertConfig.title}</CustomText>
            <CustomText style={styles.alertMessage}>{alertConfig.message}</CustomText>
            
            <TouchableOpacity 
              style={styles.alertBtn} 
              activeOpacity={0.8}
              onPress={() => setAlertConfig({ ...alertConfig, visible: false })}
            >
              <CustomText style={styles.alertBtnText}>Okay</CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueText: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#000',
    marginRight: moderateScale(10),
  },
  restoreBtn: {
    backgroundColor: 'transparent',
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: moderateScale(16),
  },
  restoreBtnText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#fff',
  },
  activeProContainer: {
    marginTop: moderateScale(30),
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: moderateScale(24),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeProTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#fff',
    marginTop: moderateScale(12),
  },
  activeProSubtitle: {
    fontSize: moderateScale(14),
    color: 'rgba(255,255,255,0.6)',
    marginTop: moderateScale(6),
    textAlign: 'center',
  },
  footer: {
    marginTop: moderateScale(32),
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
    color: 'rgba(255,255,255,0.5)',
    fontSize: moderateScale(11),
  },
  footerDot: {
    color: 'rgba(255,255,255,0.2)',
    marginHorizontal: moderateScale(6),
    fontSize: moderateScale(10),
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },
  alertContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: moderateScale(24),
    padding: moderateScale(24),
    width: '100%',
    maxWidth: moderateScale(340),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  alertIconContainer: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  alertTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#fff',
    marginBottom: moderateScale(8),
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: moderateScale(14),
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: moderateScale(24),
    lineHeight: moderateScale(20),
  },
  alertBtn: {
    backgroundColor: '#fff',
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(32),
    borderRadius: moderateScale(100),
    width: '100%',
    alignItems: 'center',
  },
  alertBtnText: {
    color: '#000',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
});

export default PaywallModal;
