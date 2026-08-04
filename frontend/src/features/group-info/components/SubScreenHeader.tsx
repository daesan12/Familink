import {StyleSheet, Text, View} from 'react-native';

import {COLORS} from '../../../design/tokens';
import {BackButton} from '../../../shared/components/BackButton';

interface SubScreenHeaderProps {
  title: string;
  onBack: () => void;
}

// 그룹정보 하위 전체화면(H-4·H-5) 공통 헤더. 왼쪽 뒤로가기 + 가운데 제목.
export function SubScreenHeader({title, onBack}: SubScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <BackButton onPress={onBack} style={styles.backButton} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    left: 20,
    position: 'absolute',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
});
