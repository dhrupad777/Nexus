import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

/**
 * Hash-chained append-only audit log.
 *
 * Listens to every mutation on collections that matter. Computes the payload
 * hash, reads the most recent auditLog entry's hash as `prevHash`, writes a
 * new entry. Because it runs in a trigger, callable code never needs to
 * remember to audit — plan §A.8 #6.
 */
export const appendAuditLog = onDocumentWritten(
  "{collection}/{docId}",
  async (event) => {
    const collection = event.params.collection;
    // Only audit collections that carry authoritative state.
    const AUDITED = new Set([
      "tickets",
      "contributions",
      "agreements",
      "organizations",
      "signoffs",
    ]);
    if (!AUDITED.has(collection)) return;

    logger.debug("audit write — TODO: prevHash chain", {
      collection,
      docId: event.params.docId,
    });
    // TODO: compute payloadHash, read prev, write auditLog/{entryId}.
  },
);
