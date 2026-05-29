import { CronExpressionParser } from "cron-parser";
import type { WorkplanSchedule } from "./types.js";

export class ScheduleBuilder {
  static nextRunAt(cronExpression: string, timezone: string): string {
    const expr = CronExpressionParser.parse(cronExpression, { tz: timezone });
    return expr.next().toISOString() ?? new Date().toISOString();
  }

  static withNextRunAt(schedule: WorkplanSchedule): WorkplanSchedule {
    return {
      ...schedule,
      nextRunAt: ScheduleBuilder.nextRunAt(schedule.cronExpression, schedule.timezone),
    };
  }
}
