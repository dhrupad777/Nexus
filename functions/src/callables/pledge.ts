import { onCall } from "firebase-functions/v2/https";
import { notImplemented } from "../lib/notImplemented";

/**
 * Branches on tickets/{id}.rapid:
 *  - rapid=false → AGREEMENT_FIRST path (create contribution PROPOSED + draft agreement)
 *  - rapid=true  → PLEDGE_FIRST path (commit instantly, bump progress)
 * App Check enforced (plan §A.4).
 */
export const pledge = onCall({ enforceAppCheck: true }, async () => {
  notImplemented("pledge");
});
