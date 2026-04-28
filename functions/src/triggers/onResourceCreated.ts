import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import {
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
} from "../lib/matching";

/**
 * On resource create, generate a 768-d embedding with text-embedding-004 and
 * write it back to the resource doc using Firestore's native vector type
 * (queryable by Firestore native vectorSearch — see plan §A.2). Flips
 * embeddingStatus pending → ok on success, failed on permanent error.
 *
 * After embedding succeeds, runs **reverse matching** — scans all open tickets
 * and creates match docs for any that the new resource is relevant to. This
 * closes the gap where resources listed AFTER a ticket was raised would never
 * generate match docs (because onTicketCreated already fired in the past).
 *
 * The Gemini API key is reused: text-embedding-004 is served by the same
 * Generative Language API as the onboarding chat model. No Vertex auth needed.
 */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;
const MAX_TICKETS = 500;
const TOP_K = 10;

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

    // ── Reverse matching: scan open tickets and create match docs ────────
    await runReverseMatching(resourceId, data, vector);
  },
);

// ── Reverse Matching ─────────────────────────────────────────────────────
// Mirror of Flow A in onTicketCreated.ts, but inverted: given a NEW resource,
// find all open tickets it could serve and write match docs.

interface ScoredTicket {
  ticketId: string;
  ticketGeo: { lat: number; lng: number };
  needs: NeedLite[];
  ticketEmbedding: number[];
  semanticScore: number;
  geo: number;
  capacity: number;
  reliability: number;
  finalScore: number;
  distanceKm: number;
}

async function runReverseMatching(
  resourceId: string,
  resourceData: admin.firestore.DocumentData,
  resourceEmbedding: number[],
) {
  const db = admin.firestore();
  const resourceCategory = String(resourceData.category ?? "");
  const resourceOrgId = String(resourceData.orgId ?? "");
  const resourceQty = Number(resourceData.quantity ?? 0);
  const resourceGeo = resourceData.geo as {
    lat: number;
    lng: number;
    serviceRadiusKm?: number;
  };
  const radiusKm = Number(resourceGeo?.serviceRadiusKm ?? 0);
  const resourceTerms = resourceData.terms as {
    availableFrom?: number;
    availableUntil?: number;
  };

  if (!resourceCategory || !resourceOrgId || !resourceGeo) {
    logger.warn("reverse matching skipped — resource missing required fields", {
      resourceId,
    });
    return;
  }

  // Look up the resource owner's org for reliability scoring.
  const orgSnap = await db.collection("organizations").doc(resourceOrgId).get();
  if (!orgSnap.exists || orgSnap.data()?.status !== "ACTIVE") {
    logger.info("reverse matching skipped — org not ACTIVE", {
      resourceId,
      resourceOrgId,
    });
    return;
  }
  const org: OrgLite = {
    status: String(orgSnap.data()!.status ?? ""),
    reliability: orgSnap.data()!.reliability,
  };

  // Query all open tickets (not yet closed/completed).
  const ticketSnap = await db
    .collection("tickets")
    .where("phase", "in", ["OPEN", "PLEDGING", "EXECUTION", "PENDING_SIGNOFF"])
    .limit(MAX_TICKETS)
    .get();

  if (ticketSnap.empty) {
    logger.info("reverse matching: no open tickets found", { resourceId });
    return;
  }

  // Hard-filter and score each ticket.
  const scored: ScoredTicket[] = [];

  for (const ticketDoc of ticketSnap.docs) {
    const ticket = ticketDoc.data();
    const ticketId = ticketDoc.id;
    const hostOrgId = String(ticket.hostOrgId ?? "");

    // Can't match yourself.
    if (hostOrgId === resourceOrgId) continue;

    // Ticket must have a valid embedding.
    if (ticket.embeddingStatus !== "ok") continue;
    const ticketEmbedding = readEmbedding(ticket.embedding);
    if (!ticketEmbedding) continue;

    // Ticket must need this resource category.
    const needs: NeedLite[] = (ticket.needs ?? []).map((n: NeedLite) => ({
      resourceCategory: n.resourceCategory,
      quantity: n.quantity,
      unit: n.unit,
      progressPct: n.progressPct ?? 0,
    }));
    const matchedNeed = needs.find(
      (n) => n.resourceCategory === resourceCategory,
    );
    if (!matchedNeed) continue;

    // Geo check — if the resource has a service radius, the ticket must be within it.
    const ticketGeo = ticket.geo as { lat: number; lng: number };
    if (!ticketGeo) continue;
    const distance = haversineKm(ticketGeo, resourceGeo);
    if (radiusKm > 0 && distance > radiusKm) continue;

    // Deadline check — resource must be available before ticket deadline.
    const deadline = Number(ticket.deadline ?? 0);
    if (
      resourceTerms?.availableUntil !== undefined &&
      Number(resourceTerms.availableUntil) > 0 &&
      Number(resourceTerms.availableUntil) < deadline
    ) {
      continue;
    }

    // Score using the same hybrid formula as onTicketCreated.
    const sem = cosineSimilarity(ticketEmbedding, resourceEmbedding);
    const geo = geoScore(distance, radiusKm);
    const remaining =
      matchedNeed.quantity * (1 - matchedNeed.progressPct / 100);
    const capacity = capacityScore(resourceQty, Math.max(remaining, 1));
    const reliability = reliabilityScore(org);
    const finalScore = hybridScore({ sem, geo, capacity, reliability });

    scored.push({
      ticketId,
      ticketGeo,
      needs,
      ticketEmbedding,
      semanticScore: sem,
      geo,
      capacity,
      reliability,
      finalScore,
      distanceKm: distance,
    });
  }

  if (scored.length === 0) {
    logger.info("reverse matching: no eligible tickets after hard filter", {
      resourceId,
    });
    return;
  }

  // Sort and cap to top-K tickets.
  const topK = scored
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, TOP_K);

  // Write match docs. Deterministic ID: `{ticketId}__{orgId}`.
  // Using set() so if a match already exists from onTicketCreated, it gets
  // updated with the (possibly better) score. No duplicates.
  const now = Date.now();
  const batch = db.batch();

  for (const c of topK) {
    const projection = computeProjection(
      c.needs,
      resourceCategory,
      resourceQty,
    );
    const matchId = `${c.ticketId}__${resourceOrgId}`;
    const ref = db.collection("matches").doc(matchId);

    batch.set(
      ref,
      {
        ticketId: c.ticketId,
        orgId: resourceOrgId,
        topResourceId: resourceId,
        score: c.finalScore,
        semanticScore: c.semanticScore,
        reason: `You listed ${resourceCategory} within ${Math.round(c.distanceKm)} km of this ticket.`,
        bestNeedIndex: projection.bestNeedIndex,
        maxContributionPossible: projection.maxContributionPossible,
        contributionFeasibility: projection.contributionFeasibility,
        contributionImpactPct: projection.contributionImpactPct,
        geoDistanceKm: c.distanceKm,
        rapidBroadcast: false,
        surfaced: false,
        dismissed: false,
        createdAt: now,
      },
      { merge: true },
    );
  }

  await batch.commit();

  logger.info("reverse matching: match docs written", {
    resourceId,
    ticketsScanned: ticketSnap.size,
    ticketsScored: scored.length,
    matchesWritten: topK.length,
  });
}
