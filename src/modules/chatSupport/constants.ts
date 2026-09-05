import { isAgentAvailable as isSocketAgentAvailable } from '../../config/socket/socketManager';

class AdminPresenceStore {
  public getStatus() {
    const isOnline = isSocketAgentAvailable();
    return {
      isOnline,
      activeAdminId: null
    };
  }

  public isAgentAvailable(): boolean {
    return isSocketAgentAvailable();
  }
}

export const adminPresenceStore = new AdminPresenceStore();

export const CHAT_SOCKET_EVENTS = {
  CONVERSATION_CONVERTED: 'conversation_converted',
  NEW_MESSAGE: 'new_message',
  USER_NEW_MESSAGE_NOTICE: 'user_new_message_notice',
  CONVERSATIONS_AUTO_ESCALATED: 'conversations_auto_escalated',
  ADMIN_PRESENCE_UPDATED: 'admin_presence_updated'
} as const;


