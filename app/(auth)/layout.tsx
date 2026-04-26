"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * If a user lands on /login or /signup while already authenticated, send
 * them on to wherever they were heading (?next=) or to /dashboard. Avoids
 * the "you're signed in but we're showing you the login form" footgun.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (loading || !user) return;
    const next = params?.get("next");
    const dest = next && next.startsWith("/") ? next : "/dashboard";
    router.replace(dest);
  }, [loading, user, params, router]);

  return <div className="auth-shell">{children}</div>;
}
