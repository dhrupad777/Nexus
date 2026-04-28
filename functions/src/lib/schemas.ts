/**
 * Minimal server-side copies of the shared zod schemas used by callables.
 * Kept in sync with nexus/lib/schemas/* — if you add a field here, mirror it
 * on the client side and vice versa. Plan §12 "interface-first teamwork".
 */
import { z } from "zod";

export const GeoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  adminRegion: z.string().min(1),
  operatingAreas: z.array(z.string()),
});

export const ResourceCategory = z.enum([
  "MATERIAL",
  "FUNDS",
  "MANUFACTURING",
  "VENUE",
  "VEHICLE",
  "VOLUNTEER_HOURS",
  "SERVICE",
  "SHELTER",
  "LOGISTICS",
  "FOOD_KIT",
]);

export const TicketUrgency = z.enum(["NORMAL", "EMERGENCY"]);

export const NeedInput = z.object({
  resourceCategory: ResourceCategory,
  /** Free-text refinement inside category, e.g. "primary education". Embedding input concatenates this when present. */
  subtype: z.string().max(80).optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  valuationINR: z.number().nonnegative(),
  hostSelfPledge: z.object({
    quantity: z.number().nonnegative(),
    valuationINR: z.number().nonnegative(),
    pctOfNeed: z.number().min(0).max(100),
  }),
});

export const RaiseTicketInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(4000),
  category: z.string().min(1).max(50),
  urgency: TicketUrgency,
  needs: z.array(NeedInput).min(1).max(10),
  geo: GeoSchema,
  deadline: z.number().int().positive(),
  // Optional gallery — first entry is the cover used on cards. Up to 6.
  images: z.array(z.string().url()).max(6).optional(),
  requestId: z.string().min(8),
});

export const DeleteTicketInputSchema = z.object({
  ticketId: z.string().min(1),
  requestId: z.string().min(8),
});
export type DeleteTicketInput = z.infer<typeof DeleteTicketInputSchema>;
export type RaiseTicketInput = z.infer<typeof RaiseTicketInputSchema>;

// ── Resources ─────────────────────────────────────────────────────────────

export const EmbeddingStatus = z.enum(["pending", "ok", "failed"]);

export const EmergencyContractSchema = z.object({
  enabled: z.boolean().default(false),
  emergencyCategories: z.array(z.string()).default([]),
  maxQuantityPerTicket: z.number().int().nonnegative().default(0),
  autoNotify: z.boolean().default(false),
});

// ── Pledge ────────────────────────────────────────────────────────────────

/** Mirror of lib/schemas/contribution.ts OfferedSchema. */
export const OfferedSchema = z.object({
  kind: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  valuationINR: z.number().nonnegative(),
  pctOfNeed: z.number().min(0).max(100),
  notes: z.string().default(""),
});

/**
 * Mirror of lib/schemas/contribution.ts PledgeInputSchema. Contributor names
 * a resource + quantity; server derives kind/unit/valuationINR/pctOfNeed
 * from the referenced resource doc. Server fills status, commitPath, timestamps.
 */
export const PledgeInputSchema = z.object({
  ticketId: z.string().min(1),
  resourceId: z.string().min(1),
  needIndex: z.number().int().nonnegative(),
  quantity: z.number().positive(),
  notes: z.string().max(1000).default(""),
  requestId: z.string().min(8),
});
export type PledgeInput = z.infer<typeof PledgeInputSchema>;

/** Mirror of lib/schemas/contribution.ts RespondToPledgeInputSchema. */
export const RespondToPledgeInputSchema = z.object({
  ticketId: z.string().min(1),
  contributionId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).default(""),
  requestId: z.string().min(8),
});
export type RespondToPledgeInput = z.infer<typeof RespondToPledgeInputSchema>;

// ── Phase transitions ─────────────────────────────────────────────────────

/** Mirror of lib/schemas/ticket.ts AdvancePhaseInputSchema. */
export const AdvancePhaseInputSchema = z.object({
  ticketId: z.string().min(1),
  target: z.enum(["EXECUTION", "PENDING_SIGNOFF"]),
  requestId: z.string().min(8),
});
export type AdvancePhaseInput = z.infer<typeof AdvancePhaseInputSchema>;

// ── Signoffs ──────────────────────────────────────────────────────────────

/** Mirror of lib/schemas/signoff.ts RecordSignoffInputSchema. */
export const SignoffDecision = z.enum(["APPROVED", "DISPUTED"]);
export type SignoffDecision = z.infer<typeof SignoffDecision>;

export const RecordSignoffInputSchema = z.object({
  ticketId: z.string().min(1),
  decision: SignoffDecision,
  note: z.string().max(2000).default(""),
  requestId: z.string().min(8),
});
export type RecordSignoffInput = z.infer<typeof RecordSignoffInputSchema>;

/**
 * Client-writable subset. Mirrors lib/schemas/resource.ts's
 * ResourceClientWriteSchema — orgId, status, and embedding lifecycle fields
 * are all set server-side.
 */
export const ResourceClientWriteSchema = z.object({
  category: ResourceCategory,
  title: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(40),
  valuationINR: z.number().nonnegative(),
  terms: z.object({
    availableFrom: z.number().int(),
    availableUntil: z.number().int(),
    conditions: z.string().max(2000).default(""),
  }),
  geo: GeoSchema.extend({
    serviceRadiusKm: z.number().nonnegative().default(0),
  }),
  emergencyContract: EmergencyContractSchema,
  requestId: z.string().min(8),
});
export type ResourceClientWrite = z.infer<typeof ResourceClientWriteSchema>;
