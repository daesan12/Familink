import type * as React from 'react';
import type {
  CodegenTypes,
  HostComponent,
  ViewProps,
} from 'react-native';
import {
  codegenNativeCommands,
  codegenNativeComponent,
} from 'react-native';

type AccessTokenRefreshRequestEvent = Readonly<{
  requestId: string;
}>;

type FullscreenChangeEvent = Readonly<{
  isFullscreen: boolean;
}>;

export type AiCallResultEvent = Readonly<{
  status: string;
}>;

export interface NativeProps extends ViewProps {
  apiBaseUrl?: string | null;
  accessToken?: string | null;
  groupId?: string | null;
  onAccessTokenRefreshRequested?:
    | CodegenTypes.DirectEventHandler<AccessTokenRefreshRequestEvent>
    | null;
  onCallResult?:
    | CodegenTypes.DirectEventHandler<AiCallResultEvent>
    | null;
  onFullscreenChange?:
    | CodegenTypes.DirectEventHandler<FullscreenChangeEvent>
    | null;
}

type NativeType = HostComponent<NativeProps>;

interface NativeCommands {
  completeAccessTokenRefresh(
    viewRef: React.ElementRef<NativeType>,
    requestId: string,
    accessToken: string,
    errorCode: string,
  ): void;
}

export const Commands: NativeCommands =
  codegenNativeCommands<NativeCommands>({
    supportedCommands: ['completeAccessTokenRefresh'],
  });

export default codegenNativeComponent<NativeProps>(
  'AiCallView',
) as NativeType;
