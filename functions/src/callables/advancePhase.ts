import { onCall } from "firebase-functions/v2/https";
import { notImplemented } from "../lib/notImplemented";

/** Host-only phase transitions. Flow A floor = 30%; Flow B has no floor. Plan §4. */
export const advancePhase = onCall(async () => {
  notImplemented("advancePhase");
});
