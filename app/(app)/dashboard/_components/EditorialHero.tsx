"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { OrgRecordState } from "@/lib/onboarding/useOrgRecord";

interface Props {
  displayName: string | null | undefined;
  email: string | null | undefined;
  orgRecord: OrgRecordState;
  actionsWaiting: number | null;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(name: string | null | undefined, email: string | null | undefined) {
  if (name && name.trim()) return name.trim().split(/\s+/)[0];
  if (email) return email.split("@")[0];
  return "there";
}

/**
 * Top-of-dashboard editorial hero. Three lines:
 *   1. Tiny uppercase status: VERIFIED · REGION · N ACTIONS WAITING
 *   2. Huge editorial greeting: "Good evening, {firstName}." + light "Here's what's moving."
 *   3. Right-side "Today's brief" pill — anchors to the live emergency card.
 *
 * Pure presentation. Reads from props the parent already has.
 */
export function EditorialHero({ displayName, email, orgRecord, actionsWaiting }: Props) {
  const greet = timeGreeting();
  const first = firstNameOf(displayName, email);

  const verified =
    !orgRecord.loading && orgRecord.exists && orgRecord.status === "ACTIVE";
  const region =
    !orgRecord.loading && orgRecord.exists ? orgRecord.geo.adminRegion : null;
  const regionLabel = region && region.trim() ? region.trim().toUpperCase() : null;

  const actions =
    actionsWaiting === null
      ? null
      : `${actionsWaiting} ACTION${actionsWaiting === 1 ? "" : "S"} WAITING`;

  return (
    <section className="ed-hero" aria-label="Welcome">
      <div className="ed-hero__status">
        {verified && (
          <span className="ed-hero__status-pill ed-hero__status-pill--verified">
            <span className="ed-hero__status-dot" aria-hidden /> VERIFIED
          </span>
        )}
        {regionLabel && (
          <>
            <span className="ed-hero__status-dot-sep" aria-hidden>·</span>
            <span className="ed-hero__status-text">{regionLabel}</span>
          </>
        )}
        {actions !== null && (
          <>
            <span className="ed-hero__status-dot-sep" aria-hidden>·</span>
            <span className="ed-hero__status-text">{actions}</span>
          </>
        )}
      </div>

      <div className="ed-hero__row">
        <h1 className="ed-hero__headline">
          <span className="ed-hero__headline-strong">
            {greet}, {first}.
          </span>{" "}
          <span className="ed-hero__headline-soft">Here&apos;s what&apos;s moving.</span>
        </h1>
        <Link href="#today-brief" className="ed-hero__brief">
          Today&apos;s brief <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}
