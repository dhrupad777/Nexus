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

interface State {
  total: number;
  topScore: number | null;
  newestAt: number | null;
}

interface Props {
  orgId: string;
}

function timeAgo(ts: number | null): string {
  if (!ts) return "—";
  const ms = Date.now() - ts;
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * "AI matches today" — count of all live matches for this org plus the
 * top score and the freshness of the newest match.
 */
export function AiMatchesCard({ orgId }: Props) {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "matches"),
      where("orgId", "==", orgId),
      where("rapidBroadcast", "==", false),
      orderBy("score", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setState({ total: 0, topScore: null, newestAt: null });
          return;
        }
        let topScore = 0;
        let newestAt = 0;
        for (const d of snap.docs) {
          const x = d.data();
          const s = Number(x.score ?? 0);
          if (s > topScore) topScore = s;
          const c = Number(x.createdAt ?? 0);
          if (c > newestAt) newestAt = c;
        }
        setState({ total: snap.size, topScore, newestAt: newestAt || null });
      },
      () => setState({ total: 0, topScore: null, newestAt: null }),
    );
    return unsub;
  }, [orgId]);

  const total = state?.total ?? null;
  const topPct =
    state?.topScore !== null && state?.topScore !== undefined
      ? Math.round(Math.max(0, Math.min(1, state.topScore)) * 100)
      : null;
  const fresh = timeAgo(state?.newestAt ?? null);

  return (
    <Link href="/tickets" className="ed-card ed-card--light" aria-label="AI matches today">
      <div className="ed-card__body">
        <span className="ed-card__eyebrow">AI matches today</span>
        <h3 className="ed-card__heading">
          <span className="ed-card__heading-accent-blue">{total ?? "—"}</span>{" "}
          <span className="ed-card__heading-soft">ranked picks</span>
        </h3>
        <p className="ed-card__lede">
          {topPct !== null
            ? `Top score ${topPct}% · refreshed ${fresh}`
            : "Refresh in a moment as matches land."}
        </p>
      </div>
      <span className="ed-card__arrow" aria-hidden>
        <ArrowRight size={14} strokeWidth={2.5} />
      </span>
    </Link>
  );
}
