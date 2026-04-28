"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type Story = {
  id: string;
  photo: string;
  photoAlt: string;
  ticket: string;
  title: string;
  location: string;
  duration: string;
  outcome: string;
  stats: { value: string; label: string }[];
};

// Showcase fallback used until at least one real CLOSED ticket exists with a
// cover image. Once the query below returns ≥1 derived story, the fallback
// disappears entirely. New tickets that close show up here automatically.
const FALLBACK_STORIES: Story[] = [
  {
    id: "child_hunger",
    photo: "/photos/child_hunger.png",
    photoAlt: "Children eating hot midday meals at a community kitchen",
    ticket: "T-0318",
    title: "Daily meals for 612 children, 90 days straight",
    location: "Dharavi, Mumbai",
    duration: "90 days",
    outcome:
      "Akshaya Patra and CareIndia co-funded a community kitchen that served hot midday meals to children through the monsoon school term — closed without a single missed day.",
    stats: [
      { value: "₹18.4L", label: "mobilised" },
      { value: "612", label: "lives impacted" },
      { value: "3", label: "NGOs" },
    ],
  },
  {
    id: "food_crisis",
    photo: "/photos/Food_Crisis.png",
    photoAlt: "Volunteers sorting and loading ration kits for distribution",
    ticket: "T-0402",
    title: "11,840 households fed in the 72 hours after Cyclone Remal",
    location: "Balasore, Odisha",
    duration: "21 days",
    outcome:
      "Goonj, Oxfam India, and Sewa pooled logistics and stock so two-week ration kits reached displaced families inside three days of the crisis ticket opening.",
    stats: [
      { value: "₹42.2L", label: "mobilised" },
      { value: "11,840", label: "lives impacted" },
      { value: "5", label: "NGOs" },
    ],
  },
  {
    id: "flood_rescue",
    photo: "/photos/Flood_Rescue.png",
    photoAlt: "Rescue boats moving through floodwater in a flooded village",
    ticket: "T-0461",
    title: "2,340 displaced rescued and sheltered in 14 days",
    location: "Majuli, Assam",
    duration: "14 days",
    outcome:
      "CareIndia coordinated boats and evacuation volunteers while Doctors for You ran mobile clinics at shelter camps — the entire operation closed inside two weeks.",
    stats: [
      { value: "₹28.7L", label: "mobilised" },
      { value: "2,340", label: "lives impacted" },
      { value: "4", label: "NGOs" },
    ],
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;
const INTERVAL_MS = 7000;

function formatINR(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "₹0";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const days = Math.max(1, Math.round(ms / 86_400_000));
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"}`;
}

function ticketToStory(id: string, t: Record<string, unknown>): Story | null {
  // Story cards are visual — skip closed tickets that never got a cover.
  const cover =
    typeof t.coverImageUrl === "string" && t.coverImageUrl
      ? t.coverImageUrl
      : Array.isArray(t.images) &&
          typeof (t.images as unknown[])[0] === "string" &&
          (t.images as string[])[0]
        ? (t.images as string[])[0]
        : null;
  if (!cover) return null;

  const needs = Array.isArray(t.needs)
    ? (t.needs as Array<Record<string, unknown>>)
    : [];
  const totalValue = needs.reduce(
    (s, n) => s + Number(n.valuationINR ?? 0),
    0,
  );
  const totalQty = needs.reduce((s, n) => s + Number(n.quantity ?? 0), 0);
  const firstUnit =
    typeof needs[0]?.unit === "string" && (needs[0]!.unit as string)
      ? (needs[0]!.unit as string)
      : "units";

  const orgCount = Array.isArray(t.participantOrgIds)
    ? (t.participantOrgIds as unknown[]).length
    : 0;

  const createdAt = Number(t.createdAt ?? 0);
  const closedAt = Number(t.closedAt ?? 0);
  const duration = formatDuration(closedAt - createdAt);

  const geo = (t.geo as { adminRegion?: string } | undefined) ?? {};
  const location =
    typeof geo.adminRegion === "string" && geo.adminRegion.trim()
      ? geo.adminRegion.trim()
      : "—";

  const stats: { value: string; label: string }[] = [
    { value: formatINR(totalValue), label: "mobilised" },
  ];
  if (totalQty > 0) {
    stats.push({
      value: totalQty.toLocaleString("en-IN"),
      label: firstUnit.toLowerCase(),
    });
  }
  stats.push({
    value: String(orgCount),
    label: orgCount === 1 ? "org" : "orgs",
  });

  return {
    id,
    photo: cover,
    photoAlt: typeof t.title === "string" ? t.title : "Closed ticket",
    ticket: `T-${id.slice(0, 6).toUpperCase()}`,
    title: typeof t.title === "string" && t.title ? t.title : "Untitled",
    location,
    duration,
    outcome: typeof t.description === "string" ? t.description : "",
    stats,
  };
}

export function FeaturedStoryShow() {
  const reduce = useReducedMotion();
  const [liveStories, setLiveStories] = useState<Story[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live subscription to closed tickets — most-recently-closed first.
  useEffect(() => {
    const q = query(
      collection(db, "tickets"),
      where("phase", "==", "CLOSED"),
      orderBy("closedAt", "desc"),
      limit(8),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Story[] = [];
        for (const d of snap.docs) {
          const s = ticketToStory(d.id, d.data() as Record<string, unknown>);
          if (s) out.push(s);
        }
        setLiveStories(out);
      },
      // On any read error, leave liveStories as-is — the fallback shows by
      // default, so the page never goes blank.
      () => setLiveStories([]),
    );
    return unsub;
  }, []);

  const stories = useMemo<Story[]>(
    () =>
      liveStories && liveStories.length > 0 ? liveStories : FALLBACK_STORIES,
    [liveStories],
  );

  // Reset index if the active story disappeared (ticket count shrank).
  useEffect(() => {
    if (index >= stories.length) setIndex(0);
  }, [stories.length, index]);

  useEffect(() => {
    if (reduce || paused || stories.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % stories.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduce, paused, stories.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight")
        setIndex((i) => (i + 1) % stories.length);
      if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + stories.length) % stories.length);
    }
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [stories.length]);

  return (
    <section
      ref={containerRef}
      className="story-shell"
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Nexus impact stories"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="story-stack">
        {stories.map((story, i) => {
          const active = i === index;
          return (
            <motion.article
              key={story.id}
              className="story-card"
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 0.8, ease: EASE }}
              style={{
                pointerEvents: active ? "auto" : "none",
                zIndex: active ? 2 : 1,
              }}
              aria-hidden={!active}
              aria-label={`Story ${i + 1} of ${stories.length}: ${story.title}`}
            >
              <div className="story-photo">
                <Image
                  src={story.photo}
                  alt={story.photoAlt}
                  fill
                  sizes="(min-width: 1100px) 600px, (min-width: 760px) 80vw, 100vw"
                  priority={i === 0}
                  unoptimized={story.photo.startsWith("https://")}
                />
              </div>
              <div className="story-content">
                <div className="story-meta">
                  <span className="story-ticket num">#{story.ticket}</span>
                  <span className="badge badge-success">
                    <Check size={12} strokeWidth={3} /> Fulfilled
                  </span>
                </div>
                <h2 className="story-title">{story.title}</h2>
                <div className="story-sub">
                  <span>{story.location}</span>
                  <span className="story-sub-dot" aria-hidden>·</span>
                  <span>{story.duration}</span>
                </div>
                <p className="story-outcome">{story.outcome}</p>
                <div className="story-stats">
                  {story.stats.map((s) => (
                    <div key={s.label} className="story-stat">
                      <span className="story-stat-value num">{s.value}</span>
                      <span className="story-stat-label">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="story-controls">
        <button
          type="button"
          className="story-nav-btn"
          aria-label="Previous story"
          onClick={() =>
            setIndex((i) => (i - 1 + stories.length) % stories.length)
          }
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <nav className="story-dots" aria-label="Story navigation">
          {stories.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`story-dot${i === index ? " is-active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Show story ${i + 1}`}
              aria-current={i === index}
            />
          ))}
        </nav>
        <button
          type="button"
          className="story-nav-btn"
          aria-label="Next story"
          onClick={() => setIndex((i) => (i + 1) % stories.length)}
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}
