import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

/**
 * A photoProofs/{id} doc was created → recompute host execution liveness.
 * Plan §3 (Execution Reliability recovers when proofs land).
 */
export const onPhotoProofUploaded = onDocumentCreated(
  "tickets/{ticketId}/photoProofs/{proofId}",
  async (event) => {
    logger.info("photo proof uploaded — TODO: touch ticket liveness", {
      ticketId: event.params.ticketId,
    });
    // TODO: implement per plan §3.
  },
);
