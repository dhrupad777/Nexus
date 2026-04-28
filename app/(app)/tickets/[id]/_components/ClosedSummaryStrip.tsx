"use client";

import { useEffect, useState } from "react";
import {
  collection,
  documentId,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { Award, CheckCircle2, Users } from "lucide-react";
import { db } from "@/lib/firebase/client";

interface BadgeRow {
  id: string;
  orgId: string;
  role: "HOST" | "CONTRIBUTOR";
  contributedValuationINR: number;
  proportionalSharePct: number;
  scorePct: number;
}

interface Props {
  ticketId: string;
  closedAt: number | null;
}

function formatINR(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "₹0";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * Closed-ticket summary card. Only renders when phase == CLOSED.
 * Reads `badges where ticketId == X` (existing index covers this) plus
 * a one-shot batch fetch of org names for display.
 *
 * Shown to everyone who opens the ticket — host, contributors, public —
 * so the impact is visible regardless of whether you participated.
 */
export function ClosedSummaryStrip({ ticketId, closedAt }: Props) {
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(db, "badges"), where("ticketId", "==", ticketId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: BadgeRow[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            orgId: String(x.orgId ?? ""),
            role: x.role === "HOST" ? "HOST" : "CONTRIBUTOR",
            contributedValuationINR: Number(x.contributedValuationINR ?? 0),
            proportionalSharePct: Number(x.proportionalSharePct ?? 0),
            scorePct: Number(x.scorePct ?? 0),
          };
        });
        setBadges(out);
      },
      () => setBadges([]),
    );
    return unsub;
  }, [ticketId]);

  // Resolve org names in a single batched query.
  useEffect(() => {
    if (!badges || badges.length === 0) return;
    const ids = Array.from(new Set(badges.map((b) => b.orgId).filter(Boolean)));
    const missing = ids.filter((id) => !(id in orgNames));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      // Firestore `in` clause caps at 30; for our org count this is safe.
      const chunks: string[][] = [];
      for (let i = 0; i < missing.length; i += 30) {
        chunks.push(missing.slice(i, i + 30));
      }
      const fetched: Record<string, string> = {};
      await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const snap = await getDocs(
              query(collection(db, "organizations"), where(documentId(), "in", chunk)),
            );
            snap.docs.forEach((d) => {
              fetched[d.id] = String(d.data().name ?? d.id.slice(0, 8));
            });
          } catch {
            // ignore — fall back to short id
          }
        }),
      );
      if (!cancelled) setOrgNames((prev) => ({ ...prev, ...fetched }));
    })();
    return () => {
      cancelled = true;
    };
  }, [badges, orgNames]);

  if (badges === null || badges.length === 0) return null;

  const totalDelivered = badges.reduce(
    (s, b) => s + b.contributedValuationINR,
    0,
  );
  const sorted = badges.slice().sort((a, b) => {
    if (a.role === "HOST") return -1;
    if (b.role === "HOST") return 1;
    return b.proportionalSharePct - a.proportionalSharePct;
  });
  const closedLabel = closedAt
    ? new Date(closedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <section className="td-closed-summary">
      <header className="td-closed-summary__head">
        <div className="td-closed-summary__title-block">
          <span className="td-closed-summary__eyebrow">
            <CheckCircle2 size={13} strokeWidth={2.5} /> Closed · {closedLabel}
          </span>
          <h3 className="td-closed-summary__title">
            <span className="td-closed-summary__amount">
              {formatINR(totalDelivered)}
            </span>{" "}
            <span className="td-closed-summary__title-soft">
              delivered · {sorted.length} participant{sorted.length === 1 ? "" : "s"}
            </span>
          </h3>
        </div>
      </header>

      <div className="td-closed-summary__participants">
        {sorted.map((b) => {
          const name = orgNames[b.orgId] ?? b.orgId.slice(0, 8);
          const isHost = b.role === "HOST";
          return (
            <div
              key={b.id}
              className={`td-closed-participant${isHost ? " td-closed-participant--host" : ""}`}
            >
              <div className="td-closed-participant__head">
                {isHost ? (
                  <Users size={14} strokeWidth={2} />
                ) : (
                  <Award size={14} strokeWidth={2} />
                )}
                <span className="td-closed-participant__name">{name}</span>
                <span
                  className={`td-closed-participant__role${isHost ? " td-closed-participant__role--host" : ""}`}
                >
                  {b.role}
                </span>
              </div>
              <div className="td-closed-participant__stats">
                <div>
                  <span className="td-closed-participant__stat-value">
                    {formatINR(b.contributedValuationINR)}
                  </span>
                  <span className="td-closed-participant__stat-label">value</span>
                </div>
                <div>
                  <span className="td-closed-participant__stat-value">
                    {Math.round(b.proportionalSharePct)}%
                  </span>
                  <span className="td-closed-participant__stat-label">share</span>
                </div>
                <div>
                  <span className="td-closed-participant__stat-value">
                    {Math.round(b.scorePct)}
                  </span>
                  <span className="td-closed-participant__stat-label">score</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
