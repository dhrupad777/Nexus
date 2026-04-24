# NEXUS — build list, phased (tracked)

Living todo. Edit freely — when you tweak a feature, update the line here
and the checkbox. Three phases; each is self-contained and demoable on its
own, and each one's outputs become the next one's inputs.

**Legend**
- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[-]` dropped / deferred
- **FE** = Next.js route / component  • **BE** = Cloud Functions / rules
- **DATA** = Firestore schema / indexes / seed  • **EXT** = external API

Last updated: 2026-04-24

---

## Phase 1 — Collect the data

**Goal:** an authenticated org admin can create an organization, pass hard
verification, and list their first resources. At end of Phase 1, Firestore
has real orgs and resources — nothing else can happen without this.

### 1.1 Auth → user record
- [x] FE `/signup` + `/login` with Google SSO and email — [app/(auth)/](../app/(auth)/)
- [x] BE first sign-in auto-creates `users/{uid}` with `role: "ORG_ADMIN"`, `orgId: null` — [lib/auth/actions.ts](../lib/auth/actions.ts)
- [x] Auth-gated `(app)` shell that redirects unauthenticated users → `/login` — [app/(app)/layout.tsx](../app/(app)/layout.tsx)

### 1.2 Onboarding flow
- [ ] FE `/onboarding/form` — classic form fallback (build this FIRST, it's the safety net)
- [ ] FE `/onboarding` — Gemini chat surface (EXT: `@google/genai`)
- [ ] BE callable `onboardingChat` — validates each turn against `OnboardingTurnOutputSchema`; one retry on parse failure, then client falls back to form — stub at [functions/src/callables/onboardingChat.ts](../functions/src/callables/onboardingChat.ts)
- [ ] BE callable `completeOnboarding` — writes `organizations/{orgId}` with `status: "PENDING_REVIEW"`, sets `users/{uid}.orgId`
- [ ] FE `PENDING_REVIEW` banner on `/dashboard` + block `/tickets/new` until ACTIVE

### 1.3 Govt-doc upload + verification
- [ ] FE drop-zone on onboarding step 2 — NGO: 80G / 12A / PAN / REG • ORG: GST / CIN / PAN
- [ ] BE callable `getDocUploadUrl` — returns signed Storage URL scoped to `orgs/{orgId}/govtDocs/`
- [ ] BE trigger `onGovtDocUploaded` — Document AI extracts fields → `organizations.govtDocs[*].extractedFields`  (EXT: Document AI, deferred — manual admin review is MVP fallback)
- [x] BE callable `approveOrg` — flips `status → ACTIVE`, sets custom claims (role, orgId) — [functions/src/callables/approveOrg.ts](../functions/src/callables/approveOrg.ts)
- [x] Storage rules scoped by `orgId` — [storage.rules](../storage.rules)

### 1.4 Resource listing
- [~] FE `/resources` list (TanStack Table) — [app/(app)/resources/page.tsx](../app/(app)/resources/page.tsx)
- [~] FE `/resources/new` form mirroring [lib/schemas/resource.ts](../lib/schemas/resource.ts) — [app/(app)/resources/new/page.tsx](../app/(app)/resources/new/page.tsx); blocks non-ACTIVE orgs
- [~] BE callable `createResource` — validates `ResourceClientWriteSchema`, requires `org.status === "ACTIVE"`, writes doc with `embeddingStatus: "pending"` — [functions/src/callables/createResource.ts](../functions/src/callables/createResource.ts). (Client direct-create is disallowed in rules so the ACTIVE gate can't be skipped.)
- [~] BE trigger `onResourceCreated` — Vertex `text-embedding-004` on category+title+conditions+region → writes `embedding` (768d), `embeddingVersion: "text-embedding-004"`, flips `embeddingStatus` pending→ok; on permanent failure sets `failed` and omits `embedding` — [functions/src/triggers/onResourceCreated.ts](../functions/src/triggers/onResourceCreated.ts) (EXT: Vertex)
- [x] Composite index `(orgId, status)` — [firestore.indexes.json](../firestore.indexes.json)

### 1.5 Platform admin console
- [ ] FE `/admin` — table of orgs where `status === "PENDING_REVIEW"` with Approve button → calls `approveOrg`
- [ ] Gate on `claims.role === "PLATFORM_ADMIN"`
- [ ] Tool/script to bootstrap the first platform admin (`firebase auth:users:set-claims` helper)

**Phase 1 done when:**
1. Can sign up → onboard → upload docs → org appears in admin queue
2. Admin approves → custom claims land → can list resources
3. Firestore has: `organizations` (ACTIVE), `users` (with claims), `resources` (with embeddings)

---

## Phase 2 — Tickets: raise → match → commit → execute → sign off → close

**Goal:** the ticket lifecycle end to end. At the end of Phase 2, a host can
raise a ticket and carry it all the way through `CLOSED`, with both Flow A
(agreement-first) and Flow B (rapid, pledge-first) working.

Depends on Phase 1: no ticket raising without ACTIVE org; no matching
without embedded resources.

### 2.1 Raise a ticket
- [x] FE `/tickets/new` — [app/(app)/tickets/new/page.tsx](../app/(app)/tickets/new/page.tsx)
- [x] BE callable `raiseTicket` — idempotent, valuation-weighted initial progress, sets `rapid` from urgency, writes `phase: OPEN_FOR_CONTRIBUTIONS` — [functions/src/callables/raiseTicket.ts](../functions/src/callables/raiseTicket.ts)
- [x] BE trigger `onTicketCreated` — text-embedding-004 (Gemini API) on title+description+needs → `tickets.embedding` (768d), then chains into Flow A matching for non-rapid tickets — [functions/src/triggers/onTicketCreated.ts](../functions/src/triggers/onTicketCreated.ts)
- [ ] Replace raw lat/lng with Google Maps Places autocomplete (EXT: Maps)
- [x] Schema: extend `needs[].subtype: string?` (e.g. "primary education" inside category EDUCATION). Embedding input string includes subtype when present. — RUBRIC: AI Integration (richer semantic signal). [Albin/Nexus_Ticket_Display_Spec.md §3.1]
- [x] On `raiseTicket` success, denormalize `host: { name, type }` from `organizations/{orgId}` onto the ticket doc so the ticket card never JOINs at read time. (Status is implicit ACTIVE — only ACTIVE orgs can raise; reliability is read separately when needed.) — RUBRIC: Performance + Trust visibility. [Albin spec §3.1]
- [x] Initialize `tickets.participantOrgIds: [hostOrgId]` + `contributorCount: 0` + `lastUpdatedAt: now` on raise. `participantOrgIds` is the single source of truth for the dashboard's Active Tickets query (§2.10) — set semantics, capped at 50, hosts always present; contributors union-added on commit (§2.3). — RUBRIC: Performance (single `array-contains` query for the active-tickets feed). [Albin/Nexus_Dashboard_Logic.md §3.2]

### 2.2 Matching

**Flow A — ranked top-K** (non-emergency):
- [x] BE Flow A pipeline runs from `onTicketCreated` after embedding (non-rapid only) — [functions/src/triggers/onTicketCreated.ts](../functions/src/triggers/onTicketCreated.ts) → `runFlowAMatching`
  - [x] Hard filter: category ∈ needs, geo reachable (haversine for now; Distance Matrix swap is one function call), `terms.availableUntil` ≥ deadline, org ACTIVE, host excluded
  - [x] Semantic rerank: brute-force cosine in-memory against `resources where status == "AVAILABLE"`. (Firestore native `findNearest` is documented in [lib/matching.ts](../functions/src/lib/matching.ts) header as the future swap when seed volume grows.)
  - [x] **Hybrid score (weights LOCKED as constants in [lib/matching.ts](../functions/src/lib/matching.ts)):** `finalScore = 0.5*semanticScore + 0.2*geoScore + 0.2*capacityScore + 0.1*reliabilityScore`
  - [x] Write top-K=10 `matches/{ticketId__orgId}` (deterministic id = idempotent on retry) with `score` (hybrid), `semanticScore` (raw cosine), `reason`, `orgId` denormalized, `topResourceId` (best resource per org). — RUBRIC: Performance (single-query dashboard).
  - [x] Persist display-time projection on `matches/{id}`: `bestNeedIndex`, `maxContributionPossible`, `contributionFeasibility`, `contributionImpactPct`. Dashboard reads them as-is — no recomputation client-side. — RUBRIC: Innovation + UX. [Albin Ticket spec §3.3]
  - [x] Persist `geoDistanceKm` on `matches/{id}` from the same haversine call — ticket card renders "12 km away" with no extra API hit. — RUBRIC: Performance. [Albin spec §3.1]
- [ ] Recommendation exclusions: hide tickets where viewer's org is already in `contributions/` (any status) OR in `tickets/{id}/declines/{orgId}`. New lightweight `decline` callable writes the decline doc only — never mutates progress. — RUBRIC: UX (signal-to-noise on dashboard). [Albin spec §6.5]
- [ ] FUTURE: swap haversine → Maps Distance Matrix once `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is provisioned. Swap brute-force cosine → Firestore `findNearest` once resource count > ~500.

