"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const TICKET = {
  id: "T-0421",
  title: "300 school bags · Monsoon relief camp",
  severity: "Crisis",
  totalPct: 72,
};

const CONTRIBUTORS = [
  { name: "Goonj", pct: 30, live: false },
  { name: "CareIndia", pct: 40, live: false },
  { name: "Oxfam India", pct: 2, live: true },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function HeroProductPeek() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <motion.div
      ref={ref}
      className="hero-peek"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
      aria-label="Live ticket preview"
    >
      <div className="peek-ticket-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="peek-ticket-id num">#{TICKET.id}</span>
          <span className="peek-ticket-title">{TICKET.title}</span>
        </div>
        <span className="badge badge-emergency">{TICKET.severity}</span>
      </div>

      <div className="peek-progress-row">
        <div className="peek-progress-meta">
          <span className="peek-progress-label">Fulfillment</span>
          <span className="num" style={{ color: "var(--color-text)", fontWeight: 600 }}>
            {TICKET.totalPct}%
          </span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={TICKET.totalPct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="progress-fill"
            initial={reduce ? { width: `${TICKET.totalPct}%` } : { width: 0 }}
            animate={inView ? { width: `${TICKET.totalPct}%` } : {}}
            transition={{ type: "spring", stiffness: 60, damping: 20, delay: 0.2 }}
            style={{ willChange: "width" }}
          />
        </div>
      </div>

      <div className="peek-contributors">
        {CONTRIBUTORS.map((c, i) => (
          <motion.div
            key={c.name}
            className="peek-contributor"
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.5 + i * 0.1, ease: EASE }}
          >
            <span className="peek-contributor-name">
              {c.live && <span className="peek-live-dot" aria-hidden="true" />}
              {c.name}
            </span>
            <span className="peek-contributor-pct num">{c.pct}%</span>
          </motion.div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span className="peek-live-chip">
          <span className="peek-live-dot" aria-hidden="true" />
          Live
        </span>
      </div>
    </motion.div>
  );
}
