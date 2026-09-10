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

export const CHAT_STATUS = {
  BOT: 'BOT',
  WAITING_AGENT: 'WAITING_AGENT',
  AGENT_HANDLING: 'AGENT_HANDLING',
  RESOLVED: 'RESOLVED',
  CONVERTED_TO_TICKET: 'CONVERTED_TO_TICKET',
} as const;

export type ChatStatusType = typeof CHAT_STATUS[keyof typeof CHAT_STATUS];
export const VALID_CHAT_STATUSES = Object.values(CHAT_STATUS);

export const SENDER_TYPE = {
  USER: 'USER',
  BOT: 'BOT',
  AGENT: 'AGENT',
  SYSTEM: 'SYSTEM'
} as const;

export type SenderTypeType = typeof SENDER_TYPE[keyof typeof SENDER_TYPE];
export const VALID_SENDER_TYPES = Object.values(SENDER_TYPE);

export const CHAT_SOCKET_EVENTS = {
  JOIN_CONVERSATION: 'join_conversation',
  LEAVE_CONVERSATION: 'leave_conversation',
  CONVERSATION_CONVERTED: 'conversation_converted',
  NEW_MESSAGE: 'new_message',
  USER_NEW_MESSAGE_NOTICE: 'user_new_message_notice',
  CONVERSATIONS_AUTO_ESCALATED: 'conversations_auto_escalated',
  ADMIN_PRESENCE_UPDATED: 'admin_presence_updated',
  CONVERSATION_UPDATED: 'conversation_updated'
} as const;