**Flow B — broadcast** (emergency):
- [x] BE trigger `onRapidTicketCreated` — [functions/src/triggers/onRapidTicketCreated.ts](../functions/src/triggers/onRapidTicketCreated.ts)
  - [x] Filter: `resource.emergencyContract.enabled === true`, category ∈ needs, geo reachable (haversine), org ACTIVE, host excluded
  - [x] Write `matches/{id}` with `rapidBroadcast: true` for every passing org (no K cutoff). No semantic ranking. Per-entity projection (`maxContributionPossible`, `contributionFeasibility`, `contributionImpactPct`, `geoDistanceKm`) included so the rapid card has the same UX as the normal card. *(If ranking is ever added to Flow B, weights lock to `0.7 semantic + 0.3 geo`.)*
  - [ ] FCM push when `resource.emergencyContract.autoNotify === true` — deferred (needs FCM token plumbing)
- EXT: FCM (deferred)

**Dashboard:** (full layout + Active Tickets surface live in §2.10; this stub covers only the Recommended-side index)
- [x] FE Recommended panel — [app/(app)/dashboard/_components/RecommendedTicketsList.tsx](../app/(app)/dashboard/_components/RecommendedTicketsList.tsx) — two parallel queries on `matches` for `viewerOrgId`: (a) normal top-10 = `where orgId == X and rapidBroadcast == false order by score desc`; (b) rapid broadcast = `where orgId == X and rapidBroadcast == true order by createdAt desc limit 30` (sorted client-side per spec §5). Cards render fully from match doc fields produced above — single batched ticket-header fetch hydrates the title/host/needs.
- [x] Composite indexes for matches — [firestore.indexes.json](../firestore.indexes.json): `(orgId, rapidBroadcast, score desc)` for normal top-K + existing `(orgId, rapidBroadcast, createdAt desc)` for rapid.

