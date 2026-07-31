import type {
  CodegenTypes,
  HostComponent,
  ViewProps,
} from 'react-native';
import {codegenNativeComponent} from 'react-native';

type FullscreenChangeEvent = Readonly<{
  isFullscreen: boolean;
}>;

export type AiCallResultEvent = Readonly<{
  status: string;
}>;

export interface NativeProps extends ViewProps {
  accessToken?: string | null;
  groupId?: string | null;
  onCallResult?:
    | CodegenTypes.DirectEventHandler<AiCallResultEvent>
    | null;
  onFullscreenChange?:
    | CodegenTypes.DirectEventHandler<FullscreenChangeEvent>
    | null;
}

export default codegenNativeComponent<NativeProps>(
  'AiCallView',
) as HostComponent<NativeProps>;
