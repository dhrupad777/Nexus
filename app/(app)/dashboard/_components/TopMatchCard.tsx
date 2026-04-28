"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
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

interface MatchRow {
  ticketId: string;
  score: number;
  geoDistanceKm: number | null;
  rapidBroadcast: boolean;
}

interface TicketHeader {
  id: string;
  title: string;
  rapid: boolean;
  needs: Array<{ resourceCategory: string; quantity: number; unit: string }>;
}

interface Props {
  orgId: string;
}

/**
 * Top match — the highest-scoring non-closed match for this org. Reads
 * from the existing matches index `(orgId, rapidBroadcast, score DESC)`.
 */
export function TopMatchCard({ orgId }: Props) {
  const [match, setMatch] = useState<MatchRow | null | undefined>(undefined);
  const [ticket, setTicket] = useState<TicketHeader | null>(null);

  useEffect(() => {
    if (!orgId) return;
    // Top-scoring non-rapid match. Rapid lives in the live emergency card.
    const q = query(
      collection(db, "matches"),
      where("orgId", "==", orgId),
      where("rapidBroadcast", "==", false),
      orderBy("score", "desc"),
      limit(1),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setMatch(null);
          return;
        }
        const x = snap.docs[0].data();
        setMatch({
          ticketId: String(x.ticketId ?? ""),
          score: Number(x.score ?? 0),
          geoDistanceKm:
            typeof x.geoDistanceKm === "number" ? x.geoDistanceKm : null,
          rapidBroadcast: Boolean(x.rapidBroadcast),
        });
      },
      () => setMatch(null),
    );
    return unsub;
  }, [orgId]);

  useEffect(() => {
    if (!match) {
      setTicket(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "tickets", match.ticketId));
        if (cancelled) return;
        if (!snap.exists()) {
          setTicket(null);
          return;
        }
        const x = snap.data();
        setTicket({
          id: snap.id,
          title: String(x.title ?? "(untitled)"),
          rapid: Boolean(x.rapid),
          needs: Array.isArray(x.needs)
            ? (x.needs as Array<Record<string, unknown>>).map((n) => ({
                resourceCategory: String(n.resourceCategory ?? ""),
                quantity: Number(n.quantity ?? 0),
                unit: String(n.unit ?? ""),
              }))
            : [],
        });
      } catch {
        if (!cancelled) setTicket(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [match]);

  if (match === null || (match && !ticket)) {
    return (
      <div className="ed-card ed-card--light ed-card--mint">
        <div className="ed-card__body">
          <span className="ed-card__eyebrow">Top match</span>
          <h2 className="ed-card__display ed-card__display--small">
            <span className="ed-card__display-accent-green">—</span>
          </h2>
          <p className="ed-card__lede">
            {match === null
              ? "No matches yet. List a resource to start receiving picks."
              : "Loading…"}
          </p>
        </div>
      </div>
    );
  }

  if (match === undefined) {
    return (
      <div className="ed-card ed-card--light ed-card--mint" aria-hidden>
        <div className="ed-card__body">
          <span className="ed-card__eyebrow">Top match</span>
          <h2 className="ed-card__display ed-card__display--small">
            <span className="ed-card__display-accent-green">—</span>
          </h2>
        </div>
      </div>
    );
  }

  const pct = Math.round(Math.max(0, Math.min(1, match.score)) * 100);
  const need = ticket!.needs[0];
  const heading = ticket!.title.split(" ").slice(0, 2).join(" ");
  const subline =
    match.geoDistanceKm !== null
      ? `${Math.round(match.geoDistanceKm)} km · ${ticket!.rapid ? "auto-pledge ready" : "ranked match"}`
      : `${ticket!.rapid ? "auto-pledge ready" : "ranked match"}`;

  return (
    <Link
      href={`/tickets/${ticket!.id}`}
      className="ed-card ed-card--light ed-card--mint"
      aria-label="Top match"
    >
      <div className="ed-card__body">
        <span className="ed-card__eyebrow">Top match</span>
        <h2 className="ed-card__display ed-card__display--small">
          <span className="ed-card__display-accent-green">{pct}</span>
          <span className="ed-card__display-suffix"> %</span>
        </h2>
        <span className="ed-card__sub-eyebrow">Gemini-ranked</span>
        <h4 className="ed-card__sub-heading">
          {need ? `${need.resourceCategory.charAt(0) + need.resourceCategory.slice(1).toLowerCase()} for ${heading}.` : `${heading}.`}
        </h4>
        <p className="ed-card__lede">{subline}</p>
      </div>
      <span className="ed-card__arrow" aria-hidden>
        <ArrowRight size={14} strokeWidth={2.5} />
      </span>
    </Link>
  );
}
