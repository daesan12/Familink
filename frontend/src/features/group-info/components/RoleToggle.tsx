import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import type {GroupRole} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';

interface RoleToggleProps {
  // 세그먼트를 누른 사람이 볼 접근성 라벨에 쓸 대상 이름.
  memberName: string;
  role: GroupRole;
  // 항상 호출한다. 방장 여부에 따른 권한 처리는 상위 화면이 담당한다.
  onSelect: (role: GroupRole) => void;
}

const SEGMENTS: readonly {label: string; role: GroupRole}[] = [
  {label: '보호자', role: 'guardian'},
  {label: '피보호자', role: 'careReceiver'},
];

// 보호자/피보호자 세그먼트 토글. 현재 역할을 강조 표시한다.
export function RoleToggle({memberName, onSelect, role}: RoleToggleProps) {
  return (
    <View style={styles.container}>
      {SEGMENTS.map((segment) => {
        const isActive = segment.role === role;
        return (
          <Pressable
            accessibilityLabel={`${memberName} ${segment.label}`}
            accessibilityRole="button"
            accessibilityState={{selected: isActive}}
            key={segment.role}
            onPress={() => onSelect(segment.role)}
            style={[styles.segment, isActive && styles.segmentActive]}
          >
            <AppText
              style={[styles.label, isActive && styles.labelActive]}
            >
              {segment.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    flexDirection: 'row',
    padding: 3,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    color: COLORS.background,
    fontWeight: '700',
  },
  segment: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 12,
  },
  segmentActive: {
    backgroundColor: COLORS.purpleDeep,
  },
});
