"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ArrowRight, Activity, CalendarDays, CheckCircle2 } from "lucide-react";

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
          <p className="muted-text">Here's what's happening in your network today.</p>
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
      <div className="dashboard-grid">
        <div className="stat-card">
          <span className="stat-label">Active Tickets</span>
          <span className="stat-value">12</span>
          <span className="badge badge-primary" style={{ alignSelf: "flex-start", marginTop: "4px" }}>3 pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Contributions</span>
          <span className="stat-value num">48</span>
          <span className="badge badge-success" style={{ alignSelf: "flex-start", marginTop: "4px" }}>This month</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Reliability Score</span>
          <span className="stat-value">98<span style={{ fontSize: "18px", color: "var(--color-muted)" }}>%</span></span>
          <span className="muted-text" style={{ fontSize: "12px", marginTop: "4px" }}>Top 5% of network</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Impact</span>
          <span className="stat-value num">14.2<span style={{ fontSize: "18px", color: "var(--color-muted)" }}>k</span></span>
          <span className="muted-text" style={{ fontSize: "12px", marginTop: "4px" }}>People reached</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: "24px" }} className="dashboard-main-grid">
        {/* Recent Tickets Table */}
        <div className="card stack" style={{ gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Recent Tickets</h2>
            <Link href="/tickets" className="btn-link" style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Phase</th>
                  <th>Deadline</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="stack" style={{ gap: "2px" }}>
                      <span style={{ fontWeight: 600 }}>Emergency Medical Supplies</span>
                      <span className="muted-text num" style={{ fontSize: "12px" }}>TKT-8924</span>
                    </div>
                  </td>
                  <td><span className="badge badge-emergency">Execution</span></td>
                  <td><span className="muted-text num">24 Oct</span></td>
                  <td><Link href="/tickets/TKT-8924" className="btn-link">View</Link></td>
                </tr>
                <tr>
                  <td>
                    <div className="stack" style={{ gap: "2px" }}>
                      <span style={{ fontWeight: 600 }}>Winter Clothing Drive</span>
                      <span className="muted-text num" style={{ fontSize: "12px" }}>TKT-8921</span>
                    </div>
                  </td>
                  <td><span className="badge badge-primary">Pledging</span></td>
                  <td><span className="muted-text num">30 Oct</span></td>
                  <td><Link href="/tickets/TKT-8921" className="btn-link">View</Link></td>
                </tr>
                <tr>
                  <td>
                    <div className="stack" style={{ gap: "2px" }}>
                      <span style={{ fontWeight: 600 }}>School Rebuilding Fund</span>
                      <span className="muted-text num" style={{ fontSize: "12px" }}>TKT-8890</span>
                    </div>
                  </td>
                  <td><span className="badge badge-normal">Closure</span></td>
                  <td><span className="muted-text num">12 Nov</span></td>
                  <td><Link href="/tickets/TKT-8890" className="btn-link">View</Link></td>
                </tr>
                <tr>
                  <td>
                    <div className="stack" style={{ gap: "2px" }}>
                      <span style={{ fontWeight: 600 }}>Clean Water Initiative</span>
                      <span className="muted-text num" style={{ fontSize: "12px" }}>TKT-8875</span>
                    </div>
                  </td>
                  <td><span className="badge badge-success">Completed</span></td>
                  <td><span className="muted-text num">--</span></td>
                  <td><Link href="/tickets/TKT-8875" className="btn-link">View</Link></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card stack" style={{ gap: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Activity Feed</h2>
          
          <div className="timeline">
            <div className="timeline-item">
              <div className="stack" style={{ gap: "4px" }}>
                <span style={{ fontSize: "14px", lineHeight: 1.4 }}>
                  <strong style={{ color: "var(--color-text)" }}>Red Cross</strong> pledged 500 blankets to <strong style={{ color: "var(--color-primary)" }}>TKT-8921</strong>
                </span>
                <span className="muted-text" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Activity size={12} /> 2 hours ago
                </span>
              </div>
            </div>
            <div className="timeline-item">
              <div className="stack" style={{ gap: "4px" }}>
                <span style={{ fontSize: "14px", lineHeight: 1.4 }}>
                  Ticket <strong style={{ color: "var(--color-primary)" }}>TKT-8924</strong> moved to Execution phase
                </span>
                <span className="muted-text" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <CheckCircle2 size={12} /> 5 hours ago
                </span>
              </div>
            </div>
            <div className="timeline-item">
              <div className="stack" style={{ gap: "4px" }}>
                <span style={{ fontSize: "14px", lineHeight: 1.4 }}>
                  Deadline extended for <strong style={{ color: "var(--color-primary)" }}>TKT-8890</strong>
                </span>
                <span className="muted-text" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <CalendarDays size={12} /> 1 day ago
                </span>
              </div>
            </div>
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
