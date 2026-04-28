"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Sparkles, Zap } from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { TicketPhase, TicketUrgency } from "@/lib/schemas";

interface MatchRow {
  id: string;
  ticketId: string;
  rapidBroadcast: boolean;
  score: number;
  contributionImpactPct: number;
  reason: string;
  geoDistanceKm?: number;
}

interface TicketHeader {
  id: string;
  title: string;
  category: string;
  urgency: TicketUrgency;
  rapid: boolean;
  phase: TicketPhase;
  host: { name: string; type: "NGO" | "ORG" };
  needs: Array<{ resourceCategory: string; quantity: number; unit: string }>;
  geo?: { adminRegion?: string };
  coverImageUrl: string | null;
}

interface Props {
  orgId: string;
}

/**
 * Full "Recommended for you" feed — same data as the previous dashboard's
 * RecommendedTicketsList, restored as a section under the editorial cards
 * so contributors don't lose visibility of every ticket they could pledge
 * to (the editorial design's TopMatchCard only spotlights ONE).
 *
 * Two parallel match queries:
 *   - Flow A: orgId, rapidBroadcast=false, score DESC
 *   - Flow B: orgId, rapidBroadcast=true,  createdAt DESC
 * Rapid floats to top, then ranked normals. Closed tickets filtered out
 * after a one-shot ticket-header fetch.
 */
export function RecommendedFeed({ orgId }: Props) {
  const [normalMatches, setNormalMatches] = useState<MatchRow[] | null>(null);
  const [rapidMatches, setRapidMatches] = useState<MatchRow[] | null>(null);
  const [headers, setHeaders] = useState<Record<string, TicketHeader | null>>({});

  useEffect(() => {
    const q = query(
      collection(db, "matches"),
      where("orgId", "==", orgId),
      where("rapidBroadcast", "==", false),
      orderBy("score", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setNormalMatches(snap.docs.map(parseMatchRow)),
      () => setNormalMatches([]),
    );
    return unsub;
  }, [orgId]);

  useEffect(() => {
    const q = query(
      collection(db, "matches"),
      where("orgId", "==", orgId),
      where("rapidBroadcast", "==", true),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setRapidMatches(snap.docs.map(parseMatchRow)),
      () => setRapidMatches([]),
    );
    return unsub;
  }, [orgId]);

  const merged = useMemo(() => {
    if (normalMatches === null || rapidMatches === null) return null;
    const seen = new Set<string>();
    const out: MatchRow[] = [];
    for (const m of [...rapidMatches, ...normalMatches]) {
      if (seen.has(m.ticketId)) continue;
      seen.add(m.ticketId);
      out.push(m);
    }
    return out;
  }, [normalMatches, rapidMatches]);

  useEffect(() => {
    if (!merged) return;
    const missing = merged.map((m) => m.ticketId).filter((id) => !(id in headers));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const fetched: Record<string, TicketHeader | null> = {};
      await Promise.all(
        missing.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, "tickets", id));
            fetched[id] = snap.exists() ? parseTicketHeader(id, snap.data()) : null;
          } catch {
            fetched[id] = null;
          }
        }),
      );
      if (!cancelled) setHeaders((prev) => ({ ...prev, ...fetched }));
    })();
    return () => {
      cancelled = true;
    };
  }, [merged, headers]);

  const visible = useMemo(() => {
    if (!merged) return null;
    return merged
      .map((m) => ({ match: m, ticket: headers[m.ticketId] }))
      .filter(
        (row): row is { match: MatchRow; ticket: TicketHeader } =>
          row.ticket !== undefined &&
          row.ticket !== null &&
          row.ticket.phase !== "CLOSED",
      );
  }, [merged, headers]);

  // Loading: render nothing — the editorial layout above already has plenty.
  if (visible === null) return null;
  if (visible.length === 0) return null;

  return (
    <section className="ed-feed">
      <header className="ed-feed__head">
        <div className="ed-feed__title-block">
          <span className="ed-feed__eyebrow">Recommended for you</span>
          <h2 className="ed-feed__title">
            <span className="ed-feed__title-accent-blue">{visible.length}</span>{" "}
            <span className="ed-feed__title-soft">
              ticket{visible.length === 1 ? "" : "s"} you can pledge to
            </span>
          </h2>
        </div>
        <Link href="/tickets" className="ed-feed__more">
          See all <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </header>

      <div className="ed-feed__grid">
        {visible.map(({ match, ticket }) => (
          <FeedCard key={match.id} match={match} ticket={ticket} />
        ))}
      </div>
    </section>
  );
}

