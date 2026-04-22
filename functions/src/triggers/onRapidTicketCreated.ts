import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

/**
 * Fires on every new ticket. Only acts when `rapid === true`.
 *  - compute candidate orgs via hard filters
 *  - write matches/{id} with rapidBroadcast=true
 *  - FCM-push opt-in orgs
 * Plan §2 (Flow B).
 */
export const onRapidTicketCreated = onDocumentCreated("tickets/{ticketId}", async (event) => {
  const data = event.data?.data();
  if (!data || data.rapid !== true) return;

  logger.info("rapid ticket raised — TODO: broadcast + FCM", {
    ticketId: event.params.ticketId,
  });
  // TODO: implement broadcast per plan §2 (Flow B).
});
