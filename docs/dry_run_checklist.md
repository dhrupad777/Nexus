# Nexus — Live Dry Run Validation Checklist

**Project:** `buffet-493105` · **Firestore Console:** https://console.firebase.google.com/project/buffet-493105/firestore  
**DRY_RUN.md reference:** Part B (full steps) + Part G (14-step cheat sheet)  
**Last updated:** 2026-04-28

> Mark each step: ✅ Done · ❌ Failed · 🔄 In Progress · ⏳ Pending

---

## Participants

| Role | Person | Email |
|---|---|---|
| 🏛️ Host (NGO) | **Niraj** | `nirajvaidya32@gmail.com` |
| 💰 FUNDS Contributor | **Albin** | `albinvishwas7@gmail.com` |
| 🏭 MANUFACTURING Contributor + Admin | **Dhrupad** | `dhrupadrajpurohit@gmail.com` |

---

## Part A — One-time Setup

### A.1 — All three create accounts & onboard
- [x] **Status:** ✅ Done
- **Who:** Niraj, Albin, Dhrupad (each in their own browser)
- **Action:** `/signup` → Google sign-in → fill `/onboard` form
  - Niraj: type=`NGO`, name=`Niraj Foundation`, region=`Panvel, MH`
  - Albin: type=`ORG`, name=`Albin Capital`, region=`Panvel, MH`
  - Dhrupad: type=`ORG`, name=`Dhrupad Manufacturing`, region=`Panvel, MH`
- **Expected UI:** Dashboard shows **"Pending admin approval"** banner
- **Expected Firestore:** `users/{uid}` exists; `organizations/{uid}` with `status: "PENDING_REVIEW"`
- **Notes:** —

---

### A.2 — Dhrupad approves all three orgs from `/admin`
- [x] **Status:** ✅ Done
- **Who:** Dhrupad only (Niraj & Albin wait)
- **Action:** Navigate to `/admin` → Sign in with Google → click **Approve** on each of the 3 pending org cards
- **Expected UI:** Cards disappear as approved; Niraj & Albin dashboards auto-flip to live state within ~1s, no refresh needed
- **Expected Firestore:** `organizations/{*}.status: "ACTIVE"`; Auth custom claims `{role: "ORG_ADMIN", orgId}` set on each user
- **Notes:** If `/admin` is unreachable, fall back to `npm run approve` from project root

---

### A.3 — Albin lists FUNDS resource
- [x] **Status:** ✅ Done
- **Who:** Albin
- **Action:** `/resources/new` → fill form:
  | Field | Value |
  |---|---|
  | Category | `FUNDS` |
  | Title | `Demo financial pool` |
  | Quantity | `100000` |
  | Unit | `INR` |
  | Valuation (INR) | `100000` |
  | Latitude | `18.9894` |
  | Longitude | `73.1175` |
  | Service radius (km) | `50` |
  | Available from | today |
  | Available until | 30 days from today |
  | Emergency contract | unchecked |
- **Expected UI:** Resource appears in `/resources` list; **"Embedding…"** badge for ~10–30s → **"Embedded"**
- **Expected Firestore:** `resources/{id}` with `category: "FUNDS"`, `quantity: 100000`, `reservedQuantity: 0`, `status: "AVAILABLE"`, `embeddingStatus: "pending"` → `"ok"`
- **Notes:** Do NOT proceed to A.4 / Step 5 until `embeddingStatus === "ok"`

---

### A.4 — Dhrupad lists MANUFACTURING resource
- [x] **Status:** ✅ Done
- **Who:** Dhrupad
- **Action:** `/resources/new` → fill form:
  | Field | Value |
  |---|---|
  | Category | `MANUFACTURING` |
  | Title | `Demo desk production line` |
  | Quantity | `200` |
  | Unit | `desks` |
  | Valuation (INR) | `200000` |
  | Latitude | `18.9894` |
  | Longitude | `73.1175` |
  | Service radius (km) | `50` |
  | Available from | today |
  | Available until | 30 days from today |
  | Emergency contract | unchecked |
- **Expected UI:** Same as A.3 — "Embedded" badge appears within 30s
- **Expected Firestore:** Same shape as A.3 but `category: "MANUFACTURING"`, `quantity: 200`
- **Notes:** Wait for `embeddingStatus === "ok"` before Niraj raises the ticket

---

## Part B — Core Ticket Lifecycle (14-step happy path)