function FeedCard({ match, ticket }: { match: MatchRow; ticket: TicketHeader }) {
  const need = ticket.needs[0];
  const region = ticket.geo?.adminRegion?.trim();
  const impact = Math.round(match.contributionImpactPct);
  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className={`ed-feed-card${ticket.rapid ? " ed-feed-card--rapid" : ""}`}
    >
      <div className="ed-feed-card__cover" aria-hidden>
        {ticket.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ticket.coverImageUrl} alt="" />
        ) : (
          <div className="ed-feed-card__cover-placeholder" />
        )}
        {ticket.rapid && (
          <span className="ed-feed-card__rapid-badge">
            <Zap size={11} strokeWidth={2.5} /> Emergency
          </span>
        )}
      </div>

      <div className="ed-feed-card__body">
        <div className="ed-feed-card__meta">
          <span>
            {ticket.host.name} · {ticket.host.type}
          </span>
          {region && (
            <>
              <span className="ed-feed-card__meta-dot" aria-hidden>·</span>
              <span className="ed-feed-card__region">
                <MapPin size={11} /> {region}
              </span>
            </>
          )}
        </div>
        <h3 className="ed-feed-card__title">{ticket.title}</h3>
        {need && (
          <p className="ed-feed-card__need">
            Needs <span className="num">{need.quantity}</span> {need.unit} ({need.resourceCategory})
          </p>
        )}
        <div className="ed-feed-card__foot">
          {impact > 0 && (
            <span className="ed-feed-card__impact">
              <Sparkles size={11} /> Fills {impact}% of need
            </span>
          )}
          <span className="ed-feed-card__cta">
            {ticket.rapid ? "Respond" : "View ticket"}{" "}
            <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function parseMatchRow(d: { id: string; data: () => Record<string, unknown> }): MatchRow {
  const data = d.data();
  return {
    id: d.id,
    ticketId: String(data.ticketId ?? ""),
    rapidBroadcast: Boolean(data.rapidBroadcast),
    score: Number(data.score ?? 0),
    contributionImpactPct: Number(data.contributionImpactPct ?? 0),
    reason: String(data.reason ?? ""),
    geoDistanceKm: typeof data.geoDistanceKm === "number" ? data.geoDistanceKm : undefined,
  };
}

function parseTicketHeader(id: string, data: Record<string, unknown>): TicketHeader {
  const hostRaw = (data.host ?? {}) as { name?: unknown; type?: unknown };
  const cover =
    typeof data.coverImageUrl === "string" && data.coverImageUrl
      ? data.coverImageUrl
      : Array.isArray(data.images) &&
          typeof (data.images as unknown[])[0] === "string" &&
          (data.images as string[])[0]
        ? (data.images as string[])[0]
        : null;
  return {
    id,
    title: String(data.title ?? "(untitled)"),
    category: String(data.category ?? ""),
    urgency: (data.urgency as TicketUrgency) ?? "NORMAL",
    rapid: Boolean(data.rapid),
    phase: (data.phase as TicketPhase) ?? "OPEN_FOR_CONTRIBUTIONS",
    host: {
      name: String(hostRaw.name ?? "—"),
      type: hostRaw.type === "NGO" ? "NGO" : "ORG",
    },
    needs: Array.isArray(data.needs)
      ? (data.needs as Array<Record<string, unknown>>).map((n) => ({
          resourceCategory: String(n.resourceCategory ?? ""),
          quantity: Number(n.quantity ?? 0),
          unit: String(n.unit ?? ""),
        }))
      : [],
    geo: data.geo as { adminRegion?: string } | undefined,
    coverImageUrl: cover,
  };
}
