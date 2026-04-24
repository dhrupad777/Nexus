"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import {
  deriveDisplayStatus,
  sortKey,
  statusLabel,
  type DashboardRole,
} from "../_lib/activeTicket";

interface ActiveRow {
  id: string;
  title: string;
  hostOrgId: string;
  host: { name: string; type: "NGO" | "ORG" };
  phase: TicketPhase;
  rapid: boolean;
  progressPct: number;
  contributorCount: number;
  lastUpdatedAt: number;
}

/**
 * Single Firestore listener: `tickets where participantOrgIds array-contains
 * viewerOrgId order by lastUpdatedAt desc limit 50`. Per `Albin/Nexus_Dashboard_Logic.md`
 * §3 + List.md §2.10 contract.
 */
export function ActiveTicketsList({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<ActiveRow[] | null>(null);

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
        const out: ActiveRow[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            title: String(x.title ?? "(untitled)"),
            hostOrgId: String(x.hostOrgId ?? ""),
            host: { name: String(x.host?.name ?? "—"), type: x.host?.type ?? "ORG" },
            phase: x.phase as TicketPhase,
            rapid: Boolean(x.rapid),
            progressPct: Number(x.progressPct ?? 0),
            contributorCount: Number(x.contributorCount ?? 0),
            lastUpdatedAt: Number(x.lastUpdatedAt ?? x.createdAt ?? 0),
          };
        });
        setRows(out);
      },
      () => setRows([]),
    );
    return unsub;
  }, [orgId]);

  if (rows === null) return <p className="muted-text">Loading active tickets…</p>;
  if (rows.length === 0) {
    return (
      <div className="card stack-sm" style={{ textAlign: "center", padding: 24 }}>
        <strong>No active tickets</strong>
        <p className="muted-text" style={{ fontSize: 13 }}>
          Tickets you raise or contribute to appear here.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/tickets/new" className="btn btn-primary">Raise a ticket</Link>
        </div>
      </div>
    );
  }

  // Client-side sort per spec §3.5: phase=EXECUTION first, then pending-action,
  // then recently updated. We don't have viewer-action data without an extra
  // contributions read — using phase-only proxy for now (good enough for demo).
  const sorted = rows
    .map((r) => ({ ...r, role: r.hostOrgId === orgId ? ("HOST" as DashboardRole) : ("CONTRIBUTOR" as DashboardRole) }))
    .sort((a, b) => sortKey(b) - sortKey(a));

  return (
    <section className="stack">
      <header className="stack-sm">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Active tickets
        </h2>
        <p className="muted-text" style={{ fontSize: 13 }}>
          Tickets you&apos;re hosting or contributing to.
        </p>
      </header>
      <div className="stack-sm">
        {sorted.map((r) => (
          <ActiveCard key={r.id} row={r} />
        ))}
      </div>
    </section>
  );
}

function ActiveCard({
  row,
}: {
  row: ActiveRow & { role: DashboardRole };
}) {
  const display = deriveDisplayStatus(row.phase);
  const status = statusLabel(display);
  return (
    <Link
      href={`/tickets/${row.id}`}
      className="card stack-sm"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div className="stack-sm" style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                padding: "2px 6px",
                borderRadius: 4,
                background: row.role === "HOST" ? "var(--color-accent, #2563eb)" : "var(--color-muted-bg, #e5e7eb)",
                color: row.role === "HOST" ? "white" : "var(--color-fg, #111827)",
              }}
            >
              {row.role}
            </span>
            <span style={{ fontSize: 12, color: status.tone, fontWeight: 600 }}>
              {status.label}
            </span>
            {row.rapid && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-danger, #dc2626)" }}>
                EMERGENCY
              </span>
            )}
          </div>
          <h4 style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>{row.title}</h4>
          <span className="muted-text" style={{ fontSize: 12 }}>
            {row.host.name} · {row.host.type}
            {row.contributorCount > 0 ? ` · ${row.contributorCount} contributor${row.contributorCount === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
          {Math.round(row.progressPct)}%
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: "var(--color-surface-2, #f6f7f9)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, row.progressPct))}%`,
            height: "100%",
            background: "var(--color-accent, #2563eb)",
          }}
        />
      </div>
    </Link>
  );
}
