import {
  useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import type {GroupRole} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';
import {RetryButton} from '../../../shared/components/RetryButton';
import {SubScreenHeader} from '../components/SubScreenHeader';
import {useJoinRequests} from '../hooks/useJoinRequests';
import {
  isCareReceiverAlreadyActiveInOtherGroup,
  isJoinRequestAlreadyProcessed,
  joinRequestDecisionErrorMessage,
  roleLabel,
} from '../joinRequestModel';
import type {
  JoinRequestProcessor,
  JoinRequestsLoader,
} from '../api/groupMembershipApi';
import type {JoinRequest} from '../types';

// 회원가입 때 프로필 사진을 등록하지 않은 신청자에게 쓰는 기본 이미지.
const PROFILE_PLACEHOLDER = require('../../../assets/images/profile-placeholder.png');

interface JoinApprovalScreenProps {
  groupId: string;
  onBack: () => void;
  // 가입 요청 로더 주입(테스트·연동용). 없으면 기본 로더로 조회한다.
  loader?: JoinRequestsLoader;
  // 승인·거절 처리 커맨드 주입. 없으면 로컬 상태만 갱신한다(API-GROUPS-009 연동은 후속).
  onProcess?: JoinRequestProcessor;
}

interface DecisionAlert {
  accessibilityLabel: string;
  confirmAccessibilityLabel: string;
  message?: string;
  title: string;
}

// H-5 가입 승인 대기. 관리자가 신청자를 확인해 승인(역할 지정) 또는 거절한다.
export function JoinApprovalScreen({
  groupId,
  onBack,
  loader,
  onProcess,
}: JoinApprovalScreenProps) {
  const joinRequests = useJoinRequests(groupId, loader);
  // H-5p 역할 선택 모달 대상. null이면 닫힘.
  const [approving, setApproving] = useState<JoinRequest | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [processAlert, setProcessAlert] = useState<DecisionAlert | null>(null);

  const applyDecision = async (
    request: JoinRequest,
    role?: GroupRole,
  ): Promise<boolean> => {
    if (processingId !== null) {
      return false;
    }

    setProcessError(null);
    setProcessAlert(null);
    setProcessingId(request.joinRequestId);
    try {
      await onProcess?.(groupId, {
        joinRequestId: request.joinRequestId,
        decision: role ? 'APPROVE' : 'REJECT',
        assignedRole: role,
      });
      // 연동 전 단계라 로컬 목록에서 즉시 제거해 처리 결과를 반영한다.
      joinRequests.remove(request.joinRequestId);
      return true;
    } catch (error) {
      const errorMessage = joinRequestDecisionErrorMessage(error);
      if (isJoinRequestAlreadyProcessed(error)) {
        setProcessError(errorMessage);
      } else if (isCareReceiverAlreadyActiveInOtherGroup(error)) {
        setProcessAlert({
          accessibilityLabel: '피보호자 승인 제한 안내',
          confirmAccessibilityLabel: '피보호자 승인 제한 확인',
          message: errorMessage,
          title: '피보호자로 승인할 수 없어요',
        });
      } else {
        setProcessAlert({
          accessibilityLabel: '가입 요청 처리 실패 안내',
          confirmAccessibilityLabel: '가입 요청 처리 실패 확인',
          title: '가입 요청을 처리하지 못했습니다.',
        });
      }
      // 이미 처리된 요청은 재시도할 수 없으므로 목록에서도 정리한다.
      if (isJoinRequestAlreadyProcessed(error)) {
        joinRequests.remove(request.joinRequestId);
      }
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (request: JoinRequest) => {
    return applyDecision(request);
  };

  const handleSelectRole = async (role: GroupRole) => {
    if (!approving || processingId !== null) {
      return;
    }
    // 실패해도 "참여했습니다" 역할 팝업이 남지 않도록 항상 닫는다.
    await applyDecision(approving, role);
    setApproving(null);
  };

  const handleCloseRoleModal = () => {
    // 처리 중 닫으면 진행 상황을 오인할 수 있으므로 완료 후에만 닫는다.
    if (processingId === null) {
      setApproving(null);
    }
  };

  return (
    <View style={styles.screen}>
      <SubScreenHeader onBack={onBack} title="가입 승인 대기" />

      {joinRequests.status === 'loading' ? (
        <View accessibilityLabel="가입 요청 불러오는 중" style={styles.statusBlock}>
          <ActivityIndicator color={COLORS.purple} size="large" />
        </View>
      ) : joinRequests.status === 'error' ? (
        <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
          <AppText style={styles.errorText}>{joinRequests.message}</AppText>
          <RetryButton onPress={joinRequests.retry} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {processError ? (
            <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
              {processError}
            </AppText>
          ) : null}
          <View style={styles.headingBlock}>
            <AppText style={styles.heading}>
              승인 요청 {joinRequests.requests.length}건
            </AppText>
            <AppText style={styles.subtitle}>
              가족인지 확인한 뒤 승인해 주세요.
            </AppText>
          </View>

          {joinRequests.requests.length > 0 ? (
            joinRequests.requests.map((request) => (
              <View key={request.joinRequestId} style={styles.requestCard}>
                <View style={styles.applicantRow}>
                  <CachedRemoteImage
                    source={
                      request.profileImageUrl
                        ? {uri: request.profileImageUrl}
                        : PROFILE_PLACEHOLDER
                    }
                    style={styles.avatar}
                  />
                  <AppText style={styles.applicantName}>
                    {request.applicantName}
                  </AppText>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityLabel={`${request.applicantName} 승인`}
                    accessibilityRole="button"
                    disabled={processingId !== null}
                    onPress={() => setApproving(request)}
                    style={[styles.actionButton, styles.approveButton]}
                  >
                    <AppText style={styles.approveText}>승인</AppText>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`${request.applicantName} 거절`}
                    accessibilityRole="button"
                    disabled={processingId !== null}
                    onPress={() => handleReject(request)}
                    style={[styles.actionButton, styles.rejectButton]}
                  >
                    <AppText style={styles.rejectText}>거절</AppText>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <AppText style={styles.emptyText}>
              대기 중인 가입 요청이 없어요.
            </AppText>
          )}

          <View style={styles.noticeCard}>
            <AppText style={styles.noticeTitle}>확인해 주세요</AppText>
            <AppText style={styles.noticeBody}>
              승인된 구성원은 가족 기록과 그룹 정보를 볼 수 있어요.
            </AppText>
          </View>
        </ScrollView>
      )}

      <RoleSelectModal
        processing={processingId !== null}
        request={approving}
        onSelect={handleSelectRole}
        onClose={handleCloseRoleModal}
      />
      <DecisionErrorModal
        alert={processAlert}
        onClose={() => setProcessAlert(null)}
      />
    </View>
  );
}

function DecisionErrorModal({
  alert,
  onClose,
}: {
  alert: DecisionAlert | null;
  onClose: () => void;
}) {
  if (alert === null) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={styles.alertBackdrop}>
        <View
          accessibilityLabel={alert.accessibilityLabel}
          accessibilityViewIsModal
          style={styles.alertCard}
        >
          <AppText style={styles.alertTitle}>{alert.title}</AppText>
          {alert.message ? (
            <AppText style={styles.alertMessage}>{alert.message}</AppText>
          ) : null}
          <Pressable
            accessibilityLabel={alert.confirmAccessibilityLabel}
            accessibilityRole="button"
            onPress={onClose}
            style={styles.alertButton}
          >
            <AppText style={styles.alertButtonText}>확인</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// H-5p 역할 선택 모달. 승인한 신청자의 그룹 역할(보호자/피보호자)을 정한다.
function RoleSelectModal({
  processing,
  request,
  onSelect,
  onClose,
}: {
  processing: boolean;
  request: JoinRequest | null;
  onSelect: (role: GroupRole) => void;
  onClose: () => void;
}) {
  const roles: readonly GroupRole[] = ['guardian', 'careReceiver'];

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={request !== null}
    >
      <Pressable
        accessibilityLabel="역할 선택 닫기"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
      >
        {request ? (
          <Pressable
            accessibilityViewIsModal
            accessible={false}
            onPress={() => {}}
            style={styles.roleCard}
          >
            <AppText style={styles.roleText}>
              {request.applicantName}님이 우리 가족에 참여했습니다.
            </AppText>
            <AppText style={styles.roleText}>가족의 역할을 정해주세요</AppText>
            <AppText style={styles.roleSubject}>
              [{request.applicantName}]님의 역할
            </AppText>
            <View style={styles.roleButtonRow}>
              {roles.map((role) => (
                <Pressable
                  accessibilityLabel={`${roleLabel(role)}로 지정`}
                  accessibilityRole="button"
                  disabled={processing}
                  key={role}
                  onPress={() => onSelect(role)}
                  style={[styles.roleButton, processing && styles.roleButtonDisabled]}
                >
                  <AppText style={styles.roleButtonText}>{roleLabel(role)}</AppText>
                </Pressable>
              ))}
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  alertBackdrop: {
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  alertButton: {
    alignItems: 'center',
    backgroundColor: COLORS.textMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
  },
  alertButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
  alertCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderRadius: RADII.sheet,
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
  },
  alertMessage: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  alertTitle: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  applicantName: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: '700',
  },
  applicantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  approveButton: {
    backgroundColor: COLORS.lavenderSurface,
  },
  approveText: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    gap: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyText: {
    color: COLORS.textSubtle,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  heading: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: '700',
  },
  // 제목과 안내 문구는 한 덩어리로 묶어 목록보다 좁은 간격을 쓴다.
  headingBlock: {
    gap: 6,
    marginTop: 24,
  },
  noticeBody: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  noticeCard: {
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    gap: 8,
    marginTop: 8,
    padding: 20,
  },
  noticeTitle: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  rejectButton: {
    backgroundColor: COLORS.lemon,
  },
  rejectText: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  requestCard: {
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    padding: 18,
  },
  roleButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.small,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 24,
  },
  roleButtonDisabled: {
    opacity: 0.5,
  },
  roleButtonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 20,
  },
  roleButtonText: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  roleCard: {
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderRadius: RADII.sheet,
    padding: 24,
    width: '100%',
  },
  roleSubject: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  roleText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
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
