"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { OrgRecordState } from "@/lib/onboarding/useOrgRecord";

interface Props {
  orgRecord: OrgRecordState;
}

function toneFor(score: number | null): string {
  if (score === null) return "ed-bar--muted";
  if (score >= 85) return "ed-bar--good";
  if (score >= 70) return "ed-bar--warn";
  return "ed-bar--low";
}

/**
 * Reliability card — public-to-partners. Reads from the org doc's
 * `reliability` map (already in the live useOrgRecord snapshot — zero
 * extra queries). Three score bars: agreement, execution, closure.
 */
export function ReliabilityCard({ orgRecord }: Props) {
  const loaded = !orgRecord.loading && orgRecord.exists;
  const reliability = loaded
    ? orgRecord.reliability
    : { agreement: null, execution: null, closure: null };
  const closedCount = loaded ? orgRecord.badges.length : 0;

  const ag = reliability.agreement;
  const ex = reliability.execution;
  const cl = reliability.closure;

  return (
    <Link href="/profile" className="ed-card ed-card--light" aria-label="Reliability">
      <div className="ed-card__body">
        <span className="ed-card__eyebrow">Reliability — public to partners</span>
        <h3 className="ed-card__heading">
          Trusted on{" "}
          <span className="ed-card__heading-accent">
            {closedCount} closed ticket{closedCount === 1 ? "" : "s"}
          </span>
          . Zero disputes filed.
        </h3>

        <div className="ed-reliability">
          <ScoreBar label="Agreement" score={ag} />
          <ScoreBar label="Execution" score={ex} />
          <ScoreBar label="Closure" score={cl} />
        </div>
      </div>
      <span className="ed-card__arrow" aria-hidden>
        <ArrowRight size={14} strokeWidth={2.5} />
      </span>
    </Link>
  );
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  const display = score === null ? "—" : Math.round(score).toString();
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div className="ed-reliability__col">
      <div className="ed-reliability__num">
        <span className="ed-reliability__num-value">{display}</span>
        <span className="ed-reliability__num-of">/100</span>
      </div>
      <span className="ed-reliability__label">{label.toUpperCase()}</span>
      <div className="ed-bar">
        <div
          className={`ed-bar__fill ${toneFor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
