import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

/**
 * Owner-only on-demand re-run of the resource embedding pipeline. Used by
 * the "Retry embedding" button on /resources when an earlier attempt
 * landed `embeddingStatus: "failed"` (model rotation, API key blip, etc).
 *
 * Same model + dim + input-shaping formula as onResourceCreated.ts so the
 * vector that lands matches what the matching trigger expects.
 */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;

const InputSchema = z.object({
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

export const retryResourceEmbedding = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const { token } = request.auth;
    const orgId = (token.orgId as string | undefined) ?? null;
    if (!orgId) {
      throw new HttpsError(
        "failed-precondition",
        "Your org isn't approved yet.",
      );
    }

    const parsed = InputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", parsed.error.message);
    }
    const { resourceId } = parsed.data;

    const db = admin.firestore();
    const ref = db.collection("resources").doc(resourceId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Resource not found.");
    }
    const data = snap.data()!;
    if (data.orgId !== orgId) {
      throw new HttpsError(
        "permission-denied",
        "You can only retry embedding on resources owned by your org.",
      );
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      logger.error("GEMINI_API_KEY missing — cannot retry embedding", { resourceId });
      await ref.update({ embeddingStatus: "failed" });
      return { resourceId, embeddingStatus: "failed" as const };
    }

    // Flip to pending so the UI shows the badge while we work.
    await ref.update({ embeddingStatus: "pending" });

    const ai = new GoogleGenAI({ apiKey });
    const input = buildEmbeddingInput(data);

    let vector: number[] | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        vector = await embedOnce(ai, input);
        break;
      } catch (err) {
        logger.warn(`retryResourceEmbedding attempt ${attempt} failed`, {
          resourceId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!vector) {
      await ref.update({ embeddingStatus: "failed" });
      return { resourceId, embeddingStatus: "failed" as const };
    }

    await ref.update({
      embedding: FieldValue.vector(vector),
      embeddingVersion: MODEL,
      embeddingStatus: "ok",
    });

    logger.info("resource embedding retried successfully", { resourceId });
    return { resourceId, embeddingStatus: "ok" as const };
  },
);
