import Link from "next/link";
import { HeroProductPeek } from "./HeroProductPeek";

export function HeroSection() {
  return (
    <section className="hero-v2" id="product">
      <div className="hero-v2-inner">
        <div>
          <h1 className="hero-title-v2">
            Route resources to where they&apos;re needed
            <span className="hero-accent"> in minutes</span>, not weeks.
          </h1>
          <p className="hero-subtitle-v2">
            NEXUS is how verified NGOs and organizations fulfill tickets together,
            live. Atomic multi-org pledges, AI-matched resources, transparent audit
            trail.
          </p>
          <div className="hero-actions-v2">
            <Link href="/signup" className="btn btn-primary">
              Get Started
            </Link>
            <Link href="/about" className="btn-link-ghost">
              Learn more →
            </Link>
          </div>
        </div>
        <HeroProductPeek />
      </div>
    </section>
  );
}
