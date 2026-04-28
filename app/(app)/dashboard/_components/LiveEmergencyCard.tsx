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
  reason: string;
  createdAt: number;
  geoDistanceKm: number | null;
}

interface TicketHeader {
  id: string;
  title: string;
  description: string;
  hostName: string;
  hostType: "NGO" | "ORG";
  deadline: number;
  needs: Array<{ resourceCategory: string; quantity: number; unit: string; progressPct: number }>;
}

interface Props {
  orgId: string;
}

function timeLeftLabel(deadline: number): string | null {
  if (!deadline) return null;
  const ms = deadline - Date.now();
  if (ms <= 0) return "OVERDUE";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return `${days}D ${rem}H LEFT`;
  }
  return `${hours}H ${String(minutes).padStart(2, "0")}M LEFT`;
}

/**
 * Hero right card (dark). Shows the top rapid-broadcast match for this
 * org, with countdown + remaining capacity per need. Falls back to a
 * subtle "no live emergencies" state when none exist.
 */
export function LiveEmergencyCard({ orgId }: Props) {
  const [match, setMatch] = useState<MatchRow | null | undefined>(undefined);
  const [ticket, setTicket] = useState<TicketHeader | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "matches"),
      where("orgId", "==", orgId),
      where("rapidBroadcast", "==", true),
      orderBy("createdAt", "desc"),
      limit(1),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setMatch(null);
          return;
        }
        const d = snap.docs[0];
        const data = d.data();
        setMatch({
          ticketId: String(data.ticketId ?? ""),
          reason: String(data.reason ?? ""),
          createdAt: Number(data.createdAt ?? 0),
          geoDistanceKm:
            typeof data.geoDistanceKm === "number" ? data.geoDistanceKm : null,
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
        const hostRaw = (x.host ?? {}) as { name?: unknown; type?: unknown };
        setTicket({
          id: snap.id,
          title: String(x.title ?? "(untitled)"),
          description: String(x.description ?? ""),
          hostName: String(hostRaw.name ?? "—"),
          hostType: hostRaw.type === "NGO" ? "NGO" : "ORG",
          deadline: Number(x.deadline ?? 0),
          needs: Array.isArray(x.needs)
            ? (x.needs as Array<Record<string, unknown>>).map((n) => ({
                resourceCategory: String(n.resourceCategory ?? ""),
                quantity: Number(n.quantity ?? 0),
                unit: String(n.unit ?? ""),
                progressPct: Number(n.progressPct ?? 0),
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

  // Initial loading: render skeletal dark card so layout doesn't shift.
  if (match === undefined) {
    return (
      <div className="ed-card ed-card--emergency ed-card--placeholder" aria-hidden>
        <div className="ed-card__body">
          <span className="ed-card__eyebrow ed-card__eyebrow--emergency">
            <span className="ed-card__pulse" /> SCANNING…
          </span>
          <h2 className="ed-card__display ed-card__display--dark">Loading.</h2>
        </div>
      </div>
    );
  }

  if (match === null) {
    return (
      <div className="ed-card ed-card--emergency ed-card--quiet" aria-label="No live emergency">
        <div className="ed-card__body">
          <span className="ed-card__eyebrow ed-card__eyebrow--emergency">
            <span className="ed-card__pulse" /> ALL CLEAR
          </span>
          <h2 className="ed-card__display ed-card__display--dark">No live emergency.</h2>
          <p className="ed-card__lede ed-card__lede--dark">
            We&apos;ll surface rapid-broadcast tickets here the moment one matches your inventory.
          </p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="ed-card ed-card--emergency ed-card--placeholder" aria-hidden>
        <div className="ed-card__body">
          <span className="ed-card__eyebrow ed-card__eyebrow--emergency">
            <span className="ed-card__pulse" /> LIVE EMERGENCY
          </span>
          <h2 className="ed-card__display ed-card__display--dark">Loading match…</h2>
        </div>
      </div>
    );
  }

  const left = timeLeftLabel(ticket.deadline);
  const heading = ticket.title.split(" ").slice(0, 3).join(" ").replace(/[—–-]+$/, "");
  const remaining = ticket.needs
    .map((n) => ({
      ...n,
      remaining: Math.max(
        0,
        Math.round(n.quantity * (1 - n.progressPct / 100)),
      ),
    }))
    .filter((n) => n.remaining > 0)
    .slice(0, 3);

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="ed-card ed-card--emergency"
      aria-label={`Live emergency: ${ticket.title}`}
    >
      <div className="ed-card__body">
        <span className="ed-card__eyebrow ed-card__eyebrow--emergency">
          <span className="ed-card__pulse" /> LIVE EMERGENCY
          {left && (
            <>
              {" "}<span className="ed-card__eyebrow-sep">·</span> {left}
            </>
          )}
        </span>
        <h2 className="ed-card__display ed-card__display--dark">
          {heading || ticket.title}.
        </h2>
        <p className="ed-card__lede ed-card__lede--dark">
          {ticket.hostName} {ticket.hostType} needs{" "}
          {ticket.needs
            .slice(0, 3)
            .map((n) => n.resourceCategory.toLowerCase().replace(/_/g, " "))
            .join(", ")}
          {match.geoDistanceKm !== null && match.geoDistanceKm >= 0
            ? ` within ${Math.round(match.geoDistanceKm)} km`
            : ""}
          . Auto-pledge eligible.
        </p>
        {remaining.length > 0 && (
          <div className="ed-card__stats">
            {remaining.map((n) => (
              <div key={n.resourceCategory} className="ed-card__stat">
                <span className="ed-card__stat-value ed-card__stat-value--dark">
                  {n.remaining}
                </span>
                <span className="ed-card__stat-label ed-card__stat-label--dark">
                  {n.unit.toUpperCase()} SHORT
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <span className="ed-card__arrow ed-card__arrow--dark" aria-hidden>
        <ArrowRight size={14} strokeWidth={2.5} />
      </span>
    </Link>
  );
}
