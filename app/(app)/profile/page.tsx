"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { CheckCircle2, ShieldCheck, MapPin, Globe, FileText, Download, Building2, HelpCircle } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { user } = useAuth();
  
  // Mock data for the profile
  const orgName = "Global Health Initiative";
  const orgType = "NGO";
  const location = "Geneva, Switzerland";
  const website = "https://example.org";
  const verified = true;
  
  return (
    <div className="stack" style={{ gap: "32px" }}>
      {/* Header Profile Section */}
      <div className="card stack" style={{ gap: "24px" }}>
        <div className="profile-header">
          <div className="chat-avatar" style={{ width: "80px", height: "80px", fontSize: "32px", background: "var(--color-surface-2)", color: "var(--color-primary)", border: "1px solid var(--color-border)" }}>
            <Building2 size={40} />
          </div>
          
          <div className="stack-sm" style={{ flex: 1, gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.01em" }}>
                {orgName}
              </h1>
              {verified && (
                <span className="badge badge-success" style={{ padding: "4px 10px" }}>
                  <ShieldCheck size={14} /> Platform Verified
                </span>
              )}
            </div>
            
            <div className="row muted-text" style={{ flexWrap: "wrap", gap: "16px" }}>
              <span className="row"><Building2 size={16} /> {orgType}</span>
              <span className="row"><MapPin size={16} /> {location}</span>
              <span className="row"><Globe size={16} /> <a href={website} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Website</a></span>
            </div>
          </div>
          
          <div>
            <button className="btn btn-ghost">Edit Profile</button>
          </div>
        </div>
        
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px" }}>About Organization</h3>
          <p style={{ color: "var(--color-text-2)", lineHeight: 1.6, maxWidth: "800px" }}>
            Dedicated to providing rapid medical response and sustainable healthcare solutions in crisis zones globally. 
            Registered non-profit operating since 2010 with a focus on emergency trauma care and communicable disease prevention.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        
        {/* Reliability Score */}
        <div className="card stack" style={{ gap: "20px" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Reliability Score</h2>
            <HelpCircle size={16} className="muted-text" />
          </div>
          
          <div className="reliability-gauges">
            <div className="gauge">
              <span className="stat-label">Fulfilment</span>
              <span className="stat-value num">98%</span>
              <div className="progress-bar" style={{ width: "100%", height: "4px", marginTop: "4px" }}>
                <div className="progress-fill" style={{ width: "98%", background: "var(--color-success)" }}></div>
              </div>
            </div>
            <div className="gauge">
              <span className="stat-label">Quality</span>
              <span className="stat-value num">95%</span>
              <div className="progress-bar" style={{ width: "100%", height: "4px", marginTop: "4px" }}>
                <div className="progress-fill" style={{ width: "95%", background: "var(--color-primary)" }}></div>
              </div>
            </div>
            <div className="gauge">
              <span className="stat-label">Speed</span>
              <span className="stat-value num">92%</span>
              <div className="progress-bar" style={{ width: "100%", height: "4px", marginTop: "4px" }}>
                <div className="progress-fill" style={{ width: "92%", background: "var(--color-primary)" }}></div>
              </div>
            </div>
          </div>
          
          <p className="muted-text" style={{ fontSize: "13px" }}>
            Scores are calculated automatically based on successful ticket completions and partner feedback over the last 12 months.
          </p>
        </div>

        {/* Verification Documents */}
        <div className="card stack" style={{ gap: "20px" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Verification Documents</h2>
            <button className="btn-link" style={{ fontSize: "13px" }}>Upload New</button>
          </div>
          
          <div className="documents-list">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
              <div className="row">
                <div style={{ padding: "8px", background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", color: "var(--color-text-2)" }}>
                  <FileText size={20} />
                </div>
                <div className="stack-sm" style={{ gap: "2px" }}>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>NGO_Registration_Cert.pdf</span>
                  <div className="row muted-text" style={{ fontSize: "12px" }}>
                    <CheckCircle2 size={12} color="var(--color-success)" /> Verified on 12 Jan 2023
                  </div>
                </div>
              </div>
              <button className="btn-ghost" style={{ padding: "6px", border: "none", borderRadius: "50%" }}><Download size={16} /></button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
              <div className="row">
                <div style={{ padding: "8px", background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", color: "var(--color-text-2)" }}>
                  <FileText size={20} />
                </div>
                <div className="stack-sm" style={{ gap: "2px" }}>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>Tax_Exempt_Status.pdf</span>
                  <div className="row muted-text" style={{ fontSize: "12px" }}>
                    <CheckCircle2 size={12} color="var(--color-success)" /> Verified on 12 Jan 2023
                  </div>
                </div>
              </div>
              <button className="btn-ghost" style={{ padding: "6px", border: "none", borderRadius: "50%" }}><Download size={16} /></button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
