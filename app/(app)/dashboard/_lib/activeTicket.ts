import type { TicketPhase } from "@/lib/schemas";

export type DashboardRole = "HOST" | "CONTRIBUTOR";

export type DisplayStatus =
  | "pending_contribution"
  | "active_execution"
  | "awaiting_confirmation"
  | "completed";

/** Pure derivation per `Albin/Nexus_Dashboard_Logic.md` §3.6. No reads. */
export function deriveDisplayStatus(phase: TicketPhase): DisplayStatus {
  switch (phase) {
    case "EXECUTION":
      return "active_execution";
    case "PENDING_SIGNOFF":
      return "awaiting_confirmation";
    case "CLOSED":
      return "completed";
    case "RAISED":
    case "OPEN_FOR_CONTRIBUTIONS":
    default:
      return "pending_contribution";
  }
}

const STATUS_LABEL: Record<DisplayStatus, { label: string; tone: string }> = {
  pending_contribution: { label: "Open", tone: "var(--color-accent, #2563eb)" },
  active_execution: { label: "Executing", tone: "var(--color-warn, #d97706)" },
  awaiting_confirmation: { label: "Awaiting sign-off", tone: "var(--color-warn, #d97706)" },
  completed: { label: "Closed", tone: "var(--color-muted, #6b7280)" },
};

export function statusLabel(s: DisplayStatus) {
  return STATUS_LABEL[s];
}

/**
 * Sort priority for Active Tickets (`Albin/Nexus_Dashboard_Logic.md` §3.5):
 *  1) phase === EXECUTION first,
 *  2) tickets with a pending viewer action,
 *  3) recently updated.
 *
 * Returns a tuple — JS sorts compare arrays element-by-element via stringify,
 * so we use a numeric composite key instead.
 */
export function sortKey(t: {
  phase: TicketPhase;
  role: DashboardRole;
  lastUpdatedAt: number;
}): number {
  // Higher = appears first.
  const phaseRank = t.phase === "EXECUTION" ? 1_000_000_000 : 0;
  const actionRank =
    t.phase === "EXECUTION" || t.phase === "PENDING_SIGNOFF" ? 100_000_000 : 0;
  return phaseRank + actionRank + (t.lastUpdatedAt ?? 0);
}
