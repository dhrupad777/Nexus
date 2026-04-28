# NEXUS

**Collaborative resource-allocation platform for verified NGOs and Organizations — with an emergency bypass for crisis response.**

---

## The problem

India has over 3 million registered NGOs, yet humanitarian needs go under-fulfilled because:

1. **Matching fails** — the right resource-holder is never connected to the right request in time.
2. **Scale fails** — a single organization rarely has the budget to solo-fulfill a large request, so the request dies instead of being split.
3. **Speed fails** — rigid verification protocols trade response time for safety during crises.

NEXUS is a coordination layer that removes all three failure modes.

---

## What NEXUS does

Verified NGOs and Organizations (Companies, Hospitals, Trust Funds) raise **tickets** for quantified needs. Any other verified entity can pledge a **fractional** percentage. The work starts the moment the first pledge lands; the ticket closes when 100% is committed and signed off.

Two flows share the same data model:

### Flow A — Non-Rapid (default)
Agreement-first. Pledges go `PROPOSED → AGREEMENT_PENDING → COMMITTED` only after both parties sign a generated Google Doc. Progress only ticks forward post-signature. Best for planned, durable contributions.

### Flow B — Rapid / Emergency
Pledges commit **instantly** — `commitPath: "PLEDGE_FIRST"`. The system broadcasts the ticket to every eligible org with FCM push (no ranked top-K). Agreements are optional and generated **post-hoc** during sign-off for record-keeping. Hard expiry in 12h / 24h / 48h. Used for floods, medical emergencies, fires.

The behavior switch is keyed off `ticket.urgency === "EMERGENCY"` and is **immutable after creation**.

---

## Key mechanics

- **Hard verification upfront** — 80G/12A/PAN for NGOs; GST/CIN/PAN for Organizations. Document AI extracts fields; Platform Admin approves `PENDING_REVIEW → ACTIVE`. No individuals.
- **Capability-driven UI** — every entity can both *request* and *contribute*. `org.intent` (`GET | PROVIDE | BOTH`) only reorders dashboard panels; it never gates actions.
- **Multi-need tickets** — `tickets.needs[]` is an array, so one emergency ticket can request 300 food kits + 200 shelter + 30 volunteers, each tracking its own `progressPct`.
- **Hybrid AI matching** — deterministic geo + capacity filters, then Gemini semantic ranking on Vertex Vector Search embeddings. Score weights locked: `0.5 semantic + 0.2 geo + 0.2 capacity + 0.1 reliability`. Every match carries an explainable `reason` string.
- **Reliability scores** — three stage-specific scores per org (Agreement / Execution / Closure), 0–100, decay `-1/day` past SLA, recover on-time. Publicly visible on org profile. Agreement Reliability does not decay on rapid tickets.
- **Public closed-ticket feed** — closed tickets and badges are world-readable; everything else is denied to unauthenticated clients.
- **Append-only audit log** — every state mutation writes a hash-chained `auditLog` entry. AI output is never authoritative for state changes.

---

## Ticket lifecycle

```
RAISED → OPEN_FOR_CONTRIBUTIONS → EXECUTION → PENDING_SIGNOFF → CLOSED
```

Host can advance to EXECUTION early (≥30% on Flow A; no floor on Flow B). Photo proofs are uploaded during EXECUTION. Contributors sign off in PENDING_SIGNOFF; any DISPUTED sign-off routes to Platform Admin. On CLOSED, badges are minted for host + each contributor and published to the public feed.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TS strict) |
| Styling | Tailwind v4 + shadcn/ui |
| Forms / validation | react-hook-form + zod (schemas shared client↔server) |
| Data | TanStack Query + Firestore realtime listeners |
| Auth | Firebase Auth + custom claims (`role`, `orgId`) |
| DB / Storage | Cloud Firestore + Cloud Storage (region `asia-south1`) |
| Triggers | Cloud Functions 2nd gen (TS) |
| REST surface | Cloud Run (Hono) |
| Agreements | Google Docs API (template → filled → signed → PDF snapshot) |
| AI reasoning | Gemini 2.x via `@google-cloud/vertexai` |
| AI matching | Vertex AI Vector Search + `text-embedding-004` |
| AI doc verification | Document AI (80G / 12A / PAN / GST / CIN) |
| Messaging | Firebase Cloud Messaging (emergency broadcast) |
| Security | App Check (reCAPTCHA Enterprise), Secret Manager, Firestore rules-unit-testing |
| Hosting | Firebase App Hosting (Next.js SSR) |

**Out of scope for MVP:** blockchain, real payments, native mobile (PWA only), real-time chat, full i18n.

---

## Repo layout

```
nexus/                  Next.js 16 app (this folder)
  app/                  App Router routes
  components/           shadcn/ui + custom components
  lib/schemas/          Zod schemas — single source of truth, client+server
  functions/            Cloud Functions 2nd gen (triggers + scheduled jobs)
../Niraj/               Product brief, design system, alignment narrative, ticket fields
../Albin/               Onboarding + entity/resource data model
../OVERVIEW_NEXUS.md    Source-of-truth document (read first)
```

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Local Firebase emulators (recommended before any deploy):

```bash
npx firebase emulators:start
```

Build + type-check before deploying:

```bash
npm run build
```

---

## Demo path (the golden flow)

1. Public home feed at `/` shows two seeded CLOSED tickets with badges.
2. Sign up as NGO → Gemini onboarding chat → Document AI extracts → Admin approves → ACTIVE.
3. NGO raises a normal ticket pledging 50%. Org B pledges → bilateral agreement signed → progress ticks. NGO C closes the gap → EXECUTION → photos → sign-off → CLOSED → badge on public feed.
4. Platform Admin clicks **Simulate Crisis** → emergency ticket raised → seeded orgs receive FCM within 2s → instant pledges → live progress → host advances → post-hoc agreement → CLOSED.
5. Skip a sign-off deliberately → hourly `reliabilityDecaySweep` → Closure Reliability drops on the public profile.

---

## License

Hackathon project — not yet licensed for production use.
