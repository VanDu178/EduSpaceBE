import { z } from 'zod';

export const TicketCategoryEnum = z.enum(['PAYMENT', 'ACCOUNT', 'TECHNICAL', 'OTHER']);
export const TicketPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const TicketStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED']);

export const createTicketSchema = z.object({
  title: z.string().min(5, 'Tiêu đề phải từ 5 ký tự trở lên').max(255, 'Tiêu đề không quá 255 ký tự'),
  description: z.string().min(10, 'Mô tả phải chi tiết từ 10 ký tự trở lên'),
  category: TicketCategoryEnum.default('OTHER'),
  priority: TicketPriorityEnum.default('MEDIUM'),
  attachments: z.array(z.string()).optional()
});

export const updateTicketStatusSchema = z.object({
  status: TicketStatusEnum
});

export const updateTicketSchema = z.object({
  priority: TicketPriorityEnum.optional(),
  category: TicketCategoryEnum.optional(),
  assigneeId: z.number().nullable().optional()
});

export const addTicketCommentSchema = z.object({
  content: z.string().min(1, 'Nội dung phản hồi không được để trống'),
  attachments: z.array(z.string()).optional()
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type AddTicketCommentInput = z.infer<typeof addTicketCommentSchema>;
