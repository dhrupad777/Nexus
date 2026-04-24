import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import {
  buildTicketEmbeddingInput,
  capacityScore,
  computeProjection,
  cosineSimilarity,
  geoScore,
  haversineKm,
  hybridScore,
  readEmbedding,
  reliabilityScore,
  type NeedLite,
  type OrgLite,
  type ResourceLite,
} from "../lib/matching";

/**
 * Fires on every ticket create. Two responsibilities:
 *  1. Embed the ticket via text-embedding-004 → write `embedding` (768d).
 *  2. If non-rapid: run the Flow A matching pipeline (hard filter →
 *     cosine semantic → hybrid score → top-K with per-entity projection
 *     → write `matches/{ticketId__orgId}` docs).
 *
 * Rapid tickets are handled by `onRapidTicketCreated` in parallel.
 *
 * Phase 2 references:
 *  - List.md §2.2 (matching) — hybrid weights are LOCKED here as constants.
 *  - Albin/Nexus_Vector_Embedding_Integration.md — algorithm shape.
 *  - Albin/Nexus_Ticket_Display_Spec.md §3.3 — projection fields.
 */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const EMBED_MODEL = "text-embedding-004";
const EMBED_DIM = 768;
const MAX_CANDIDATES = 500;
const TOP_K = 10;

async function embedOnce(ai: GoogleGenAI, text: string): Promise<number[]> {
  const resp = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
  });
  const values = resp.embeddings?.[0]?.values;
  if (!values || values.length !== EMBED_DIM) {
    throw new Error(
      `embedContent returned ${values?.length ?? 0} dims, expected ${EMBED_DIM}`,
    );
  }
  return values;
}

interface ScoredCandidate {
  resource: ResourceLite;
  org: OrgLite;
  semanticScore: number;
  geo: number;
  capacity: number;
  reliability: number;
  finalScore: number;
  distanceKm: number;
}

export const onTicketCreated = onDocumentCreated(
  { document: "tickets/{ticketId}", secrets: [GEMINI_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ticket = snap.data();
    const { ticketId } = event.params;

    // ── 1. Embed ────────────────────────────────────────────────────────
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      logger.error("GEMINI_API_KEY missing — cannot embed ticket", { ticketId });
      await snap.ref.update({ embeddingStatus: "failed" });
      return;
    }
    const ai = new GoogleGenAI({ apiKey });
    const input = buildTicketEmbeddingInput(ticket);

    let vector: number[] | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        vector = await embedOnce(ai, input);
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`embed attempt ${attempt} failed`, { ticketId, err: msg });
      }
    }

    if (!vector) {
      await snap.ref.update({ embeddingStatus: "failed" });
      logger.error("ticket embedding failed permanently", { ticketId });
      return;
    }

    await snap.ref.update({
      embedding: FieldValue.vector(vector),
      embeddingVersion: EMBED_MODEL,
      embeddingStatus: "ok",
    });
    logger.info("ticket embedded", { ticketId, model: EMBED_MODEL });

    // Flow B (rapid) branches off via `onRapidTicketCreated`.
    if (ticket.rapid === true) return;

    // ── 2. Flow A matching ──────────────────────────────────────────────
    await runFlowAMatching(ticketId, ticket, vector);
  },
);

