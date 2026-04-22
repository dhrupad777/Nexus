"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

type Props = {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  decimals?: number;
};

export function MetricCountUp({ value, prefix = "", suffix = "", label, decimals = 0 }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString("en-IN");

  return (
    <div className="metric-item">
      <span ref={ref} className="metric-item-value num">
        {prefix}{formatted}{suffix}
      </span>
      <span>{label}</span>
    </div>
  );
}
