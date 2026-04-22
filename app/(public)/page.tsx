import { HomeTopbar } from "./_components/HomeTopbar";
import { FeaturedStoryShow } from "./_components/FeaturedStoryShow";

export const revalidate = 30;

export default function HomePage() {
  return (
    <div className="landing-shell">
      <HomeTopbar />
      <main className="landing-main">
        <FeaturedStoryShow />
      </main>
    </div>
  );
}
