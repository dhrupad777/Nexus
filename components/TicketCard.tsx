"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import type { MockTicket } from "@/lib/data/tickets";
import { phaseLabel } from "@/lib/data/tickets";

type Ticket = Pick<
  MockTicket,
  | "id"
  | "title"
  | "category"
  | "location"
  | "deadline"
  | "image"
  | "urgency"
  | "phase"
  | "completion_percentage"
  | "mode"
>;

const URGENCY_CONFIG: Record<string, { label: string; className: string }> = {
  Emergency: { label: "Emergency", className: "tkt-badge tkt-badge--emergency" },
  High:      { label: "High",      className: "tkt-badge tkt-badge--high" },
  Normal:    { label: "Normal",    className: "tkt-badge tkt-badge--normal" },
};

export function TicketCard({
  ticket,
  hrefBase = "/tickets",
}: {
  ticket: Ticket;
  hrefBase?: string;
}) {
  const badge = URGENCY_CONFIG[ticket.urgency] ?? URGENCY_CONFIG.Normal;
  const router = useRouter();
  const href = `${hrefBase}/${ticket.id}`;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();

    // View Transitions API — morphs the card image to the hero image on detail page
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(href);
      });
    } else {
      router.push(href);
    }
  }

  return (
    <a
      href={href}
      className="tkt-card"
      style={{
        textDecoration: "none",
        cursor: "pointer",
        "--tkt-progress": ticket.completion_percentage,
      } as React.CSSProperties}
      onClick={handleClick}
    >
      {/* Thumbnail — tagged for shared-element transition */}
      <div
        className="tkt-thumb"
        style={{ viewTransitionName: `ticket-hero-${ticket.id}` } as React.CSSProperties}
      >
        {ticket.image ? (
          <Image
            src={ticket.image}
            alt={ticket.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1100px) 50vw, 33vw"
            className="tkt-thumb-img"
          />
        ) : (
          <div className="tkt-thumb-placeholder" />
        )}

        {/* Top badges overlay */}
        <div className="tkt-thumb-overlay">
          <span className="tkt-id-chip">{ticket.id}</span>
          <span className={badge.className}>{badge.label}</span>
          {ticket.mode === "RAPID" && <span className="tkt-badge tkt-badge--rapid">Rapid</span>}
        </div>
      </div>

      {/* Info */}
      <div className="tkt-info">
        <p className="tkt-category">{ticket.category} · {ticket.location}</p>
        <h3 className="tkt-title">{ticket.title}</h3>

        {/* Progress row */}
        <div className="tkt-footer">
          <div className="tkt-bar-wrap">
            <div className="tkt-bar-fill" style={{ width: `${ticket.completion_percentage}%` }} />
          </div>
          <div className="tkt-footer-meta">
            <span className="tkt-phase">{phaseLabel(ticket.phase)}</span>
            <span className="tkt-pct">{ticket.completion_percentage}%</span>
          </div>
        </div>
      </div>
    </a>
  );
}
