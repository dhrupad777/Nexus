import { z } from "zod";

/**
 * AI-generated suggestion linking a ticket to an org's best matching resource.
 * One doc per (ticket, org) pair — if multiple resources from the same org
 * match the same ticket, only the highest-scoring one is persisted as the
 * canonical match (its id lives in `topResourceId`). Server-only writes
 * (firestore.rules); client may only flip `dismissed` on its own row.
 *
 * Two write-paths:
 *  - Flow A `onTicketOpened` → ranked top-K with `score` + `semanticScore`.
 *  - Flow B `onRapidTicketCreated` → broadcast with `rapidBroadcast: true`,
 *    no hybrid score (sort client-side by urgency → distance → capacity per
 *    Albin/Nexus_Dashboard_Logic.md §5).
 */
export const MatchSchema = z.object({
  ticketId: z.string(),
  /** Denormalized from `resources/{topResourceId}.orgId`. The dashboard query
   * filter — `matches where orgId == viewerOrgId`. */
  orgId: z.string(),
  /** Best resource from this org for this ticket (highest score among the
   * org's resources that passed the hard filters). */
  topResourceId: z.string(),

  // ── Scoring (Flow A only — undefined on Flow B rapidBroadcast matches) ──
  /** Hybrid score: `0.5*sem + 0.2*geo + 0.2*capacity + 0.1*reliability`. */
  score: z.number().min(0).max(1).optional(),
  /** Raw cosine similarity from vectorSearch. */
  semanticScore: z.number().min(0).max(1).optional(),

  /** Human-readable explanation surfaced on the card ("You listed X in Y"). */
  reason: z.string(),

  // ── Per-entity contribution projection (Albin Ticket spec §3.3) ────────
  /** Index into `tickets.needs[]` that this org can contribute to most
   * impactfully (drives the card's "Your contribution potential" panel). */
  bestNeedIndex: z.number().int().nonnegative(),
  /** Quantity (in the need's unit) the org could deliver — capped by
   * `min(resource.quantity, need.remaining)`. */
  maxContributionPossible: z.number().nonnegative(),
  /** True if the org can meaningfully participate (>0 deliverable AND any
   * outstanding remaining on the need). */
  contributionFeasibility: z.boolean(),
  /** `maxContributionPossible / need.remaining * 100`, clamped to [0, 100].
   * Used as the headline "fills 32% of remaining" on the card. */
  contributionImpactPct: z.number().min(0).max(100),

  // ── Geo (denormalized from Distance Matrix) ────────────────────────────
  geoDistanceKm: z.number().nonnegative().optional(),

  // ── Flow B ─────────────────────────────────────────────────────────────
  rapidBroadcast: z.boolean().default(false),

  // ── UI flags ───────────────────────────────────────────────────────────
  /** Set true after the org has seen this match on their dashboard. */
  surfaced: z.boolean().default(false),
  /** Client may flip via `decline` callable / dismiss action (firestore.rules
   * permits a single-key update). */
  dismissed: z.boolean().default(false),

  createdAt: z.number().int(),
});
export type Match = z.infer<typeof MatchSchema>;
