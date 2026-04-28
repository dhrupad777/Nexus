"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
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
  ticketId: string;
  contributedValuationINR: number;
  role: "HOST" | "CONTRIBUTOR";
}

interface Props {
  orgId: string;
}

function formatINR(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "₹0";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)} lakh`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatINRShort(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "₹0";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * Hero left card. Lifetime impact this org has delivered. Reads the
 * `badges` collection (existing index on `orgId, closedAt DESC`).
 * `contributedValuationINR` is server-computed at ticket close time —
 * we just sum + max it client-side.
 */
export function LifetimeImpactCard({ orgId }: Props) {
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "badges"),
      where("orgId", "==", orgId),
      orderBy("closedAt", "desc"),
      limit(100),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: BadgeRow[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            ticketId: String(x.ticketId ?? ""),
            contributedValuationINR: Number(x.contributedValuationINR ?? 0),
            role: x.role === "HOST" ? "HOST" : "CONTRIBUTOR",
          };
        });
        setBadges(rows);
      },
      () => setBadges([]),
    );
    return unsub;
  }, [orgId]);

  const stats = useMemo(() => {
    if (badges === null) return null;
    const totalDelivered = badges.reduce(
      (s, b) => s + b.contributedValuationINR,
      0,
    );
    const closedCount = new Set(badges.map((b) => b.ticketId)).size;
    const largest = badges.reduce(
      (m, b) => Math.max(m, b.contributedValuationINR),
      0,
    );
    return { totalDelivered, closedCount, largest, badgeCount: badges.length };
  }, [badges]);

  const loaded = stats !== null;
  const totalLabel = loaded ? formatINR(stats!.totalDelivered) : "—";
  const closedLabel = loaded ? String(stats!.closedCount) : "—";
  const largestLabel = loaded ? formatINRShort(stats!.largest) : "—";
  const badgeCount = loaded ? stats!.badgeCount : 0;

  return (
    <Link href="/profile" className="ed-card ed-card--impact" aria-label="Lifetime impact">
      <div className="ed-card__body">
        <span className="ed-card__eyebrow">Lifetime impact</span>
        <h2 className="ed-card__display">
          <span className="ed-card__display-accent">{totalLabel}</span>{" "}
          <span className="ed-card__display-strong">delivered.</span>
        </h2>
        <p className="ed-card__lede">
          {loaded && stats!.closedCount > 0
            ? `Verified across ${stats!.closedCount} closed ticket${stats!.closedCount === 1 ? "" : "s"}. ${badgeCount} badge${badgeCount === 1 ? "" : "s"} minted on your public profile.`
            : "Closed tickets show up here once your contributions are signed off."}
        </p>
        <div className="ed-card__stats">
          <div className="ed-card__stat">
            <span className="ed-card__stat-value">{closedLabel}</span>
            <span className="ed-card__stat-label">Tickets closed</span>
          </div>
          <div className="ed-card__stat">
            <span className="ed-card__stat-value">{largestLabel}</span>
            <span className="ed-card__stat-label">Largest pledge</span>
          </div>
          <div className="ed-card__stat">
            <span className="ed-card__stat-value">0</span>
            <span className="ed-card__stat-label">Disputes</span>
          </div>
        </div>
      </div>
      <span className="ed-card__arrow" aria-hidden>
        <ArrowRight size={14} strokeWidth={2.5} />
      </span>
    </Link>
  );
}
