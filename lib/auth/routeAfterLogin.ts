"use client";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

/**
 * Decides where a signed-in user should land.
 *
 * Reads users/{uid}.orgId. If unset → `/onboard` (they haven't registered an
 * org yet). If set → `/dashboard`.
 */
export async function routeAfterLogin(uid: string, fallback: string = "/dashboard"): Promise<string> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const orgId = snap.exists() ? (snap.data() as { orgId?: string | null }).orgId : null;
    return orgId ? fallback : "/onboard";
  } catch {
    return "/onboard";
  }
}
