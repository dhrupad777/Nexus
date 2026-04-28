import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { DeleteTicketInputSchema } from "../lib/schemas";
import { withIdempotency } from "../lib/idempotency";
import { resolveActorOrgId } from "../lib/resolveActorOrgId";

/**
 * Host-only ticket deletion. Allowed only while the ticket has no
 * load-bearing contributions — i.e. nothing past PROPOSED. Once a pledge
 * is COMMITTED/EXECUTED/SIGNED_OFF, deleting would silently destroy
 * inventory bookkeeping and badge audit history, so we refuse and tell
 * the host to close out the ticket through the normal lifecycle instead.
 *
 * Caller-confirmed twice on the client (UX guard, not a security one).
 */
export const deleteTicket = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const { uid, token } = request.auth;
  const orgId = await resolveActorOrgId(uid, token);
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Your org isn't approved yet.");
  }

  const parsed = DeleteTicketInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { ticketId, requestId } = parsed.data;

  return withIdempotency(uid, requestId, async () => {
    const db = admin.firestore();
    const ticketRef = db.collection("tickets").doc(ticketId);
    const snap = await ticketRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Ticket not found.");
    }
    const data = snap.data()!;
    if (data.hostOrgId !== orgId) {
      throw new HttpsError(
        "permission-denied",
        "Only the host org can delete this ticket.",
      );
    }
    if (data.phase === "CLOSED") {
      throw new HttpsError(
        "failed-precondition",
        "Closed tickets are part of the public impact ledger and can't be deleted.",
      );
    }

    // Refuse if any contribution is past PROPOSED — those carry inventory
    // reservations / agreements / signoffs that we shouldn't silently drop.
    const blocking = await ticketRef
      .collection("contributions")
      .where("status", "in", ["AGREEMENT_PENDING", "COMMITTED", "EXECUTED", "SIGNED_OFF"])
      .limit(1)
      .get();
    if (!blocking.empty) {
      throw new HttpsError(
        "failed-precondition",
        "Can't delete: this ticket has committed contributions. Close it through the normal flow instead.",
      );
    }

    // Soft cleanup — drop PROPOSED/REJECTED contributions, photoProofs,
    // and matches subcollections. Best-effort; leftover docs in
    // collection-group queries are filtered by ticket existence anyway.
    const sub = ["contributions", "photoProofs", "matches"];
    for (const name of sub) {
      const q = await ticketRef.collection(name).limit(500).get();
      const batch = db.batch();
      q.docs.forEach((d) => batch.delete(d.ref));
      if (q.size > 0) await batch.commit();
    }

    await ticketRef.delete();

    await db.collection("auditLog").add({
      actor: uid,
      action: "ticket.deleted",
      ticketId,
      orgId,
      createdAt: Date.now(),
    });

    logger.info("ticket deleted by host", { ticketId, orgId, uid });
    return { ticketId, deleted: true as const };
  });
});
