import { HomeTopbar } from "./_components/HomeTopbar";
import { HeroSection } from "./_components/HeroSection";
import { MetricsStrip } from "./_components/MetricsStrip";
import { MomentsStrip } from "./_components/MomentsStrip";
import { ActivityFeed } from "./_components/ActivityFeed";

export const revalidate = 30;

export default function HomePage() {
  return (
    <div className="landing-shell">
      <HomeTopbar />
      <main>
        <HeroSection />
        <MetricsStrip />
        <MomentsStrip />
        <ActivityFeed />
      </main>
      <footer className="home-footer">
        <span>© Nexus — a collaborative resource-allocation platform.</span>
      </footer>
    </div>
  );
}
