"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Gate the /(app) routes behind auth. Redirect unauthenticated users to /login. */
export default function AppShellLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
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

  const navLinkStyle = {
    fontWeight: 600,
    color: "var(--color-accent, #2563eb)",
    textDecoration: "none",
  } as const;

  return (
    <div className="container" style={{ padding: "32px 24px" }}>
      <div
        className="row"
        style={{
          justifyContent: "flex-end",
          marginBottom: 16,
          gap: 16,
          fontSize: 13,
        }}
      >
        <Link href="/dashboard" style={navLinkStyle}>
          Dashboard
        </Link>
        <Link href="/profile" style={navLinkStyle}>
          Profile
        </Link>
      </div>
      {children}
    </div>
  );
}
