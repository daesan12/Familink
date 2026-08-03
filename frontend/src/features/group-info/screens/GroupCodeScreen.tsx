import Clipboard from '@react-native-clipboard/clipboard';
import {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {RetryButton} from '../../../shared/components/RetryButton';
import {SubScreenHeader} from '../components/SubScreenHeader';
import {useGroupInviteCode} from '../hooks/useGroupInviteCode';
import type {GroupInviteCodeLoader} from '../api/groupMembershipApi';

interface GroupCodeScreenProps {
  groupId: string;
  onBack: () => void;
  // 초대 코드 로더 주입(테스트·연동용). 없으면 기본 로더로 조회한다.
  loader?: GroupInviteCodeLoader;
  // 코드 복사 동작 주입. 없으면 연동 전 안내를 띄운다(네이티브 클립보드 연동은 후속).
  onCopyCode?: (code: string) => void;
}

const INVITE_STEPS: readonly string[] = [
  '그룹 코드를 복사해 가족에게 전달해요.',
  '가족이 가입 후 코드를 입력해요.',
  '그룹관리자가 가입 요청을 승인해요.',
];

// H-4 그룹 코드. 구성원을 초대하기 위해 그룹 코드를 확인하고 공유·복사한다.
export function GroupCodeScreen({
  groupId,
  onBack,
  loader,
  onCopyCode,
}: GroupCodeScreenProps) {
  const invite = useGroupInviteCode(groupId, loader);
  const [copied, setCopied] = useState(false);

  const handleCopy = (code: string) => {
    // onCopyCode 주입 시 그 구현을 쓰고(테스트·커스텀), 없으면 기기 클립보드에 복사한다.
    if (onCopyCode) {
      onCopyCode(code);
    } else {
      Clipboard.setString(code);
    }
    setCopied(true);
  };

  return (
    <View style={styles.screen}>
      <SubScreenHeader onBack={onBack} title="그룹 코드" />

      {invite.status === 'loading' ? (
        <View accessibilityLabel="그룹 코드 불러오는 중" style={styles.statusBlock}>
          <ActivityIndicator color={COLORS.purple} size="large" />
        </View>
      ) : invite.status === 'error' ? (
        <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
          <Text style={styles.errorText}>{invite.message}</Text>
          <RetryButton onPress={invite.retry} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>가족을 초대해 보세요</Text>
          <Text style={styles.subtitle}>
            아래 코드를 공유하면 같은 그룹에 참여할 수 있어요.
          </Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>우리 가족 그룹 코드</Text>
            <Text
              accessibilityLabel={`그룹 코드 ${invite.inviteCode}`}
              style={styles.code}
            >
              {invite.inviteCode}
            </Text>
            <Text style={styles.expiry}>유효 기간 · 제한 없음</Text>
            <Pressable
              accessibilityLabel="그룹 코드 복사"
              accessibilityRole="button"
              onPress={() => handleCopy(invite.inviteCode)}
              style={styles.copyButton}
            >
              <Text style={styles.copyButtonText}>
                {copied ? '복사했어요' : '코드 복사'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>초대 방법</Text>
            {INVITE_STEPS.map((step, index) => (
              <Text key={step} style={styles.guideStep}>
                {index + 1}. {step}
              </Text>
            ))}
          </View>

          <Text style={styles.securityNote}>
            보안을 위해 모르는 사람에게 코드를 공유하지 마세요.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  code: {
    color: COLORS.textStrong,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 12,
    textAlign: 'center',
  },
  codeCard: {
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  codeLabel: {
    color: COLORS.textSubtle,
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    gap: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  copyButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.small,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 40,
  },
  copyButtonText: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  expiry: {
    color: COLORS.textSubtle,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  guideCard: {
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    gap: 12,
    padding: 20,
  },
  guideStep: {
    color: COLORS.text,
    fontSize: 14,
  },
  guideTitle: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  heading: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  securityNote: {
    color: COLORS.textSubtle,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  statusBlock: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  subtitle: {
    color: COLORS.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
});
