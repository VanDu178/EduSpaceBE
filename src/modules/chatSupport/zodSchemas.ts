import { z } from 'zod';
import { TicketCategoryEnum, TicketPriorityEnum } from '../ticketSupport/zodSchemas';

export const ConversationStatusEnum = z.enum(['BOT', 'WAITING_AGENT', 'AGENT_HANDLING', 'RESOLVED', 'CONVERTED_TO_TICKET']);
export const SenderTypeEnum = z.enum(['USER', 'BOT', 'AGENT', 'SYSTEM']);

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
  title: z.string().min(5, 'Tiêu đề Ticket phải từ 5 ký tự trở lên'),
  category: TicketCategoryEnum.default('OTHER'),
  priority: TicketPriorityEnum.default('HIGH')
});

export const setAdminStatusSchema = z.object({
  isOnline: z.boolean({ message: 'Trạng thái isOnline là bắt buộc' })
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ConvertChatToTicketInput = z.infer<typeof convertChatToTicketSchema>;
export type SetAdminStatusInput = z.infer<typeof setAdminStatusSchema>;