### 2.3 Pledge → commit

**Flow A — AGREEMENT_FIRST:**
- [ ] FE ticket-detail `/tickets/[id]` with "Pledge" CTA per need
- [ ] BE callable `pledge` (App Check enforced) — Flow A path: writes `contributions PROPOSED`, `agreements DRAFTED`, Google Docs template copy + placeholder fill, returns `googleDocUrl` — stub at [functions/src/callables/pledge.ts](../functions/src/callables/pledge.ts)
- [ ] BE callable `signAgreement` — HOST then CONTRIBUTOR marks signature; status progresses `DRAFTED → HOST_SIGNED → FULLY_SIGNED` — stub at [functions/src/callables/signAgreement.ts](../functions/src/callables/signAgreement.ts)
- [ ] BE trigger `onAgreementFullySigned` — contribution → COMMITTED, bump `needs[i].progressPct` + `ticket.progressPct`, append audit — stub at [functions/src/triggers/onAgreementFullySigned.ts](../functions/src/triggers/onAgreementFullySigned.ts)
- [ ] EXT: Google Docs + Drive APIs (template copy + PDF export)

**Flow B — PLEDGE_FIRST:**
- [x] `pledge` callable Flow B branch — [functions/src/callables/pledge.ts](../functions/src/callables/pledge.ts). Asserts `ticket.rapid === true`, single transaction: rejects double-pledge from same org → writes `contributions/{id}` COMMITTED + commitPath PLEDGE_FIRST + bumps `needs[i].progressPct` + recomputes valuation-weighted `progressPct` + denorms aggregates. App Check enforced. Idempotent via `withIdempotency`.

