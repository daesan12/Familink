type GroupAccessDeniedListener = (groupId: string) => void;

const groupAccessDeniedListeners = new Set<GroupAccessDeniedListener>();

export function subscribeGroupAccessDenied(
  listener: GroupAccessDeniedListener,
): () => void {
  groupAccessDeniedListeners.add(listener);
  return () => groupAccessDeniedListeners.delete(listener);
}

export function notifyGroupAccessDenied(groupId: string): void {
  groupAccessDeniedListeners.forEach(listener => listener(groupId));
}
