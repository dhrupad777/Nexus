"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { TicketPhase } from "@/lib/schemas";

interface Row {
  id: string;
  title: string;
  region: string | null;
  phase: TicketPhase;
  progressPct: number;
  hostOrgId: string;
  rapid: boolean;
  lastUpdatedAt: number;
}

interface Props {
  orgId: string;
}

const PHASE_LABEL: Record<TicketPhase, string> = {
  RAISED: "Raised",
  OPEN_FOR_CONTRIBUTIONS: "Open",
  EXECUTION: "Executing",
  PENDING_SIGNOFF: "Awaiting sign-off",
  CLOSED: "Closed",
};

const PHASE_TONE: Record<TicketPhase, string> = {
  RAISED: "td-closed-participant__role",
  OPEN_FOR_CONTRIBUTIONS: "td-closed-participant__role td-closed-participant__role--host",
  EXECUTION: "td-closed-participant__role",
  PENDING_SIGNOFF: "td-closed-participant__role",
  CLOSED: "td-closed-participant__role",
};

/**
 * Active-tickets list for /profile. Subscribes to the same query
 * ActiveTicketsList uses on the dashboard, but renders all of them
 * (not just top 3) so the profile shows a complete in-flight summary.
 */
export function ProfileActiveTickets({ orgId }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "tickets"),
      where("participantOrgIds", "array-contains", orgId),
      orderBy("lastUpdatedAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Row[] = snap.docs
          .map((d): Row => {
            const x = d.data();
            const geo = (x.geo as { adminRegion?: unknown } | undefined) ?? {};
            return {
              id: d.id,
              title: String(x.title ?? "(untitled)"),
              region:
                typeof geo.adminRegion === "string" && geo.adminRegion.trim()
                  ? geo.adminRegion.trim()
                  : null,
              phase: x.phase as TicketPhase,
              progressPct: Number(x.progressPct ?? 0),
              hostOrgId: String(x.hostOrgId ?? ""),
              rapid: Boolean(x.rapid),
              lastUpdatedAt: Number(x.lastUpdatedAt ?? 0),
            };
          })
          .filter((r) => r.phase !== "CLOSED");
        setRows(out);
      },
      () => setRows([]),
    );
    return unsub;
  }, [orgId]);

  return (
    <div className="card stack" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: 0,
          }}
        >
          <Briefcase size={18} style={{ color: "var(--color-primary)" }} />
          Active tickets
          <span className="num muted-text" style={{ fontSize: 14, fontWeight: 500 }}>
            · {rows?.length ?? 0}
          </span>
        </h2>
      </div>

      {rows === null ? (
        <p className="muted-text" style={{ fontSize: 13 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted-text" style={{ fontSize: 13 }}>
          No active tickets right now. Tickets you raise or pledge to appear here while open.
        </p>
      ) : (
        <div className="stack-sm">
          {rows.map((r) => {
            const isHost = r.hostOrgId === orgId;
            return (
              <Link
                key={r.id}
                href={`/tickets/${r.id}`}
                className="row"
                style={{
                  gap: 10,
                  padding: 12,
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                  alignItems: "center",
                }}
              >
                <div className="stack-sm" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      fontSize: 11,
                    }}
                  >
                    <span className={PHASE_TONE[r.phase]}>{PHASE_LABEL[r.phase]}</span>
                    <span
                      className="td-closed-participant__role"
                      style={{
                        background: isHost
                          ? "var(--color-primary-soft)"
                          : "var(--color-surface-2, #f3f4f6)",
                        color: isHost ? "var(--color-primary)" : "var(--color-muted)",
                      }}
                    >
                      {isHost ? "HOST" : "CONTRIBUTOR"}
                    </span>
                    {r.rapid && (
                      <span className="td-closed-participant__role" style={{ background: "rgba(220,38,38,0.10)", color: "var(--color-danger)" }}>
                        EMERGENCY
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</span>
                  {r.region && (
                    <span className="muted-text" style={{ fontSize: 12 }}>
                      {r.region}
                    </span>
                  )}
                </div>
                <span
                  className="num"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--color-text)",
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {Math.round(r.progressPct)}%
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
