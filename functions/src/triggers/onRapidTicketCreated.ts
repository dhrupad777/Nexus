import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {
  computeProjection,
  haversineKm,
  type NeedLite,
} from "../lib/matching";

/**
 * Fires on every new ticket; only acts when `rapid === true`. Flow B
 * broadcast per List.md §2.2 + Albin/Nexus_Ticket_Display_Spec.md §5:
 *
 *  - hard-filter resources (emergencyContract.enabled, category fits, geo
 *    reachable, org ACTIVE),
 *  - write `matches/{ticketId__orgId}` with `rapidBroadcast: true` for every
 *    passing org (NO K cutoff, NO semantic ranking),
 *  - FCM push deferred — see `emergencyContract.autoNotify` bullet in §2.2.
 *
 * The dashboard sorts the broadcast segment client-side by
 * `urgency desc, geoDistanceKm asc, capacityFit desc` (List.md §2.10).
 */
const MAX_CANDIDATES = 1000;

export const onRapidTicketCreated = onDocumentCreated(
  "tickets/{ticketId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || data.rapid !== true) return;
    const { ticketId } = event.params;

    const db = admin.firestore();
    const needs: NeedLite[] = (data.needs ?? []).map((n: NeedLite) => ({
      resourceCategory: n.resourceCategory,
      quantity: n.quantity,
      unit: n.unit,
      progressPct: n.progressPct ?? 0,
    }));
    if (needs.length === 0) {
      logger.warn("rapid ticket has no needs — skipping broadcast", { ticketId });
      return;
    }
    const neededCategories = new Set(needs.map((n) => n.resourceCategory));
    const ticketGeo = data.geo as { lat: number; lng: number };
    const hostOrgId = String(data.hostOrgId ?? "");

    // Single index lookup: status=AVAILABLE survives the cap of 1000 in
    // demo scale; production-scale Flow B should fan out via a category
    // composite index, see firestore.indexes.json (resources by category +
    // emergencyContract.enabled + status — already present).
    const resourceSnap = await db
      .collection("resources")
      .where("status", "==", "AVAILABLE")
      .limit(MAX_CANDIDATES)
      .get();

    if (resourceSnap.empty) {
      logger.info("rapid: no AVAILABLE resources", { ticketId });
      return;
    }

    type Survivor = {
      id: string;
      orgId: string;
      category: string;
      quantity: number;
      distanceKm: number;
    };
    const survivors: Survivor[] = [];
    for (const doc of resourceSnap.docs) {
      const d = doc.data();
      const orgId = String(d.orgId ?? "");
      if (!orgId || orgId === hostOrgId) continue;
      const category = String(d.category ?? "");
      if (!neededCategories.has(category)) continue;
      const ec = d.emergencyContract as { enabled?: boolean } | undefined;
      if (!ec?.enabled) continue;
      const resGeo = d.geo as {
        lat: number;
        lng: number;
        serviceRadiusKm?: number;
      };
      if (!resGeo) continue;
      const radiusKm = Number(resGeo.serviceRadiusKm ?? 0);
      const distance = haversineKm(ticketGeo, resGeo);
      if (radiusKm > 0 && distance > radiusKm) continue;
      survivors.push({
        id: doc.id,
        orgId,
        category,
        quantity: Number(d.quantity ?? 0),
        distanceKm: distance,
      });
    }

    if (survivors.length === 0) {
      logger.info("rapid: no resources passed broadcast filter", { ticketId });
      return;
    }

    // Verify org is ACTIVE (batch-read).
    const orgIds = Array.from(new Set(survivors.map((s) => s.orgId)));
    const orgDocs = await db.getAll(
      ...orgIds.map((id) => db.collection("organizations").doc(id)),
    );
    const activeOrgs = new Set<string>();
    orgDocs.forEach((s, i) => {
      if (s.exists && s.data()!.status === "ACTIVE") activeOrgs.add(orgIds[i]);
    });

    // Group by orgId, keep closest (lowest distance) — distance is the
    // primary sort key on the rapid card, so closest is the canonical match.
    const bestPerOrg = new Map<string, Survivor>();
    for (const s of survivors) {
      if (!activeOrgs.has(s.orgId)) continue;
      const cur = bestPerOrg.get(s.orgId);
      if (!cur || s.distanceKm < cur.distanceKm) bestPerOrg.set(s.orgId, s);
    }

    if (bestPerOrg.size === 0) {
      logger.info("rapid: no ACTIVE orgs after filter", { ticketId });
      return;
    }

    const now = Date.now();
    const batch = db.batch();
    for (const s of bestPerOrg.values()) {
      const projection = computeProjection(needs, s.category, s.quantity);
      const matchId = `${ticketId}__${s.orgId}`;
      const ref = db.collection("matches").doc(matchId);
      batch.set(ref, {
        ticketId,
        orgId: s.orgId,
        topResourceId: s.id,
        // No `score` / `semanticScore` on rapid: dashboard sorts client-side
        // by urgency → distance → capacity per spec §5.
        reason: `Emergency broadcast: you have ${s.category} within ${Math.round(s.distanceKm)} km.`,
        bestNeedIndex: projection.bestNeedIndex,
        maxContributionPossible: projection.maxContributionPossible,
        contributionFeasibility: projection.contributionFeasibility,
        contributionImpactPct: projection.contributionImpactPct,
        geoDistanceKm: s.distanceKm,
        rapidBroadcast: true,
        surfaced: false,
        dismissed: false,
        createdAt: now,
      });
    }
    await batch.commit();

    logger.info("rapid broadcast complete", {
      ticketId,
      candidates: survivors.length,
      written: bestPerOrg.size,
    });
  },
);
