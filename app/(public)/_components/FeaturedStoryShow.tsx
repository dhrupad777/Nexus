"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

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

const STORIES: Story[] = [
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

export function FeaturedStoryShow() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % STORIES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduce, paused]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % STORIES.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + STORIES.length) % STORIES.length);
    }
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

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
        {STORIES.map((story, i) => {
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
              aria-label={`Story ${i + 1} of ${STORIES.length}: ${story.title}`}
            >
              <div className="story-photo">
                <Image
                  src={story.photo}
                  alt={story.photoAlt}
                  fill
                  sizes="(min-width: 1100px) 1080px, 100vw"
                  priority={i === 0}
                />
                <div className="story-photo-scrim" aria-hidden />
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
          onClick={() => setIndex((i) => (i - 1 + STORIES.length) % STORIES.length)}
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <nav className="story-dots" aria-label="Story navigation">
          {STORIES.map((s, i) => (
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
          onClick={() => setIndex((i) => (i + 1) % STORIES.length)}
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}
