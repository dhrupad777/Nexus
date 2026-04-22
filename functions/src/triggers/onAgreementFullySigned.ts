import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

/**
 * When agreements/{id}.status transitions to FULLY_SIGNED:
 *  - set contributions.status = COMMITTED
 *  - transactionally bump ticket.needs[].progressPct + ticket.progressPct
 *  - append auditLog entry
 * Plan §1a.
 */
export const onAgreementFullySigned = onDocumentUpdated(
  "agreements/{agreementId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === "FULLY_SIGNED" || after.status !== "FULLY_SIGNED") return;

    logger.info("agreement fully signed — TODO: commit contribution + bump progress", {
      agreementId: event.params.agreementId,
    });
    // TODO: implement transactional commit per plan §1a.
  },
);
