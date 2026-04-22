import type { GovtDocSchema } from "@/lib/schemas";
import type { z } from "zod";

export type DocType = z.infer<typeof GovtDocSchema>["docType"];

export type UploadedDoc = {
  docType: DocType;
  fileUrl: string;      // https download URL
  storagePath: string;  // full Storage path (stored for server-side revocation / reissue)
  uploadedAt: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  at: number;                // unix ms — drives WhatsApp-style timestamps
  attachments?: UploadedDoc[];
};

/** The docs the user has captured during onboarding, keyed by docType. */
export type DocsByType = Partial<Record<DocType, UploadedDoc>>;
