import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const EMBED_MODEL = "gemini-embedding-2";
const EMBED_DIM = 768;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

function buildTicketEmbeddingInput(data: admin.firestore.DocumentData): string {
  const title = String(data.title ?? "");
  const desc = String(data.description ?? "");
  const needsStr = (data.needs ?? [])
    .map((n: any) => `${n.quantity} ${n.unit} of ${n.resourceCategory}`)
    .join(", ");
  return `Ticket: ${title}. ${desc}. Needs: ${needsStr}.`;
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

async function retriggerEmbeddings() {
  if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not set in environment.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Fetch all tickets with failed or missing embeddings
  const allTicketsSnap = await db.collection("tickets").get();
  const failedTickets = allTicketsSnap.docs.filter((doc) => {
    const status = doc.data().embeddingStatus;
    return status === "failed" || status === undefined || status === null;
  });

  console.log(`Found ${failedTickets.length} ticket(s) with missing/failed embeddings.\n`);

  let success = 0;
  let failure = 0;

  for (const doc of failedTickets) {
    const data = doc.data();
    const input = buildTicketEmbeddingInput(data);
    process.stdout.write(`  ⏳ [${doc.id}] "${data.title}" ... `);

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

retriggerEmbeddings().catch(console.error);
