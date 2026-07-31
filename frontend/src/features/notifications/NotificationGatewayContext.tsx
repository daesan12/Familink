import {createContext, useContext, type ReactNode} from 'react';

import type {NotificationGateway} from './types';

const NotificationGatewayContext =
  createContext<NotificationGateway | null>(null);

export function NotificationGatewayProvider({
  children,
  gateway,
}: {
  children: ReactNode;
  gateway: NotificationGateway;
}) {
  return (
    <NotificationGatewayContext.Provider value={gateway}>
      {children}
    </NotificationGatewayContext.Provider>
  );
}

export function useNotificationGateway(): NotificationGateway | null {
  return useContext(NotificationGatewayContext);
}
