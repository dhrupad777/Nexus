"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ArrowRight, Sparkles, ChevronRight, MapPin, Package, Zap, ShieldCheck } from "lucide-react";
import {
  MOCK_TICKETS,
  phaseLabel,
  type MockTicket,
  type UrgencyLevel,
} from "@/lib/data/tickets";

const USER_LOCATION = "Mumbai, Maharashtra";

const AVAILABLE_RESOURCES = [
  { label: "Food kits", count: 120 },
  { label: "Blankets", count: 80 },
  { label: "Volunteers", count: 24 },
];

const URGENCY_BADGE: Record<UrgencyLevel, string> = {
  EMERGENCY: "badge-emergency",
  HIGH: "badge-primary",
  NORMAL: "badge-normal",
};

const PHASE_DOT: Record<MockTicket["phase"], string> = {
  PLANNING: "#6366f1",
  EXECUTION: "#ef4444",
  COMPLETION: "#10b981",
};

/**
 * Recommendation ranking per spec §6:
 *   finalScore = semantic_score + geo_score + urgency_score + capacity_fit
 * With §6.1 filter `status = OPEN` and §6.5 excluding ACTIVE/COMPLETED for the viewer.
 * Mocked here with deterministic inputs; swap for live scoring once available.
 */
function recommendationScore(t: MockTicket): number {
  const urgencyScore = t.urgency_level === "EMERGENCY" ? 30 : t.urgency_level === "HIGH" ? 20 : 10;
  const geoScore = Math.max(0, 25 - (t.distance_km ?? 0) / 20);
  const capacityFit = Math.min(25, t.contribution_impact_percentage * 2);
  const semantic = 20; // placeholder — real embedding similarity plugs in here
  return Math.round(urgencyScore + geoScore + capacityFit + semantic);
}

