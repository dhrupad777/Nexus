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

interface MatchRow {
  id: string;
  ticketId: string;
  topResourceId: string;
  score?: number;
  semanticScore?: number;
  reason: string;
  bestNeedIndex: number;
  maxContributionPossible: number;
  contributionFeasibility: boolean;
  contributionImpactPct: number;
  geoDistanceKm?: number;
  rapidBroadcast: boolean;
  createdAt: number;
}

interface TicketLite {
  id: string;
  title: string;
  category: string;
  urgency: "NORMAL" | "EMERGENCY";
  rapid: boolean;
  host: { name: string; type: "NGO" | "ORG" };
  needs: Array<{ resourceCategory: string; quantity: number; unit: string }>;
  geo?: { adminRegion?: string };
}

/**
 * Three Firestore listeners fire in parallel from this component (one per
 * matches sub-query) — counts toward the dashboard contract budget in
 * `docs/List.md` §2.10. Each card resolves entirely from the match doc +
 * the lazily-loaded ticket header (which we batch-fetch in a single doc-list
 * query); no other reads.
 */
export function RecommendedTicketsList({ orgId }: { orgId: string }) {
  const [normal, setNormal] = useState<MatchRow[] | null>(null);
  const [rapid, setRapid] = useState<MatchRow[] | null>(null);
  const [tickets, setTickets] = useState<Record<string, TicketLite>>({});

  // Normal recommended — score-ordered top 10 (Flow A).
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "matches"),
      where("orgId", "==", orgId),
      where("rapidBroadcast", "==", false),
      orderBy("score", "desc"),
      limit(10),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setNormal(snap.docs.map(toMatch)),
      () => setNormal([]),
    );
    return unsub;
  }, [orgId]);

  // Rapid broadcast — newest-first; sorted client-side by spec §5.
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "matches"),
      where("orgId", "==", orgId),
      where("rapidBroadcast", "==", true),
      orderBy("createdAt", "desc"),
      limit(30),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setRapid(snap.docs.map(toMatch)),
      () => setRapid([]),
    );
    return unsub;
  }, [orgId]);

  // Hydrate ticket headers for every match we hold. One-shot per ticketId,
  // cached in `tickets` state. Single round-trip via `documentId in […]`.
  useEffect(() => {
    const all = [...(normal ?? []), ...(rapid ?? [])];
    const missing = Array.from(
      new Set(all.map((m) => m.ticketId).filter((id) => !tickets[id])),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { getDocs, documentId } = await import("firebase/firestore");
      // Firestore `in` filter is capped at 30 ids per query — chunk.
      const chunks: string[][] = [];
      for (let i = 0; i < missing.length; i += 30) chunks.push(missing.slice(i, i + 30));
      const fetched: Record<string, TicketLite> = {};
      for (const chunk of chunks) {
        const q = query(collection(db, "tickets"), where(documentId(), "in", chunk));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const x = d.data();
          fetched[d.id] = {
            id: d.id,
            title: String(x.title ?? "(untitled)"),
            category: String(x.category ?? ""),
            urgency: x.urgency,
            rapid: Boolean(x.rapid),
            host: { name: String(x.host?.name ?? "—"), type: x.host?.type ?? "ORG" },
            needs: Array.isArray(x.needs) ? x.needs : [],
            geo: x.geo,
          };
        });
      }
      if (!cancelled) setTickets((prev) => ({ ...prev, ...fetched }));
    })();
    return () => {
      cancelled = true;
    };
  }, [normal, rapid, tickets]);

  const rapidSorted = (rapid ?? [])
    .slice()
    .sort((a, b) => {
      const ua = tickets[a.ticketId]?.urgency === "EMERGENCY" ? 1 : 0;
      const ub = tickets[b.ticketId]?.urgency === "EMERGENCY" ? 1 : 0;
      if (ua !== ub) return ub - ua; // urgency desc
      const da = a.geoDistanceKm ?? Number.POSITIVE_INFINITY;
      const dbb = b.geoDistanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== dbb) return da - dbb; // distance asc
      return b.maxContributionPossible - a.maxContributionPossible;
    });

  const loading = normal === null || rapid === null;
  const isEmpty = !loading && rapidSorted.length === 0 && (normal ?? []).length === 0;

  return (
    <section className="stack">
      <header className="stack-sm">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Recommended for you
        </h2>
        <p className="muted-text" style={{ fontSize: 13 }}>
          Tickets matched to your resources, ranked by capability and proximity.
        </p>
      </header>

      {loading ? (
        <p className="muted-text">Loading recommendations…</p>
      ) : isEmpty ? (
        <div className="card stack-sm" style={{ textAlign: "center", padding: 24 }}>
          <strong>No matches yet</strong>
          <p className="muted-text" style={{ fontSize: 13 }}>
            Match recommendations appear here once your resources are embedded
            and a ticket in your category is raised nearby.
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link href="/resources/new" className="btn btn-primary">List a resource</Link>
          </div>
        </div>
      ) : (
        <>
          {rapidSorted.length > 0 && (
            <div className="stack-sm">
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-danger, #dc2626)" }}>
                Emergency Response Needed
              </h3>
              <div className="stack-sm">
                {rapidSorted.map((m) => (
                  <RecommendedCard key={m.id} match={m} ticket={tickets[m.ticketId]} rapid />
                ))}
              </div>
            </div>
          )}

          {(normal ?? []).length > 0 && (
            <div className="stack-sm">
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Best matches</h3>
              <div className="stack-sm">
                {(normal ?? []).map((m) => (
                  <RecommendedCard key={m.id} match={m} ticket={tickets[m.ticketId]} rapid={false} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RecommendedCard({
  match,
  ticket,
  rapid,
}: {
  match: MatchRow;
  ticket: TicketLite | undefined;
  rapid: boolean;
}) {
  if (!ticket) {
    return (
      <article className="card stack-sm" style={{ opacity: 0.6 }}>
        <span className="muted-text">Loading ticket…</span>
      </article>
    );
  }
  const need = ticket.needs[match.bestNeedIndex] ?? ticket.needs[0];
  return (
    <article
      className="card stack-sm"
      style={{
        borderColor: rapid ? "var(--color-danger, #dc2626)" : undefined,
        borderWidth: rapid ? 2 : 1,
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div className="stack-sm" style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {rapid && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--color-danger, #dc2626)",
                  color: "white",
                }}
              >
                Emergency
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--color-muted, #6b7280)" }}>
              {ticket.host.name} · {ticket.host.type}
            </span>
          </div>
          <h4 style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>{ticket.title}</h4>
        </div>
        <Link href={`/tickets/${match.ticketId}`} className="btn btn-primary" style={{ flexShrink: 0 }}>
          {rapid ? "Respond" : "Pledge"}
        </Link>
      </div>

      <div className="row" style={{ gap: 16, fontSize: 13, flexWrap: "wrap" }}>
        {match.geoDistanceKm !== undefined && (
          <span className="muted-text">{Math.round(match.geoDistanceKm)} km away</span>
        )}
        {need && (
          <span className="muted-text">
            Needs {need.quantity} {need.unit} ({need.resourceCategory})
          </span>
        )}
      </div>

      {match.contributionFeasibility ? (
        <div
          style={{
            background: "var(--color-surface-2, #f6f7f9)",
            padding: "10px 12px",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <strong>Your contribution potential:</strong>{" "}
          fill <strong>{Math.round(match.contributionImpactPct)}%</strong> of remaining
          {need ? ` (${formatQty(match.maxContributionPossible)} ${need.unit})` : ""}.
        </div>
      ) : (
        <span className="muted-text" style={{ fontSize: 12 }}>
          Limited capacity match
        </span>
      )}
    </article>
  );
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 10) return n.toFixed(1).replace(/\.0$/, "");
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function toMatch(d: { id: string; data: () => Record<string, unknown> }): MatchRow {
  const x = d.data();
  return {
    id: d.id,
    ticketId: String(x.ticketId ?? ""),
    topResourceId: String(x.topResourceId ?? ""),
    score: typeof x.score === "number" ? x.score : undefined,
    semanticScore: typeof x.semanticScore === "number" ? x.semanticScore : undefined,
    reason: String(x.reason ?? ""),
    bestNeedIndex: Number(x.bestNeedIndex ?? 0),
    maxContributionPossible: Number(x.maxContributionPossible ?? 0),
    contributionFeasibility: Boolean(x.contributionFeasibility),
    contributionImpactPct: Number(x.contributionImpactPct ?? 0),
    geoDistanceKm: typeof x.geoDistanceKm === "number" ? x.geoDistanceKm : undefined,
    rapidBroadcast: Boolean(x.rapidBroadcast),
    createdAt: Number(x.createdAt ?? 0),
  };
}
