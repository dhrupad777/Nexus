import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

/**
 * Every 30 min: flag tickets that overshot stage SLAs so the admin dashboard
 * surfaces them. Does not mutate state beyond writing admin-visible flags.
 */
export const stuckStageSweep = onSchedule("every 30 minutes", async () => {
  logger.info("stuckStageSweep tick — TODO: flag SLA overruns");
});