const RECOMMENDED = MOCK_TICKETS
  .filter((t) => t.ticket_status === "OPEN" && t.contribution_feasibility)
  .map((t) => ({ ticket: t, score: recommendationScore(t) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 4);

const ACTIVE = MOCK_TICKETS.filter((t) => t.ticket_status === "ACTIVE").slice(0, 4);

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="stack" style={{ gap: "32px" }}>
      {/* Welcome Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div className="stack" style={{ gap: "4px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Welcome back, {user?.displayName?.split(' ')[0] || 'User'}
          </h1>
          <p className="muted-text" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <MapPin size={14} /> {USER_LOCATION}
          </p>
        </div>
        <div className="row" style={{ gap: "12px" }}>
          <Link href="/tickets/new" className="btn btn-primary">
            Raise a Ticket
          </Link>
          <Link href="/tickets" className="btn btn-ghost">
            Browse Tickets
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-grid dashboard-grid--compact">
        <div className="stat-card stat-card--compact">
          <span className="stat-label">Active Tickets</span>
          <span className="stat-value stat-value--sm num">12</span>
          <span className="badge badge-primary badge-xs">3 pending</span>
        </div>
        <div className="stat-card stat-card--compact">
          <span className="stat-label">Contributions</span>
          <span className="stat-value stat-value--sm num">48</span>
          <span className="badge badge-success badge-xs">This month</span>
        </div>
        <div className="stat-card stat-card--compact">
          <span className="stat-label">Reliability Score</span>
          <span className="stat-value stat-value--sm num">
            98<span style={{ fontSize: "14px", color: "var(--color-muted)" }}>%</span>
          </span>
          <span className="muted-text" style={{ fontSize: "11px" }}>Top 5% of network</span>
        </div>
        <div className="stat-card stat-card--compact">
          <span className="stat-label">Total Impact</span>
          <span className="stat-value stat-value--sm num">
            14.2<span style={{ fontSize: "14px", color: "var(--color-muted)" }}>k</span>
          </span>
          <span className="muted-text" style={{ fontSize: "11px" }}>People reached</span>
        </div>
        <Link
          href="/resources"
          className="stat-card stat-card--compact stat-card--wide stat-card--link"
        >
          <div className="resource-card-head">
            <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Package size={12} /> Resource Dashboard
            </span>
            <span className="btn-link" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
              Manage <ChevronRight size={14} />
            </span>
          </div>
          <div className="resource-chip-row">
            {AVAILABLE_RESOURCES.map((r) => (
              <span key={r.label} className="resource-chip">
                <span className="num">{r.count}</span>
                <span className="resource-chip-label">{r.label}</span>
              </span>
            ))}
          </div>
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: "24px" }} className="dashboard-main-grid">
        {/* Recommended Tickets */}
        <div className="card stack" style={{ gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="stack" style={{ gap: "2px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={16} style={{ color: "var(--color-primary)" }} />
                Recommended Tickets
              </h2>
              <span className="muted-text" style={{ fontSize: "12px" }}>
                Matched to your focus areas & capacity
              </span>
            </div>
            <Link href="/tickets" className="btn-link" style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="recommended-list">
            {RECOMMENDED.map(({ ticket: t, score }) => (
              <Link key={t.id} href={`/tickets/${t.id}`} className="recommended-item">
                <div className="stack" style={{ gap: "6px", flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{t.title}</span>
                    <span className={`badge ${URGENCY_BADGE[t.urgency_level]}`}>{t.urgency}</span>
                    {t.mode === "RAPID" && (
                      <span className="badge badge-emergency" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <Zap size={10} /> Rapid
                      </span>
                    )}
                  </div>
                  <span className="muted-text" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span className="num">{t.id}</span>
                    <span>·</span>
                    <span>{t.category}{t.subtype ? ` · ${t.subtype}` : ""}</span>
                    <span>·</span>
                    <span>{t.host_entity}</span>
                    {t.host_verification_status === "VERIFIED" && (
                      <ShieldCheck size={11} style={{ color: "var(--color-primary)" }} />
                    )}
                    <span>·</span>
                    <span>{t.location}</span>
                    {typeof t.distance_km === "number" && (
                      <span className="num">({t.distance_km} km)</span>
                    )}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px", flexWrap: "wrap" }}>
                    <div className="match-bar">
                      <div className="match-bar-fill" style={{ width: `${Math.min(100, score)}%` }} />
                    </div>
                    <span className="num" style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-primary)" }}>
                      {score} match
                    </span>
                    <span className="muted-text" style={{ fontSize: "11px" }}>
                      · <span className="num">+{t.contribution_impact_percentage}%</span> impact if you pledge
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
              </Link>
            ))}
            {RECOMMENDED.length === 0 && (
              <div className="muted-text" style={{ fontSize: "13px", padding: "8px 0" }}>
                No open tickets match your capacity right now.
              </div>
            )}
          </div>
        </div>

        {/* Active Tickets */}
        <div className="card stack" style={{ gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Active Tickets</h2>
            <span className="badge badge-primary num">{ACTIVE.length}</span>
          </div>

          <div className="active-list">
            {ACTIVE.map((t) => (
              <Link key={t.id} href={`/tickets/${t.id}/process`} className="active-item">
                <div className="active-item-dot" style={{ background: PHASE_DOT[t.phase] }} />
                <div className="stack" style={{ gap: "3px", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, lineHeight: 1.3 }}>
                    {t.title}
                  </span>
                  <span className="muted-text" style={{ fontSize: "12px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <span className="num">{t.id}</span>
                    <span>·</span>
                    <span>{phaseLabel(t.phase)}</span>
                    <span>·</span>
                    <span className="num">{t.contributor_count}</span>
                    <span>contributors</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <div className="active-progress">
                      <div className="active-progress-fill" style={{ width: `${t.completion_percentage}%` }} />
                    </div>
                    <span className="num" style={{ fontSize: "11px", color: "var(--color-muted)" }}>
                      {t.completion_percentage}%
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
              </Link>
            ))}
            {ACTIVE.length === 0 && (
              <div className="muted-text" style={{ fontSize: "13px", padding: "8px 0" }}>
                You have no active tickets right now.
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile dashboard grid fix */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 900px) {
          .dashboard-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
    </div>
  );
}
