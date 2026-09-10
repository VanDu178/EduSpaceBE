import { z } from 'zod';
import { TicketCategoryEnum, TicketPriorityEnum } from '../ticketSupport/zodSchemas';
import { VALID_CHAT_STATUSES, VALID_SENDER_TYPES } from './constants';

export const ConversationStatusEnum = z.enum(VALID_CHAT_STATUSES as [string, ...string[]]);

export const SenderTypeEnum = z.enum(VALID_SENDER_TYPES as [string, ...string[]]);

export const startConversationSchema = z.object({
  initialMessage: z.string().optional()
});

export const sendMessageSchema = z.object({
  conversationId: z.number({ message: 'ID cuộc trò chuyện là bắt buộc' }),
  content: z.string().optional().default(''),
  attachments: z.array(z.string()).optional()
}).refine((data) => (data.content && data.content.trim().length > 0) || (data.attachments && data.attachments.length > 0), {
  message: 'Nội dung tin nhắn hoặc tệp đính kèm là bắt buộc',
  path: ['content']
});

export const convertChatToTicketSchema = z.object({
  conversationId: z.number({ message: 'ID cuộc trò chuyện là bắt buộc' }),
  title: z.string().min(1, 'Tiêu đề Ticket không được để trống'),
  description: z.string().optional(),
  category: TicketCategoryEnum.default('OTHER'),
  priority: TicketPriorityEnum.default('HIGH'),
  attachments: z.array(z.string()).optional()
});

export const setAdminStatusSchema = z.object({
  isOnline: z.boolean({ message: 'Trạng thái isOnline là bắt buộc' })
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ConvertChatToTicketInput = z.infer<typeof convertChatToTicketSchema>;
export type SetAdminStatusInput = z.infer<typeof setAdminStatusSchema>;
