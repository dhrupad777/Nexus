"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Award } from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface BadgeRow {
  id: string;
  ticketId: string;
  role: "HOST" | "CONTRIBUTOR";
  contributedValuationINR: number;
  proportionalSharePct: number;
  scorePct: number;
  closedAt: number;
  ticketTitle: string | null;
  ticketRegion: string | null;
}

interface Props {
  orgId: string;
}

function formatINR(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "₹0";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * "Recent closures" — every closed ticket the org participated in,
 * surfaced via the `badges` collection. Each badge is minted by
 * onTicketClosed for every participant (host + contributors), so this
 * list naturally appears on every contributor's dashboard the moment a
 * ticket they touched closes.
 */
export function RecentClosuresStrip({ orgId }: Props) {
  const [rows, setRows] = useState<BadgeRow[] | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "badges"),
      where("orgId", "==", orgId),
      orderBy("closedAt", "desc"),
      limit(6),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: BadgeRow[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            ticketId: String(x.ticketId ?? ""),
            role: x.role === "HOST" ? "HOST" : "CONTRIBUTOR",
            contributedValuationINR: Number(x.contributedValuationINR ?? 0),
            proportionalSharePct: Number(x.proportionalSharePct ?? 0),
            scorePct: Number(x.scorePct ?? 0),
            closedAt: Number(x.closedAt ?? 0),
            ticketTitle:
              typeof x.ticketTitle === "string" ? x.ticketTitle : null,
            ticketRegion:
              typeof x.ticketRegion === "string" ? x.ticketRegion : null,
          };
        });
        setRows(out);
      },
      () => setRows([]),
    );
    return unsub;
  }, [orgId]);

  if (rows === null || rows.length === 0) return null;

  return (
    <section className="ed-closures">
      <header className="ed-feed__head">
        <div className="ed-feed__title-block">
          <span className="ed-feed__eyebrow">Recent closures</span>
          <h2 className="ed-feed__title">
            <span className="ed-feed__title-accent-green">{rows.length}</span>{" "}
            <span className="ed-feed__title-soft">
              ticket{rows.length === 1 ? "" : "s"} you helped close
            </span>
          </h2>
        </div>
      </header>
      <div className="ed-closures__grid">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/tickets/${r.ticketId}`}
            className="ed-closure-card"
          >
            <div className="ed-closure-card__head">
              <Award size={16} strokeWidth={2} className="ed-closure-card__award" />
              <span className="ed-closure-card__role">
                {r.role === "HOST" ? "HOST" : "CONTRIBUTOR"}
              </span>
              <span className="ed-closure-card__when">
                {new Date(r.closedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
            <h4 className="ed-closure-card__title">
              {r.ticketTitle && r.ticketTitle.trim()
                ? r.ticketTitle
                : `Ticket ${r.ticketId.slice(0, 6)}`}
            </h4>
            <div className="ed-closure-card__stats">
              <div className="ed-closure-card__stat">
                <span className="ed-closure-card__stat-value">
                  {formatINR(r.contributedValuationINR)}
                </span>
                <span className="ed-closure-card__stat-label">delivered</span>
              </div>
              <div className="ed-closure-card__stat">
                <span className="ed-closure-card__stat-value">
                  {Math.round(r.proportionalSharePct)}%
                </span>
                <span className="ed-closure-card__stat-label">share</span>
              </div>
              <div className="ed-closure-card__stat">
                <span className="ed-closure-card__stat-value">
                  {Math.round(r.scorePct)}
                </span>
                <span className="ed-closure-card__stat-label">score</span>
              </div>
            </div>
            <span className="ed-closure-card__cta">
              View ticket <ArrowRight size={12} strokeWidth={2.5} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
