import { HomeTopbar } from "./_components/HomeTopbar";
import { FeaturedStoryShow } from "./_components/FeaturedStoryShow";
import { TicketCard } from "@/components/TicketCard";
import { MOCK_TICKETS, ACTIVE_PHASES } from "@/lib/data/tickets";

export const revalidate = 30;

export default function HomePage() {
  const activeTickets = MOCK_TICKETS.filter((t) => ACTIVE_PHASES.includes(t.phase));

  return (
    <div className="landing-shell">
      <HomeTopbar />

      {/* ── Impact Stories Carousel ── */}
      <section className="landing-stories-section">
        <FeaturedStoryShow />
      </section>

      {/* ── Active tickets — visible to all visitors ── */}
      <section className="public-tickets-section">
        <div className="public-tickets-head">
          <h2 className="public-tickets-title">Active tickets</h2>
          <p className="public-tickets-sub">
            Open requests from verified NGOs — see where your organisation can help.
          </p>
        </div>
        <div className="tkt-grid">
          {activeTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              hrefBase="/explore/tickets"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
