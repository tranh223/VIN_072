export type UserNotificationType =
  | 'upload'
  | 'chatbot'
  | 'processing'
  | 'alert'
  | 'settings'
  | 'feedback'
  | 'system';

export type UserNotificationPayload = {
  id?: string;
  title: string;
  detail?: string;
  time?: string;
  type?: UserNotificationType;
  read?: boolean;
};

export const USER_NOTIFICATION_EVENT = 'scaify.user.notifications.push';

export function pushUserNotification(payload: UserNotificationPayload) {
  window.dispatchEvent(
    new CustomEvent(USER_NOTIFICATION_EVENT, {
      detail: {
        ...payload,
        time: payload.time || new Date().toISOString(),
        type: payload.type || 'system',
        read: false,
      },
    })
  );
}
