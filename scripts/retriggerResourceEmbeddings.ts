/**
 * Retrigger embeddings for resources with failed or missing embeddingStatus.
 * Run: npx tsx --env-file-if-exists=.env.local scripts/retriggerResourceEmbeddings.ts
 */

import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 768;

function buildResourceEmbeddingInput(data: admin.firestore.DocumentData): string {
  const category = String(data.category ?? "");
  const title = String(data.title ?? "");
  const conditions = String(data.terms?.conditions ?? "");
  const region = String(data.geo?.adminRegion ?? "");
  return `Capability: ${category}. ${title}. Terms: ${conditions}. Service region: ${region}.`;
}

async function embedText(ai: GoogleGenAI, text: string): Promise<number[]> {
  const resp = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBED_DIM },
  });
  const values = resp.embeddings?.[0]?.values;
  if (!values || values.length !== EMBED_DIM) {
    throw new Error(`Expected ${EMBED_DIM} dims, got ${values?.length ?? 0}`);
  }
  return values;
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not set.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const allSnap = await db.collection("resources").get();
  const needsFix = allSnap.docs.filter((doc) => {
    const s = doc.data().embeddingStatus;
    return s === "failed" || s === undefined || s === null;
  });

  console.log(`Found ${needsFix.length} resource(s) with failed/missing embeddings.\n`);

  let success = 0, failure = 0;

  for (const doc of needsFix) {
    const data = doc.data();
    const input = buildResourceEmbeddingInput(data);
    process.stdout.write(`  ⏳ [${doc.id}] "${data.title ?? data.category}" ... `);

    let vector: number[] | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        vector = await embedText(ai, input);
        break;
      } catch (err: any) {
        if (attempt === 2) {
          process.stdout.write(`❌ FAILED (${err.message})\n`);
        }
      }
    }

    if (!vector) {
      await doc.ref.update({ embeddingStatus: "failed" });
      failure++;
      continue;
    }

    await doc.ref.update({
      embedding: admin.firestore.FieldValue.vector(vector),
      embeddingVersion: EMBED_MODEL,
      embeddingStatus: "ok",
    });
    process.stdout.write(`✅ OK (${EMBED_DIM}d)\n`);
    success++;
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`Done. ✅ ${success} embedded  ❌ ${failure} failed`);
}

main().catch(console.error);