### Step 1 — Niraj raises the ticket
- [x] **Status:** ✅ Done
- **Who:** Niraj
- **Action:** Topbar **"Raise a ticket"** → fill form:
  | Field | Value |
  |---|---|
  | Title | `100 desks for Panvel school` |
  | Description | `Local primary school needs 100 study desks before the new term begins. Funds and manufacturing capacity both welcome.` |
  | Category | `EDUCATION` |
  | Urgency | `Normal — agreement-first` |
  | Need #1 Resource | `FUNDS` · qty `40` · unit `desks-equivalent` · valuation `40000` · self-pledge `0/0/0` |
  | Need #2 Resource | `MANUFACTURING` · qty `60` · unit `desks` · valuation `60000` · self-pledge `0/0/0` |
  | Admin region | `Panvel, MH` · lat `18.9894` · lng `73.1175` |
  | Deadline | 14 days from today |
- **Expected UI:** Toast **"Ticket raised"** → redirects to `/tickets/<id>`; phase chip **"Open"** (blue); progress **0%**
- **Expected Firestore:** `tickets/{id}` with `phase: "OPEN_FOR_CONTRIBUTIONS"`, `progressPct: 0`, `participantOrgIds: [nirajOrgId]`; within ~10s `onTicketCreated` writes `matches/{ticketId}__{albinOrgId}` and `matches/{ticketId}__{dhrupadOrgId}`
- **Notes:** Copy the ticket URL into team chat. Wait 10s before Albin/Dhrupad check dashboards.

---

### Step 2 — Albin & Dhrupad see the ticket in "Recommended for you"
- [x] **Status:** ✅ Done
- **Who:** Albin AND Dhrupad (simultaneously)
- **Action:** Go to `/dashboard` (or refresh)
- **Expected UI:** Under **"Recommended for you"** — card titled **"100 desks for Panvel school"** with a score-based reason ("You listed FUNDS/MANUFACTURING in Panvel"), a "fills X%" chip, and a **"View"** button
- **Expected Firestore:** `matches/{ticketId}__{albinOrgId}` and `matches/{ticketId}__{dhrupadOrgId}` exist with `score: 0–1`, `topResourceId`, `contributionImpactPct`, `rapidBroadcast: false`
- **Notes:** If card missing after 10s, check `resources/{id}.embeddingStatus === "ok"`. Without an embedding, no match doc is written.

---

### Step 3a — Contributor proposes a pledge
- [x] **Status:** ✅ Done
- **Who:** Flexon Foods (actual dry-run contributor)
- **Action:** Open ticket → scroll to **"Pledge to this ticket"** → qty `40 units` → click **"Submit for approval"**
- **Expected UI:** Toast **"Pledge proposed. Waiting for the host to approve it."**; contribution card shows `status PROPOSED`; progress bar stays at **0%**
- **Expected Firestore:** `tickets/{id}/contributions/{cid}` with `status: "PROPOSED"`, `offered.quantity: 40`; resource `reservedQuantity` still `0`
- **Notes:** Confirmed in Firestore — contribution `JUbIb5N6GDv8CAVbDnQ8` created, committedAt `2026-04-28T06:38:53Z`.

---

### Step 3a-bis — Niraj approves pledge
- [x] **Status:** ✅ Done
- **Who:** Niraj
- **Action:** Open ticket → scroll to **"Proposed pledges (1)"** → click **Approve**
- **Expected UI:** Toast **"Pledge approved."**; progress jumps; contribution card flips to `COMMITTED`
- **Expected Firestore:** Contribution `status: "COMMITTED"`, `committedAt` set; ticket `progressPct` rising, contributor in `participantOrgIds`
- **Notes:** Confirmed — committedAt `2026-04-28T06:38:53Z`; Flexon Foods in `participantOrgIds`.

---

### Step 3b — Second contributor pledge (MANUFACTURING)
- [x] **Status:** ✅ Done (single-contributor run — ticket reached 100% via Flexon Foods)
- **Who:** N/A for this run (only 1 contributor needed to reach 100%)
- **Notes:** `progressPct: 100` confirmed in Firestore. Dry-run ran with Flexon Foods as sole contributor covering the full need.

---

### Step 4 — Niraj advances to EXECUTION
- [x] **Status:** ✅ Done
- **Who:** Niraj
- **Action:** Open ticket → **"Host controls"** card → click **"Move to execution"**
- **Expected UI:** Toast **"Phase: EXECUTION"**; phase chip flips to **"Executing"** (orange)
- **Expected Firestore:** Ticket `phase: "EXECUTION"`; contributions flip `COMMITTED → EXECUTED`
- **Notes:** Confirmed — ticket transitioned through EXECUTION before reaching CLOSED.

