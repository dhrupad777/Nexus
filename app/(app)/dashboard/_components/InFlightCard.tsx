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

interface Row {
  id: string;
  title: string;
  region: string | null;
  phase: TicketPhase;
  progressPct: number;
}

interface Props {
  orgId: string;
  onTotal?: (n: number) => void;
}

const TONE: Record<TicketPhase, { dot: string; label: string }> = {
  RAISED: { dot: "ed-flight-dot--raised", label: "raised" },
  OPEN_FOR_CONTRIBUTIONS: { dot: "ed-flight-dot--open", label: "open" },
  EXECUTION: { dot: "ed-flight-dot--exec", label: "exec" },
  PENDING_SIGNOFF: { dot: "ed-flight-dot--signoff", label: "sign-off" },
  CLOSED: { dot: "ed-flight-dot--closed", label: "closed" },
};

function shortLine(region: string | null, title: string): string {
  // Region — first-three-words-of-title  →  "Panvel — 100 desks"
  const words = title.split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
  if (region && region.trim()) return `${region.trim()} — ${words}`;
  return words || title;
}

/**
 * "In flight right now" — top 3 active tickets the org participates in.
 * Same query as ActiveTicketsList (no new index), client-filtered to
 * non-closed, sorted by lastUpdatedAt desc, top 3.
 */
export function InFlightCard({ orgId, onTotal }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [totalActive, setTotalActive] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "tickets"),
      where("participantOrgIds", "array-contains", orgId),
      orderBy("lastUpdatedAt", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all: Row[] = snap.docs.map((d): Row => {
          const x = d.data();
          const geo = (x.geo as { adminRegion?: unknown } | undefined) ?? {};
          const region =
            typeof geo.adminRegion === "string" && geo.adminRegion.trim()
              ? geo.adminRegion.trim()
              : null;
          return {
            id: d.id,
            title: String(x.title ?? "(untitled)"),
            region,
            phase: x.phase as TicketPhase,
            progressPct: Number(x.progressPct ?? 0),
          };
        });
        const active = all.filter((r) => r.phase !== "CLOSED");
        setTotalActive(active.length);
        setRows(active.slice(0, 3));
      },
      () => {
        setTotalActive(0);
        setRows([]);
      },
    );
    return unsub;
  }, [orgId]);

  useEffect(() => {
    if (!onTotal) return;
    if (totalActive === null) return;
    onTotal(totalActive);
  }, [totalActive, onTotal]);

  const count = totalActive ?? 0;

  return (
    <div className="ed-card ed-card--light" id="today-brief">
      <div className="ed-card__body">
        <span className="ed-card__eyebrow">In flight right now</span>
        <h3 className="ed-card__heading">
          <span className="ed-card__heading-accent-blue">
            {totalActive === null ? "—" : count}
          </span>{" "}
          <span className="ed-card__heading-soft">
            ticket{count === 1 ? "" : "s"} moving
          </span>
        </h3>
        {rows === null ? (
          <p className="ed-card__lede">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="ed-card__lede">
            Nothing in flight. Pledge to a recommendation or raise a ticket to start.
          </p>
        ) : (
          <ul className="ed-flight">
            {rows.map((r) => (
              <li key={r.id} className="ed-flight__row">
                <Link href={`/tickets/${r.id}`} className="ed-flight__link">
                  <span className={`ed-flight__dot ${TONE[r.phase].dot}`} aria-hidden />
                  <span className="ed-flight__name">{shortLine(r.region, r.title)}</span>
                  <span className="ed-flight__meta">
                    <span className="ed-flight__pct num">{Math.round(r.progressPct)}%</span>
                    <span className="ed-flight__sep">·</span>
                    <span className="ed-flight__phase">{TONE[r.phase].label}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
