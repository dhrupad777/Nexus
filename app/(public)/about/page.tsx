import Link from "next/link";
import { HomeTopbar } from "../_components/HomeTopbar";

export default function AboutPage() {
  return (
    <div className="landing-shell">
      <HomeTopbar />

      <main className="about-shell">
        {/* Ambient */}
        <div className="landing-blob landing-blob-1" aria-hidden style={{ opacity: 0.4 }} />

        <div className="about-inner">
          {/* Label */}
          <div className="landing-eyebrow" style={{ justifyContent: "center" }}>
            <span className="landing-eyebrow-dot" />
            Our mission
          </div>

          <h1 className="about-headline">What Nexus is.</h1>

          <p className="about-lead">
            Nexus is a collaborative resource-allocation platform connecting
            government-verified NGOs and organisations. Only verified entities
            can register — individuals cannot.
          </p>

          {/* Two pillars */}
          <div className="about-pillars">
            <div className="about-pillar">
              <h3 className="about-pillar-title">Rapid</h3>
              <p className="about-pillar-body">
                Instant broadcast + pledge-first commitment for emergency response. When a crisis ticket opens, verified organisations can pledge resources within minutes.
              </p>
            </div>
            <div className="about-pillar">
              <h3 className="about-pillar-title">Steady</h3>
              <p className="about-pillar-body">
                Agreement-first allocation for non-urgent, planned work. Every pledge is a bilateral agreement, every delivery is photographed, every contribution is publicly attributed.
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="about-values">
            {[
              { stat: "180+", label: "Verified organisations" },
              { stat: "3,200+", label: "Tickets fulfilled" },
              { stat: "₹12 Cr", label: "Mobilised & tracked" },
              { stat: "100%", label: "Publicly attributed" },
            ].map((v) => (
              <div key={v.label} className="about-stat">
                <span className="about-stat-value">{v.stat}</span>
                <span className="about-stat-label">{v.label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="about-cta-row">
            <Link href="/login?next=/onboard" className="btn btn-primary landing-btn-lg">
              Register your organisation
            </Link>
            <Link href="/" className="btn btn-ghost landing-btn-lg">
              Back home
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-footer-logo">
              NEXUS<span className="home-logo-dot">.</span>
            </span>
            <span className="landing-footer-motto">Aid coordinated. Lives changed.</span>
          </div>
          <div className="landing-footer-socials">
            <a href="https://twitter.com/nexusaid" target="_blank" rel="noopener noreferrer" className="landing-social-link" aria-label="Twitter / X">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
            </a>
            <a href="https://instagram.com/nexusaid" target="_blank" rel="noopener noreferrer" className="landing-social-link" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a href="https://linkedin.com/company/nexusaid" target="_blank" rel="noopener noreferrer" className="landing-social-link" aria-label="LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
          <div className="landing-footer-bottom">
            <span>© {new Date().getFullYear()} Nexus. All rights reserved.</span>
            <div className="landing-footer-links">
              <Link href="/about">About</Link>
              <Link href="/login">Sign in</Link>
              <Link href="/login?next=/onboard">Register</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
