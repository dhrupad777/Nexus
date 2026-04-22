"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { NexusLogo } from "./NexusLogo";

export function HomeTopbar() {
  const { user, loading } = useAuth();
  const joinHref = loading ? "/login" : user ? "/onboard" : "/login?next=/onboard";
  return (
    <header className="home-topbar">
      <Link href="/" style={{ textDecoration: "none" }}>
        <NexusLogo size="sm" />
      </Link>
      <Link href={joinHref} className="btn btn-primary" style={{ padding: "8px 14px" }}>
        Join us
      </Link>
    </header>
  );
}
