"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUserProfile } from "@/lib/auth/useUserProfile";
import { useOrgRecord } from "@/lib/onboarding/useOrgRecord";
import { useOrgStatus } from "../resources/_lib/useOrgStatus";
import { EditorialHero } from "./_components/EditorialHero";
import { LifetimeImpactCard } from "./_components/LifetimeImpactCard";
import { LiveEmergencyCard } from "./_components/LiveEmergencyCard";
import { ReliabilityCard } from "./_components/ReliabilityCard";
import { InFlightCard } from "./_components/InFlightCard";
import { TopMatchCard } from "./_components/TopMatchCard";
import { AwaitsSignoffCard } from "./_components/AwaitsSignoffCard";
import { AiMatchesCard } from "./_components/AiMatchesCard";
import { ResourceInventoryCard } from "./_components/ResourceInventoryCard";
import { RecommendedFeed } from "./_components/RecommendedFeed";
import { RecentClosuresStrip } from "./_components/RecentClosuresStrip";
import { ProfileCard } from "./_components/ProfileCard";

/**
 * Editorial dashboard — Stitch design port.
 *
 * Layout:
 *   1. Status pre-header + huge greeting + "Today's brief" CTA
 *   2. Two-column hero: Lifetime impact (light) + Live emergency (dark)
 *   3. Three-column metrics: Reliability + In-flight + Top match
 *   4. Three-column actions: Awaits sign-off + AI matches + Resource inventory
 *   5. ProfileCard (for orgs still uploading docs)
 *
 * No new logic on top of what the previous dashboard ran. Each card owns
 * its own Firestore subscription against existing indexes; no schema or
 * index additions required. Routing is preserved — every card links to
 * an existing route.
 */
export default function Dashboard() {
  const { user, loading, claims } = useAuth();
  const profile = useUserProfile(user?.uid ?? null);
  const profileOrgId = profile.loading ? null : profile.orgId;
  const orgId = claims?.orgId ?? profileOrgId;
  const orgStatus = useOrgStatus(orgId);
  const orgRecord = useOrgRecord(user?.uid ?? null);

  // Count lifted from InFlightCard — drives the "N actions waiting"
  // pre-header chip. Pure presentational data flow.
  const [actionsWaiting, setActionsWaiting] = useState<number | null>(null);
  const onInFlightTotal = useCallback((n: number) => setActionsWaiting(n), []);

  if (loading || profile.loading || orgStatus.loading) {
    return (
      <p className="muted-text" style={{ textAlign: "center", marginTop: 64 }}>
        Loading…
      </p>
    );
  }
  if (!user) return null;

  const onboarded = Boolean(orgId);
  const isActive = orgStatus.status === "ACTIVE" && Boolean(claims?.orgId);

  if (!onboarded) {
    return (
      <div className="stack" style={{ maxWidth: 640, margin: "64px auto", textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Set up your organization
        </h1>
        <p className="muted-text">
          Tell us who you are and upload your government documents. Takes about 2 minutes.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/onboard" className="btn btn-primary">
            Start setup
          </Link>
        </div>
      </div>
    );
  }

  // Until the org is ACTIVE + the orgId claim is issued, we can't subscribe
  // to per-org collections (rules block it). Show the editorial hero +
  // ProfileCard so the user can finish onboarding, then unlock everything.
  if (!isActive || !orgId) {
    return (
      <div className="stack ed-shell" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <EditorialHero
          displayName={user.displayName}
          email={user.email}
          orgRecord={orgRecord}
          actionsWaiting={null}
        />
        <ProfileCard orgRecord={orgRecord} />
      </div>
    );
  }

  return (
    <div className="stack ed-shell" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <EditorialHero
        displayName={user.displayName}
        email={user.email}
        orgRecord={orgRecord}
        actionsWaiting={actionsWaiting}
      />

      <div className="ed-grid ed-grid--hero">
        <LifetimeImpactCard orgId={orgId} />
        <LiveEmergencyCard orgId={orgId} />
      </div>

      <div className="ed-grid ed-grid--three">
        <ReliabilityCard orgRecord={orgRecord} />
        <InFlightCard orgId={orgId} onTotal={onInFlightTotal} />
        <TopMatchCard orgId={orgId} />
      </div>

      <div className="ed-grid ed-grid--three">
        <AwaitsSignoffCard orgId={orgId} />
        <AiMatchesCard orgId={orgId} />
        <ResourceInventoryCard orgId={orgId} />
      </div>

      {/* Full recommendation feed — restored from the previous dashboard so
          contributors see every ticket they could pledge to (the editorial
          TopMatchCard above only spotlights the single highest-scoring one). */}
      <RecommendedFeed orgId={orgId} />

      {/* Recent closures — every closed ticket the org participated in,
          driven by the badges collection. Naturally appears on every
          contributor's dashboard the moment a ticket they touched closes. */}
      <RecentClosuresStrip orgId={orgId} />

      {!orgRecord.loading && orgRecord.exists && !orgRecord.isComplete && (
        <ProfileCard orgRecord={orgRecord} />
      )}
    </div>
  );
}
