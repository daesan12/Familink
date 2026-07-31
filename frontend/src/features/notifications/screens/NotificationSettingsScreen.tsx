import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_SETTING_GROUPS,
} from '../fixtures/notificationFixtures';
import type {NotificationSetting, NotificationType} from '../types';

interface NotificationSettingsScreenProps {
  onBack: () => void;
  // 초기 설정 주입(테스트·연동용). 없으면 기본값(모두 켜짐)으로 시작한다.
  initialSettings?: readonly NotificationSetting[];
}

// I-6 알림 설정. 마이페이지(I-1)에서 진입하며, 7개 푸시 설정을 4개 그룹으로 나눠 토글한다.
// 저장은 목업 수준(로컬 상태 반영)이라 상단 체크는 장식 표시로 둔다.
export function NotificationSettingsScreen({
  onBack,
  initialSettings = DEFAULT_NOTIFICATION_SETTINGS,
}: NotificationSettingsScreenProps) {
  const [settings, setSettings] = useState(initialSettings);

  const settingByType = useMemo(() => {
    const map = new Map<NotificationType, NotificationSetting>();
    settings.forEach(setting => map.set(setting.type, setting));
    return map;
  }, [settings]);

  const handleToggle = (type: NotificationType) => {
    setSettings(current =>
      current.map(setting =>
        setting.type === type
          ? {...setting, enabled: !setting.enabled}
          : setting,
      ),
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={styles.headerButton}
        >
          <MaterialDesignIcons
            color={COLORS.textStrong}
            name="chevron-left"
            size={24}
          />
        </Pressable>
        <Text style={styles.headerTitle}>알림 설정</Text>
        {/* 토글이 즉시 반영되므로 별도 저장 액션 없이 제목만 가운데 정렬한다. */}
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>앱 푸시 알림</Text>
        {NOTIFICATION_SETTING_GROUPS.map(group => {
          const rows = group.types
            .map(type => settingByType.get(type))
            .filter((setting): setting is NotificationSetting =>
              setting !== undefined,
            );
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
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
    paddingHorizontal: 20,
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
