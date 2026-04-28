/**
 * Nexus — Vector Embedding Validation & Testing Script
 * Implements: docs/Nexus_Embedding_Test_Guide.md
 *
 * Run: tsx --env-file-if-exists=.env.local scripts/testEmbeddings.ts
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

// ── Helpers ────────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embed(ai: GoogleGenAI, text: string): Promise<number[]> {
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

function simLabel(score: number): string {
  if (score >= 0.80) return "🟢 HIGH";
  if (score >= 0.60) return "🟡 MEDIUM";
  return "🔴 LOW";
}

// ── Test Dataset ────────────────────────────────────────────────────────────

interface TestDoc {
  id: string;
  type: "resource" | "ticket";
  text: string;
  category: string;
}

const TEST_RESOURCES: TestDoc[] = [
  {
    id: "r_food",
    type: "resource",
    category: "FOOD_KIT",
    text: "Capability: FOOD_KIT. Packaged meal kits for disaster relief. Terms: available immediately. Service region: Maharashtra.",
  },
  {
    id: "r_logistics",
    type: "resource",
    category: "LOGISTICS",
    text: "Capability: LOGISTICS. Fleet of 10 trucks for goods transport and last-mile delivery. Terms: 7-day notice. Service region: Gujarat.",
  },
  {
    id: "r_medical",
    type: "resource",
    category: "SERVICE",
    text: "Capability: SERVICE. Medical aid team with emergency response training and first-aid supplies. Terms: on-call 24/7. Service region: Delhi.",
  },
];

const TEST_TICKETS: TestDoc[] = [
  {
    id: "t_food",
    type: "ticket",
    category: "FOOD_KIT",
    text: "Ticket: Food relief for flood victims. Community affected by floods needs urgent food supply for 500 families. Needs: 500 units of FOOD_KIT.",
  },
  {
    id: "t_transport",
    type: "ticket",
    category: "LOGISTICS",
    text: "Ticket: Transport requirement for aid distribution. Need vehicles to move relief goods across rural areas. Needs: 8 vehicles for LOGISTICS.",
  },
  {
    id: "t_medical",
    type: "ticket",
    category: "SERVICE",
    text: "Ticket: Medical emergency support for cyclone survivors. Injured survivors need medical attention and first-aid. Needs: 20 medical SERVICE providers.",
  },
];

// ── Rule-based matching (category + same region heuristic) ─────────────────

function ruleBasedMatch(resource: TestDoc, ticket: TestDoc): boolean {
  return resource.category === ticket.category;
}

// ── Pre-check ──────────────────────────────────────────────────────────────

async function preCheck(): Promise<boolean> {
  console.log("━━━ PRE-CHECK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  let ok = true;

  // 1. Gemini API key
  if (!GEMINI_API_KEY) {
    console.log("❌ GEMINI_API_KEY not set in environment.");
    ok = false;
  } else {
    console.log("✅ GEMINI_API_KEY present");
  }

  // 2. Firestore reachable
  try {
    await db.collection("organizations").limit(1).get();
    console.log("✅ Firestore connection OK");
  } catch (e: any) {
    console.log(`❌ Firestore connection failed: ${e.message}`);
    ok = false;
  }

  // 3. Check existing resources have embedding field
  const resSnap = await db.collection("resources").limit(5).get();
  const withEmbedding = resSnap.docs.filter((d) => d.data().embedding);
  console.log(`✅ Firestore schema: ${withEmbedding.length}/${resSnap.size} sampled resources have embedding field`);

  console.log();
  return ok;
}

// ── Step 1: Generate Embeddings ────────────────────────────────────────────

async function step1_generateEmbeddings(ai: GoogleGenAI) {
  console.log("━━━ STEP 1 — Generate Embeddings ━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const allDocs = [...TEST_RESOURCES, ...TEST_TICKETS];
  const embeddings = new Map<string, number[]>();
  const timings: number[] = [];

  for (const doc of allDocs) {
    const t0 = Date.now();
    try {
      const vec = await embed(ai, doc.text);
      const elapsed = Date.now() - t0;
      timings.push(elapsed);
      embeddings.set(doc.id, vec);
      console.log(`  ✅ [${doc.id}] ${doc.category} — ${vec.length}d in ${elapsed}ms`);
    } catch (err: any) {
      console.log(`  ❌ [${doc.id}] FAILED: ${err.message}`);
    }
  }

  const avgMs = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : 0;
  console.log(`\n  📊 Avg embedding latency: ${avgMs}ms | Generated: ${embeddings.size}/${allDocs.length}`);

  // Step 1 result: every doc must have a non-empty embedding
  const allEmbedded = embeddings.size === allDocs.length;
  console.log(`  ${allEmbedded ? "✅" : "❌"} All entities embedded: ${allEmbedded}`);
  console.log();

  return embeddings;
}

// ── Step 2: Similarity Calculation ────────────────────────────────────────

function step2_similarityCalc(embeddings: Map<string, number[]>) {
  console.log("━━━ STEP 2 — Cosine Similarity Calculation ━━━━━━━━━━━━━━━━\n");

  const results: Array<{ resource: string; ticket: string; score: number; expected: "HIGH" | "LOW" }> = [];

  for (const r of TEST_RESOURCES) {
    for (const t of TEST_TICKETS) {
      const rVec = embeddings.get(r.id);
      const tVec = embeddings.get(t.id);
      if (!rVec || !tVec) continue;

      const score = cosineSimilarity(rVec, tVec);
      const expected = r.category === t.category ? "HIGH" : "LOW";
      results.push({ resource: r.id, ticket: t.id, score, expected });

      const label = simLabel(score);
      const match = expected === "HIGH" ? score >= 0.60 : score < 0.80;
      const icon = match ? "✅" : "⚠️ ";
      console.log(`  ${icon} ${r.id} ↔ ${t.id}: ${score.toFixed(4)} ${label} (expected: ${expected})`);
    }
  }

  // Validate ranking: same-category pairs should score higher than cross-category
  let rankingCorrect = 0, rankingTotal = 0;
  for (const r of TEST_RESOURCES) {
    const samecat = results.find((x) => x.resource === r.id && x.expected === "HIGH");
    const others = results.filter((x) => x.resource === r.id && x.expected === "LOW");
    if (!samecat) continue;
    for (const o of others) {
      rankingTotal++;
      if (samecat.score > o.score) rankingCorrect++;
    }
  }

  console.log(`\n  📊 Ranking accuracy: ${rankingCorrect}/${rankingTotal} same-category pairs ranked higher`);
  const rankingOk = rankingCorrect === rankingTotal;
  console.log(`  ${rankingOk ? "✅" : "❌"} Correct ranking order: ${rankingOk}`);
  console.log();

  return { results, rankingCorrect, rankingTotal };
}

// ── Step 3: Compare Embedding vs Rule-Based ────────────────────────────────

function step3_compareMatching(embeddings: Map<string, number[]>) {
  console.log("━━━ STEP 3 — Embedding vs Rule-Based Matching ━━━━━━━━━━━━━\n");

  let ruleCorrect = 0, embeddingCorrect = 0, total = 0;

  for (const t of TEST_TICKETS) {
    const tVec = embeddings.get(t.id);
    console.log(`  Ticket: ${t.id} (${t.category})`);

    // Rule-based: score by category match
    const ruleBestResource = TEST_RESOURCES.reduce((best, r) => {
      const score = ruleBasedMatch(r, t) ? 1 : 0;
      return score > (ruleBasedMatch(best, t) ? 1 : 0) ? r : best;
    });

    // Embedding-based: cosine similarity
    let embBestResource = TEST_RESOURCES[0];
    let embBestScore = -1;
    for (const r of TEST_RESOURCES) {
      const rVec = embeddings.get(r.id);
      if (!rVec || !tVec) continue;
      const score = cosineSimilarity(rVec, tVec);
      if (score > embBestScore) {
        embBestScore = score;
        embBestResource = r;
      }
    }

    const expectedBest = TEST_RESOURCES.find((r) => r.category === t.category)!;
    const ruleOk = ruleBestResource.id === expectedBest.id;
    const embOk = embBestResource.id === expectedBest.id;

    if (ruleOk) ruleCorrect++;
    if (embOk) embeddingCorrect++;
    total++;

    console.log(`    Rule-based best:      ${ruleBestResource.id} ${ruleOk ? "✅" : "❌"}`);
    console.log(`    Embedding-based best: ${embBestResource.id} (score: ${embBestScore.toFixed(4)}) ${embOk ? "✅" : "❌"}`);
    console.log();
  }

  console.log(`  📊 Rule-based accuracy:      ${ruleCorrect}/${total}`);
  console.log(`  📊 Embedding-based accuracy: ${embeddingCorrect}/${total}`);
  const embeddingWins = embeddingCorrect >= ruleCorrect;
  console.log(`  ${embeddingWins ? "✅" : "❌"} Embedding >= rule-based accuracy`);
  console.log();

  return { ruleCorrect, embeddingCorrect, total };
}

// ── Step 4: Live Firestore Embedding Check ─────────────────────────────────

async function step4_firestoreCheck() {
  console.log("━━━ STEP 4 — Live Firestore Embedding Status ━━━━━━━━━━━━━━\n");

  const [resSnap, ticketSnap] = await Promise.all([
    db.collection("resources").get(),
    db.collection("tickets").get(),
  ]);

  const countStatus = (docs: admin.firestore.QueryDocumentSnapshot[], field: string) => {
    let ok = 0, pending = 0, failed = 0, missing = 0;
    for (const d of docs) {
      const s = d.data()[field];
      if (s === "ok") ok++;
      else if (s === "pending") pending++;
      else if (s === "failed") failed++;
      else missing++;
    }
    return { ok, pending, failed, missing, total: docs.length };
  };

  const rStats = countStatus(resSnap.docs, "embeddingStatus");
  const tStats = countStatus(ticketSnap.docs, "embeddingStatus");

  console.log(`  Resources  (${rStats.total} total): ✅ ok=${rStats.ok}  ⏳ pending=${rStats.pending}  ❌ failed=${rStats.failed}  ❓ missing=${rStats.missing}`);
  console.log(`  Tickets    (${tStats.total} total): ✅ ok=${tStats.ok}  ⏳ pending=${tStats.pending}  ❌ failed=${tStats.failed}  ❓ missing=${tStats.missing}`);

  // Check that embedded docs actually have vectors
  let vectorMissing = 0;
  for (const d of resSnap.docs) {
    if (d.data().embeddingStatus === "ok" && !d.data().embedding) vectorMissing++;
  }
  for (const d of ticketSnap.docs) {
    if (d.data().embeddingStatus === "ok" && !d.data().embedding) vectorMissing++;
  }

  const vectorOk = vectorMissing === 0;
  console.log(`\n  ${vectorOk ? "✅" : "⚠️ "} Vector field present on all 'ok' docs (missing=${vectorMissing})`);
  console.log(`  ${rStats.failed + tStats.failed === 0 ? "✅" : "⚠️ "} No failed embeddings in production`);
  console.log();

  return { rStats, tStats, vectorMissing };
}

// ── Step 5: Performance Summary ────────────────────────────────────────────

function step5_performance(embeddings: Map<string, number[]>, totalElapsedMs: number) {
  console.log("━━━ STEP 5 — Performance ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  const count = embeddings.size;
  const avgMs = count ? Math.round(totalElapsedMs / count) : 0;
  const acceptable = avgMs < 5000;
  console.log(`  Total docs embedded:  ${count}`);
  console.log(`  Total wall time:      ${totalElapsedMs}ms`);
  console.log(`  Avg per embedding:    ${avgMs}ms`);
  console.log(`  ${acceptable ? "✅" : "❌"} Latency acceptable (<5s): ${acceptable}`);
  console.log();
}

// ── Step 6: Edge Cases ─────────────────────────────────────────────────────

async function step6_edgeCases(ai: GoogleGenAI) {
  console.log("━━━ STEP 6 — Edge Cases ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const cases: Array<{ label: string; text: string }> = [
    { label: "Empty description", text: "Capability: . . Terms: . Service region: ." },
    { label: "Very similar categories", text: "Ticket: Food and nutrition support. Nutritional aid for children. Needs: 100 units of FOOD_KIT." },
    { label: "Completely unrelated", text: "Ticket: Tech infrastructure upgrade. Software licenses and cloud compute. Needs: 50 units of SERVICE." },
  ];

  let passed = 0;
  for (const c of cases) {
    try {
      const vec = await embed(ai, c.text);
      const nonZero = vec.some((v) => v !== 0);
      console.log(`  ✅ "${c.label}" → ${vec.length}d, non-zero=${nonZero}`);
      passed++;
    } catch (err: any) {
      console.log(`  ❌ "${c.label}" → CRASHED: ${err.message}`);
    }
  }

  console.log(`\n  📊 Edge cases passed: ${passed}/${cases.length}`);
  console.log(`  ${passed === cases.length ? "✅" : "❌"} No crashes on edge inputs`);
  console.log();

  return passed;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   NEXUS — VECTOR EMBEDDING VALIDATION TEST               ║");
  console.log("║   Model: " + EMBED_MODEL.padEnd(48) + "║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Pre-check
  const preOk = await preCheck();
  if (!preOk) {
    console.error("❌ Pre-check failed. Aborting.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const t0 = Date.now();

  // Steps
  const embeddings = await step1_generateEmbeddings(ai);
  const { results, rankingCorrect, rankingTotal } = step2_similarityCalc(embeddings);
  const { ruleCorrect, embeddingCorrect, total } = step3_compareMatching(embeddings);
  const { rStats, tStats, vectorMissing } = await step4_firestoreCheck();
  step5_performance(embeddings, Date.now() - t0);
  const edgePassed = await step6_edgeCases(ai);

  // ── Final Verdict ────────────────────────────────────────────────────────
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   FINAL VERDICT                                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const criteria = [
    { label: "All test docs embedded",            pass: embeddings.size === [...TEST_RESOURCES, ...TEST_TICKETS].length },
    { label: "Correct similarity ranking",         pass: rankingCorrect === rankingTotal },
    { label: "Embedding accuracy >= rule-based",   pass: embeddingCorrect >= ruleCorrect },
    { label: "No failed embeddings in production", pass: rStats.failed + tStats.failed === 0 },
    { label: "No vector field missing on ok docs", pass: vectorMissing === 0 },
    { label: "Edge cases: no crashes",             pass: edgePassed === 3 },
  ];

  let passed = 0;
  for (const c of criteria) {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.label}`);
    if (c.pass) passed++;
  }

  console.log();
  if (passed === criteria.length) {
    console.log("🏆 RESULT: PASS — Embeddings are valid and should be used in production.");
  } else {
    console.log(`⚠️  RESULT: PARTIAL (${passed}/${criteria.length} criteria met) — Review failures above.`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
