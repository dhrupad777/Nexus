/**
 * POST /api/onboarding/chat
 *
 * Runs the Nexus onboarding chat server-side via @google/genai (gemini-2.5-flash).
 * Validates input with OnboardingTurnInputSchema, enforces structured JSON output
 * via responseMimeType + responseSchema, then zod-parses the result.
 * One retry on parse failure; second failure returns { fallback: true }.
 *
 * NOTE: must NOT import lib/firebase/client.ts — that pulls firebase/app-check which
 * accesses window. Only @google/genai, zod, and pure schema modules allowed here.
 */
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import {
  OnboardingTurnInputSchema,
  OnboardingTurnOutputSchema,
  type OnboardingTurnOutput,
} from "@/lib/schemas/onboarding";
import { buildSystemPrompt } from "@/app/(app)/onboard/_lib/systemPrompt";

export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash";

// Hand-built OpenAPI-3 subset mirroring OnboardingTurnOutputSchema.
// Keep flat and permissive on nested partials — Gemini Flash struggles with deep
// required chains. Client is the ground truth and zod re-validates.
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    assistantMessage: { type: Type.STRING },
    updatedData: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["NGO", "ORG"] },
        legalName: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        geo: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            adminRegion: { type: Type.STRING },
            operatingAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        docsUploaded: {
          type: Type.OBJECT,
          properties: {
            pan: { type: Type.BOOLEAN },
            reg: { type: Type.BOOLEAN },
            gst: { type: Type.BOOLEAN },
            cin: { type: Type.BOOLEAN },
            g80: { type: Type.BOOLEAN },
            a12: { type: Type.BOOLEAN },
          },
        },
        firstResource: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            title: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            valuationINR: { type: Type.NUMBER },
          },
        },
      },
    },
    nextField: { type: Type.STRING, nullable: true },
    done: { type: Type.BOOLEAN },
  },
  required: ["assistantMessage", "updatedData", "done"],
};

type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

function historyToContents(
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
): GeminiContent[] {
  const prior: GeminiContent[] = history
    .slice(-20)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  prior.push({ role: "user", parts: [{ text: userMessage }] });
  return prior;
}

async function callGemini(
  ai: GoogleGenAI,
  systemInstruction: string,
  contents: GeminiContent[],
): Promise<string | undefined> {
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.85,
    },
  });
  return resp.text;
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { fallback: true, reason: "GEMINI_API_KEY not set" },
      { status: 200 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = OnboardingTurnInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input", detail: parsed.error.format() }, { status: 400 });
  }
  const input = parsed.data;

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction =
    buildSystemPrompt(input.partialData.type) +
    `\n\nCurrent partialData (merge new info into this):\n${JSON.stringify(input.partialData)}`;

  const contents = historyToContents(input.history, input.userMessage);

  // Attempt 1
  let raw: string | undefined;
  try {
    raw = await callGemini(ai, systemInstruction, contents);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "gemini_call_failed";
    return Response.json({ fallback: true, reason: `gemini_call_failed: ${msg}` }, { status: 200 });
  }

  let outputRaw: unknown;
  try {
    outputRaw = raw ? JSON.parse(raw) : null;
  } catch {
    outputRaw = null;
  }

  let checked = outputRaw ? OnboardingTurnOutputSchema.safeParse(outputRaw) : null;

  // Attempt 2 — one retry with a stricter nudge
  if (!checked?.success) {
    const retryContents: GeminiContent[] = [
      ...contents,
      {
        role: "user",
        parts: [
          {
            text:
              "Your previous reply did not match the JSON schema. Respond AGAIN with a single valid JSON object matching the schema exactly. No markdown, no prose outside JSON.",
          },
        ],
      },
    ];

    try {
      raw = await callGemini(ai, systemInstruction, retryContents);
    } catch {
      return Response.json({ fallback: true, reason: "gemini_retry_failed" }, { status: 200 });
    }

    try {
      outputRaw = raw ? JSON.parse(raw) : null;
    } catch {
      outputRaw = null;
    }
    checked = outputRaw ? OnboardingTurnOutputSchema.safeParse(outputRaw) : null;

    if (!checked?.success) {
      return Response.json({ fallback: true, reason: "schema_violation" }, { status: 200 });
    }
  }

  const output: OnboardingTurnOutput = checked.data;
  return Response.json({ fallback: false, output }, { status: 200 });
}