**Denormalization on commit (both flows):**
- [x] In the same transaction that flips a contribution → `COMMITTED`, bump `tickets.contributorCount` (FieldValue.increment) and union-add the contributor's orgId into `tickets.participantOrgIds[]` (FieldValue.arrayUnion). Wired in pledge.ts Flow B branch; Flow A `onAgreementFullySigned` will reuse the same denorm shape when implemented. The contributors strip on ticket detail derives `contributors = participantOrgIds.filter(id => id !== hostOrgId)`. — RUBRIC: Performance. [Albin Ticket spec §3.4 + Dashboard spec §3.2]

### 2.4 Host advances to EXECUTION
- [ ] FE "Move to Execution" CTA (host-only)
- [ ] BE callable `advancePhase` — Flow A floor 30%, Flow B no floor, writes `phase: "EXECUTION"`, `phaseChangedAt`, `advancedEarly` — stub at [functions/src/callables/advancePhase.ts](../functions/src/callables/advancePhase.ts)
- [ ] FE: existing contributors notified via realtime listener on ticket doc

### 2.5 Photo proofs
- [ ] FE upload widget on ticket detail (host-only, EXECUTION only)
- [ ] Storage signed-URL upload to `tickets/{ticketId}/photoProofs/`
- [ ] BE trigger `onPhotoProofUploaded` — touches ticket liveness (recovers execution reliability decay) — stub at [functions/src/triggers/onPhotoProofUploaded.ts](../functions/src/triggers/onPhotoProofUploaded.ts); ALSO writes `tickets/{id}/updates/{updateId}` with `{ kind: "PHOTO_PROOF" | "STATUS_NOTE", caption, authorOrgId, createdAt }`. Builds the spec's "proof_updates" feed; Phase 3's public ticket page reads the same subcollection. — RUBRIC: Alignment (transparent attribution) + Innovation (auditable feed alongside the immutable hash chain). [Albin spec §3.6]

### 2.6 Host closes execution → PENDING_SIGNOFF
- [ ] FE "Execution Done" CTA (requires ≥1 photo proof)
- [ ] `advancePhase` transitions `EXECUTION → PENDING_SIGNOFF`

### 2.7 Signoffs
- [ ] FE per-contributor signoff panel on ticket detail — APPROVE / DISPUTE
- [ ] BE callable `recordSignoff` — writes `tickets/{id}/signoffs/{sid}` — stub at [functions/src/callables/recordSignoff.ts](../functions/src/callables/recordSignoff.ts)
- [ ] BE trigger `onSignoffRecorded` — all APPROVED → `phase: "CLOSED"` (hands off to Phase 3); any DISPUTED → admin review — stub at [functions/src/triggers/onSignoffRecorded.ts](../functions/src/triggers/onSignoffRecorded.ts)

