import { z } from "zod";

export const AgreementStatus = z.enum([
  "DRAFTED",
  "HOST_SIGNED",
  "CONTRIBUTOR_SIGNED",
  "FULLY_SIGNED",
  "VOIDED",
]);
export type AgreementStatus = z.infer<typeof AgreementStatus>;

export const AgreementSchema = z.object({
  ticketId: z.string(),
  contributionId: z.string(),
  hostOrgId: z.string(),
  contributorOrgId: z.string(),
  googleDocId: z.string(),
  googleDocUrl: z.string().url(),
  templateVersion: z.string(),
  status: AgreementStatus,
  hostSignedAt: z.number().int().nullable().default(null),
  contributorSignedAt: z.number().int().nullable().default(null),
  finalPdfUrl: z.string().url().nullable().default(null),
  createdAt: z.number().int(),
});
export type Agreement = z.infer<typeof AgreementSchema>;

export const SignAgreementInputSchema = z.object({
  agreementId: z.string(),
  role: z.enum(["HOST", "CONTRIBUTOR"]),
  requestId: z.string().min(8),
});
export type SignAgreementInput = z.infer<typeof SignAgreementInputSchema>;
