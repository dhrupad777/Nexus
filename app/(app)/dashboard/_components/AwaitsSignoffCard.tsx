"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

interface Row {
  id: string;
  title: string;
  region: string | null;
  needs: Array<{ resourceCategory: string; quantity: number; unit: string; progressPct: number }>;
  proofCount: number;
}

interface Props {
  orgId: string;
}

/**
 * "Awaits your sign-off" — the most recent ticket the org participates
 * in that's currently in PENDING_SIGNOFF. Filters from the same query
 * ActiveTicketsList already runs (no new index).
 */
export function AwaitsSignoffCard({ orgId }: Props) {
  const [row, setRow] = useState<Row | null | undefined>(undefined);

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
        const found = snap.docs.find((d) => d.data().phase === "PENDING_SIGNOFF");
        if (!found) {
          setRow(null);
          return;
        }
        const x = found.data();
        const geo = (x.geo as { adminRegion?: unknown } | undefined) ?? {};
        const region =
          typeof geo.adminRegion === "string" && geo.adminRegion.trim()
            ? geo.adminRegion.trim()
            : null;
        setRow({
          id: found.id,
          title: String(x.title ?? "(untitled)"),
          region,
          needs: Array.isArray(x.needs)
            ? (x.needs as Array<Record<string, unknown>>).map((n) => ({
                resourceCategory: String(n.resourceCategory ?? ""),
                quantity: Number(n.quantity ?? 0),
                unit: String(n.unit ?? ""),
                progressPct: Number(n.progressPct ?? 0),
              }))
            : [],
          proofCount: 0, // filled in by the proofs subcollection effect below
        });
      },
      () => setRow(null),
    );
    return unsub;
  }, [orgId]);

  // Live count of photo proofs for the surfaced ticket.
  useEffect(() => {
    if (!row) return;
    const q = query(
      collection(db, "tickets", row.id, "photoProofs"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setRow((cur) => (cur ? { ...cur, proofCount: snap.size } : cur)),
      () => {},
    );
    return unsub;
  }, [row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (row === undefined) {
    return (
      <div className="ed-card ed-card--lavender" aria-hidden>
        <div className="ed-card__body">
          <span className="ed-card__eyebrow ed-card__eyebrow--purple">Awaits your sign-off</span>
          <h3 className="ed-card__heading">Loading…</h3>
        </div>
      </div>
    );
  }

  if (row === null) {
    return (
      <div className="ed-card ed-card--lavender ed-card--quiet">
        <div className="ed-card__body">
          <span className="ed-card__eyebrow ed-card__eyebrow--purple">Awaits your sign-off</span>
          <h3 className="ed-card__heading">
            <span className="ed-card__heading-accent-purple">Nothing pending.</span>
          </h3>
          <p className="ed-card__lede">
            Tickets awaiting your delivery confirmation will surface here.
          </p>
        </div>
      </div>
    );
  }

  const totalQty = row.needs.reduce((s, n) => s + n.quantity, 0);
  const fulfilledQty = row.needs.reduce(
    (s, n) => s + n.quantity * (n.progressPct / 100),
    0,
  );
  const heading = row.title.split(" ").slice(0, 3).join(" ");

  return (
    <Link
      href={`/tickets/${row.id}`}
      className="ed-card ed-card--lavender"
      aria-label="Awaits your sign-off"
    >
      <div className="ed-card__body">
        <span className="ed-card__eyebrow ed-card__eyebrow--purple">Awaits your sign-off</span>
        <h3 className="ed-card__heading">
          <span className="ed-card__heading-accent-purple">Confirm delivery</span>{" "}
          <span className="ed-card__heading-soft">on {heading}.</span>
        </h3>
        <p className="ed-card__lede">
          {row.proofCount} photo proof{row.proofCount === 1 ? "" : "s"} ·{" "}
          {Math.round(fulfilledQty)}/{Math.round(totalQty)} units
        </p>
      </div>
      <span className="ed-card__arrow ed-card__arrow--purple" aria-hidden>
        <ArrowRight size={14} strokeWidth={2.5} />
      </span>
    </Link>
  );
}