**Flow B post-hoc agreements** (optional, not a gate):
- [ ] BE callable `createPosthocAgreement` — generates record-keeping Google Doc for a PLEDGE_FIRST contribution — stub at [functions/src/callables/createPosthocAgreement.ts](../functions/src/callables/createPosthocAgreement.ts)

### 2.8 Reliability decay
- [ ] BE scheduled `reliabilityDecaySweep` (hourly) — decay math per plan §3; rapid tickets **never** decay Agreement reliability — stub at [functions/src/scheduled/reliabilityDecaySweep.ts](../functions/src/scheduled/reliabilityDecaySweep.ts)
- [ ] BE scheduled `stuckStageSweep` (every 30m) — admin-visible flags, no mutation — stub at [functions/src/scheduled/stuckStageSweep.ts](../functions/src/scheduled/stuckStageSweep.ts)
- [ ] BE scheduled `emergencyExpirySweep` (every 15m) — auto-advance rapid tickets past deadline — stub at [functions/src/scheduled/emergencyExpirySweep.ts](../functions/src/scheduled/emergencyExpirySweep.ts)
- [ ] Surface contributor reliability mini-bars (Agreement / Execution / Closure, 0–100) inline next to each contributor on the ticket-detail contributors strip. Re-uses Phase 3's org-profile reliability component. — RUBRIC: Innovation (reliability decay is the originality centerpiece — surface it everywhere it can be seen, not only on the org profile).

### 2.9 Ticket detail display contract

A single render of `/tickets/[id]` reads only: ticket doc + `needs[]` + `matches/{viewerOrgId}` (optional) + `contributions/*` + `updates/*`. No further API calls. This is the contract that proves Phase 2's denormalizations are right.

- [x] FE component `TicketDetail` — [app/(app)/tickets/[id]/_components/TicketDetail.tsx](../app/(app)/tickets/[id]/_components/TicketDetail.tsx). Renders: title; host name + NGO/ORG type tag; urgency pill (rapid only); location; phase tag; geoDistanceKm from match; per-need rows [required | fulfilled | remaining | progress bar]; **"Your contribution potential"** panel from match doc; PledgeForm CTA (Flow B only — Flow A degraded with explanatory copy); contributors strip with batched org-name hydration. (Reliability mini-bars + proof gallery + updates feed deferred to §2.8 / §2.5 slices.)
- [x] Empty/edge states per spec §9: "Your contribution potential" hidden when viewer is host or has no match doc; PledgeForm hidden when already pledged or wrong phase; "ticket not found" card with back-to-dashboard.
- [ ] axe DevTools clean — keyboard nav, semantic landmarks, AA contrast on urgency tag and progress bars. — RUBRIC: UX/Accessibility. (Not yet manually verified — basic semantic markup is in place.)
- [x] FE component [PledgeForm](../app/(app)/tickets/[id]/_components/PledgeForm.tsx) — defaults to match's `bestNeedIndex` + `maxContributionPossible` for one-click pledge; calls `callPledge`; toasts result; idempotent via stable per-mount requestId.

### 2.10 Dashboard display contract

`/dashboard` renders two surfaces against the viewer's orgId in **three Firestore queries fired in parallel** (one tickets + two matches sub-queries — normal vs rapid). Mirrors the §2.9 contract for ticket detail. Contract enforces "uniform code, smooth data transfer": both surfaces read the same denormalized fields produced by §2.1 / §2.2 / §2.3 — no separate read paths. Per `Albin/Nexus_Dashboard_Logic.md`.

#### Two-surface layout (spec §2)
- **Recommended Tickets** (primary, AI-driven) — sourced from `matches/*` filtered by `orgId == viewerOrgId`. Already wired in §2.2.
- **Active Tickets** (secondary, state-driven) — sourced from `tickets/*` filtered by `participantOrgIds array-contains viewerOrgId`.

