import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { EditTicketInputSchema } from "../lib/schemas";

/**
 * Host-only ticket edit. Allows changing:
 *  - title (string)
 *  - urgency (NORMAL | EMERGENCY)
 *  - images (cover/gallery URLs)
 *
 * Blocked if the ticket is CLOSED. Only the host org can call this.
 * Uses admin SDK to bypass Firestore rules (urgency is locked in rules
 * for direct client writes — this callable is the controlled gate).
 */
export const editTicket = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const orgId = request.auth?.token?.orgId as string | undefined;
  if (!orgId) throw new HttpsError("permission-denied", "No org linked to this account.");

  const parsed = EditTicketInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { ticketId, title, urgency, images, requestId } = parsed.data;

  const db = admin.firestore();
  const ticketRef = db.collection("tickets").doc(ticketId);
  const ticketSnap = await ticketRef.get();

  if (!ticketSnap.exists) {
    throw new HttpsError("not-found", "Ticket not found.");
  }

  const ticket = ticketSnap.data()!;

  // Only the host org can edit.
  if (String(ticket.hostOrgId ?? "") !== orgId) {
    throw new HttpsError("permission-denied", "Only the host organisation can edit this ticket.");
  }

  // Cannot edit a closed ticket.
  if (ticket.phase === "CLOSED") {
    throw new HttpsError("failed-precondition", "Cannot edit a closed ticket.");
  }

  // Build partial update — only include fields the caller actually sent.
  const update: Record<string, unknown> = {
    lastUpdatedAt: Date.now(),
  };

  if (title !== undefined) {
    update.title = title;
  }
  if (urgency !== undefined) {
    update.urgency = urgency;
  }
  if (images !== undefined) {
    update.images = images;
  }

  // At least one editable field must be provided.
  if (title === undefined && urgency === undefined && images === undefined) {
    throw new HttpsError("invalid-argument", "Nothing to update — provide at least one of: title, urgency, images.");
  }

  await ticketRef.update(update);

  logger.info("ticket edited", { ticketId, orgId, requestId, fields: Object.keys(update) });

  return { ticketId, updated: true };
});
