"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Tag, Box, Activity, CheckCircle2, ChevronRight, Download } from "lucide-react";

// Mock Data
const MOCK_TICKET_DETAILS = {
  id: "TKT-8924",
  title: "Emergency Medical Supplies",
  category: "Medical",
  urgency: "Emergency",
  phase: "Execution",
  location: "Beirut, Lebanon",
  deadline: "24 Oct 2023",
  description: "Immediate requirement for basic trauma kits and essential medicines to support local clinics overwhelmed by recent events. The supplies will be distributed directly to verified healthcare facilities operating in the affected zones.",
  progress: 45,
  needs: [
    { item: "Trauma Kits", category: "Medical", quantity: 500, unit: "kits", valuation: "$25,000", pledged: 350 },
    { item: "Antibiotics", category: "Medical", quantity: 2000, unit: "boxes", valuation: "$15,000", pledged: 2000 },
    { item: "Surgical Masks", category: "PPE", quantity: 10000, unit: "pieces", valuation: "$2,000", pledged: 1000 },
  ],
  timeline: [
    { title: "Moved to Execution", date: "5 hours ago", icon: CheckCircle2, desc: "Sufficient pledges received to begin coordinated delivery." },
    { title: "Pledge received", date: "1 day ago", icon: Box, desc: "Global Health Org pledged 300 Trauma Kits." },
    { title: "Ticket created", date: "2 days ago", icon: Activity, desc: "Initial needs assessment submitted by field team." },
  ],
  contributors: [
    { name: "Global Health Org", type: "NGO", amount: "300 Trauma Kits" },
    { name: "PharmaCare Intl", type: "Corporation", amount: "2000 Antibiotics" },
  ]
};

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const ticketId = resolvedParams.id;
  const [showPledgeForm, setShowPledgeForm] = useState(false);

  // In a real app, we would fetch ticket details using ticketId.
  // For now, we just use the mock data.
  const ticket = { ...MOCK_TICKET_DETAILS, id: ticketId };

  const getUrgencyBadgeClass = (urgency: string) => {
    switch (urgency) {
      case "Emergency": return "badge-emergency";
      case "High": return "badge-primary";
      default: return "badge-normal";
    }
  };

  const getPhaseBadgeClass = (phase: string) => {
    switch (phase) {
      case "Completed": return "badge-success";
      case "Execution": return "badge-emergency";
      case "Pledging": return "badge-primary";
      default: return "badge-normal";
    }
  };

  return (
    <div className="ticket-detail">
      {/* Top Nav */}
      <div>
        <Link href="/tickets" className="btn-link" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <ArrowLeft size={16} /> Back to tickets
        </Link>
      </div>

      {/* Header Section */}
      <div className="card stack" style={{ gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div className="stack-sm">
            <div className="row">
              <span className="badge badge-normal num">{ticket.id}</span>
              <span className={`badge ${getPhaseBadgeClass(ticket.phase)}`}>{ticket.phase}</span>
              <span className={`badge ${getUrgencyBadgeClass(ticket.urgency)}`}>{ticket.urgency}</span>
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.01em", marginTop: "8px" }}>
              {ticket.title}
            </h1>
          </div>
          <div className="row" style={{ gap: "12px" }}>
            <button className="btn btn-ghost">Share</button>
            <button className="btn btn-primary" onClick={() => setShowPledgeForm(!showPledgeForm)}>
              Contribute
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", padding: "16px 0", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
          <div className="row muted-text">
            <Tag size={16} /> <span>{ticket.category}</span>
          </div>
          <div className="row muted-text">
            <MapPin size={16} /> <span>{ticket.location}</span>
          </div>
          <div className="row muted-text">
            <Clock size={16} /> <span>{ticket.deadline}</span>
          </div>
        </div>

        <div className="stack-sm">
          <h3 style={{ fontSize: "15px", fontWeight: 600 }}>Description</h3>
          <p style={{ color: "var(--color-text-2)", lineHeight: 1.6 }}>{ticket.description}</p>
        </div>
      </div>

      {showPledgeForm && (
        <div className="card stack animate-fade-in-up" style={{ border: "1px solid var(--color-primary)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Make a Pledge</h3>
          <p className="muted-text">Select the items you can provide towards this ticket.</p>
          <div className="form-row">
            <label className="label">Resource</label>
            <select className="select">
              <option>Select an item to pledge...</option>
              {ticket.needs.map((n, i) => (
                <option key={i} disabled={n.pledged >= n.quantity}>
                  {n.item} ({n.quantity - n.pledged} {n.unit} remaining)
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="label">Quantity</label>
            <input type="number" className="input" placeholder="Amount" />
          </div>
          <div className="form-row">
            <label className="label">Notes / Delivery Details</label>
            <textarea className="textarea" placeholder="Provide any logistics details..." style={{ minHeight: "80px" }} />
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: "8px" }}>
            <button className="btn btn-ghost" onClick={() => setShowPledgeForm(false)}>Cancel</button>
            <button className="btn btn-primary">Submit Pledge</button>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: "24px" }} className="dashboard-main-grid">
        
        {/* Left Column */}
        <div className="stack" style={{ gap: "24px" }}>
          
          {/* Needs Table */}
          <div className="card stack" style={{ padding: "0", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Resource Needs</h2>
            </div>
            <div className="needs-table-container">
              <table className="needs-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Required</th>
                    <th>Pledged</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.needs.map((need, idx) => {
                    const percent = Math.round((need.pledged / need.quantity) * 100);
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{need.item}</td>
                        <td className="num">{need.quantity} <span className="muted-text" style={{ fontSize: "12px" }}>{need.unit}</span></td>
                        <td className="num">{need.pledged}</td>
                        <td style={{ minWidth: "120px" }}>
                          <div className="stack-sm" style={{ gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                              <span className="num">{percent}%</span>
                            </div>
                            <div className="progress-bar" style={{ height: "4px" }}>
                              <div className="progress-fill" style={{ width: `${Math.min(100, percent)}%`, background: percent >= 100 ? "var(--color-success)" : "var(--color-primary)" }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contributors */}
          <div className="card stack">
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Contributors</h2>
            <div className="stack">
              {ticket.contributors.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < ticket.contributors.length - 1 ? "1px solid var(--color-border-strong)" : "none" }}>
                  <div className="stack-sm" style={{ gap: "2px" }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span className="muted-text" style={{ fontSize: "12px" }}>{c.type}</span>
                  </div>
                  <span className="badge badge-normal">{c.amount}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="stack" style={{ gap: "24px" }}>
          
          {/* Progress Summary */}
          <div className="card stack" style={{ gap: "16px", background: "var(--color-surface-2)" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 600 }}>Overall Progress</h3>
            <div className="stack-sm">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <span className="num" style={{ fontSize: "32px", fontWeight: 700, lineHeight: 1 }}>{ticket.progress}%</span>
                <span className="muted-text" style={{ fontSize: "13px", paddingBottom: "4px" }}>Funded / Pledged</span>
              </div>
              <div className="progress-bar" style={{ height: "8px" }}>
                <div className="progress-fill" style={{ width: `${ticket.progress}%` }}></div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card stack">
            <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Activity Timeline</h3>
            <div className="timeline" style={{ marginTop: "8px" }}>
              {ticket.timeline.map((event, i) => {
                const Icon = event.icon;
                return (
                  <div key={i} className="timeline-item stack-sm" style={{ gap: "2px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{event.title}</span>
                      <span className="muted-text num" style={{ fontSize: "12px" }}>{event.date}</span>
                    </div>
                    <span className="muted-text" style={{ fontSize: "13px", lineHeight: 1.4 }}>{event.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documentation */}
          <div className="card stack">
            <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Documentation</h3>
            <div className="stack" style={{ gap: "8px" }}>
              <button className="btn btn-ghost" style={{ justifyContent: "space-between", padding: "12px 16px" }}>
                <div className="row"><Download size={16} /> Needs_Assessment.pdf</div>
                <ChevronRight size={16} />
              </button>
              <button className="btn btn-ghost" style={{ justifyContent: "space-between", padding: "12px 16px" }}>
                <div className="row"><Download size={16} /> Verification_Report.pdf</div>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

        </div>

      </div>

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
