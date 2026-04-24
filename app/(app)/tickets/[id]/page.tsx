"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Building2,
  Users,
  ShieldCheck,
  Zap,
  TrendingUp,
} from "lucide-react";
import {
  getTicketById,
  phaseLabel,
  type ContributorStatus,
} from "@/lib/data/tickets";

const TABS = ["Contributions", "Proof", "Audit Log"] as const;

const STATUS_LABEL: Record<ContributorStatus, string> = {
  PLEDGED: "PLEDGED",
  DELIVERED: "HOST SIGNED",
  VERIFIED: "FULLY SIGNED",
};

function hueFor(orgId: string): number {
  let h = 0;
  for (let i = 0; i < orgId.length; i++) h = (h * 31 + orgId.charCodeAt(i)) >>> 0;
  return h % 360;
}

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routeId } = use(params);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Contributions");
  const ticket = getTicketById(routeId);

  if (!ticket) {
    return (
      <div className="td-shell">
        <Link href="/tickets" className="td-back">
          <ArrowLeft size={15} /> Back to tickets
        </Link>
        <div className="td-empty">Ticket {routeId} not found.</div>
      </div>
    );
  }

  const isEmergency = ticket.urgency_level === "EMERGENCY";
  const isRapid = ticket.mode === "RAPID";

  return (
    <div className="td-shell">
      <Link href="/tickets" className="td-back">
        <ArrowLeft size={15} /> Back to tickets
      </Link>

      {/* ── Header card ── */}
      <header className={`td-header${isEmergency ? " td-header--emergency" : ""}`}>
        <div className="td-header-top">
          <div className="td-header-pills">
            <span className="td-id-pill num">{ticket.id}</span>
            <span className="td-status-pill">
              <span className="td-status-dot" aria-hidden /> {phaseLabel(ticket.phase)}
            </span>
            <span className="td-urgency-label">
              {ticket.urgency_level} · {ticket.category}
              {ticket.subtype ? ` · ${ticket.subtype}` : ""}
              {isRapid ? " · rapid flow" : " · structured flow"}
            </span>
          </div>
          <span className="td-expires">
            {isRapid ? `auto-expires · ${ticket.deadline}` : `deadline · ${ticket.deadline}`}
          </span>
        </div>

        <h1 className="td-title">{ticket.title}</h1>
        <p className="td-contribute-body" style={{ marginTop: 4 }}>{ticket.description}</p>

        <div className="td-meta-row">
          <span className="td-meta-item">
            <MapPin size={15} /> {ticket.location}
            {typeof ticket.distance_km === "number" && ticket.distance_km > 0 && (
              <span className="muted-text num" style={{ marginLeft: 6 }}>· {ticket.distance_km} km</span>
            )}
          </span>
          <span className="td-meta-item">
            <Building2 size={15} /> Host: {ticket.host_entity}
            {ticket.host_verification_status === "VERIFIED" && (
              <ShieldCheck size={14} style={{ color: "var(--color-primary)", marginLeft: 4 }} />
            )}
          </span>
          <span className="td-meta-item">
            <Users size={15} /> {ticket.contributor_count} contributors
          </span>
        </div>
      </header>

      {/* ── Two-column: Coverage | Contribute ── */}
      <div className="td-2col">
        {/* Overall coverage + needs breakdown (§3.2) */}
        <section className="td-card">
          <div className="td-card-head">
            <h2 className="td-card-title">Overall coverage</h2>
            <span className="td-live">
              <span className="td-live-dot" aria-hidden />
              Live · updates in real time
            </span>
          </div>

          <div className="td-coverage">
            <div className="td-coverage-bar">
              <div className="td-coverage-bar-fill" style={{ width: `${ticket.completion_percentage}%` }} />
            </div>
            <div className="td-coverage-num num">{ticket.completion_percentage}%</div>
          </div>

          <div className="muted-text" style={{ fontSize: "12px", marginBottom: "8px" }}>
            <span className="num">{ticket.total_fulfilled.toLocaleString()}</span> of{" "}
            <span className="num">{ticket.total_required.toLocaleString()}</span> units fulfilled ·{" "}
            <span className="num">{ticket.total_remaining.toLocaleString()}</span> remaining
          </div>

          <div className="td-resources">
            {ticket.needs.map((n) => {
              const pct = n.total_required > 0 ? Math.round((n.total_fulfilled / n.total_required) * 100) : 0;
              return (
                <div key={n.resource} className="td-resource">
                  <div className="td-resource-head">
                    <span className="td-resource-name">{n.resource}</span>
                    <span className="td-resource-count num">
                      {n.total_fulfilled} / {n.total_required} {n.unit}
                    </span>
                  </div>
                  <div className="td-resource-bar">
                    <div className="td-resource-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Contribute — per-entity context (§3.3) */}
        <section className="td-card">
          <h2 className="td-card-title">Contribute to this ticket</h2>
          <p className="td-contribute-body">
            {isRapid
              ? "Rapid flow: resources reflect immediately. Agreement generated post-execution (§5.6)."
              : "Structured flow: agreement must be signed before action (§4.4)."}
          </p>

          <div className="stack" style={{ gap: "6px", margin: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span className="muted-text">You can contribute up to</span>
              <span className="num" style={{ fontWeight: 600 }}>
                {ticket.max_contribution_possible.toLocaleString()} units
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span className="muted-text" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <TrendingUp size={12} /> Your impact
              </span>
              <span className="num" style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                +{ticket.contribution_impact_percentage}%
              </span>
            </div>
          </div>

          <button
            type="button"
            className="td-pledge-btn"
            disabled={!ticket.contribution_feasibility}
            style={!ticket.contribution_feasibility ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            {ticket.contribution_feasibility ? (
              <>
                Pledge resources to this ticket <ArrowRight size={16} strokeWidth={2.5} />
              </>
            ) : (
              <>No matching capacity available</>
            )}
          </button>

          <div className="td-stat-grid">
            <div className="td-stat-chip">
              <span className="td-stat-value num">{ticket.contributor_count}</span>
              <span className="td-stat-label">orgs responding</span>
            </div>
            <div className="td-stat-chip">
              <span className="td-stat-value num">{ticket.completion_percentage}%</span>
              <span className="td-stat-label">covered</span>
            </div>
            <div className="td-stat-chip">
              <span className="td-stat-value num">{ticket.total_remaining.toLocaleString()}</span>
              <span className="td-stat-label">units remaining</span>
            </div>
          </div>

          {isRapid && (
            <div className="badge badge-emergency" style={{ marginTop: "10px", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Zap size={11} /> Rapid mode active
            </div>
          )}
        </section>
      </div>

      {/* ── Tabs ── */}
      <div className="td-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`td-tab${activeTab === tab ? " is-active" : ""}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === "Contributions" && (
        <div className="td-contrib-list">
          {ticket.contributors_list.length === 0 ? (
            <div className="td-empty">No contributions yet.</div>
          ) : (
            ticket.contributors_list.map((c) => (
              <div key={`${c.org_id}-${c.at}`} className="td-contrib-row">
                <div
                  className="td-contrib-avatar"
                  style={{ "--av-hue": hueFor(c.org_id) } as React.CSSProperties}
                >
                  {c.org_name.charAt(0)}
                </div>
                <div className="td-contrib-info">
                  <span className="td-contrib-org">{c.org_name}</span>
                  <span className="td-contrib-detail">
                    {c.resource} × {c.quantity} {c.unit}
                  </span>
                </div>
                <span className={`td-contrib-status td-contrib-status--${statusSlug(c.status)}`}>
                  {STATUS_LABEL[c.status]}
                </span>
                <span className="td-contrib-time">{c.at}</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "Proof" && (
        ticket.proof_updates && ticket.proof_updates.length > 0 ? (
          <div className="stack" style={{ gap: "10px" }}>
            {ticket.proof_updates.map((p, i) => (
              <div key={i} className="td-contrib-row" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{p.author ?? "Host"}</span>
                <span className="td-contrib-detail">{p.note}</span>
                <span className="td-contrib-time">{p.at}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="td-empty">No proof uploads yet.</div>
        )
      )}

      {activeTab === "Audit Log" && (
        <div className="td-empty">No audit events to show.</div>
      )}
    </div>
  );
}

function statusSlug(s: ContributorStatus) {
  return STATUS_LABEL[s].toLowerCase().replace(/\s+/g, "-");
}
