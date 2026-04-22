import { z } from "zod";

export const ContributionStatus = z.enum([
  "PROPOSED",
  "AGREEMENT_PENDING",
  "COMMITTED",
  "EXECUTED",
  "SIGNED_OFF",
  "DISPUTED",
  "REJECTED",
]);
export type ContributionStatus = z.infer<typeof ContributionStatus>;

export const CommitPath = z.enum(["AGREEMENT_FIRST", "PLEDGE_FIRST"]);
export type CommitPath = z.infer<typeof CommitPath>;

export const OfferedSchema = z.object({
  kind: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  valuationINR: z.number().nonnegative(),
  pctOfNeed: z.number().min(0).max(100),
  notes: z.string().default(""),
});

export const ContributionSchema = z.object({
  contributorOrgId: z.string(),
  resourceId: z.string().optional(),
  needIndex: z.number().int().nonnegative(),
  offered: OfferedSchema,
  status: ContributionStatus,
  commitPath: CommitPath,
  agreementId: z.string().optional(),
  requestId: z.string().min(8),
  createdAt: z.number().int(),
  committedAt: z.number().int().optional(),
  signedOffAt: z.number().int().optional(),
});
export type Contribution = z.infer<typeof ContributionSchema>;

/** Client input for /pledge — server sets status, commitPath, timestamps. */
export const PledgeInputSchema = z.object({
  ticketId: z.string(),
  resourceId: z.string().optional(),
  needIndex: z.number().int().nonnegative(),
  offered: OfferedSchema,
  requestId: z.string().min(8),
});
export type PledgeInput = z.infer<typeof PledgeInputSchema>;
