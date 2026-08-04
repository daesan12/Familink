import {useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {GroupRole} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';
import {RetryButton} from '../../../shared/components/RetryButton';
import {SubScreenHeader} from '../components/SubScreenHeader';
import {useJoinRequests} from '../hooks/useJoinRequests';
import {
  isJoinRequestAlreadyProcessed,
  joinRequestDecisionErrorMessage,
  roleLabel,
} from '../joinRequestModel';
import {avatarInitial} from '../rankingModel';
import type {
  JoinRequestProcessor,
  JoinRequestsLoader,
} from '../api/groupMembershipApi';
import type {JoinRequest} from '../types';

interface JoinApprovalScreenProps {
  groupId: string;
  onBack: () => void;
  // 가입 요청 로더 주입(테스트·연동용). 없으면 기본 로더로 조회한다.
  loader?: JoinRequestsLoader;
  // 승인·거절 처리 커맨드 주입. 없으면 로컬 상태만 갱신한다(API-GROUPS-009 연동은 후속).
  onProcess?: JoinRequestProcessor;
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

  const applyDecision = async (
    request: JoinRequest,
    role?: GroupRole,
  ): Promise<boolean> => {
    if (processingId !== null) {
      return false;
    }

    setProcessError(null);
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
      setProcessError(joinRequestDecisionErrorMessage(error));
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
    // 실패해도 "참여했습니다" 팝업이 남지 않도록 항상 닫고, 오류는 화면 문구로 안내한다.
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
          <Text style={styles.errorText}>{joinRequests.message}</Text>
          <RetryButton onPress={joinRequests.retry} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {processError ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {processError}
            </Text>
          ) : null}
          <Text style={styles.heading}>
            승인 요청 {joinRequests.requests.length}건
          </Text>
          <Text style={styles.subtitle}>가족인지 확인한 뒤 승인해 주세요.</Text>

          {joinRequests.requests.length > 0 ? (
            joinRequests.requests.map((request) => (
              <View key={request.joinRequestId} style={styles.requestCard}>
                <View style={styles.applicantRow}>
                  {request.profileImageUrl ? (
                    <CachedRemoteImage
                      source={{uri: request.profileImageUrl}}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {avatarInitial(request.applicantName)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.applicantName}>
                    {request.applicantName}
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityLabel={`${request.applicantName} 거절`}
                    accessibilityRole="button"
                    disabled={processingId !== null}
                    onPress={() => handleReject(request)}
                    style={[styles.actionButton, styles.rejectButton]}
                  >
                    <Text style={styles.rejectText}>거절</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`${request.applicantName} 승인`}
                    accessibilityRole="button"
                    disabled={processingId !== null}
                    onPress={() => setApproving(request)}
                    style={[styles.actionButton, styles.approveButton]}
                  >
                    <Text style={styles.approveText}>승인</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              대기 중인 가입 요청이 없어요.
            </Text>
          )}

          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>확인해 주세요</Text>
            <Text style={styles.noticeBody}>
              승인된 구성원은 가족 기록과 그룹 정보를 볼 수 있어요.
            </Text>
          </View>
        </ScrollView>
      )}

      <RoleSelectModal
        processing={processingId !== null}
        request={approving}
        onSelect={handleSelectRole}
        onClose={handleCloseRoleModal}
      />
    </View>
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
            <Text style={styles.roleText}>
              {request.applicantName}님이 우리 가족에 참여했습니다.
            </Text>
            <Text style={styles.roleText}>가족의 역할을 정해주세요</Text>
            <Text style={styles.roleSubject}>
              [{request.applicantName}]님의 역할
            </Text>
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
                  <Text style={styles.roleButtonText}>{roleLabel(role)}</Text>
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
  actionButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: RADII.small,
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
    fontSize: 16,
    fontWeight: '700',
  },
  applicantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  approveButton: {
    backgroundColor: COLORS.textMuted,
  },
  approveText: {
    color: COLORS.background,
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
  avatarText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '700',
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
    marginTop: 8,
  },
  noticeBody: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  noticeCard: {
    backgroundColor: COLORS.surfaceMuted,
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
    backgroundColor: COLORS.surfaceMuted,
  },
  rejectText: {
    color: COLORS.error,
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
