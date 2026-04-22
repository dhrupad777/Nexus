import { MetricCountUp } from "./MetricCountUp";

export function MetricsStrip() {
  return (
    <section className="metrics-strip" aria-label="Platform impact metrics">
      <MetricCountUp value={2.4} prefix="₹" suffix="Cr" label="mobilised" decimals={1} />
      <MetricCountUp value={14000} suffix="+" label="lives impacted" />
      <MetricCountUp value={85} label="verified NGOs" />
      <MetricCountUp value={320} label="active needs" />
    </section>
  );
}
