"use client";

import type { OnboardingData } from "@/lib/schemas";
import type { ChatMessage, DocsByType } from "./types";

const KEY = "nexus.onboarding";

type Stored = {
  sessionId: string;
  history: ChatMessage[];
  partialData: OnboardingData;
  docs: DocsByType;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function freshStore(initial?: Partial<OnboardingData>): Stored {
  return {
    sessionId: newSessionId(),
    history: [],
    partialData: (initial as OnboardingData) ?? {},
    docs: {},
  };
}

export function loadSession(initial?: Partial<OnboardingData>): Stored {
  if (!isBrowser()) return freshStore(initial);

  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      const stored: Stored = {
        sessionId: parsed.sessionId ?? newSessionId(),
        history: parsed.history ?? [],
        partialData: parsed.partialData ?? {},
        docs: parsed.docs ?? {},
      };
      if (initial && Object.keys(initial).length) {
        stored.partialData = { ...stored.partialData, ...initial };
      }
      return stored;
    } catch {
      // fall through
    }
  }

  const fresh = freshStore(initial);
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveSession(patch: Partial<Stored>): Stored {
  const current = loadSession();
  const next: Stored = {
    sessionId: patch.sessionId ?? current.sessionId,
    history: patch.history ?? current.history,
    partialData: patch.partialData ?? current.partialData,
    docs: patch.docs ?? current.docs,
  };
  if (isBrowser()) localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSession(): void {
  if (isBrowser()) localStorage.removeItem(KEY);
}
