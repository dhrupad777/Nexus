"use client";

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

  return <div className="container" style={{ padding: "32px 24px" }}>{children}</div>;
}
