"use client";

import { useCallback, useEffect, useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

const ADMIN_EMAIL = "dhrupadrajpurohit@gmail.com";

interface PendingOrg {
  id: string;
  name: string;
  type: string;
  contactEmail: string | null;
  region: string | null;
  ownerEmail: string | null;
  createdAt: number | null;
}

/**
 * Standalone platform-admin page. Lives outside the (app) route group,
 * so it has its own auth surface — Google sign-in directly on the page,
 * no redirect to /login. Only `dhrupadrajpurohit@gmail.com` is allowed
 * to act; everyone else sees an "access denied" screen.
 *
 * Calls same-origin Next.js API routes (`/api/admin/pending`,
 * `/api/admin/approve`) which run server-side with firebase-admin.
 * No Cloud Function callable, no CORS preflight, no Cloud Run IAM.
 */
export default function AdminPage() {
  const { user, loading } = useAuth();
  const [orgs, setOrgs] = useState<PendingOrg[] | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const refetch = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/pending", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { orgs: PendingOrg[] };
      setOrgs(data.orgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setOrgs([]);
    }
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    void refetch();
  }, [isAdmin, refetch]);

  async function approve(orgId: string) {
    if (!user) return;
    setActing(orgId);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActing(null);
    }
  }

  async function onSignIn() {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  async function onSignOut() {
    await signOut(auth);
    setOrgs(null);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card stack" style={{ maxWidth: 720, width: "100%" }}>
        <header className="stack-sm">
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Platform admin
          </h1>
          <p className="muted-text" style={{ fontSize: 13 }}>
            Restricted to <code>{ADMIN_EMAIL}</code>. Approving an org sets its status to ACTIVE
            and grants the owner their <code>{"{role, orgId}"}</code> claims.
          </p>
        </header>

        {loading && <p className="muted-text">Loading…</p>}

        {!loading && !user && (
          <div className="stack-sm">
            <p className="muted-text">Sign in with Google to continue.</p>
            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={onSignIn}
              disabled={signingIn}
            >
              {signingIn ? "Opening…" : "Sign in with Google"}
            </button>
          </div>
        )}

        {!loading && user && !isAdmin && (
          <div className="stack-sm">
            <strong style={{ color: "var(--color-danger, #dc2626)" }}>Access denied</strong>
            <p className="muted-text" style={{ fontSize: 13 }}>
              You&apos;re signed in as <code>{user.email}</code>. This page is restricted to{" "}
              <code>{ADMIN_EMAIL}</code>.
            </p>
            <button type="button" className="btn btn-ghost" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        )}

        {!loading && user && isAdmin && (
          <>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <span className="muted-text">
                Signed in as <strong>{user.email}</strong>
              </span>
              <button type="button" className="btn btn-ghost" onClick={onSignOut}>
                Sign out
              </button>
            </div>

            {error && (
              <div
                className="card"
                style={{
                  borderColor: "var(--color-danger, #dc2626)",
                  background: "rgba(220, 38, 38, 0.08)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {orgs === null && <p className="muted-text">Loading pending organizations…</p>}

            {orgs !== null && orgs.length === 0 && (
              <div className="card stack-sm" style={{ textAlign: "center" }}>
                <strong>No pending organizations</strong>
                <p className="muted-text" style={{ fontSize: 13 }}>
                  New onboarding submissions appear here. Hit <em>Refresh</em> to re-check.
                </p>
                <button type="button" className="btn btn-ghost" onClick={() => void refetch()}>
                  Refresh
                </button>
              </div>
            )}

            {orgs !== null && orgs.length > 0 && (
              <div className="stack-sm">
                {orgs.map((org) => (
                  <div key={org.id} className="card stack-sm">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div className="stack-sm" style={{ minWidth: 0, flex: 1 }}>
                        <div className="row" style={{ gap: 6, alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--color-muted-bg, #e5e7eb)",
                            }}
                          >
                            {org.type}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-warn, #d97706)" }}>
                            PENDING_REVIEW
                          </span>
                        </div>
                        <h3 style={{ fontWeight: 600, fontSize: 17, margin: 0 }}>{org.name}</h3>
                        <span className="muted-text" style={{ fontSize: 12 }}>
                          {org.ownerEmail ?? org.contactEmail ?? "—"}
                          {org.region ? ` · ${org.region}` : ""}
                          {org.createdAt ? ` · ${new Date(org.createdAt).toLocaleDateString()}` : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={acting === org.id}
                        onClick={() => approve(org.id)}
                      >
                        {acting === org.id ? "Approving…" : "Approve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
