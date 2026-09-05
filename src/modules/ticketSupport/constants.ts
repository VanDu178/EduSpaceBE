/**
 * HẰNG SỐ VÀ KEY MAPPINGS CHO MODULE TICKET SUPPORT (BE)
 */

export const TICKET_CATEGORY = {
  PAYMENT: 'PAYMENT',
  ACCOUNT: 'ACCOUNT',
  TECHNICAL: 'TECHNICAL',
  OTHER: 'OTHER',
} as const;

export type TicketCategoryType = typeof TICKET_CATEGORY[keyof typeof TICKET_CATEGORY];
export const VALID_TICKET_CATEGORIES = Object.values(TICKET_CATEGORY);

export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type TicketPriorityType = typeof TICKET_PRIORITY[keyof typeof TICKET_PRIORITY];
export const VALID_TICKET_PRIORITIES = Object.values(TICKET_PRIORITY);

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_USER: 'PENDING_USER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export type TicketStatusType = typeof TICKET_STATUS[keyof typeof TICKET_STATUS];
export const VALID_TICKET_STATUSES = Object.values(TICKET_STATUS);

export const TICKET_STATUS_LABELS: Record<TicketStatusType, string> = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  PENDING_USER: 'Chờ phản hồi từ khách',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
};

/**
 * TẬP TRUNG HÓA TẤT CẢ TÊN EVENT SOCKET.IO CHO TICKET SUPPORT
 */
export const TICKET_SOCKET_EVENTS = {
  COMMENT_ADDED: 'ticket:comment_added',
  STATUS_CHANGED: 'ticket:status_changed',
  CREATED: 'ticket:created',
  UPDATED: 'ticket:updated',
  JOIN_TICKET: 'join_ticket',
  LEAVE_TICKET: 'leave_ticket',
} as const;

export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
} as const;

export const TICKET_RATE_LIMIT = {
  WINDOW_MS: 10 * 60 * 1000, // 10 phút
  MAX_TICKETS_PER_WINDOW: 5,
}


export const TICKET_LINKS = {
  CUSTOMER_SUPPORT: '/support',
  ADMIN_SUPPORT: '/admin/support',
}