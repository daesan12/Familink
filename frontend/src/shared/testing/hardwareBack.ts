import {BackHandler} from 'react-native';

type BackPressHandler = () => boolean;

export interface HardwareBackMock {
  /**
   * 등록된 리스너를 React Native와 같은 순서로 호출한다. 마지막에 등록한 리스너가
   * 먼저 실행되고, 처음으로 `true`를 반환한 리스너에서 멈춘다.
   *
   * @returns 처리한 리스너가 있으면 `true`. 아무도 처리하지 않으면 `false`이며,
   *   실제 앱에서 `BackHandler.exitApp()`이 호출되는 상황, 즉 앱 종료를 뜻한다.
   */
  press(): boolean;
  /** 현재 등록되어 있는 리스너 수. */
  size(): number;
  /** `BackHandler.addEventListener` 원본 구현을 되돌린다. */
  restore(): void;
}

/**
 * 하드웨어 뒤로가기를 검증하기 위해 `BackHandler.addEventListener`를 대체한다.
 *
 * <p>여러 화면이 동시에 리스너를 등록하는 상황을 재현해야 하므로 등록된 리스너를
 * 모두 보관하고 역순으로 호출한다. 리스너를 하나만 붙잡아 두면 셸과 화면 중
 * 어느 쪽이 실제로 뒤로가기를 처리하는지 구분할 수 없다.
 */
export function mockHardwareBack(): HardwareBackMock {
  const handlers: BackPressHandler[] = [];

  const addEventListener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      const wrapped: BackPressHandler = () => handler({} as never) === true;
      handlers.push(wrapped);

      return {
        remove: () => {
          const index = handlers.indexOf(wrapped);
          if (index !== -1) {
            handlers.splice(index, 1);
          }
        },
      };
    });

  return {
    press: () => {
      for (let index = handlers.length - 1; index >= 0; index -= 1) {
        if (handlers[index]()) {
          return true;
        }
      }

      return false;
    },
    size: () => handlers.length,
    restore: () => addEventListener.mockRestore(),
  };
}
