import { ActivityRow } from "./ActivityRow";

export function ActivityFeed() {
  const activities = [
    {
      title: "Medical Supplies for Flood Relief Camp",
      meta: "Fulfilled by CareIndia · 2 hours ago",
    },
    {
      title: "500 Ration Kits for Cyclone Evacuees",
      meta: "Fulfilled by Goonj · 5 hours ago",
    },
    {
      title: "Emergency Tents and Tarpaulins",
      meta: "Fulfilled by Oxfam India · 1 day ago",
    },
  ];

  return (
    <section className="live-feed" id="about" aria-label="Recent activity">
      <h2 className="live-feed-header">
        <span className="peek-live-dot" aria-hidden="true" />
        Live on Nexus
      </h2>
      <div className="live-feed-list">
        {activities.map((a, i) => (
          <ActivityRow key={i} index={i} title={a.title} meta={a.meta} isLive={i === 0} />
        ))}
      </div>
    </section>
  );
}
