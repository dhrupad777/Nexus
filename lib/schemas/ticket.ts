import { z } from "zod";
import { GeoSchema, ResourceCategory } from "./common";

export const TicketUrgency = z.enum(["NORMAL", "EMERGENCY"]);
export type TicketUrgency = z.infer<typeof TicketUrgency>;

export const TicketPhase = z.enum([
  "RAISED",
  "OPEN_FOR_CONTRIBUTIONS",
  "EXECUTION",
  "PENDING_SIGNOFF",
  "CLOSED",
]);
export type TicketPhase = z.infer<typeof TicketPhase>;

export const NeedSchema = z.object({
  resourceCategory: ResourceCategory,
  quantity: z.number().positive(),
  unit: z.string().min(1),
  valuationINR: z.number().nonnegative(),
  hostSelfPledge: z.object({
    quantity: z.number().nonnegative(),
    valuationINR: z.number().nonnegative(),
    pctOfNeed: z.number().min(0).max(100),
  }),
  // progressPct is server-written only
});
export type Need = z.infer<typeof NeedSchema>;

/** Full server-side shape, including locked fields. */
export const TicketSchema = z.object({
  hostOrgId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  urgency: TicketUrgency,
  rapid: z.boolean(),
  needs: z.array(NeedSchema.extend({ progressPct: z.number().min(0).max(100) })).min(1),
  geo: GeoSchema,
  deadline: z.number().int(),
  phase: TicketPhase,
  progressPct: z.number().min(0).max(100),
  advancedEarly: z.boolean().default(false),
  createdAt: z.number().int(),
  phaseChangedAt: z.number().int(),
  closedAt: z.number().int().nullable().default(null),
});
export type Ticket = z.infer<typeof TicketSchema>;

/** Client-writable create payload. Server fills phase/progress/needs[].progressPct/rapid/embedding. */
export const RaiseTicketInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(10),
  category: z.string().min(1),
  urgency: TicketUrgency,
  needs: z.array(NeedSchema).min(1),
  geo: GeoSchema,
  deadline: z.number().int(),
  requestId: z.string().min(8),
});
export type RaiseTicketInput = z.infer<typeof RaiseTicketInputSchema>;
