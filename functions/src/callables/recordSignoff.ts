import { onCall } from "firebase-functions/v2/https";
import { notImplemented } from "../lib/notImplemented";

/** Contributor APPROVED/DISPUTED on a PENDING_SIGNOFF ticket. Plan §5. */
export const recordSignoff = onCall(async () => {
  notImplemented("recordSignoff");
});
