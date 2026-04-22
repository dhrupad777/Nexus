import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

/**
 * tickets/{id}.phase → CLOSED → create badges/{id} for host + each contributor,
 * write public feed entry (if separate), revalidate SSR feed.
 * Plan §5.
 */
export const onTicketClosed = onDocumentUpdated("tickets/{ticketId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.phase === "CLOSED" || after.phase !== "CLOSED") return;

  logger.info("ticket closed — TODO: emit badges + feed entry", {
    ticketId: event.params.ticketId,
  });
  // TODO: implement per plan §5.
});
