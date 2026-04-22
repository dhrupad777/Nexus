import { z } from "zod";

export const SignoffDecision = z.enum(["APPROVED", "DISPUTED"]);
export type SignoffDecision = z.infer<typeof SignoffDecision>;

export const SignoffSchema = z.object({
  contributorOrgId: z.string(),
  decision: SignoffDecision,
  note: z.string().default(""),
  signedAt: z.number().int(),
});
export type Signoff = z.infer<typeof SignoffSchema>;

export const RecordSignoffInputSchema = z.object({
  ticketId: z.string(),
  decision: SignoffDecision,
  note: z.string().max(2000).default(""),
  requestId: z.string().min(8),
});
export type RecordSignoffInput = z.infer<typeof RecordSignoffInputSchema>;
