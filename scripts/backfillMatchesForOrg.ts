/**
 * backfillMatchesForOrg.ts
 *
 * Option A: One-shot Flow A backfill for orgs that listed resources AFTER
 * tickets were created and therefore received no match docs.
 *
 * What it does:
 *  1. Finds the target org by name keyword (e.g. "flexon").
 *  2. Loads all AVAILABLE resources for that org with embeddingStatus=ok.
 *  3. Finds all open (non-CLOSED) tickets whose needs overlap the org's
 *     resource categories.
 *  4. For each qualifying ticket, runs the same hard-filter + cosine +
 *     hybrid score logic as onTicketCreated (Flow A).
 *  5. Writes matches/{ticketId}__{orgId} — idempotent (batch.set overwrites).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=.secrets/service-account.json \
 *   npx tsx scripts/backfillMatchesForOrg.ts --org flexon [--dry-run]
 *
 * Flags:
 *   --org <keyword>   Partial org name (case-insensitive). Required.
 *   --dry-run         Print what would be written without committing.
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const orgFlag = args.indexOf("--org");
const orgKeyword = orgFlag !== -1 ? args[orgFlag + 1] : null;
const DRY_RUN = args.includes("--dry-run");

if (!orgKeyword) {
  console.error("Usage: npx tsx scripts/backfillMatchesForOrg.ts --org <keyword> [--dry-run]");
  process.exit(1);
}

// ── Scoring helpers (mirrors functions/src/lib/matching.ts) ─────────────────
function readEmbedding(val: unknown): number[] | null {
  if (!val) return null;
  if (Array.isArray(val)) return val as number[];
  if (typeof (val as any).toArray === "function") return (val as any).toArray();
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function haversineKm(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function geoScore(dist: number, radius: number | undefined): number {
  const r = radius && radius > 0 ? radius : 50;
  if (dist > r) return 0;
  return 1 - dist / r;
}

function capacityScore(qty: number, needed: number): number {
  if (needed <= 0) return 1;
  return Math.min(qty / needed, 1.0);
}

function reliabilityScore(reliability: any): number {
  if (!reliability) return 0.7;
  const { agreement, execution, closure } = reliability;
  return (agreement.score + execution.score + closure.score) / 3 / 100;
}

function hybridScore(sem: number, geo: number, capacity: number, reliability: number): number {
  return 0.5 * sem + 0.2 * geo + 0.2 * capacity + 0.1 * reliability;
}

function computeProjection(needs: any[], resourceCategory: string, resourceQuantity: number) {
  const idx = needs.findIndex((n: any) => n.resourceCategory === resourceCategory);
  if (idx === -1) return { bestNeedIndex: -1, maxContributionPossible: 0, contributionFeasibility: "PARTIALLY_COVERS" as const, contributionImpactPct: 0 };
  const need = needs[idx];
  const remaining = need.quantity * (1 - (need.progressPct ?? 0) / 100);
  const maxPossible = Math.min(resourceQuantity, remaining);
  let feasibility: "FULLY_COVERS" | "PARTIALLY_COVERS" | "EXCEEDS_NEED" = "PARTIALLY_COVERS";
  if (resourceQuantity >= remaining) feasibility = resourceQuantity > remaining ? "EXCEEDS_NEED" : "FULLY_COVERS";
  const impactPct = remaining > 0 ? (maxPossible / remaining) * 100 : 0;
  return { bestNeedIndex: idx, maxContributionPossible: maxPossible, contributionFeasibility: feasibility, contributionImpactPct: impactPct };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("══════════════════════════════════════════════════════");
  console.log(`  NEXUS — Flow A Backfill  [${DRY_RUN ? "DRY RUN" : "LIVE WRITE"}]`);
  console.log(`  Target org keyword: "${orgKeyword}"`);
  console.log("══════════════════════════════════════════════════════\n");

  // 1. Find org
  const orgsSnap = await db.collection("organizations").get();
  const orgDoc = orgsSnap.docs.find((d) =>
    d.data().name?.toLowerCase().includes(orgKeyword!.toLowerCase())
  );
  if (!orgDoc) {
    console.error(`❌ No org found matching "${orgKeyword}"`);
    process.exit(1);
  }
  const orgData = orgDoc.data();
  console.log(`🏢 Org: "${orgData.name}" (ID: ${orgDoc.id}) | Status: ${orgData.status}`);
  if (orgData.status !== "ACTIVE") {
    console.error("❌ Org is not ACTIVE — aborting.");
    process.exit(1);
  }

  // 2. Load org's embedded resources
  const resourcesSnap = await db.collection("resources")
    .where("orgId", "==", orgDoc.id)
    .where("status", "==", "AVAILABLE")
    .get();

  const resources = resourcesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r: any) => r.embeddingStatus === "ok" && readEmbedding(r.embedding) !== null);

  if (resources.length === 0) {
    console.error("❌ No AVAILABLE resources with embeddingStatus=ok found. Cannot backfill.");
    process.exit(1);
  }

  const categories = new Set(resources.map((r: any) => r.category));
  console.log(`\n📦 Eligible resources: ${resources.length}`);
  resources.forEach((r: any) => {
    console.log(`   [${r.id}] "${r.title}" | category=${r.category} | qty=${r.quantity}`);
  });
  console.log(`   Categories: ${[...categories].join(", ")}\n`);

  // 3. Find open tickets with overlapping category needs, excluding tickets hosted by this org
  const ticketsSnap = await db.collection("tickets")
    .where("phase", "!=", "CLOSED")
    .get();

  const candidateTickets = ticketsSnap.docs.filter((d) => {
    const t = d.data();
    if (t.hostOrgId === orgDoc.id) return false; // host can't match themselves
    if (t.embeddingStatus !== "ok") return false; // ticket not embedded → skip
    const needCategories = (t.needs ?? []).map((n: any) => n.resourceCategory);
    return needCategories.some((c: string) => categories.has(c));
  });

  console.log(`🎫 Open tickets with category overlap: ${candidateTickets.length}`);
  if (candidateTickets.length === 0) {
    console.log("Nothing to backfill.");
    process.exit(0);
  }

  // 4. Score and write
  const now = Date.now();
  let written = 0;
  let skipped = 0;

  for (const ticketDoc of candidateTickets) {
    const ticket = ticketDoc.data();
    const ticketId = ticketDoc.id;
    const ticketEmbedding = readEmbedding(ticket.embedding);
    if (!ticketEmbedding) {
      console.log(`   ⚠️  [${ticketId}] No embedding vector on ticket — skipping`);
      skipped++;
      continue;
    }

    const ticketGeo = ticket.geo as { lat: number; lng: number };
    const needs = (ticket.needs ?? []) as any[];
    const deadline = Number(ticket.deadline ?? 0);

    // Hard filter + score each matching resource for this org
    let bestScore = -1;
    let bestResource: any = null;
    let bestGeo = 0, bestCapacity = 0, bestSem = 0, bestDistanceKm = 0;

    for (const r of resources as any[]) {
      if (!categories.has(r.category)) continue;
      const matchedNeed = needs.find((n) => n.resourceCategory === r.category);
      if (!matchedNeed) continue;

      // Geo distance check
      const resGeo = r.geo as { lat: number; lng: number; serviceRadiusKm?: number };
      if (!resGeo) continue;
      const radiusKm = Number(resGeo.serviceRadiusKm ?? 0);
      const distance = haversineKm(ticketGeo, resGeo);
      if (radiusKm > 0 && distance > radiusKm) {
        console.log(`   ⚠️  [${ticketId}] Resource ${r.id} out of radius (${Math.round(distance)}km > ${radiusKm}km) — skipping`);
        continue;
      }

      // Availability window check
      if (
        r.terms?.availableUntil !== undefined &&
        Number(r.terms.availableUntil) > 0 &&
        Number(r.terms.availableUntil) < deadline
      ) {
        console.log(`   ⚠️  [${ticketId}] Resource ${r.id} expires before ticket deadline — skipping`);
        continue;
      }

      const embedding = readEmbedding(r.embedding)!;
      const sem = cosineSimilarity(ticketEmbedding, embedding);
      const geo = geoScore(distance, radiusKm);
      const remaining = matchedNeed.quantity * (1 - (matchedNeed.progressPct ?? 0) / 100);
      const capacity = capacityScore(r.quantity, Math.max(remaining, 1));
      const rel = reliabilityScore(orgData.reliability);
      const score = hybridScore(sem, geo, capacity, rel);

      if (score > bestScore) {
        bestScore = score;
        bestResource = r;
        bestGeo = geo;
        bestCapacity = capacity;
        bestSem = sem;
        bestDistanceKm = distance;
      }
    }

    if (!bestResource || bestScore < 0) {
      console.log(`   ⏭️  [${ticketId}] "${ticket.title}" — no resource passed hard filter`);
      skipped++;
      continue;
    }

    const projection = computeProjection(needs, bestResource.category, bestResource.quantity);
    const matchId = `${ticketId}__${orgDoc.id}`;
    const matchData = {
      ticketId,
      orgId: orgDoc.id,
      topResourceId: bestResource.id,
      score: bestScore,
      semanticScore: bestSem,
      reason: `You listed ${bestResource.category} within ${Math.round(bestDistanceKm)} km of this ticket.`,
      bestNeedIndex: projection.bestNeedIndex,
      maxContributionPossible: projection.maxContributionPossible,
      contributionFeasibility: projection.contributionFeasibility,
      contributionImpactPct: projection.contributionImpactPct,
      geoDistanceKm: bestDistanceKm,
      rapidBroadcast: false,
      surfaced: false,
      dismissed: false,
      createdAt: now,
    };

    console.log(`   ✅ [${ticketId}] "${ticket.title}"`);
    console.log(`      → matchId: ${matchId}`);
    console.log(`      → score: ${bestScore.toFixed(4)} (sem=${bestSem.toFixed(3)}, geo=${bestGeo.toFixed(3)}, cap=${bestCapacity.toFixed(3)})`);
    console.log(`      → contributionImpactPct: ${projection.contributionImpactPct.toFixed(1)}%`);

    if (!DRY_RUN) {
      await db.collection("matches").doc(matchId).set(matchData);
    }
    written++;
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  SUMMARY  [${DRY_RUN ? "DRY RUN — nothing written" : "LIVE"}]`);
  console.log(`  Tickets processed: ${candidateTickets.length}`);
  console.log(`  Match docs ${DRY_RUN ? "would be written" : "written"}: ${written}`);
  console.log(`  Skipped (no qualifying resource): ${skipped}`);
  console.log("══════════════════════════════════════════════════════");
  if (DRY_RUN) {
    console.log("\n  Re-run without --dry-run to commit the writes.");
  } else {
    console.log("\n  Done. Flexon's /dashboard should now show these tickets under");
    console.log("  \"Recommended for you\" (may take a few seconds for Firestore listeners to update).");
  }
}

main().catch(console.error);
