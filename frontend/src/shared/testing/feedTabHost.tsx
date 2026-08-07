import React from 'react';
import {useRoute} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Text} from 'react-native';

import type {
  AppScreenProps,
  AppScreenRenderer,
  SharedSubRoute,
} from '../../app-shell/types';

// 피드 탭의 FeedStack 위상만 재현하는 테스트용 호스트(S15P11B104-367).
//
// 알림·보관함은 셸이 소유하지만 렌더 위치는 피드 탭 스택이다. 셸 단독 테스트의
// 피드 목은 납작한 컴포넌트라 두 화면을 호스트할 스택이 없으므로, 이 목이
// 프로덕션과 같은 라우트 이름으로 등록해 셸이 실제 경로로 신호를 켜게 한다.
//
// 목이 신호를 직접 구동하게 만들지 않는 것이 중요하다. 그렇게 하면 셸↔스택
// 보고 배선이 죽어도 테스트가 초록색을 유지한다 — 이 리팩터가 만드는 위험의
// 정확한 형태다.
//
// 주입 API가 바뀌면 이 파일 한 곳만 고친다.
const HostStack = createNativeStackNavigator();

const SHARED_SUB_ROUTES: readonly SharedSubRoute[] = ['notifications', 'archive'];

// 프로덕션 FeedStack에 있는 나머지 화면. 딥링크가 중첩 params로 이 이름들을
// 지목하므로 등록해 두지 않으면 "NAVIGATE가 처리되지 않았다" 경고가 난다.
const FEED_LOCAL_ROUTES = ['PostDetail', 'PostComposer'] as const;

export interface FeedTabHostHomeContext {
  props: AppScreenProps;
  // 피드 탭 route params. 중첩 params 계약(initial·pop·screen)을 단언하는
  // 프로브가 읽는 값이다.
  tabParams: unknown;
}

interface FeedTabHostOptions {
  renderHome?: (context: FeedTabHostHomeContext) => React.ReactNode;
  // 하위 화면이 닫힌 뒤 스택 소유자가 받는 후처리 훅. 프로덕션 FeedScreen은 이
  // 자리에 feed.refresh를 바인딩한다.
  onSubRouteClosed?: (route: SharedSubRoute) => void;
}

export function createFeedTabHostScreen(
  options?: FeedTabHostOptions,
): AppScreenRenderer {
  return function FeedTabHost(props: AppScreenProps) {
    // 중첩 params는 탭 route에 실린다. 스택 안쪽에서 useRoute를 부르면 그 화면의
    // params가 나오므로 반드시 스택 밖(탭 화면 본문)에서 읽는다.
    const tabRoute = useRoute();
    const tabParams = tabRoute.params;

    return (
      <HostStack.Navigator
        screenOptions={{animation: 'none', headerShown: false}}
      >
        <HostStack.Screen name="FeedHome">
          {() => (
            <>
              {options?.renderHome?.({props, tabParams}) ?? (
                <Text>screen:feed</Text>
              )}
            </>
          )}
        </HostStack.Screen>
        {FEED_LOCAL_ROUTES.map(route => (
          <HostStack.Screen key={route} name={route}>
            {() => <Text>{`screen:${route}`}</Text>}
          </HostStack.Screen>
        ))}
        {SHARED_SUB_ROUTES.map(route => (
          <HostStack.Screen key={route} name={route}>
            {({navigation}) =>
              props.renderSharedSubRoute?.(route, {
                onClose: () => navigation.goBack(),
                onClosed: () => options?.onSubRouteClosed?.(route),
              }) ?? null
            }
          </HostStack.Screen>
        ))}
      </HostStack.Navigator>
    );
  };
}