---

### Step 5a — Niraj uploads photo proof
- [x] **Status:** ✅ Done
- **Who:** Niraj
- **Action:** In "Host controls — execution" card → click file input → pick any image → wait ~3s
- **Expected UI:** Toast **"Photo proof uploaded."**
- **Expected Firestore:** `tickets/{id}/photoProofs/{pid}` created
- **Notes:** Confirmed — `photoProofs/2ahmTHymkzJC6tYcASDM` exists, storagePath=`tickets/ttoQA25JsOJtUl3aiq9e/photoProofs/1c2fc868-8f2f-4d04-b5f2-cb9f75c107a1.jpg`, at `2026-04-28T06:39:08Z`.

---

### Step 5b — Niraj marks execution complete
- [x] **Status:** ✅ Done
- **Who:** Niraj
- **Action:** Same card → click **"Mark execution complete"**
- **Expected UI:** Toast **"Phase: PENDING_SIGNOFF"**; phase chip flips to **"Awaiting sign-off"**
- **Expected Firestore:** Ticket `phase: "PENDING_SIGNOFF"`
- **Notes:** Confirmed — ticket moved through PENDING_SIGNOFF before final closure.

---

### Step 5c — Contributor confirms delivery
- [x] **Status:** ✅ Done
- **Who:** Flexon Foods
- **Action:** Open ticket → scroll to **"Sign off on this delivery"** → click **"Confirm delivery"**
- **Expected UI:** Toast **"Delivery confirmed."**; phase auto-advances to CLOSED (single contributor)
- **Expected Firestore:** `signoffs/ttoQA25JsOJtUl3aiq9e__MhyKfwaLmJRUJ92gj8WSOGelcwj1` with `decision: "APPROVED"`; contribution `signedOffAt` set
- **Notes:** Confirmed — signoff exists, signedOffAt `2026-04-28T06:39:17Z`. Auto-closure triggered immediately (only 1 contributor).

---

### Step 5d — Auto-close on full signoff coverage
- [x] **Status:** ✅ Done
- **Who:** System (`onSignoffRecorded` trigger)
- **Expected Firestore:** `onSignoffRecorded` confirms full coverage → ticket `phase: "CLOSED"`, `closedAt` set; `onTicketClosed` fires → resources deducted, `reservedQuantity: 0`
- **Notes:** Confirmed — `phase: "CLOSED"`, `closedAt: 2026-04-28T06:39:20Z`. Triggered ~3s after Flexon Foods signoff.

---

### Step 6 — Verify closure in Firestore
- [x] **Status:** ✅ Done
- **Who:** Verified by `scripts/auditTicketLifecycle.ts` + `scripts/identifyContributor.ts`
- **Action:** Firebase Console → Firestore → `tickets/ttoQA25JsOJtUl3aiq9e`
- **Confirmed Firestore:**
  - `phase: "CLOSED"`
  - `closedAt: 2026-04-28T06:39:20.550Z`
  - `progressPct: 100`
  - `contributorCount: 1` (Flexon Foods)
  - `participantOrgIds: ["0czjMK7ZKCO1wi2fAaqZFRLfOgS2", "MhyKfwaLmJRUJ92gj8WSOGelcwj1"]`
- **Notes:** —

---

### Step 7 — Badge minting verification
- [x] **Status:** ✅ Done
- **Who:** Verified by `scripts/identifyContributor.ts`
- **Action:** Firebase Console → Firestore → `badges` collection
- **Confirmed Firestore:**
  - `ttoQA25JsOJtUl3aiq9e__0czjMK7ZKCO1wi2fAaqZFRLfOgS2` → **Niraj Foundation** · role=HOST
  - `ttoQA25JsOJtUl3aiq9e__MhyKfwaLmJRUJ92gj8WSOGelcwj1` → **Flexon Foods** · role=CONTRIBUTOR
- **Notes:** 2 badges minted (1 HOST + 1 CONTRIBUTOR). Badge `score` field is `undefined` — may indicate `onTicketClosed` doesn't write a score yet; non-blocking for dry run.

---

## Part C — Failure Tests

### C.1 — Dispute blocks auto-close
- [ ] **Status:** ⏳ Pending
- **Setup:** Repeat Steps 1→5b on a new ticket. At 5c, Albin clicks **"Dispute"** instead of "Confirm delivery", enters reason, submits.
- **Expected:** Phase stays **"Awaiting sign-off"** even after Dhrupad confirms. No badges minted.
- **Proves:** A single dispute permanently blocks ticket closure.

