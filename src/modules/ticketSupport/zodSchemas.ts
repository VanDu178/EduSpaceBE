import { z } from 'zod';
import {
  VALID_TICKET_CATEGORIES,
  VALID_TICKET_PRIORITIES,
  VALID_TICKET_STATUSES,
  TICKET_CATEGORY,
  TICKET_PRIORITY
} from './constants';

export const TicketCategoryEnum = z.enum(VALID_TICKET_CATEGORIES as [string, ...string[]]);
export const TicketPriorityEnum = z.enum(VALID_TICKET_PRIORITIES as [string, ...string[]]);
export const TicketStatusEnum = z.enum(VALID_TICKET_STATUSES as [string, ...string[]]);

export const createTicketSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống').max(255, 'Tiêu đề không quá 255 ký tự'),
  description: z.string().min(1, 'Mô tả không được để trống'),
  category: TicketCategoryEnum.default(TICKET_CATEGORY.OTHER),
  priority: TicketPriorityEnum.default(TICKET_PRIORITY.MEDIUM),
  attachments: z.array(z.string()).optional()
});

export const getTicketsQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.coerce.number().int().positive().optional()
});

export const updateTicketStatusSchema = z.object({
  status: TicketStatusEnum
});

export const updateTicketSchema = z.object({
  priority: TicketPriorityEnum.optional(),
  category: TicketCategoryEnum.optional(),
  assigneeId: z.number().nullable().optional()
});

export const addTicketCommentSchema = z
  .object({
    content: z.string().optional(),
    attachments: z.array(z.string()).optional()
  })
  .refine(
    (data) => (data.content && data.content.trim().length > 0) || (data.attachments && data.attachments.length > 0),
    {
      message: 'Phải có nội dung văn bản hoặc hình ảnh đính kèm'
    }
  );

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type GetTicketsQueryInput = z.infer<typeof getTicketsQuerySchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type AddTicketCommentInput = z.infer<typeof addTicketCommentSchema>;