#### Active Tickets feed (spec §3)
- [x] FE component `ActiveTicketsList` — single Firestore query: `tickets where participantOrgIds array-contains viewerOrgId order by lastUpdatedAt desc limit 50`. — [app/(app)/dashboard/_components/ActiveTicketsList.tsx](../app/(app)/dashboard/_components/ActiveTicketsList.tsx)
- [x] DATA composite index on `tickets`: `(participantOrgIds, lastUpdatedAt desc)` — added to [firestore.indexes.json](../firestore.indexes.json).
- [x] Per-card derived `role` (HOST | CONTRIBUTOR) = `ticket.hostOrgId === viewerOrgId ? HOST : CONTRIBUTOR`. Pure client function; no schema field. — RUBRIC: Performance (zero extra reads).
- [x] Per-card derived `displayStatus`: `pending_contribution | active_execution | awaiting_confirmation | completed`. Pure function over `ticket.phase` (current proxy uses phase only — adding contribution-state nuance is a follow-up needing a per-card contribution lookup). [spec §3.6] — [_lib/activeTicket.ts](../app/(app)/dashboard/_lib/activeTicket.ts)
- [x] Sort priority (client-side, after the array fetch — no second query): phase=EXECUTION first, then PENDING_SIGNOFF, then recently updated. — [_lib/activeTicket.ts](../app/(app)/dashboard/_lib/activeTicket.ts) `sortKey`
- [ ] Per-role action panel (spec §3.7): HOST gets {update progress (server-driven, not manual), upload proof, manage contributions, close}; CONTRIBUTOR gets {confirm delivery (= recordSignoff), track usage, view updates feed}. — RUBRIC: UX (User Flow — clear next-action affordance per role). DEFERRED — the card currently links straight to `/tickets/[id]`; per-role action panels live on the ticket detail (§2.9) not the dashboard card.

#### Rapid override sort (spec §5)
- [x] Within the rapidBroadcast segment of Recommended Tickets, sort by `urgency desc, geoDistanceKm asc, maxContributionPossible desc` — NOT by hybrid score. Flow B doesn't compute a hybrid score, so this ordering is the only ranking that exists for emergencies. Client-side sort over the rapid-broadcast match docs in [RecommendedTicketsList.tsx](../app/(app)/dashboard/_components/RecommendedTicketsList.tsx). — RUBRIC: Innovation (rapid crisis response is a stated innovation angle in `PROJECT_BRIEF.md` §11). [spec §5]

#### Realtime listener strategy (spec §6)
Per `PROJECT_BRIEF.md` operating rule "realtime listeners only on ticket-detail progress + emergency dashboard panel; everywhere else = TanStack Query one-shot reads", apply the listener budget surgically:
- [ ] Recommended/rapidBroadcast segment: realtime listener on `matches where orgId == viewerOrgId and rapidBroadcast == true` — emergency panel updates instantly when a new rapid ticket fans out.
- [ ] Recommended/normal segment: TanStack Query one-shot read; revalidates on dashboard re-mount + on FCM "new match" push.
- [ ] Active Tickets list: TanStack Query one-shot read by default. Promote to realtime ONLY for cards with `phase === EXECUTION` (live progress matters during execution) — done by attaching a per-card listener after the initial fetch.
- [ ] Triggers that should invalidate the Active Tickets query (no listener needed if reactive cache invalidation suffices): new ticket created where viewer is host; contribution committed (own org); phase changed; proof uploaded. — RUBRIC: Performance (Firestore listener cost discipline).

#### Layout (spec §8 — non-mandatory, flagged)
- [x] FE `/dashboard` page — bento layout: Recommended primary (left/main, ~60% width on desktop, `3fr`), Active secondary (right/aside, ~40%, `2fr`); stacks vertically below 800px with Recommended first per spec §8.5. — [app/(app)/dashboard/page.tsx](../app/(app)/dashboard/page.tsx). RUBRIC: UX (visual hierarchy).

