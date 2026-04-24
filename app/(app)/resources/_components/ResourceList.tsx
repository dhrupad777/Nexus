"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { EmbeddingStatus, ResourceCategory, ResourceStatus } from "@/lib/schemas";
import { useOrgStatus } from "../_lib/useOrgStatus";

type Row = {
  id: string;
  category: ResourceCategory;
  title: string;
  quantity: number;
  unit: string;
  valuationINR: number;
  status: ResourceStatus;
  embeddingStatus: EmbeddingStatus | undefined;
  createdAt: number;
};

const EMBED_LABEL: Record<EmbeddingStatus, { label: string; tone: string }> = {
  pending: { label: "Embedding…", tone: "var(--color-warn)" },
  ok:      { label: "Embedded",    tone: "var(--color-accent)" },
  failed:  { label: "Embed failed", tone: "var(--color-danger)" },
};

function formatINR(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

export function ResourceList() {
  const { user, loading, claims } = useAuth();
  const orgStatus = useOrgStatus(claims?.orgId ?? null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const searchParams = useSearchParams();
  const justCreatedId = searchParams.get("new");

  useEffect(() => {
    if (justCreatedId) {
      toast.success(`New resource added. It will be matchable once embedding finishes.`);
    }
  }, [justCreatedId]);

  useEffect(() => {
    if (!claims?.orgId) return;
    const q = query(
      collection(db, "resources"),
      where("orgId", "==", claims.orgId),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Row[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            category: data.category,
            title: data.title ?? "",
            quantity: Number(data.quantity ?? 0),
            unit: String(data.unit ?? ""),
            valuationINR: Number(data.valuationINR ?? 0),
            status: data.status ?? "AVAILABLE",
            embeddingStatus: data.embeddingStatus,
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setRows(out);
      },
      (err) => toast.error(`Couldn't load resources: ${err.message}`),
    );
    return unsub;
  }, [claims?.orgId]);

  if (loading || orgStatus.loading) return <p className="muted-text">Loading…</p>;
  if (!user) return <p className="muted-text">Sign in to view your resources.</p>;
  if (!claims?.orgId) {
    return (
      <div className="card stack">
        <p className="muted-text">Finish onboarding to start listing resources.</p>
        <Link href="/onboard" className="btn btn-primary">Go to onboarding</Link>
      </div>
    );
  }

  const canAdd = orgStatus.status === "ACTIVE";

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Resources
          </h1>
          <p className="muted-text">Everything your org has listed. Matches re-rank automatically as new tickets land.</p>
        </div>
        {canAdd ? (
          <Link href="/resources/new" className="btn btn-primary">+ New resource</Link>
        ) : (
          <span className="badge badge-normal" title="Wait for platform admin approval">
            {orgStatus.status === "PENDING_REVIEW" ? "Pending review" : orgStatus.status ?? "—"}
          </span>
        )}
      </div>

      {rows === null ? (
        <p className="muted-text">Loading your resources…</p>
      ) : rows.length === 0 ? (
        <div className="card stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <strong>No resources yet</strong>
          <p className="muted-text">List your first resource to appear in matching.</p>
          {canAdd && <Link href="/resources/new" className="btn btn-primary">List a resource</Link>}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "var(--color-surface-2, #f6f7f9)" }}>
                <th style={th}>Title</th>
                <th style={th}>Category</th>
                <th style={th}>Qty</th>
                <th style={th}>Valuation</th>
                <th style={th}>Status</th>
                <th style={th}>Embedding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const embed = r.embeddingStatus ? EMBED_LABEL[r.embeddingStatus] : null;
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--color-border, #e5e7eb)" }}>
                    <td style={td}><strong>{r.title}</strong></td>
                    <td style={td}>{r.category}</td>
                    <td style={td}>{r.quantity} {r.unit}</td>
                    <td style={td}>₹{formatINR(r.valuationINR)}</td>
                    <td style={td}>{r.status}</td>
                    <td style={td}>
                      {embed ? (
                        <span style={{ color: embed.tone, fontWeight: 500 }}>{embed.label}</span>
                      ) : (
                        <span className="muted-text">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", fontSize: 13, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 14, verticalAlign: "middle" };
