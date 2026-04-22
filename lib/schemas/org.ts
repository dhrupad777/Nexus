import { z } from "zod";
import { GeoSchema, OrgStatus, OrgType, ReliabilitySchema } from "./common";

export const GovtDocSchema = z.object({
  docType: z.enum(["PAN", "80G", "12A", "REG_CERT", "GST", "CIN"]),
  fileUrl: z.string().url(),
  extractedFields: z.record(z.string(), z.unknown()).default({}),
  verifiedAt: z.number().int().nullable().default(null),
  verifiedBy: z.string().nullable().default(null),
});

export const BadgeRefSchema = z.object({
  ticketId: z.string(),
  closedAt: z.number().int(),
  contributionSummary: z.string(),
});

export const OrganizationSchema = z.object({
  name: z.string().min(1),
  type: OrgType,
  govtDocs: z.array(GovtDocSchema).default([]),
  status: OrgStatus.default("PENDING_REVIEW"),
  geo: GeoSchema,
  reliability: ReliabilitySchema,
  badges: z.array(BadgeRefSchema).default([]),
  contact: z.object({
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  createdAt: z.number().int(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

/** Client-writable fields only (server-only fields stripped). */
export const OrganizationClientWriteSchema = OrganizationSchema.omit({
  status: true,
  reliability: true,
  badges: true,
});
