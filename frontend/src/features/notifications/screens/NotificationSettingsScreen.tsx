import {useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Switch, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {BackButton} from '../../../shared/components/BackButton';
import {NoticeBanner} from '../../../shared/components/NoticeBanner';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_SETTING_GROUPS,
} from '../fixtures/notificationFixtures';
import {useNotificationGateway} from '../NotificationGatewayContext';
import type {
  NotificationGateway,
  NotificationSetting,
  NotificationType,
} from '../types';

interface NotificationSettingsScreenProps {
  gateway?: NotificationGateway;
  onBack: () => void;
  // 초기 설정 주입(테스트·연동용). 없으면 기본값(모두 켜짐)으로 시작한다.
  initialSettings?: readonly NotificationSetting[];
}

// I-6 알림 설정. 마이페이지(I-1)에서 진입하며, 7개 푸시 설정을 4개 그룹으로 나눠 토글한다.
// 서버 gateway가 주입된 실제 앱 경로에서는 조회 후 변경을 즉시 저장한다.
export function NotificationSettingsScreen({
  gateway,
  onBack,
  initialSettings,
}: NotificationSettingsScreenProps) {
  const contextGateway = useNotificationGateway();
  const resolvedGateway = gateway ?? contextGateway;
  const usesInjectedSettings = initialSettings !== undefined;
  const [settings, setSettings] = useState<readonly NotificationSetting[]>(
    initialSettings ?? DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(
    resolvedGateway !== null && !usesInjectedSettings,
  );
  const [isLoadFailed, setIsLoadFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRevisionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const settingByType = useMemo(() => {
    const map = new Map<NotificationType, NotificationSetting>();
    settings.forEach(setting => map.set(setting.type, setting));
    return map;
  }, [settings]);

  useEffect(() => {
    if (resolvedGateway === null || usesInjectedSettings) {
      setIsLoading(false);
      return;
    }

    let disposed = false;
    setIsLoading(true);
    setIsLoadFailed(false);
    setErrorMessage(null);
    resolvedGateway
      .loadSettings()
      .then(remote => {
        if (!disposed) {
          setSettings(remote);
          setIsLoadFailed(false);
        }
      })
      .catch(error => {
        if (!disposed) {
          setIsLoadFailed(true);
          setErrorMessage(toSettingsErrorMessage(error));
        }
      })
      .finally(() => {
        if (!disposed) {
          setIsLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [resolvedGateway, usesInjectedSettings]);

  const handleToggle = (type: NotificationType) => {
    const revision = ++saveRevisionRef.current;
    const nextSettings = settings.map(setting =>
      setting.type === type
        ? {...setting, enabled: !setting.enabled}
        : setting,
    );
    setSettings(nextSettings);

    if (resolvedGateway === null || usesInjectedSettings) {
      return;
    }

    setErrorMessage(null);
    const nextSave = saveQueueRef.current
      .catch(() => undefined)
      .then(() => resolvedGateway.updateSettings(nextSettings))
      .then(() => undefined);
    saveQueueRef.current = nextSave;
    void nextSave.catch(error => {
      if (saveRevisionRef.current !== revision) {
        return;
      }
      void resolvedGateway
        .loadSettings()
        .then(remote => {
          if (
            mountedRef.current &&
            saveRevisionRef.current === revision
          ) {
            setSettings(remote);
          }
        })
        .catch(() => undefined);
      setErrorMessage(toSettingsErrorMessage(error));
    });
  };

  const settingContent = NOTIFICATION_SETTING_GROUPS.map(group => {
    const rows = group.types
      .map(type => settingByType.get(type))
      .filter((setting): setting is NotificationSetting => setting !== undefined);
    if (rows.length === 0) {
      return null;
    }
    return (
      <View key={group.title} style={styles.groupBlock}>
        <Text style={styles.groupTitle}>{group.title}</Text>
        <View style={styles.groupCard}>
          {rows.map((setting, index) => (
            <View
              key={setting.type}
              style={[
                styles.settingRow,
                index < rows.length - 1 && styles.settingDivider,
              ]}
            >
              <View style={styles.settingTexts}>
                <Text style={styles.settingLabel}>{setting.label}</Text>
                {setting.description ? (
                  <Text style={styles.settingDescription}>
                    {setting.description}
                  </Text>
                ) : null}
              </View>
              <Switch
                accessibilityLabel={`${setting.label} 푸시 알림`}
                disabled={isLoading || isLoadFailed}
                onValueChange={() => handleToggle(setting.type)}
                thumbColor={COLORS.background}
                trackColor={{false: COLORS.inactive, true: COLORS.purple}}
                value={setting.enabled}
              />
            </View>
          ))}
        </View>
      </View>
    );
  });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={styles.headerTitle}>알림 설정</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>앱 푸시 알림</Text>
        {isLoading ? (
          <Text style={styles.statusMessage}>설정을 불러오는 중이에요.</Text>
        ) : null}
        {errorMessage ? (
          <View style={styles.errorBannerWrap}>
            <NoticeBanner message={errorMessage} />
          </View>
        ) : null}
        {settingContent}
      </ScrollView>
    </View>
  );
}

function toSettingsErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  errorBannerWrap: {
    marginTop: 8,
  },
  groupBlock: {
    marginTop: 20,
  },
  groupCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupTitle: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  headerButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  statusMessage: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 12,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 20,
  },
  settingDescription: {
    color: COLORS.textSubtle,
    fontSize: 12,
    marginTop: 3,
  },
  settingDivider: {
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 18,
  },
  settingTexts: {
    flex: 1,
    paddingRight: 12,
  },
});
