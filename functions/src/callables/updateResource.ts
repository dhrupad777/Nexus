import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ResourceClientWriteSchema } from "../lib/schemas";
import { withIdempotency } from "../lib/idempotency";
import { resolveActorOrgId } from "../lib/resolveActorOrgId";

/**
 * Owner-only resource update. Mirrors createResource.ts but operates on an
 * existing doc. Only the editable subset of fields can change — quantity,
 * reservedQuantity, status, embedding lifecycle stay server-managed.
 *
 * If any field that contributes to the embedding text changes (title,
 * category, terms.conditions, geo.adminRegion), we re-embed inline using
 * the same model + dim as onResourceCreated. Otherwise we skip the embed
 * call to save latency and quota.
 */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;

const ResourceClientUpdateSchema = ResourceClientWriteSchema.extend({
  resourceId: z.string().min(1),
});

function buildEmbeddingInput(data: admin.firestore.DocumentData): string {
  const category = String(data.category ?? "");
  const title = String(data.title ?? "");
  const conditions = String(data.terms?.conditions ?? "");
  const region = String(data.geo?.adminRegion ?? "");
  return `Capability: ${category}. ${title}. Terms: ${conditions}. Service region: ${region}.`;
}

async function embedOnce(ai: GoogleGenAI, text: string): Promise<number[]> {
  const resp = await ai.models.embedContent({
    model: MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIM },
  });
  const values = resp.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `embedContent returned ${values?.length ?? 0} dims, expected ${EMBEDDING_DIM}`,
    );
  }
  return values;
}

export const updateResource = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const { uid, token } = request.auth;
    const orgId = await resolveActorOrgId(uid, token);
    if (!orgId) {
      throw new HttpsError(
        "failed-precondition",
        "Your org isn't approved yet. Wait for admin review.",
      );
    }

    const parsed = ResourceClientUpdateSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", parsed.error.message);
    }
    const { resourceId, requestId, ...incoming } = parsed.data;

    return withIdempotency(uid, requestId, async () => {
      const db = admin.firestore();
      const ref = db.collection("resources").doc(resourceId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Resource not found.");
      }
      const before = snap.data()!;
      if (before.orgId !== orgId) {
        throw new HttpsError(
          "permission-denied",
          "You can only edit resources owned by your org.",
        );
      }

      // Org must still be ACTIVE to make edits — same gate as create.
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      if (!orgSnap.exists || orgSnap.data()!.status !== "ACTIVE") {
        throw new HttpsError(
          "failed-precondition",
          "Only ACTIVE organizations can update resources.",
        );
      }

      // Decide whether the embedding inputs changed. If so, recompute
      // inline. We deliberately skip the onResourceUpdated trigger for
      // re-embedding — that trigger only handles match-doc cleanup.
      const beforeText = buildEmbeddingInput(before);
      const afterText = buildEmbeddingInput({
        category: incoming.category,
        title: incoming.title,
        terms: incoming.terms,
        geo: incoming.geo,
      });
      const needsReembed = beforeText !== afterText;

      const updates: Record<string, unknown> = {
        category: incoming.category,
        title: incoming.title,
        unit: incoming.unit,
        valuationINR: incoming.valuationINR,
        terms: incoming.terms,
        geo: incoming.geo,
        emergencyContract: incoming.emergencyContract,
        // quantity is editable by the owner — but reservedQuantity must
        // never decrease below current reservations, so clamp it.
        quantity: Math.max(
          Number(incoming.quantity ?? 0),
          Number(before.reservedQuantity ?? 0),
        ),
      };

      let embeddingStatus: "ok" | "failed" | "pending" | "skipped" = "skipped";

      if (needsReembed) {
        const apiKey = GEMINI_API_KEY.value();
        if (!apiKey) {
          logger.warn("GEMINI_API_KEY missing — saving update without re-embed", {
            resourceId,
          });
          updates.embeddingStatus = "failed";
          embeddingStatus = "failed";
        } else {
          const ai = new GoogleGenAI({ apiKey });
          let vector: number[] | null = null;
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              vector = await embedOnce(ai, afterText);
              break;
            } catch (err) {
              logger.warn(`updateResource embed attempt ${attempt} failed`, {
                resourceId,
                err: err instanceof Error ? err.message : String(err),
              });
            }
          }
          if (vector) {
            updates.embedding = FieldValue.vector(vector);
            updates.embeddingVersion = MODEL;
            updates.embeddingStatus = "ok";
            embeddingStatus = "ok";
          } else {
            updates.embeddingStatus = "failed";
            embeddingStatus = "failed";
          }
        }
      }

      await ref.update(updates);

      await db.collection("auditLog").add({
        actor: uid,
        action: "resource.updated",
        resourceId,
        orgId,
        reembedded: needsReembed,
        createdAt: Date.now(),
      });

      return { resourceId, embeddingStatus };
    });
  },
);
