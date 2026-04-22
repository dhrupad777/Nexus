import { Activity, Sparkles, Siren } from "lucide-react";

const MOMENTS = [
  {
    icon: Activity,
    label: "Live fulfillment",
    line: "Fractional pledges from multiple orgs land atomically on the same ticket.",
  },
  {
    icon: Sparkles,
    label: "AI matching",
    line: "Vertex Vector Search suggests verified resources in under two seconds.",
  },
  {
    icon: Siren,
    label: "Crisis triage",
    line: "Gemini turns a photo and a line of text into a structured ticket draft.",
  },
];

export function MomentsStrip() {
  return (
    <section className="moments-strip" id="how" aria-label="Signature features">
      {MOMENTS.map(({ icon: Icon, label, line }) => (
        <div key={label} className="moment-col">
          <Icon className="moment-icon" aria-hidden="true" />
          <span className="moment-label">{label}</span>
          <span className="moment-line">{line}</span>
        </div>
      ))}
    </section>
  );
}
