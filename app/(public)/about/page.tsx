import Link from "next/link";
import { HomeTopbar } from "../_components/HomeTopbar";
import { NexusLogo } from "../_components/NexusLogo";

export default function AboutPage() {
  return (
    <div className="home-shell">
      <HomeTopbar />
      <main style={{ padding: "96px 24px 64px", maxWidth: 720, margin: "0 auto" }}>
        <div className="stack" style={{ gap: 24 }}>
          <NexusLogo size="md" />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            What Nexus is.
          </h1>
          <p style={{ fontSize: 18, color: "var(--color-text-2)", lineHeight: 1.6 }}>
            Nexus is a collaborative resource-allocation platform connecting
            government-verified NGOs and organizations. Only verified entities
            can register; individuals cannot. Every pledge is a bilateral
            agreement, every delivery is photographed, every contribution is
            publicly attributed.
          </p>
          <p style={{ fontSize: 16, color: "var(--color-muted)", lineHeight: 1.6 }}>
            Two flows, one platform: <strong>steady</strong> — agreement-first
            allocation for non-urgent work; and <strong>rapid</strong> — instant
            broadcast + pledge-first commitment for emergency response.
          </p>
          <div className="row" style={{ gap: 12, marginTop: 8 }}>
            <Link href="/login?next=/onboard" className="btn btn-primary">
              Register your organization
            </Link>
            <Link href="/" className="btn btn-ghost">Back home</Link>
          </div>
        </div>
      </main>
      <footer className="home-footer">
        <span>© Nexus.</span>
      </footer>
    </div>
  );
}
