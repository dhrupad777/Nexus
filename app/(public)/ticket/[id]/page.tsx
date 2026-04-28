import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, MapPin, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { HomeTopbar } from "../../_components/HomeTopbar";

export const revalidate = 60;

type Phase =
  | "RAISED"
  | "OPEN_FOR_CONTRIBUTIONS"
  | "EXECUTION"
  | "PENDING_SIGNOFF"
  | "CLOSED";

interface TicketDoc {
  hostOrgId: string;
  host: { name: string; type: "NGO" | "ORG" };
  title: string;
  description: string;
  category: string;
  rapid: boolean;
  urgency: "NORMAL" | "EMERGENCY";
  needs: Array<{
    resourceCategory: string;
    subtype?: string;
    quantity: number;
    unit: string;
    valuationINR: number;
    progressPct: number;
  }>;
  geo: { adminRegion: string };
  phase: Phase;
  progressPct: number;
  participantOrgIds: string[];
  createdAt: number;
  phaseChangedAt: number;
  closedAt: number | null;
  coverImageUrl?: string;
}

interface BadgeDoc {
  ticketId: string;
  orgId: string;
  role: "HOST" | "CONTRIBUTOR";
  contributedValuationINR: number;
  proportionalSharePct: number;
  scorePct: number;
}

interface ContributionDoc {
  contributorOrgId: string;
  status: string;
  offered: {
    kind: string;
    quantity: number;
    unit: string;
    valuationINR: number;
    pctOfNeed: number;
  };
  createdAt: number;
}

function asPhase(v: unknown): Phase {
  return v === "RAISED" ||
    v === "OPEN_FOR_CONTRIBUTIONS" ||
    v === "EXECUTION" ||
    v === "PENDING_SIGNOFF" ||
    v === "CLOSED"
    ? v
    : "OPEN_FOR_CONTRIBUTIONS";
}

function parseTicket(raw: unknown): TicketDoc {
  const d = (raw ?? {}) as Record<string, unknown>;
  const hostRaw = (d.host ?? {}) as { name?: unknown; type?: unknown };
  const host: TicketDoc["host"] = {
    name: typeof hostRaw.name === "string" && hostRaw.name ? hostRaw.name : "—",
    type: hostRaw.type === "NGO" ? "NGO" : "ORG",
  };
  const needs: TicketDoc["needs"] = Array.isArray(d.needs)
    ? d.needs.map((n) => {
        const x = (n ?? {}) as Record<string, unknown>;
        return {
          resourceCategory: String(x.resourceCategory ?? ""),
          subtype: typeof x.subtype === "string" ? x.subtype : undefined,
          quantity: Number(x.quantity ?? 0),
          unit: String(x.unit ?? ""),
          valuationINR: Number(x.valuationINR ?? 0),
          progressPct: Number(x.progressPct ?? 0),
        };
      })
    : [];
  const geoRaw = (d.geo ?? {}) as { adminRegion?: unknown };
  return {
    hostOrgId: typeof d.hostOrgId === "string" ? d.hostOrgId : "",
    host,
    title: typeof d.title === "string" && d.title ? d.title : "(untitled)",
    description: typeof d.description === "string" ? d.description : "",
    category: typeof d.category === "string" ? d.category : "",
    rapid: Boolean(d.rapid),
    urgency: d.urgency === "EMERGENCY" ? "EMERGENCY" : "NORMAL",
    needs,
    geo: {
      adminRegion: typeof geoRaw.adminRegion === "string" ? geoRaw.adminRegion : "—",
    },
    phase: asPhase(d.phase),
    progressPct: Number(d.progressPct ?? 0),
    participantOrgIds: Array.isArray(d.participantOrgIds)
      ? d.participantOrgIds.filter((x): x is string => typeof x === "string")
      : [],
    createdAt: Number(d.createdAt ?? 0),
    phaseChangedAt: Number(d.phaseChangedAt ?? 0),
    closedAt: typeof d.closedAt === "number" ? d.closedAt : null,
    coverImageUrl:
      typeof d.coverImageUrl === "string" && d.coverImageUrl
        ? d.coverImageUrl
        : undefined,
  };
}

