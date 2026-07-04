import { z } from "zod";

export const createScheduleSchema = z.object({
  planId: z.string().min(1),
  name: z.string().min(1),
  cronExpression: z.string().min(1),
  timezone: z.string().min(1),
  inputs: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  cronExpression: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  inputs: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export type CreateScheduleBody = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleBody = z.infer<typeof updateScheduleSchema>;

export function validateCreateSchedule(body: unknown): CreateScheduleBody {
  return createScheduleSchema.parse(body);
}

export function validateUpdateSchedule(body: unknown): UpdateScheduleBody {
  return updateScheduleSchema.parse(body);
}