---

### C.2 — Org with no resources can't pledge
- [ ] **Status:** ⏳ Pending
- **Setup:** 4th account (incognito), signs up + onboards, Dhrupad approves, but no resources listed.
- **Expected:** Dashboard shows **"No matches yet"** empty state; ticket detail page shows pledge form with "No matching resource listed" and disabled Submit button; server rejects any direct callable bypass.
- **Proves:** Three-layer enforcement: matching feed, form filter, server callable.

---

### C.3 — Skip verification = no badges
- [ ] **Status:** ⏳ Pending
- **Setup:** Run Steps 1→4 on a new ticket. Stop — do nothing for 60s.
- **Expected:** Phase stays **"Executing"**; no badges in `badges` collection.
- **Proves:** Badges only exist for fully verified work.

---

### C.4 — Incremental partial pledges (50→30 scenario)
- [ ] **Status:** ⏳ Pending
- **Setup:** Niraj raises new ticket with a single FUNDS need of **80 INR**. Albin changes pledge qty to 50 → approved → then pledges remaining 30 → approved.
- **Expected:** Two contributions for same org on same ticket; progress 62.5% → 100%; `reservedQuantity` 50 → 80.
- **Proves:** Multi-pledge per (ticket, org), per-need cap enforced and visible.

---

### C.5 — Phase advance auto-rejects stranded PROPOSED
- [ ] **Status:** ⏳ Pending
- **Setup:** Standard ticket. Albin pledges (PROPOSED, Niraj does NOT approve). Dhrupad pledges → Niraj approves Dhrupad only → Niraj clicks "Move to execution".
- **Expected:** Albin's contribution silently becomes `REJECTED` with `rejectReason: "auto-rejected: ticket advanced before host approved"`. Ticket closes with Dhrupad only. Albin gets no badge.
- **Proves:** No orphaned PROPOSED contributions survive a phase advance.

---

### C.6 — Per-need over-pledge is blocked
- [ ] **Status:** ⏳ Pending
- **Setup:** Niraj raises ticket with single FUNDS need of **40 INR**. Albin pledges 40 → approved (need at 100%). Albin tries to pledge 1 more.
- **Expected:** Pledge form shows `max=0`, Submit disabled. Server rejects bypass with `"This need has only 0 INR of remaining capacity"`.
- **Proves:** Per-need cap enforced at UI and server.

---

### C.7 — Host rejects; contributor re-pledges
- [ ] **Status:** ⏳ Pending
- **Setup:** Standard ticket. Albin pledges FUNDS → Niraj clicks **Reject**, enters note, confirms.
- **Expected:** Albin's contribution card disappears (REJECTED filtered client-side). Pledge form still visible; per-need capacity fully restored. Albin can re-submit.
- **Proves:** REJECTED contributions don't block re-pledging and correctly free capacity headroom.

---

## Issues Log

| # | Step | Issue Description | Status |
|---|------|-------------------|--------|
| 1 | A.1 | `FirebaseError: Missing or insufficient permissions` on onboarding chat load | ✅ Fixed & deployed |
| 2 | A.3/A.4 | `models/text-embedding-004 is not found for API version v1beta` — Gemini embedding failure | ✅ Model updated to `gemini-embedding-2`, deployed |
| 3 | Backend | `functions/src/lib` ignored by `.gitignore` — missing `matching.ts`, `idempotency.ts`, causing failed builds | ✅ Fixed `.gitignore`, recreated missing backend logic, deployed |
| 4 | Backend | Recommended tickets feed not showing for Flexon Foods — tickets raised before Flexon listed resources, so `onTicketCreated` never wrote match docs | ✅ Root-caused & fixed via `backfillMatchesForOrg.ts` — 7 match docs written to `matches/` |
| 5 | Steps 3–7 | Dry-run contributor was **Flexon Foods** (not Albin/Dhrupad as scripted) — all lifecycle steps completed successfully with single contributor | ✅ Verified by `auditTicketLifecycle.ts` + `identifyContributor.ts` — ticket CLOSED at `2026-04-28T06:39:20Z` |
| 6 | Step 7 | Badge `score` field is `undefined` on minted docs — `onTicketClosed` may not write score yet | ⚠️ Non-blocking — badges minted correctly, score calculation to be confirmed |
