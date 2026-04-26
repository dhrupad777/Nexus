"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUserProfile } from "@/lib/auth/useUserProfile";
import { useOrgStatus } from "../resources/_lib/useOrgStatus";
import { RecommendedTicketsList } from "./_components/RecommendedTicketsList";
import { ActiveTicketsList } from "./_components/ActiveTicketsList";

/**
 * Two-surface dashboard per Albin/Nexus_Dashboard_Logic.md + List.md §2.10.
 * Recommended (primary, AI-driven) on the left; Active (secondary,
 * state-driven) on the right. Stacks vertically below the bento breakpoint.
 *
 * Reads: 3 Firestore queries fired in parallel against the viewer's orgId
 *  - tickets array-contains orgId  (Active)
 *  - matches where orgId, score desc, rapidBroadcast=false  (Normal)
 *  - matches where orgId, rapidBroadcast=true               (Rapid)
 * No joins beyond a one-shot ticket-header batch fetch keyed by ticketId
 * for the Recommended cards.
 */
export default function Dashboard() {
  const { user, loading, claims } = useAuth();
  // Read users/{uid} directly for the canonical "did they onboard" signal.
  // claims.orgId is only issued post-approval, so during PENDING_REVIEW the
  // claim is empty and we'd otherwise show "Finish onboarding" by mistake.
  const profile = useUserProfile(user?.uid ?? null);
  const profileOrgId = profile.loading ? null : profile.orgId;
  const orgId = claims?.orgId ?? profileOrgId;
  const orgStatus = useOrgStatus(orgId);

  // Auto-refresh ID token when the admin approves us. Without this, the
  // user would have to sign out and back in to pick up their new
  // {role, orgId} claims after approval. With this, the dashboard
  // transitions from "Pending review" to active within ~1s.
  const liveStatus = orgStatus.loading ? null : orgStatus.status;
  useEffect(() => {
    if (!user) return;
    if (liveStatus === "ACTIVE" && !claims?.orgId) {
      void user.getIdToken(true).catch((err) => {
        console.warn("[dashboard] post-approval token refresh failed", err);
      });
    }
  }, [user, liveStatus, claims?.orgId]);

  if (loading || profile.loading || orgStatus.loading) {
    return (
      <p className="muted-text" style={{ textAlign: "center", marginTop: 64 }}>
        Loading…
      </p>
    );
  }
  if (!user) return null;

  const onboarded = Boolean(orgId);
  // The full dashboard requires both ACTIVE status AND a claim-issued orgId
  // (server-only writes / member-gated rules check the claim, not Firestore).
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

  return (
    <div className="stack" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <header className="stack-sm">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Dashboard
          </h1>
          <Link
            href="/onboard"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-accent, #2563eb)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Edit organization profile →
          </Link>
        </div>
        <p className="muted-text">
          {isActive
            ? "Your org is approved. Recommended tickets and active work below."
            : `Your org is ${orgStatus.status === "PENDING_REVIEW" ? "under review" : (orgStatus.status ?? "not active")}. Once approved, you'll unlock matching and ticketing.`}
        </p>
      </header>

      {!isActive && (
        <div
          className="card"
          style={{
            borderColor: "var(--color-warn, #d97706)",
            background: "rgba(234, 179, 8, 0.08)",
          }}
        >
          <strong>Pending review</strong>
          <p className="muted-text" style={{ margin: "4px 0 8px" }}>
            A Platform Admin will approve your documents shortly. You&apos;ll get
            access to matching and ticket-raising once that happens.
          </p>
          <Link href="/onboard" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent, #2563eb)" }}>
            Add or update documents →
          </Link>
        </div>
      )}

      {isActive && orgId && (
        <div className="dashboard-bento">
          <RecommendedTicketsList orgId={orgId} />
          <ActiveTicketsList orgId={orgId} />
        </div>
      )}
    </div>
  );
}
