import { HomeTopbar } from "./_components/HomeTopbar";
import { FeaturedStoryShow } from "./_components/FeaturedStoryShow";
import { RecentlyClosed } from "./_components/RecentlyClosed";

export const revalidate = 30;

export default function HomePage() {
  return (
    <div className="landing-shell">
      <HomeTopbar />
      <main className="landing-main">
        <FeaturedStoryShow />
        <RecentlyClosed />
      </main>
    </div>
  );
}
