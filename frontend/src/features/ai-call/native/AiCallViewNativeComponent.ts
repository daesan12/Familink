import type {
  CodegenTypes,
  HostComponent,
  ViewProps,
} from 'react-native';
import {codegenNativeComponent} from 'react-native';

type FullscreenChangeEvent = Readonly<{
  isFullscreen: boolean;
}>;

export interface NativeProps extends ViewProps {
  onFullscreenChange?:
    | CodegenTypes.DirectEventHandler<FullscreenChangeEvent>
    | null;
}

export default codegenNativeComponent<NativeProps>(
  'AiCallView',
) as HostComponent<NativeProps>;
