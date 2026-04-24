"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Clock,
  CheckCircle2,
  HandCoins,
  FileSignature,
  Truck,
  Flag,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  getTicketById,
  phaseLabel,
  statusLabel,
  type MockTicket,
  type ContributorStatus,
} from "@/lib/data/tickets";

type EventKind = "milestone" | "donation" | "update" | "complete";

type TimelineEvent = {
  id: string;
  kind: EventKind;
  title: string;
  detail: string;
  org?: string;
  time: string;
  icon: React.ReactNode;
};

const CONTRIB_VERB: Record<ContributorStatus, string> = {
  PLEDGED: "pledged",
  DELIVERED: "delivered",
  VERIFIED: "delivery verified by host",
};

function buildTimeline(t: MockTicket): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Ticket opened (§3.6 timeline.start_date if available, else synthesized).
  events.push({
    id: "open",
    kind: "milestone",
    title: "Ticket created",
    detail: `${t.host_entity} opened this ${t.mode === "RAPID" ? "rapid" : "structured"} ticket.`,
    time: t.timeline?.start_date ?? "—",
    icon: <Flag size={14} />,
  });

  // Contributors (§3.4)
  for (const c of t.contributors_list) {
    events.push({
      id: `c-${c.org_id}-${c.at}`,
      kind: "donation",
      title: `${CONTRIB_VERB[c.status][0].toUpperCase()}${CONTRIB_VERB[c.status].slice(1)}`,
      org: c.org_name,
      detail: `${c.resource} × ${c.quantity} ${c.unit}.`,
      time: c.at,
      icon: <HandCoins size={14} />,
    });
  }

  // Agreement milestone (§4.4 non-rapid / §5.6 rapid)
  if (t.mode === "NON_RAPID" && t.contributor_count > 0) {
    events.push({
      id: "agreement",
      kind: "update",
      title: "Agreement generated",
      detail: "Multi-party contribution agreement issued for host + contributor sign-off.",
      time: "—",
      icon: <FileSignature size={14} />,
    });
  }

  // Phase transition
  if (t.phase !== "PLANNING") {
    events.push({
      id: "phase-exec",
      kind: "milestone",
      title: "Moved to Execution phase",
      detail: t.execution_plan ?? "Distribution began. Host coordinating on-ground logistics.",
      time: "—",
      icon: <Truck size={14} />,
    });
  }

  // Proof updates (§3.6)
  for (const p of t.proof_updates ?? []) {
    events.push({
      id: `proof-${p.at}`,
      kind: "update",
      title: "Progress update",
      detail: p.note,
      org: p.author,
      time: p.at,
      icon: <CheckCircle2 size={14} />,
    });
  }

  // Closure
  if (t.ticket_status === "COMPLETED") {
    events.push({
      id: "closed",
      kind: "complete",
      title: "Ticket closed",
      detail: "All required resources fulfilled and contributors confirmed usage.",
      time: "—",
      icon: <CheckCircle2 size={14} />,
    });
  }

  return events;
}

export default function TicketProcessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routeId } = use(params);
  const ticket = getTicketById(routeId);

  if (!ticket) {
    return (
      <div className="process-shell">
        <Link href="/dashboard" className="process-back">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div className="td-empty">Ticket {routeId} not found.</div>
      </div>
    );
  }

  const events = buildTimeline(ticket);

  return (
    <div className="process-shell">
      <Link href="/dashboard" className="process-back">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <header className="process-header">
        <div className="process-header-row">
          <div className="stack" style={{ gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span className="num muted-text" style={{ fontSize: "13px" }}>{ticket.id}</span>
              <span className={`badge ${ticket.urgency_level === "EMERGENCY" ? "badge-emergency" : "badge-primary"}`}>
                {phaseLabel(ticket.phase)}
              </span>
              <span className="badge badge-normal">{statusLabel(ticket.ticket_status)}</span>
              {ticket.mode === "RAPID" && (
                <span className="badge badge-emergency" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  <Zap size={10} /> Rapid
                </span>
              )}
            </div>
            <h1 className="process-title">{ticket.title}</h1>
          </div>
          <Link href={`/tickets/${ticket.id}`} className="btn btn-ghost" style={{ fontSize: "13px" }}>
            View full ticket
          </Link>
        </div>

        <div className="process-meta">
          <span className="process-meta-item">
            <MapPin size={14} /> {ticket.location}
            {typeof ticket.distance_km === "number" && ticket.distance_km > 0 && (
              <span className="num" style={{ marginLeft: 4 }}>· {ticket.distance_km} km</span>
            )}
          </span>
          <span className="process-meta-item">
            <Building2 size={14} /> Host: {ticket.host_entity}
            {ticket.host_verification_status === "VERIFIED" && (
              <ShieldCheck size={12} style={{ color: "var(--color-primary)", marginLeft: 2 }} />
            )}
          </span>
          {ticket.timeline && (
            <span className="process-meta-item">
              <Clock size={14} /> {ticket.timeline.start_date} → {ticket.timeline.expected_completion}
            </span>
          )}
        </div>
      </header>

      <div className="process-stats">
        <div className="process-stat">
          <span className="process-stat-value num">{ticket.contributor_count}</span>
          <span className="process-stat-label">contributions</span>
        </div>
        <div className="process-stat">
          <span className="process-stat-value num">{ticket.completion_percentage}%</span>
          <span className="process-stat-label">covered</span>
        </div>
        <div className="process-stat">
          <span className="process-stat-value num">{ticket.total_remaining.toLocaleString()}</span>
          <span className="process-stat-label">units remaining</span>
        </div>
      </div>

      <div className="stack" style={{ gap: "12px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Process timeline</h2>
        <p className="muted-text" style={{ fontSize: "13px" }}>
          Every contribution, signature, and milestone on this ticket — oldest first.
        </p>
      </div>

      <div className="process-timeline">
        {events.map((e) => (
          <div
            key={e.id}
            className={`process-event${
              e.kind === "milestone" ? " process-event--milestone" : ""
            }${e.kind === "complete" ? " process-event--complete" : ""}`}
          >
            <div className="process-event-head">
              <span className="process-event-title" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-primary)" }}>{e.icon}</span>
                {e.title}
              </span>
              <span className="process-event-time num">{e.time}</span>
            </div>
            {e.org && (
              <span className="process-event-org">
                <span className="process-org-avatar">{e.org.charAt(0)}</span>
                {e.org}
              </span>
            )}
            <p className="process-event-detail">{e.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
