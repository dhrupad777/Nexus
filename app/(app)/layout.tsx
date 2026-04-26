"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Gate the /(app) routes behind auth. Redirect unauthenticated users to /login. */
export default function AppShellLayout({ children }: { children: ReactNode }) {
  const { user, loading, claims } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="auth-shell">
        <p className="muted-text">Loading…</p>
      </div>
    );
  }

  const isAdmin = claims?.role === "PLATFORM_ADMIN";

  return (
    <div className="container" style={{ padding: "32px 24px" }}>
      {isAdmin && (
        <div
          className="row"
          style={{
            justifyContent: "flex-end",
            marginBottom: 16,
            gap: 12,
            fontSize: 13,
          }}
        >
          <Link
            href="/admin/organizations"
            style={{
              fontWeight: 600,
              color: "var(--color-accent, #2563eb)",
              textDecoration: "none",
            }}
          >
            Admin · Pending orgs
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}