#### Verification
- [ ] Three Firestore queries on dashboard load (one tickets + one normal-matches + one rapid-matches), fired in parallel. Confirm in DevTools Network tab.
- [ ] Every field in `Albin/Nexus_Dashboard_Logic.md` §3.3 (active-ticket required fields) and §4.3 (recommended personalization fields) resolves to a denormalized field already produced by §2.1 / §2.2 / §2.3 — no orphan reads.

**Phase 2 done when:**
1. NORMAL ticket: raise → Org B sees it → pledges → both sign → progress animates → host advances → proofs → signoffs → CLOSED
2. EMERGENCY ticket: raise → all eligible orgs see it instantly + FCM → pledges commit instantly → host advances any % → proofs → signoffs → CLOSED
3. Reliability scores decay as expected; audit log shows hash-chained entries for every state change
4. Ticket detail page renders 100% of the display fields from `Albin/Nexus_Ticket_Display_Spec.md` §3 with no missing data and no extra reads beyond the ticket subtree + viewer's match doc
5. Dashboard `/dashboard` renders Active + Recommended surfaces per `Albin/Nexus_Dashboard_Logic.md` §3 + §4 in three parallel Firestore queries against the viewer's orgId, the listener-discipline rule honored, and the rapid-override sort applied within the emergency segment

---

## Phase 3 — Feed + badges (public surface)

**Goal:** the "social proof" layer. Once a ticket closes, it becomes a
public, SEO-indexable page with badges for every contributor. This is the
rubric's Alignment 25% story — visible impact, transparent attribution.

Depends on Phase 2: no badges without closed tickets.

### 3.1 Trigger: onTicketClosed
- [ ] BE trigger `onTicketClosed` — one `badges/{id}` per participant (host + each COMMITTED contributor); also pushes `badgeRef` into `organizations.badges[]`; revalidates Next.js SSR for `/`, `/ticket/[id]`, `/org/[slug]` — stub at [functions/src/triggers/onTicketClosed.ts](../functions/src/triggers/onTicketClosed.ts)
- [ ] `publicSlug` generator (URL-safe from org + ticket title + short hash)

### 3.2 Public home feed — `/`
- [ ] FE replace the current Next.js starter at [app/page.tsx](../app/page.tsx)
- [ ] SSR via Firebase App Hosting — read `badges/*` + `tickets/{id}` where `phase === "CLOSED"` ordered by `closedAt desc`
- [ ] Ticket card: title, host, contributor count, value delivered, date closed, photo thumbnail, link to `/ticket/[id]`
- [ ] On-demand revalidation triggered from `onTicketClosed`
- [x] Rules: `badges/*` public read + `tickets/{id}` public when CLOSED — already enforced + tested

### 3.3 Public ticket page — `/ticket/[id]`
- [ ] FE SSR route `app/(public)/ticket/[id]/page.tsx`
- [ ] Need breakdown with final progress per need
- [ ] Contributors list with badges
- [ ] Photo-proofs gallery (rules already gate public read on CLOSED)
- [ ] Signed agreements (Flow A) or post-hoc signatures (Flow B)
- [ ] Final signoff notes (APPROVED only)
- [ ] OpenGraph / Twitter social cards via `generateMetadata`

### 3.4 Public org profile — `/org/[slug]`
- [ ] FE SSR route `app/(public)/org/[slug]/page.tsx`
- [ ] Header: name, type, region, verification date
- [ ] **Three reliability mini-bars (Agreement / Execution / Closure) + sparklines** — the novel mechanic
- [ ] Badge grid (paginated via TanStack Query)
- [ ] Resource summary (what they typically contribute)

### 3.5 Per-badge share page (stretch)
- [-] FE `/badge/[slug]` — single-badge shareable card for LinkedIn/X share

