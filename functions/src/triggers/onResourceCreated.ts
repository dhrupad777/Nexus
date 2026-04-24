import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

/**
 * On resource create, generate a 768-d embedding with text-embedding-004 and
 * write it back to the resource doc using Firestore's native vector type
 * (queryable by Firestore native vectorSearch — see plan §A.2). Flips
 * embeddingStatus pending → ok on success, failed on permanent error.
 *
 * The Gemini API key is reused: text-embedding-004 is served by the same
 * Generative Language API as the onboarding chat model. No Vertex auth needed.
 */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "text-embedding-004";
const EMBEDDING_DIM = 768;

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
  });
  const values = resp.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `embedContent returned ${values?.length ?? 0} dims, expected ${EMBEDDING_DIM}`,
    );
  }
  return values;
}

export const onResourceCreated = onDocumentCreated(
  { document: "resources/{resourceId}", secrets: [GEMINI_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const { resourceId } = event.params;

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      logger.error("GEMINI_API_KEY missing — cannot embed resource", { resourceId });
      await snap.ref.update({ embeddingStatus: "failed" });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const input = buildEmbeddingInput(data);

    let vector: number[] | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        vector = await embedOnce(ai, input);
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`embed attempt ${attempt} failed`, { resourceId, err: msg });
      }
    }

    if (!vector) {
      await snap.ref.update({ embeddingStatus: "failed" });
      logger.error("resource embedding failed permanently", { resourceId });
      return;
    }

    await snap.ref.update({
      embedding: FieldValue.vector(vector),
      embeddingVersion: MODEL,
      embeddingStatus: "ok",
    });

    logger.info("resource embedded", { resourceId, model: MODEL });
  },
);
