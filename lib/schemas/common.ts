import { z } from "zod";

export const GeoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  adminRegion: z.string().min(1),
  operatingAreas: z.array(z.string()),
});
export type Geo = z.infer<typeof GeoSchema>;

export const ReliabilityStatSchema = z.object({
  score: z.number().min(0).max(100),
  lastDecayAt: z.number().int().nonnegative().nullable().default(null),
});
export type ReliabilityStat = z.infer<typeof ReliabilityStatSchema>;

export const ReliabilitySchema = z.object({
  agreement: ReliabilityStatSchema,
  execution: ReliabilityStatSchema,
  closure: ReliabilityStatSchema,
});
export type Reliability = z.infer<typeof ReliabilitySchema>;

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
export type ResourceCategory = z.infer<typeof ResourceCategory>;

export const OrgType = z.enum(["NGO", "ORG"]);
export type OrgType = z.infer<typeof OrgType>;

export const OrgStatus = z.enum(["PENDING_REVIEW", "ACTIVE", "SUSPENDED"]);
export type OrgStatus = z.infer<typeof OrgStatus>;

export const UserRole = z.enum(["ORG_ADMIN", "PLATFORM_ADMIN"]);
export type UserRole = z.infer<typeof UserRole>;

export const RequestIdSchema = z
  .string()
  .min(8, "requestId must be client-generated and >= 8 chars");

/** Vector dim matches text-embedding-004 (768). Server-written only. */
export const EmbeddingSchema = z.array(z.number()).length(768);

export const EmbeddingStatus = z.enum(["pending", "ok", "failed"]);
export type EmbeddingStatus = z.infer<typeof EmbeddingStatus>;

/** Shared lifecycle fields for docs that carry an embedding. Server-written. */
export const EmbeddingLifecycleSchema = z.object({
  embeddingVersion: z.string().nullable().optional(),
  embeddingStatus: EmbeddingStatus.optional(),
});
