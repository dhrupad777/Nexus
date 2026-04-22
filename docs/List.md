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

Last updated: 2026-04-22

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
- [ ] FE `/resources` list (TanStack Table)
- [ ] FE `/resources/new` form mirroring [lib/schemas/resource.ts](../lib/schemas/resource.ts)
- [ ] BE callable `listResource` — validates `ResourceSchema`, requires `org.status === "ACTIVE"`
- [ ] BE trigger `onResourceCreated` — Vertex `text-embedding-004` on title+description → `resources.embedding` (EXT: Vertex)
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
- [ ] BE trigger `onTicketCreated` — Vertex embedding on title+description → `tickets.embedding`
- [ ] Replace raw lat/lng with Google Maps Places autocomplete (EXT: Maps)

### 2.2 Matching

**Flow A — ranked top-K** (non-emergency):
- [ ] BE trigger `onTicketOpened` (fires on phase → `OPEN_FOR_CONTRIBUTIONS`)
  - [ ] Hard filter: category ∈ needs, geo reachable (Distance Matrix), availability window, org ACTIVE
  - [ ] Semantic rerank via Firestore native `vectorSearch` on ticket/resource embeddings
  - [ ] Write top-K `matches/{id}` with `reason` string ("You listed X in Y")
- EXT: Maps Distance Matrix, Vertex vector search

**Flow B — broadcast** (emergency):
- [ ] BE trigger `onRapidTicketCreated` — stub at [functions/src/triggers/onRapidTicketCreated.ts](../functions/src/triggers/onRapidTicketCreated.ts)
  - [ ] Filter: `resource.emergencyContract.enabled === true`, category fits, geo reachable
  - [ ] Write `matches/{id}` with `rapidBroadcast: true` for every passing org (no K cutoff)
  - [ ] FCM push when `resource.emergencyContract.autoNotify === true`
- EXT: FCM

**Dashboard:**
- [ ] FE `/dashboard` — two sections: "Emergency Response Needed" (rapidBroadcast) then "Recommended for you" (normal). Plus the `PENDING_REVIEW` banner from 1.2.
- [x] Composite indexes for matches — [firestore.indexes.json](../firestore.indexes.json)

### 2.3 Pledge → commit

**Flow A — AGREEMENT_FIRST:**
- [ ] FE ticket-detail `/tickets/[id]` with "Pledge" CTA per need
- [ ] BE callable `pledge` (App Check enforced) — Flow A path: writes `contributions PROPOSED`, `agreements DRAFTED`, Google Docs template copy + placeholder fill, returns `googleDocUrl` — stub at [functions/src/callables/pledge.ts](../functions/src/callables/pledge.ts)
- [ ] BE callable `signAgreement` — HOST then CONTRIBUTOR marks signature; status progresses `DRAFTED → HOST_SIGNED → FULLY_SIGNED` — stub at [functions/src/callables/signAgreement.ts](../functions/src/callables/signAgreement.ts)
- [ ] BE trigger `onAgreementFullySigned` — contribution → COMMITTED, bump `needs[i].progressPct` + `ticket.progressPct`, append audit — stub at [functions/src/triggers/onAgreementFullySigned.ts](../functions/src/triggers/onAgreementFullySigned.ts)
- [ ] EXT: Google Docs + Drive APIs (template copy + PDF export)

**Flow B — PLEDGE_FIRST:**
- [ ] Same `pledge` callable — Flow B branch: assert `ticket.rapid === true`, transaction writes contribution COMMITTED + bumps progress directly + audit entry. No agreement at this stage.

### 2.4 Host advances to EXECUTION
- [ ] FE "Move to Execution" CTA (host-only)
- [ ] BE callable `advancePhase` — Flow A floor 30%, Flow B no floor, writes `phase: "EXECUTION"`, `phaseChangedAt`, `advancedEarly` — stub at [functions/src/callables/advancePhase.ts](../functions/src/callables/advancePhase.ts)
- [ ] FE: existing contributors notified via realtime listener on ticket doc

### 2.5 Photo proofs
- [ ] FE upload widget on ticket detail (host-only, EXECUTION only)
- [ ] Storage signed-URL upload to `tickets/{ticketId}/photoProofs/`
- [ ] BE trigger `onPhotoProofUploaded` — touches ticket liveness (recovers execution reliability decay) — stub at [functions/src/triggers/onPhotoProofUploaded.ts](../functions/src/triggers/onPhotoProofUploaded.ts)

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

**Phase 2 done when:**
1. NORMAL ticket: raise → Org B sees it → pledges → both sign → progress animates → host advances → proofs → signoffs → CLOSED
2. EMERGENCY ticket: raise → all eligible orgs see it instantly + FCM → pledges commit instantly → host advances any % → proofs → signoffs → CLOSED
3. Reliability scores decay as expected; audit log shows hash-chained entries for every state change

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
