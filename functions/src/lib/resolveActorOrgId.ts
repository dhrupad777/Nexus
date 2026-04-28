import * as admin from "firebase-admin";

/**
 * Resolve the caller's orgId for permission checks.
 *
 * Token claims are a denormalized cache set by approveOrg. They lag for users
 * who joined an org after approval, or whose token hasn't refreshed since.
 * Falling back to users/{uid}.orgId — the durable source written by the
 * onboarding flow — makes callables correct regardless of token freshness.
 */
export async function resolveActorOrgId(
  uid: string,
  token: Record<string, unknown> | undefined,
): Promise<string | null> {
  const claim = token?.orgId;
  const fromClaim = typeof claim === "string" && claim ? claim : null;
  if (fromClaim) return fromClaim;
  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  if (!userSnap.exists) return null;
  const fromDoc = userSnap.data()?.orgId;
  return typeof fromDoc === "string" && fromDoc ? fromDoc : null;
}
