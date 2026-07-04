import { DBOS } from "@dbos-inc/dbos-sdk";
import type { WorkplanScheduler } from "../../workplans/src/scheduler.js";

let registered = false;

export function registerDbosSchedulerTick(scheduler: WorkplanScheduler): void {
  if (registered) {
    return;
  }

  DBOS.registerScheduled(
    async () => {
      await scheduler.tick();
    },
    { crontab: "* * * * *" },
  );

  registered = true;
}
