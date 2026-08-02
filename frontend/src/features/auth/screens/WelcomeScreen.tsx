import {Image, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {AnimatedPressable} from '../components/AnimatedPressable';
import {AUTH_COLORS, AUTH_LAYOUT} from '../theme';

const FAMILINK_LOGO = require('../../../assets/images/familink-logo.png');

interface WelcomeScreenProps {
  onStartLogin: () => void;
  onStartSignup: () => void;
}

export function WelcomeScreen({
  onStartLogin,
  onStartSignup,
}: WelcomeScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.logoStage}>
          <Image
            accessibilityLabel="Familink"
            resizeMode="contain"
            source={FAMILINK_LOGO}
            style={styles.logo}
          />
        </View>
        <View style={styles.actions}>
          <AnimatedPressable
            accessibilityLabel="로그인 시작"
            accessibilityRole="button"
            containerStyle={styles.loginButtonContainer}
            onPress={onStartLogin}>
            <View style={styles.loginButton}>
              <Text style={styles.loginText}>로그인</Text>
            </View>
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityLabel="회원가입 시작"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onStartSignup}>
            <Text style={styles.signupText}>회원가입</Text>
          </AnimatedPressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: AUTH_COLORS.background,
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 36,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding,
    paddingTop: 130,
  },
  logo: {
    height: 220,
    width: 220,
  },
  logoStage: {
    alignItems: 'center',
    height: 260,
    justifyContent: 'center',
    width: 260,
  },
  actions: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  loginButton: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.primarySoft,
    borderRadius: AUTH_LAYOUT.buttonRadius,
    boxShadow: '0px 7px 16px rgba(102, 83, 188, 0.12)',
    height: AUTH_LAYOUT.buttonHeight,
    justifyContent: 'center',
    width: '100%',
  },
  loginButtonContainer: {
    width: '100%',
  },
  loginText: {
    color: AUTH_COLORS.muted,
    fontSize: 18,
    fontWeight: '700',
  },
  signupText: {
    color: AUTH_COLORS.muted,
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 36,
  },
});
