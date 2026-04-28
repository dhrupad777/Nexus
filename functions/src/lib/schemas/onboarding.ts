import { z } from "zod";
import { GeoSchema, OrgType } from "./common";

/**
 * Structured output contract for the Gemini onboarding chat.
 * Each turn's `updatedData` must parse against this schema. On parse failure,
 * the server retries once then falls back to the classic form.
 */
export const OnboardingDataSchema = z.object({
  type: OrgType.optional(),
  legalName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  geo: GeoSchema.partial().optional(),
  docsUploaded: z
    .object({
      pan: z.boolean().default(false),
      reg: z.boolean().default(false),
      gst: z.boolean().default(false),
      cin: z.boolean().default(false),
      g80: z.boolean().default(false),
      a12: z.boolean().default(false),
    })
    .partial()
    .optional(),
  firstResource: z
    .object({
      category: z.string().optional(),
      title: z.string().optional(),
      quantity: z.number().optional(),
      unit: z.string().optional(),
      valuationINR: z.number().optional(),
    })
    .optional(),
});
export type OnboardingData = z.infer<typeof OnboardingDataSchema>;

export const OnboardingTurnInputSchema = z.object({
  sessionId: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .default([]),
  partialData: OnboardingDataSchema.default({}),
  userMessage: z.string().min(1),
});
export type OnboardingTurnInput = z.infer<typeof OnboardingTurnInputSchema>;

export const OnboardingTurnOutputSchema = z.object({
  assistantMessage: z.string(),
  updatedData: OnboardingDataSchema,
  nextField: z.string().nullable(),
  done: z.boolean(),
});
export type OnboardingTurnOutput = z.infer<typeof OnboardingTurnOutputSchema>;