async function runFlowAMatching(
  ticketId: string,
  ticket: admin.firestore.DocumentData,
  ticketEmbedding: number[],
) {
  const db = admin.firestore();
  const needs: NeedLite[] = (ticket.needs ?? []).map((n: NeedLite) => ({
    resourceCategory: n.resourceCategory,
    quantity: n.quantity,
    unit: n.unit,
    progressPct: n.progressPct ?? 0,
  }));
  if (needs.length === 0) {
    logger.warn("ticket has no needs — skipping matching", { ticketId });
    return;
  }
  const neededCategories = new Set(needs.map((n) => n.resourceCategory));
  const ticketGeo = ticket.geo as { lat: number; lng: number };
  const deadline = Number(ticket.deadline);
  const hostOrgId = String(ticket.hostOrgId ?? "");

  // Read candidate resources (single index lookup; cap for safety).
  const resourceSnap = await db
    .collection("resources")
    .where("status", "==", "AVAILABLE")
    .limit(MAX_CANDIDATES)
    .get();

  if (resourceSnap.empty) {
    logger.info("no AVAILABLE resources; matching skipped", { ticketId });
    return;
  }

  // Hard filter pass (in-memory; cheap vs. extra Firestore round-trips).
  const survivors: ResourceLite[] = [];
  for (const doc of resourceSnap.docs) {
    const d = doc.data();
    const orgId = String(d.orgId ?? "");
    if (!orgId || orgId === hostOrgId) continue; // host can't match themselves
    const category = String(d.category ?? "");
    if (!neededCategories.has(category)) continue;
    if (d.embeddingStatus !== "ok") continue;
    const resGeo = d.geo as { lat: number; lng: number; serviceRadiusKm?: number };
    if (!resGeo) continue;
    const radiusKm = Number(resGeo.serviceRadiusKm ?? 0);
    const distance = haversineKm(ticketGeo, resGeo);
    if (radiusKm > 0 && distance > radiusKm) continue;
    const terms = d.terms as { availableFrom?: number; availableUntil?: number };
    if (
      terms?.availableUntil !== undefined &&
      Number(terms.availableUntil) > 0 &&
      Number(terms.availableUntil) < deadline
    ) {
      continue;
    }
    const embedding = readEmbedding(d.embedding);
    if (!embedding) continue;

    survivors.push({
      id: doc.id,
      orgId,
      category,
      quantity: Number(d.quantity ?? 0),
      geo: { lat: resGeo.lat, lng: resGeo.lng, serviceRadiusKm: radiusKm },
      terms: {
        availableFrom: Number(terms?.availableFrom ?? 0),
        availableUntil: Number(terms?.availableUntil ?? 0),
      },
      embedding,
      status: String(d.status ?? ""),
      embeddingStatus: String(d.embeddingStatus ?? ""),
    });
  }

  if (survivors.length === 0) {
    logger.info("no surviving candidates after hard filter", { ticketId });
    return;
  }

  // Batch-read the involved orgs (one read per distinct orgId).
  const orgIds = Array.from(new Set(survivors.map((r) => r.orgId)));
  const orgRefs = orgIds.map((id) => db.collection("organizations").doc(id));
  const orgDocs = await db.getAll(...orgRefs);
  const orgMap = new Map<string, OrgLite>();
  orgDocs.forEach((s, i) => {
    if (!s.exists) return;
    const od = s.data()!;
    orgMap.set(orgIds[i], {
      status: String(od.status ?? ""),
      reliability: od.reliability,
    });
  });

  // Score every survivor whose org is ACTIVE.
  const scored: ScoredCandidate[] = [];
  for (const r of survivors) {
    const org = orgMap.get(r.orgId);
    if (!org || org.status !== "ACTIVE") continue;
    const sem = cosineSimilarity(ticketEmbedding, r.embedding!);
    const distance = haversineKm(ticketGeo, r.geo);
    const geo = geoScore(distance, r.geo.serviceRadiusKm);
    // Capacity fit against the most-relevant matching need.
    const matchedNeed = needs.find((n) => n.resourceCategory === r.category)!;
    const remaining = matchedNeed.quantity * (1 - matchedNeed.progressPct / 100);
    const capacity = capacityScore(r.quantity, Math.max(remaining, 1));
    const reliability = reliabilityScore(org);
    const finalScore = hybridScore({ sem, geo, capacity, reliability });
    scored.push({
      resource: r,
      org,
      semanticScore: sem,
      geo,
      capacity,
      reliability,
      finalScore,
      distanceKm: distance,
    });
  }

  if (scored.length === 0) {
    logger.info("no eligible orgs after scoring", { ticketId });
    return;
  }

  // Group by orgId, keep best resource per org.
  const bestPerOrg = new Map<string, ScoredCandidate>();
  for (const c of scored) {
    const cur = bestPerOrg.get(c.resource.orgId);
    if (!cur || c.finalScore > cur.finalScore) {
      bestPerOrg.set(c.resource.orgId, c);
    }
  }

  // Top-K by hybrid score.
  const topK = Array.from(bestPerOrg.values())
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, TOP_K);

  // Write match docs in a single batch. matchId is deterministic
  // (`${ticketId}__${orgId}`) for idempotency on retries.
  const now = Date.now();
  const batch = db.batch();
  for (const c of topK) {
    const projection = computeProjection(needs, c.resource.category, c.resource.quantity);
    const matchId = `${ticketId}__${c.resource.orgId}`;
    const ref = db.collection("matches").doc(matchId);
    batch.set(ref, {
      ticketId,
      orgId: c.resource.orgId,
      topResourceId: c.resource.id,
      score: c.finalScore,
      semanticScore: c.semanticScore,
      reason: buildReason(c, needs),
      bestNeedIndex: projection.bestNeedIndex,
      maxContributionPossible: projection.maxContributionPossible,
      contributionFeasibility: projection.contributionFeasibility,
      contributionImpactPct: projection.contributionImpactPct,
      geoDistanceKm: c.distanceKm,
      rapidBroadcast: false,
      surfaced: false,
      dismissed: false,
      createdAt: now,
    });
  }
  await batch.commit();

  logger.info("Flow A matches written", {
    ticketId,
    candidates: survivors.length,
    scored: scored.length,
    written: topK.length,
  });
}

function buildReason(c: ScoredCandidate, needs: NeedLite[]): string {
  const need = needs.find((n) => n.resourceCategory === c.resource.category);
  const cat = need?.resourceCategory ?? c.resource.category;
  const km = Math.round(c.distanceKm);
  return `You listed ${cat} within ${km} km of this ticket.`;
}
