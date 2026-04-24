"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin, Building2, Users } from "lucide-react";
import { HomeTopbar } from "../../../_components/HomeTopbar";
import { getTicketById, phaseLabel, type MockTicket, type ContributorStatus } from "@/lib/data/tickets";

const FALLBACK_TICKET: MockTicket = {
  id: "TKT-0000",
  title: "Flood relief — Kolhapur, food + shelter",
  category: "Crisis",
  subtype: "Natural disaster",
  description: "Immediate food and shelter support for families displaced by flooding.",
  location: "Kolhapur, Maharashtra",
  distance_km: 0,
  host_entity: "Verified NGO Partner",
  host_verification_status: "VERIFIED",
  mode: "RAPID",
  urgency_level: "EMERGENCY",
  phase: "EXECUTION",
  ticket_status: "ACTIVE",
  deadline: "Auto-expires in 23h 56m",
  image: "/ticket-food.jpg",
  needs: [
    { resource: "Food kits",      unit: "kits",   total_required: 400, total_fulfilled: 208 },
    { resource: "Shelter spaces", unit: "spaces", total_required: 200, total_fulfilled: 104 },
    { resource: "Volunteers",     unit: "people", total_required: 40,  total_fulfilled: 8 },
  ],
  total_required: 640,
  total_fulfilled: 320,
  total_remaining: 320,
  completion_percentage: 52,
  max_contribution_possible: 0,
  contribution_feasibility: false,
  contribution_impact_percentage: 0,
  contributors_list: [],
  contributor_count: 0,
  urgency: "Emergency",
  progress: 52,
};

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

export default function PublicTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const ticket = getTicketById(id) ?? { ...FALLBACK_TICKET, id };
  const isEmergency = ticket.urgency_level === "EMERGENCY";
  const loginHref = `/login?next=/explore/tickets/${ticket.id}`;

  const stats = [
    { value: String(ticket.contributor_count || 0), label: "orgs responding" },
    { value: `${ticket.completion_percentage}%`,    label: "covered" },
    { value: ticket.total_remaining.toLocaleString(), label: "units remaining" },
  ];

  return (
    <div className="landing-shell">
      <HomeTopbar />

      <div className="td-shell" style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 28px 64px", width: "100%" }}>
        <Link href="/" className="td-back">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <header className={`td-header${isEmergency ? " td-header--emergency" : ""}`}>
          <div className="td-header-top">
            <div className="td-header-pills">
              <span className="td-id-pill num">{ticket.id}</span>
              <span className="td-status-pill">
                <span className="td-status-dot" aria-hidden /> {phaseLabel(ticket.phase)}
              </span>
              <span className="td-urgency-label">
                {ticket.urgency_level} · {ticket.category}
                {ticket.mode === "RAPID" ? " · rapid flow" : ""}
              </span>
            </div>
            <span className="td-expires">{ticket.deadline}</span>
          </div>

          <h1 className="td-title">{ticket.title}</h1>

          <div className="td-meta-row">
            <span className="td-meta-item">
              <MapPin size={15} /> {ticket.location}
              {typeof ticket.distance_km === "number" && ticket.distance_km > 0 && (
                <span className="muted-text num" style={{ marginLeft: 6 }}>· {ticket.distance_km} km</span>
              )}
            </span>
            <span className="td-meta-item">
              <Building2 size={15} /> Host: {ticket.host_entity} ({ticket.host_verification_status.toLowerCase()})
            </span>
            <span className="td-meta-item">
              <Users size={15} /> {ticket.contributor_count} contributors
            </span>
          </div>
        </header>

        <div className="td-2col">
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

          <section className="td-card">
            <h2 className="td-card-title">Contribute to this ticket</h2>
            <p className="td-contribute-body">
              Only verified NGOs and organisations can pledge. Sign in to review open
              needs and commit resources.
            </p>

            <Link href={loginHref} className="td-pledge-btn" style={{ textDecoration: "none" }}>
              Contribute <ArrowRight size={16} strokeWidth={2.5} />
            </Link>

            <div className="td-stat-grid">
              {stats.map((s) => (
                <div key={s.label} className="td-stat-chip">
                  <span className="td-stat-value num">{s.value}</span>
                  <span className="td-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="td-tabs" role="tablist">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              role="tab"
              aria-selected={i === 0}
              className={`td-tab${i === 0 ? " is-active" : ""}`}
              disabled={i !== 0}
              style={i !== 0 ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            >
              {tab}
            </button>
          ))}
        </div>

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
      </div>
    </div>
  );
}

function statusSlug(s: ContributorStatus) {
  return STATUS_LABEL[s].toLowerCase().replace(/\s+/g, "-");
}
