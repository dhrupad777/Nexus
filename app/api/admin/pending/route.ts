import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdminRequest } from "@/lib/admin/verifyAdmin";

// firebase-admin requires Node.js, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await verifyAdminRequest(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const db = getFirestore();
  const auth = getAuth();

  const snap = await db
    .collection("organizations")
    .where("status", "==", "PENDING_REVIEW")
    .get();

  const orgs = await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data() as Record<string, unknown>;
      let ownerEmail: string | null = null;
      try {
        // In the self-onboard scheme, organizations/{uid} is keyed by the owner's uid.
        const owner = await auth.getUser(doc.id);
        ownerEmail = owner.email ?? null;
      } catch {
        ownerEmail = null;
      }

      const createdAtRaw = data.createdAt as unknown;
      const createdAt =
        typeof createdAtRaw === "number" ? createdAtRaw : null;

      const contact = data.contact as { email?: string } | undefined;
      const geo = data.geo as { adminRegion?: string } | undefined;

      return {
        id: doc.id,
        name: String(data.name ?? "(unnamed)"),
        type: String(data.type ?? "ORG"),
        contactEmail: contact?.email ?? null,
        region: geo?.adminRegion ?? null,
        ownerEmail,
        createdAt,
      };
    }),
  );

  orgs.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return NextResponse.json({ orgs });
}