function parseBadge(raw: unknown): BadgeDoc {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    ticketId: typeof d.ticketId === "string" ? d.ticketId : "",
    orgId: typeof d.orgId === "string" ? d.orgId : "",
    role: d.role === "HOST" ? "HOST" : "CONTRIBUTOR",
    contributedValuationINR: Number(d.contributedValuationINR ?? 0),
    proportionalSharePct: Number(d.proportionalSharePct ?? 0),
    scorePct: Number(d.scorePct ?? 0),
  };
}

function parseContribution(raw: unknown): ContributionDoc {
  const d = (raw ?? {}) as Record<string, unknown>;
  const offered = (d.offered ?? {}) as Record<string, unknown>;
  return {
    contributorOrgId: String(d.contributorOrgId ?? ""),
    status: String(d.status ?? ""),
    offered: {
      kind: String(offered.kind ?? ""),
      quantity: Number(offered.quantity ?? 0),
      unit: String(offered.unit ?? ""),
      valuationINR: Number(offered.valuationINR ?? 0),
      pctOfNeed: Number(offered.pctOfNeed ?? 0),
    },
    createdAt: Number(d.createdAt ?? 0),
  };
}

interface ProofWithUrl {
  storagePath: string;
  caption: string;
  contentType: string;
  createdAt: number;
  url: string;
}

const loadTicket = cache(async (id: string): Promise<TicketDoc | null> => {
  try {
    const snap = await adminDb.collection("tickets").doc(id).get();
    if (!snap.exists) return null;
    return parseTicket(snap.data());
  } catch {
    return null;
  }
});

async function loadBadges(ticketId: string): Promise<BadgeDoc[]> {
  const snap = await adminDb.collection("badges").where("ticketId", "==", ticketId).get();
  return snap.docs.map((d) => parseBadge(d.data()));
}

