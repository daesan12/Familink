import { useState } from "react";
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedPressable } from "../components/AnimatedPressable";
import {
  AccountActionConfirmationModal,
  type AccountAction,
} from "../components/LogoutConfirmationModal";
import { useScreenEntrance } from "../hooks/useScreenEntrance";
import { AUTH_COLORS, AUTH_LAYOUT } from "../theme";

const FAMILY_ALBUM_ILLUSTRATION = require("../../../assets/images/family-album-welcome-illustration.png");
const FAMILINK_LOGO = require("../../../assets/images/familink-logo.png");

interface SignedInWelcomeScreenProps {
  onLogout: () => Promise<void>;
  onRequestWithdrawal: () => Promise<void>;
  onStartGroupOnboarding: () => void;
  userName: string;
}

export function SignedInWelcomeScreen({
  onLogout,
  onRequestWithdrawal,
  onStartGroupOnboarding,
  userName,
}: SignedInWelcomeScreenProps) {
  const entranceStyle = useScreenEntrance("signed-in-welcome");
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.screen, entranceStyle]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={styles.title}>{`${userName} 님,\n안녕하세요`}</Text>
            <Text style={styles.description}>
              {"Familink에서 가족과의\n첫 연결을 시작해볼까요?"}
            </Text>
          </View>

          <View style={styles.artworkStage}>
            <Image
              accessibilityLabel="가족 앨범 일러스트"
              resizeMode="contain"
              source={FAMILY_ALBUM_ILLUSTRATION}
              style={styles.artwork}
            />
          </View>

          <AnimatedPressable
            accessibilityLabel="가족과의 연결 시작하기"
            accessibilityRole="button"
            containerStyle={styles.startActionContainer}
            onPress={onStartGroupOnboarding}
          >
            <View style={styles.startAction}>
              <Text style={styles.startActionText}>가족과의 연결 시작하기</Text>
              <View style={styles.startActionIcon}>
                <MaterialDesignIcons
                  color={AUTH_COLORS.primary}
                  name="arrow-right"
                  size={30}
                />
              </View>
            </View>
          </AnimatedPressable>

          <View style={styles.footer}>
            <View style={styles.logoStage}>
              <Image
                accessibilityLabel="Familink"
                resizeMode="contain"
                source={FAMILINK_LOGO}
                style={styles.logo}
              />
            </View>
            <View style={styles.accountActions}>
              <AnimatedPressable
                accessibilityLabel="로그아웃"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setAccountAction("logout")}
              >
                <Text style={styles.accountActionText}>로그아웃</Text>
              </AnimatedPressable>
              <Text accessibilityElementsHidden style={styles.separator}>
                |
              </Text>
              <AnimatedPressable
                accessibilityLabel="회원탈퇴"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setAccountAction("withdrawal")}
              >
                <Text style={styles.accountActionText}>회원탈퇴</Text>
              </AnimatedPressable>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      <AccountActionConfirmationModal
        action={accountAction ?? "logout"}
        onCancel={() => setAccountAction(null)}
        onConfirm={accountAction === "withdrawal" ? onRequestWithdrawal : onLogout}
        visible={accountAction !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: AUTH_COLORS.background,
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 12,
    paddingHorizontal: AUTH_LAYOUT.horizontalPadding + 8,
    paddingTop: 32,
  },
  title: {
    color: "#454957",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.9,
    lineHeight: 42,
  },
  description: {
    color: AUTH_COLORS.body,
    fontSize: 16,
    letterSpacing: -0.25,
    lineHeight: 24,
    marginTop: 16,
  },
  artworkStage: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#FFF9EA",
    borderBottomLeftRadius: 54,
    borderBottomRightRadius: 76,
    borderTopLeftRadius: 72,
    borderTopRightRadius: 46,
    height: 244,
    justifyContent: "center",
    marginTop: 16,
    overflow: "hidden",
    width: "100%",
  },
  artwork: {
    height: "94%",
    width: "94%",
  },
  startActionContainer: {
    alignSelf: "center",
    marginTop: 16,
  },
  startAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 4,
  },
  startActionText: {
    color: "#454957",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  startActionIcon: {
    alignItems: "center",
    backgroundColor: "#F1EEFF",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  footer: {
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 16,
  },
  logoStage: {
    alignItems: "center",
    height: 64,
    justifyContent: "center",
    width: 130,
  },
  logo: {
    height: 96,
    width: 96,
  },
  accountActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  accountActionText: {
    color: "#969696",
    fontSize: 14,
    lineHeight: 32,
  },
  separator: {
    color: "#B8B8B8",
    fontSize: 14,
  },
});