### 3.6 Impact metrics for pitch deck
- [ ] `scripts/impact.ts` — aggregates total INR delivered, close rate, median time-to-close by flow, top-5 contributors
- [ ] Tiny React page that renders the charts → screenshot for the deck (plan §A.4)
- [-] BigQuery / Looker Studio live dashboard — explicitly cut in plan §A.6

**Phase 3 done when:**
1. When a ticket closes, badges fire automatically and appear on `/`, `/org/[slug]`, `/ticket/[id]` within seconds
2. Anonymous users can browse closed tickets, see contributor badges, land on org profiles — no login wall
3. Org profiles show the three reliability mini-bars driven by Phase 2's sweeps
4. Impact script produces screenshot-worthy numbers

---

## Cross-cutting (applies to every phase)

- [x] **Idempotency** — `requestId` on every mutating callable; dedup via `idempotency/{uid}__{requestId}` — [functions/src/lib/idempotency.ts](../functions/src/lib/idempotency.ts)
  - [ ] TTL policy on `idempotency/*` (24h) — configure in console
- [ ] **Audit log** — hash-chained `onWrite` trigger across `tickets`, `contributions`, `agreements`, `organizations`, `signoffs` — stub at [functions/src/triggers/appendAuditLog.ts](../functions/src/triggers/appendAuditLog.ts); needs the prevHash implementation
- [x] **App Check** — `enforceAppCheck: true` on `pledge` callable — [functions/src/callables/pledge.ts](../functions/src/callables/pledge.ts)
  - [ ] Register reCAPTCHA Enterprise site key in console and fill `NEXT_PUBLIC_APP_CHECK_SITE_KEY`
- [x] **Rules** — 31 unit tests lock all money-like fields — [tests/rules/](../tests/rules/)
  - [ ] Add tests for rules once new slices land (resources ACTIVE-gate, etc.)
- [ ] **Realtime listeners** — only on ticket-detail progress bar + emergency dashboard panel; everywhere else = TanStack Query one-shot reads
- [ ] **Seed script** — run once against emulator to populate demo data — [scripts/seed.ts](../scripts/seed.ts) (script written, not yet run)

---

## Blockers needing user input

- [ ] Confirm `buffet-493105` is on **Blaze** plan (required for Functions + Vertex)
- [ ] Enable **Auth providers** in console: Email/Password + Google
- [ ] Register **App Check** (reCAPTCHA Enterprise) site key — fills `NEXT_PUBLIC_APP_CHECK_SITE_KEY`
- [ ] Obtain **Google Maps Platform** key (HTTP-referrer restricted) — fills `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
- [ ] Create Google Docs **agreement template** in a Drive folder owned by a service account (deferred until 2.3)
- [ ] OK to run `firebase deploy --only firestore:rules,firestore:indexes` now that rules are tested?

---

## Dependency graph at a glance

```
Phase 1                 Phase 2                          Phase 3
────────                ────────                         ────────
signup/login            raise ticket  ──────┐
      │                      │              │
      ▼                      ▼              ▼
  onboarding   ────►   matching ──► pledge ──► commit ──► execute ──► signoff ──► CLOSE ──► badges
      │                   (Flow A/B)          (agreement     (proofs)   (approve/             │
      ▼                                        or instant)              dispute)              ▼
  govt docs                                                                             public feed
      │                                                                                      │
      ▼                                                                                      ▼
   approve                                                                            public org profiles
      │                                                                              (3 reliability bars)
      ▼
 list resources  ──────────────────► (becomes match candidates)
```

**Key handoffs:**
- Phase 1 → 2: `organizations.status === "ACTIVE"` + `resources.embedding` populated
- Phase 2 → 3: `tickets.phase === "CLOSED"` fires `onTicketClosed` which writes badges
- Phase 2 ↔ itself: `onAgreementFullySigned` (Flow A) or `pledge` directly (Flow B) both converge on `contributions.status === "COMMITTED"` + progress bump — downstream triggers are flow-agnostic
