"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { TicketCard } from "@/components/TicketCard";
import { MOCK_TICKETS } from "@/lib/data/tickets";

const TABS = ["All", "Active", "Pending", "Closed"] as const;

export default function TicketsPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [search, setSearch] = useState("");

  const filteredTickets = MOCK_TICKETS.filter((t) => {
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.location.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());

    if (activeTab === "Active")
      return matchesSearch && t.ticket_status === "ACTIVE";
    if (activeTab === "Pending")
      return matchesSearch && t.ticket_status === "OPEN";
    if (activeTab === "Closed")
      return matchesSearch && t.ticket_status === "COMPLETED";
    return matchesSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--color-text)", lineHeight: 1.15 }}>
            Tickets
          </h1>
          <p style={{ fontSize: "13px", color: "var(--color-muted)", marginTop: "3px" }}>
            {MOCK_TICKETS.length} requests across all categories
          </p>
        </div>
        <Link href="/tickets/new" className="btn btn-primary" style={{ gap: "6px" }}>
          <Plus size={16} />
          New ticket
        </Link>
      </div>

      {/* Controls bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "2px", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", padding: "3px" }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "5px 14px",
                borderRadius: "9px",
                border: "none",
                background: activeTab === tab ? "#ffffff" : "transparent",
                color: activeTab === tab ? "var(--color-text)" : "var(--color-muted)",
                fontWeight: activeTab === tab ? 600 : 500,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", width: "220px" }}>
          <Search size={14} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: "var(--color-placeholder)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search…"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "32px", height: "34px", fontSize: "13px", borderRadius: "var(--radius-md)" }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="tkt-grid">
        {filteredTickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>

      {filteredTickets.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--color-muted)", fontSize: "14px" }}>
          No tickets match your filter.
        </div>
      )}
    </div>
  );
}
