"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface Counts {
  total: number;
  ok: number;
  pending: number;
  failed: number;
}

interface Props {
  orgId: string;
}

/**
 * "Resource inventory" — count of resources owned by this org, broken
 * down by embedding status. Reads `resources where orgId == viewerOrg`
 * (existing index `(orgId, status)`).
 */
export function ResourceInventoryCard({ orgId }: Props) {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "resources"),
      where("orgId", "==", orgId),
      limit(100),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let ok = 0;
        let pending = 0;
        let failed = 0;
        for (const d of snap.docs) {
          const s = String(d.data().embeddingStatus ?? "pending");
          if (s === "ok") ok++;
          else if (s === "failed") failed++;
          else pending++;
        }
        setCounts({ total: snap.size, ok, pending, failed });
      },
      () => setCounts({ total: 0, ok: 0, pending: 0, failed: 0 }),
    );
    return unsub;
  }, [orgId]);

  const total = counts?.total ?? null;
  const ok = counts?.ok ?? 0;
  const pending = counts?.pending ?? 0;
  const failed = counts?.failed ?? 0;

  const subline =
    total === null
      ? "—"
      : total === 0
        ? "Nothing listed yet."
        : `${ok} embedded${pending > 0 ? ` · ${pending} processing` : ""}${failed > 0 ? ` · ${failed} failed` : ""}`;

  return (
    <Link href="/resources" className="ed-card ed-card--light" aria-label="Resource inventory">
      <div className="ed-card__body">
        <span className="ed-card__eyebrow">Resource inventory</span>
        <h3 className="ed-card__heading">
          <span className="ed-card__heading-accent-blue">{total ?? "—"}</span>{" "}
          <span className="ed-card__heading-soft">listed</span>
        </h3>
        <p className="ed-card__lede">{subline}</p>
      </div>
      <span className="ed-card__arrow" aria-hidden>
        <ArrowRight size={14} strokeWidth={2.5} />
      </span>
    </Link>
  );
}
