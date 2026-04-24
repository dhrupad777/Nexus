"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function HomeTopbar() {
  const pathname = usePathname();

  return (
    <header className="public-topnav">
      <div className="public-topnav-inner">

        {/* Left — nav links */}
        <nav className="public-topnav-left">
          <Link
            href="/"
            className={`public-topnav-link${pathname === "/" ? " is-active" : ""}`}
          >
            Home
          </Link>
          <Link
            href="/about"
            className={`public-topnav-link${pathname === "/about" ? " is-active" : ""}`}
          >
            About
          </Link>
        </nav>

        {/* Center — Logo */}
        <Link href="/" className="public-topnav-logo">
          NEXUS<span className="home-logo-dot">.</span>
        </Link>

        {/* Right — CTA */}
        <div className="public-topnav-right">
          <Link href="/login" className="btn btn-primary public-topnav-cta">
            Join with us
            <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
          </Link>
        </div>

      </div>
    </header>
  );
}
