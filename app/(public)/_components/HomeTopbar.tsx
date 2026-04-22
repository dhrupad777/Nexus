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
      <div className="topbar-right">
        <nav className="topbar-anchors" aria-label="Page sections">
          <a href="#product" className="topbar-anchor">Product</a>
          <a href="#how" className="topbar-anchor">How it works</a>
          <a href="#about" className="topbar-anchor">Activity</a>
        </nav>
        <Link href={joinHref} className="btn btn-primary" style={{ padding: "8px 14px" }}>
          Join as NGO / ORG
        </Link>
      </div>
    </header>
  );
}
