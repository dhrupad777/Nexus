"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

type Props = {
  index: number;
  title: string;
  meta: string;
  isLive?: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function ActivityRow({ index, title, meta, isLive = false }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5%" });

  return (
    <motion.div
      ref={ref}
      className="live-row"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, delay: index * 0.08, ease: EASE }}
    >
      <span className={`live-row-dot${isLive ? " is-live" : ""}`} aria-hidden="true" />
      <div className="live-row-body">
        <span className="live-row-title">{title}</span>
        <span className="live-row-meta">{meta}</span>
      </div>
    </motion.div>
  );
}
