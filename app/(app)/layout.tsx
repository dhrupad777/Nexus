"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { auth } from "@/lib/firebase/client";
import { signOut as firebaseSignOut } from "firebase/auth";
import Link from "next/link";
import { Home, Ticket, User, LogOut, Menu, X } from "lucide-react";

export default function AppShellLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Tickets", href: "/tickets", icon: Ticket },
    { name: "Org Profile", href: "/profile", icon: User },
  ];

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
    router.push("/login");
  };

  return (
    <div className="app-shell">
      {/* Mobile Topbar */}
      <div className="app-topbar-mobile">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em" }}>
          NEXUS<span className="home-logo-dot">.</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="btn-ghost" style={{ padding: "8px", border: "none" }}>
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`app-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
        <div style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "24px", letterSpacing: "-0.02em" }}>
            NEXUS<span className="home-logo-dot">.</span>
          </div>
          {isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(false)} className="btn-ghost" style={{ padding: "4px", border: "none", display: "flex", alignItems: "center" }}>
              <X size={20} />
            </button>
          )}
        </div>

        <nav style={{ flex: 1, padding: "0 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsSidebarOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  borderRadius: "var(--radius-md)",
                  color: isActive ? "var(--color-primary)" : "var(--color-text-2)",
                  background: isActive ? "var(--color-primary-soft)" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "14px",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={18} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "20px 16px", borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 8px" }}>
            <div className="chat-avatar" style={{ width: "32px", height: "32px", fontSize: "14px" }}>
              {user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                {user.displayName || "User"}
              </span>
              <span style={{ fontSize: "11px", color: "var(--color-muted)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                {user.email}
              </span>
            </div>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost" style={{ justifyContent: "flex-start", width: "100%", border: "none", padding: "10px 16px", color: "var(--color-muted)" }}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-main">
        <div style={{ padding: "32px 24px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
