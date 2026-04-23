"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, MapPin, Clock } from "lucide-react";

// Mock Data
const MOCK_TICKETS = [
  {
    id: "TKT-8924",
    title: "Emergency Medical Supplies",
    category: "Medical",
    urgency: "Emergency",
    phase: "Execution",
    location: "Beirut, Lebanon",
    deadline: "24 Oct 2023",
    progress: 45,
  },
  {
    id: "TKT-8921",
    title: "Winter Clothing Drive",
    category: "Clothing",
    urgency: "High",
    phase: "Pledging",
    location: "Amman, Jordan",
    deadline: "30 Oct 2023",
    progress: 75,
  },
  {
    id: "TKT-8890",
    title: "School Rebuilding Fund",
    category: "Infrastructure",
    urgency: "Normal",
    phase: "Closure",
    location: "Gaza",
    deadline: "12 Nov 2023",
    progress: 95,
  },
  {
    id: "TKT-8875",
    title: "Clean Water Initiative",
    category: "WASH",
    urgency: "High",
    phase: "Completed",
    location: "Sana'a, Yemen",
    deadline: "--",
    progress: 100,
  },
  {
    id: "TKT-8842",
    title: "Food Relief Packages",
    category: "Food",
    urgency: "High",
    phase: "Validation",
    location: "Khartoum, Sudan",
    deadline: "05 Nov 2023",
    progress: 10,
  },
];

export default function TicketsPage() {
  const [activeTab, setActiveTab] = useState("All");

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
    <div className="stack" style={{ gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Tickets
        </h1>
        <Link href="/tickets/new" className="btn btn-primary">
          <Plus size={18} /> Raise a ticket
        </Link>
      </div>

      {/* Tabs and Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap", gap: "16px" }}>
        <div className="filter-tabs" style={{ marginBottom: "-1px", borderBottom: "none" }}>
          {["All", "Active", "Pending", "Closed"].map((tab) => (
            <button
              key={tab}
              className={`filter-tab ${activeTab === tab ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div style={{ position: "relative", width: "240px", marginBottom: "12px" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--color-muted)" }} />
          <input 
            type="text" 
            placeholder="Search tickets..." 
            className="input" 
            style={{ paddingLeft: "36px", borderRadius: "var(--radius-pill)" }}
          />
        </div>
      </div>

      {/* Tickets Grid */}
      <div className="tickets-grid">
        {MOCK_TICKETS.map((ticket) => (
          <Link href={`/tickets/${ticket.id}`} key={ticket.id} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div className="ticket-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <span className="badge badge-normal num" style={{ fontSize: "11px" }}>{ticket.id}</span>
                <span className={`badge ${getUrgencyBadgeClass(ticket.urgency)}`}>{ticket.urgency}</span>
              </div>
              
              <h3 className="ticket-card-title">{ticket.title}</h3>
              
              <div className="row muted-text" style={{ fontSize: "13px", marginTop: "4px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={14} /> {ticket.location}
                </span>
                <span className="story-sub-dot">•</span>
                <span>{ticket.category}</span>
              </div>
              
              <div className="row muted-text" style={{ fontSize: "13px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={14} /> {ticket.deadline}
                </span>
              </div>
              
              <div className="stack-sm" style={{ marginTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                  <span className={`badge ${getPhaseBadgeClass(ticket.phase)}`} style={{ padding: "2px 8px", fontSize: "11px" }}>
                    {ticket.phase}
                  </span>
                  <span className="num" style={{ fontWeight: 600 }}>{ticket.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${ticket.progress}%` }}></div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
