import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

/**
 * Hourly: scan for overdue agreements (non-rapid), stuck executions, missing
 * signoffs; decay the corresponding reliability score and append auditLog.
 * Plan §3.
 *
 * Rapid tickets (ticket.rapid === true) NEVER decay Agreement reliability.
 */
export const reliabilityDecaySweep = onSchedule("every 60 minutes", async () => {
  logger.info("reliabilityDecaySweep tick — TODO: implement §3 decay math");
});
