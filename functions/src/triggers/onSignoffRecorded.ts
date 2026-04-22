import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

/**
 * When all COMMITTED contributors sign off, transition ticket → CLOSED
 * and trigger badge creation (via onTicketClosed).
 * Plan §5.
 */
export const onSignoffRecorded = onDocumentCreated(
  "tickets/{ticketId}/signoffs/{signoffId}",
  async (event) => {
    logger.info("signoff recorded — TODO: maybe close ticket", {
      ticketId: event.params.ticketId,
    });
    // TODO: implement per plan §5.
  },
);