async function loadContributions(ticketId: string): Promise<ContributionDoc[]> {
  // Visible-status only — hide PROPOSED/REJECTED from the public view.
  const snap = await adminDb
    .collection("tickets")
    .doc(ticketId)
    .collection("contributions")
    .where("status", "in", ["AGREEMENT_PENDING", "COMMITTED", "EXECUTED", "SIGNED_OFF"])
    .get();
  return snap.docs
    .map((d) => parseContribution(d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function loadOrgNames(orgIds: string[]): Promise<Record<string, string>> {
  if (orgIds.length === 0) return {};
  const refs = orgIds.map((id) => adminDb.collection("organizations").doc(id));
  const docs = await adminDb.getAll(...refs);
  const out: Record<string, string> = {};
  docs.forEach((d) => {
    if (d.exists) out[d.id] = String(d.data()?.name ?? d.id);
  });
  return out;
}

async function loadProofs(ticketId: string): Promise<ProofWithUrl[]> {
  const snap = await adminDb.collection("tickets").doc(ticketId).collection("photoProofs").get();
  const bucket = adminStorage.bucket();
  const expires = Date.now() + 60 * 60 * 1000;
  const items = await Promise.all(
    snap.docs.map(async (d): Promise<ProofWithUrl | null> => {
      const data = d.data();
      const storagePath = String(data.storagePath ?? "");
      if (!storagePath) return null;
      try {
        const [url] = await bucket.file(storagePath).getSignedUrl({ action: "read", expires });
        return {
          storagePath,
          caption: String(data.caption ?? ""),
          contentType: String(data.contentType ?? ""),
          createdAt: Number(data.createdAt ?? 0),
          url,
        };
      } catch {
        return null;
      }
    }),
  );
  return items.filter((p): p is ProofWithUrl => p !== null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ticket = await loadTicket(id);
  if (!ticket) return { title: "Ticket — Nexus" };
  const description = ticket.description.slice(0, 160);
  return {
    title: `${ticket.title} — Nexus`,
    description,
    openGraph: {
      title: ticket.title,
      description,
      type: "article",
      images: ticket.coverImageUrl ? [{ url: ticket.coverImageUrl }] : undefined,
    },
  };
}

const PHASE_ORDER: Phase[] = [
  "RAISED",
  "OPEN_FOR_CONTRIBUTIONS",
  "EXECUTION",
  "PENDING_SIGNOFF",
  "CLOSED",
];

const PHASE_LABEL: Record<Phase, string> = {
  RAISED: "Ticket raised",
  OPEN_FOR_CONTRIBUTIONS: "Open for contributions",
  EXECUTION: "Execution underway",
  PENDING_SIGNOFF: "Awaiting contributor sign-off",
  CLOSED: "Closed",
};

const PHASE_COPY: Record<Phase, string> = {
  RAISED: "The host raised this ticket and described the need.",
  OPEN_FOR_CONTRIBUTIONS:
    "Verified orgs are pledging resources. Contribute or watch the progress.",
  EXECUTION: "Pledged resources are being delivered on the ground.",
  PENDING_SIGNOFF:
    "Delivery wrapped up. Contributors are signing off on what they delivered.",
  CLOSED: "Ticket fulfilled. Impact recorded on the timeline.",
};

const STATUS_LABEL: Record<string, string> = {
  AGREEMENT_PENDING: "Agreement pending",
  COMMITTED: "Committed",
  EXECUTED: "Delivered",
  SIGNED_OFF: "Signed off",
};

export default async function PublicTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await loadTicket(id);
  if (!ticket) notFound();

  const isClosed = ticket.phase === "CLOSED";

  const [badges, contributions, proofs] = await Promise.all([
    isClosed ? loadBadges(id) : Promise.resolve([]),
    isClosed ? Promise.resolve([]) : loadContributions(id),
    isClosed ? loadProofs(id) : Promise.resolve([]),
  ]);

  const orgIds = Array.from(
    new Set([
      ...badges.map((b) => b.orgId),
      ...contributions.map((c) => c.contributorOrgId),
    ].filter(Boolean)),
  );
  const orgNames = await loadOrgNames(orgIds);

  const totalDelivered = badges.reduce(
    (a, b) => a + Number(b.contributedValuationINR ?? 0),
    0,
  );

  const sortedBadges = badges.slice().sort((a, b) => {
    if (a.role === "HOST") return -1;
    if (b.role === "HOST") return 1;
    return (b.proportionalSharePct ?? 0) - (a.proportionalSharePct ?? 0);
  });

  const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(Math.round(v));
  const fmtDate = (ms: number) =>
    ms > 0 ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

  const currentPhaseIdx = PHASE_ORDER.indexOf(ticket.phase);

  // Contribute CTA → /login. After auth, drop them on the in-app ticket
  // detail (/tickets/{id}) where they can actually pledge.
  const contributeHref = `/login?next=${encodeURIComponent(`/tickets/${id}`)}`;

  return (
    <div className="pd-shell">
      <HomeTopbar />
      <main className="pd-main">
        <Link href="/" className="pd-back">
          <ArrowLeft size={14} /> Back to home
        </Link>

        {/* ── Hero ── */}
        <header className="pd-hero">
          {ticket.coverImageUrl && (
            <div className="pd-hero-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ticket.coverImageUrl} alt="" />
              <div className="pd-hero-cover-fade" />
            </div>
          )}
          <div className="pd-hero-meta">
            {ticket.urgency === "EMERGENCY" && (
              <span className="pd-chip pd-chip--rapid">Emergency</span>
            )}
            {isClosed ? (
              <span className="pd-chip pd-chip--closed">
                <span className="pd-chip-dot" /> Closed · {fmtDate(ticket.closedAt ?? 0)}
              </span>
            ) : (
              <span className="pd-chip">
                <span className="pd-chip-dot" /> {PHASE_LABEL[ticket.phase]}
              </span>
            )}
            <span className="pd-chip">
              Hosted by {ticket.host.name} · {ticket.host.type}
            </span>
            <span className="pd-chip">
              <MapPin size={12} /> {ticket.geo.adminRegion}
            </span>
          </div>
          <h1 className="pd-title">{ticket.title}</h1>
          {ticket.description && <p className="pd-desc">{ticket.description}</p>}

          {!isClosed && (
            <div className="pd-cta-row">
              <Link href={contributeHref} className="pd-cta">
                Contribute to this ticket
              </Link>
              <span className="pd-cta-note">
                Sign in or create an org account to pledge resources.
              </span>
            </div>
          )}
        </header>

        {/* ── Impact card (closed only) ── */}
        {isClosed && (
          <div className="pd-impact">
            <div className="pd-impact-l">
              <span className="pd-impact-label">Total impact delivered</span>
              <span className="pd-impact-value">₹{fmt(totalDelivered)}</span>
            </div>
            <div className="pd-impact-meta">
              <div>
                {sortedBadges.length} {sortedBadges.length === 1 ? "participant" : "participants"}
              </div>
              <div>
                {ticket.needs.length} {ticket.needs.length === 1 ? "need" : "needs"} fulfilled
              </div>
            </div>
          </div>
        )}

        {/* ── Progress timeline ── */}
        <section className="pd-section">
          <div className="pd-section-head">
            <h2 className="pd-section-title">Progress so far</h2>
            <p className="pd-section-sub">
              Where this ticket sits in the Nexus workflow.
            </p>
          </div>
          <ol className="pd-timeline">
            {PHASE_ORDER.map((p, i) => {
              const state =
                i < currentPhaseIdx
                  ? "done"
                  : i === currentPhaseIdx
                    ? "current"
                    : "todo";
              const Icon =
                state === "done"
                  ? CheckCircle2
                  : state === "current"
                    ? Loader2
                    : Circle;
              return (
                <li key={p} className={`pd-timeline-item pd-timeline-item--${state}`}>
                  <div className="pd-timeline-dot">
                    <Icon size={16} />
                  </div>
                  <div className="pd-timeline-body">
                    <div className="pd-timeline-head">
                      <span className="pd-timeline-name">{PHASE_LABEL[p]}</span>
                      {p === "RAISED" && ticket.createdAt > 0 && (
                        <span className="pd-timeline-when">{fmtDate(ticket.createdAt)}</span>
                      )}
                      {p === ticket.phase && p !== "RAISED" && ticket.phaseChangedAt > 0 && (
                        <span className="pd-timeline-when">{fmtDate(ticket.phaseChangedAt)}</span>
                      )}
                      {p === "CLOSED" && ticket.closedAt && (
                        <span className="pd-timeline-when">{fmtDate(ticket.closedAt)}</span>
                      )}
                    </div>
                    <p className="pd-timeline-copy">{PHASE_COPY[p]}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ── Needs ── */}
        {ticket.needs.length > 0 && (
          <section className="pd-section">
            <div className="pd-section-head">
              <h2 className="pd-section-title">
                {isClosed ? "What was delivered" : "What's needed"}
              </h2>
              <p className="pd-section-sub">
                Each line is a discrete need. Progress reflects committed and signed-off contributions.
              </p>
            </div>
            <div className="pd-needs-grid">
              {ticket.needs.map((n, i) => {
                const pct = Math.min(100, Math.max(0, n.progressPct));
                return (
                  <div key={i} className="pd-need-card">
                    <div className="pd-need-head">
                      <span className="pd-need-name">
                        {n.resourceCategory}
                        {n.subtype ? ` · ${n.subtype}` : ""}
                      </span>
                      <span className="pd-need-pct">{Math.round(pct)}%</span>
                    </div>
                    <span className="pd-need-qty">
                      <span className="num">{n.quantity}</span> {n.unit}
                      {n.valuationINR > 0 && (
                        <> · ≈ ₹<span className="num">{fmt(n.valuationINR)}</span></>
                      )}
                    </span>
                    <div className="pd-need-bar">
                      <div className="pd-need-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Active contributions (active phases) ── */}
        {!isClosed && contributions.length > 0 && (
          <section className="pd-section">
            <div className="pd-section-head">
              <h2 className="pd-section-title">Contributions so far</h2>
              <p className="pd-section-sub">
                Verified orgs that have pledged toward this ticket.
              </p>
            </div>
            <div className="pd-contrib-grid">
              {contributions.map((c, i) => (
                <div key={i} className="pd-contrib-card">
                  <div className="pd-contrib-head">
                    <span className="pd-contrib-name">
                      {orgNames[c.contributorOrgId] ?? c.contributorOrgId.slice(0, 8)}
                    </span>
                    <span className="pd-contrib-role">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <div className="pd-contrib-stats">
                    <div>
                      <span className="pd-contrib-stat-key">Offered</span>
                      <span className="pd-contrib-stat-val">
                        {fmt(c.offered.quantity)} {c.offered.unit}
                      </span>
                    </div>
                    <div>
                      <span className="pd-contrib-stat-key">Value</span>
                      <span className="pd-contrib-stat-val">
                        ₹{fmt(c.offered.valuationINR)}
                      </span>
                    </div>
                    <div>
                      <span className="pd-contrib-stat-key">Of need</span>
                      <span className="pd-contrib-stat-val">
                        {Math.round(c.offered.pctOfNeed)}%
                      </span>
                    </div>
                  </div>
                  <div className="pd-contrib-bar">
                    <div
                      className="pd-contrib-bar-fill"
                      style={{ width: `${Math.min(100, c.offered.pctOfNeed)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Contributors (closed: from badges) ── */}
        {isClosed && sortedBadges.length > 0 && (
          <section className="pd-section">
            <div className="pd-section-head">
              <h2 className="pd-section-title">Contributors</h2>
              <p className="pd-section-sub">
                Verified orgs that hosted or contributed. Click to view their profile.
              </p>
            </div>
            <div className="pd-contrib-grid">
              {sortedBadges.map((b) => {
                const score = Math.min(100, Math.max(0, Number(b.scorePct ?? 0)));
                const isHost = b.role === "HOST";
                return (
                  <Link
                    key={`${b.orgId}-${b.role}`}
                    href={`/org/${b.orgId}`}
                    className={`pd-contrib-card${isHost ? " pd-contrib-card--host" : ""}`}
                  >
                    <div className="pd-contrib-head">
                      <span className="pd-contrib-name">
                        {orgNames[b.orgId] ?? b.orgId.slice(0, 8)}
                      </span>
                      <span className={`pd-contrib-role${isHost ? " pd-contrib-role--host" : ""}`}>
                        {b.role}
                      </span>
                    </div>
                    <div className="pd-contrib-stats">
                      <div>
                        <span className="pd-contrib-stat-key">Share</span>
                        <span className="pd-contrib-stat-val">
                          {Number(b.proportionalSharePct ?? 0).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="pd-contrib-stat-key">Score</span>
                        <span className="pd-contrib-stat-val">{Math.round(score)}</span>
                      </div>
                      <div>
                        <span className="pd-contrib-stat-key">Value</span>
                        <span className="pd-contrib-stat-val">
                          ₹{fmt(b.contributedValuationINR)}
                        </span>
                      </div>
                    </div>
                    <div className="pd-contrib-bar">
                      <div className="pd-contrib-bar-fill" style={{ width: `${score}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Proofs (closed only) ── */}
        {isClosed && proofs.length > 0 && (
          <section className="pd-section">
            <div className="pd-section-head">
              <h2 className="pd-section-title">Proof of delivery</h2>
              <p className="pd-section-sub">
                Photographs uploaded by the host as evidence of execution.
              </p>
            </div>
            <div className="pd-proof-grid">
              {proofs.map((p, i) => (
                <a
                  key={i}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pd-proof-tile"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption || "Proof of delivery"} loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Bottom CTA (active only) ── */}
        {!isClosed && (
          <section className="pd-cta-bottom">
            <div>
              <h3 className="pd-cta-bottom-title">Want to help?</h3>
              <p className="pd-cta-bottom-sub">
                Sign in with your organisation account to pledge resources or funds against this ticket.
              </p>
            </div>
            <Link href={contributeHref} className="pd-cta">
              Contribute
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
