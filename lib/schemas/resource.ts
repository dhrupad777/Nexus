import { z } from "zod";
import { GeoSchema, ResourceCategory } from "./common";

export const ResourceStatus = z.enum(["AVAILABLE", "RESERVED", "DEPLETED"]);
export type ResourceStatus = z.infer<typeof ResourceStatus>;

export const EmergencyContractSchema = z.object({
  enabled: z.boolean().default(false),
  emergencyCategories: z.array(z.string()).default([]),
  maxQuantityPerTicket: z.number().int().positive().default(0),
  autoNotify: z.boolean().default(false),
});

export const ResourceSchema = z.object({
  orgId: z.string(),
  category: ResourceCategory,
  title: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  valuationINR: z.number().nonnegative(),
  terms: z.object({
    availableFrom: z.number().int(),
    availableUntil: z.number().int(),
    conditions: z.string().default(""),
  }),
  geo: GeoSchema.extend({
    serviceRadiusKm: z.number().nonnegative().default(0),
  }),
  emergencyContract: EmergencyContractSchema,
  status: ResourceStatus.default("AVAILABLE"),
  // embedding is server-written (Vertex text-embedding-004 → 768d)
});
export type Resource = z.infer<typeof ResourceSchema>;

export const ResourceClientWriteSchema = ResourceSchema; // embedding not in shape
