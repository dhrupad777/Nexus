# NEXUS — Live Dry Run Playbook

**Project:** `buffet-493105` · **Region:** `asia-south1` · **Date prepared:** 2026-04-25

This is the script we will follow during the live test. Every step pre-assigns
**who** acts, **which route** to open, **exactly what to do**, and **what to
expect**. No improvisation. If a step's expected result doesn't land, stop and
check the troubleshooting table at the bottom before continuing.

---

## Roles

| Role | Person | Org type | Purpose |
|---|---|---|---|
| Host | **Niraj** | NGO | Raises the ticket, advances phases, uploads proof |
| Financial Contributor | **Albin** | ORG | Pledges FUNDS resource |
| Resource Contributor | **Dhrupad** | ORG | Pledges MANUFACTURING resource |

## Ground rules

1. **One actor at a time.** Don't click ahead — wait for the previous tester's "expected" to land before the next tester acts. The UI is driven by realtime listeners; clicking too fast can hide bugs by skipping over intermediate state.
2. **Same browser session per role.** Don't switch accounts mid-test. If you need to verify Firestore state, use a separate Firebase Console tab — not a different sign-in on the app.
3. **Open Firebase Console in a side tab** (`https://console.firebase.google.com/project/buffet-493105/firestore`). Several "expected" checks reference Firestore docs directly.
4. **Backend is already deployed.** No `firebase deploy` is required during the run. If you must redeploy mid-session, finish the current ticket first.

---

## Pre-flight — one-time setup

Do this **before** starting Step 1. Estimated time: 15 minutes total.

### All three testers
1. Open the deployed app URL.
2. Go to `/signup`. Sign up with whichever email you'll use for the demo.
3. After signup, you'll land on the dashboard with a "Finish onboarding" prompt. Click "Start onboarding" → goes to `/onboard`.
4. Complete the onboarding flow. The org-name + region + contact fields will be saved with `status: "PENDING_REVIEW"`.
5. **Wait for a Platform Admin to approve your org.** Until then your dashboard will show "Pending review" and `/tickets/new` will not work.

### Platform Admin step (one-time, ahead of the run)
The team needs at least one PLATFORM_ADMIN to approve the three test orgs. If no one has the claim yet:

```powershell
# Run once to elevate one tester (e.g. Dhrupad) to PLATFORM_ADMIN
gcloud auth login
firebase login
# Get the UID from Firebase Console → Authentication → Users
firebase auth:set-claims <uid> '{"role":"PLATFORM_ADMIN"}' --project buffet-493105
```

The admin then opens Firebase Console → Firestore → `organizations/{orgId}` for each of the three orgs and either uses the in-app `/admin` console (if wired) or directly invokes the `approveOrg` callable to flip `status: PENDING_REVIEW → ACTIVE` and stamp the custom claims.

After approval, each tester must **sign out and sign back in** so the new `claims.orgId` lands in their token. The dashboard will switch from "Pending review" to "Recommended for you" + "Active tickets".

### Niraj — host setup
- Org type: **NGO**
- Region (during onboarding): **Panvel, MH**
- No resources to list. Hosts don't pledge.

### Albin — FUNDS contributor setup
- Org type: **ORG**
- Region: **Panvel, MH**
- Go to `/resources/new` and create one resource with these exact values:
  - **Category:** `FUNDS`
  - **Title:** `Demo financial pool`
  - **Quantity:** `100000`
  - **Unit:** `INR`
  - **Valuation (INR):** `100000`
  - **Latitude:** `18.9894`
  - **Longitude:** `73.1175`
  - **Service radius (km):** `50`
  - **Available from:** today
  - **Available until:** 30 days from today
  - **Emergency contract enabled:** unchecked
- After submitting, open Firebase Console → Firestore → `resources/{newId}` and **wait until `embeddingStatus` reads `"ok"`** (usually <10 seconds). If it reads `"failed"`, check `firebase functions:log --only onResourceCreated`.

### Dhrupad — MANUFACTURING contributor setup
Same as Albin, but resource fields:
- **Category:** `MANUFACTURING`
- **Title:** `Demo desk production line`
- **Quantity:** `200`
- **Unit:** `desks`
- **Valuation (INR):** `200000`
- **Latitude:** `18.9894`
- **Longitude:** `73.1175`
- **Service radius (km):** `50`
- **Available from:** today
- **Available until:** 30 days from today
- **Emergency contract enabled:** unchecked

Wait for `embeddingStatus: "ok"` before continuing.

### Optional — reliability seeding (10 seconds, makes badge numbers interesting)
Default reliability is 0.7 across all orgs, so badge `scorePct` will land near 70% of the proportional share. To get visibly different badge numbers in the demo, hand-edit reliability per org in Firebase Console → Firestore → `organizations/{orgId}.reliability`:
- Niraj: `agreement.score = 95`, `execution.score = 95`, `closure.score = 95` (multiplier 0.95)
- Albin: `agreement.score = 80`, `execution.score = 80`, `closure.score = 80` (multiplier 0.80)
- Dhrupad: `agreement.score = 90`, `execution.score = 90`, `closure.score = 90` (multiplier 0.90)

These edits go on the existing `reliability` field; do not delete it. If you skip this step the test still passes, badges just show `~28%` / `~42%` / `~70%` instead of varied numbers.

---

## Happy Path — Steps 1-7

### Step 1 — Niraj raises the ticket

**WHO:** Niraj

**ROUTE:** `/tickets/new`

**ACTION** — fill the form with these exact values:

| Field | Value |
|---|---|
| Title | `100 desks for Panvel school` |
| Description | `Local primary school needs 100 study desks before the new term begins. Funds + manufacturing capacity both welcome.` |
| Category | `EDUCATION` |
| Urgency | `Normal — agreement-first` |
| **Need #1 — Resource** | `FUNDS` |
| Need #1 — Quantity | `40` |
| Need #1 — Unit | `desks-equivalent` |
| Need #1 — Valuation (INR) | `40000` |
| Need #1 — You pledge (qty / INR / %) | `0` / `0` / `0` |
| **Click "+ Add need"** | |
| **Need #2 — Resource** | `MANUFACTURING` |
| Need #2 — Quantity | `60` |
| Need #2 — Unit | `desks` |
| Need #2 — Valuation (INR) | `60000` |
| Need #2 — You pledge (qty / INR / %) | `0` / `0` / `0` |
| Admin region | `Panvel, MH` |
| Latitude | `18.9894` |
| Longitude | `73.1175` |
| Deadline | 14 days from today (default) |

Click **"Raise ticket"**.

**EXPECTED:**
- Toast: **"Ticket raised"**
- Browser navigates to `/tickets/{id}` — copy this URL into a shared chat so Albin and Dhrupad can confirm.
- Phase chip shows **"Open"** in blue.
- Overall progress: **0%**.
- Both need rows show 0% with required `40 desks-equivalent` / `60 desks`.
- Firebase Console → `tickets/{id}`:
  - `phase: "OPEN_FOR_CONTRIBUTIONS"`
  - `progressPct: 0`
  - `participantOrgIds: [<nirajOrgId>]`
  - `contributorCount: 0`
- Within ~10 seconds, `embeddingStatus: "ok"` lands on the ticket doc (the matching trigger needs this before contributors see the recommendation).

**If stuck:** `firebase functions:log --only raiseTicket,onTicketCreated` — look for embedding errors or rules denials.

---

### Step 2 — Albin and Dhrupad see the recommendation

**WHO:** Albin **and** Dhrupad (in parallel, in their own browsers)

**ROUTE:** `/dashboard`

**ACTION:** Refresh the page if you were already on it.

**EXPECTED (each contributor's dashboard):**
- Under **"Recommended for you" → "Best matches"**, a card titled **"100 desks for Panvel school"** appears.
- Below the title: distance ("~0 km away") and a "Needs N units" line.
- A **"Your contribution potential"** panel shows a non-zero `contributionImpactPct` and `maxContributionPossible`.
- A **"Pledge"** button on the right.
- Albin and Dhrupad will see slightly different impact numbers because their `bestNeedIndex` differs (Albin → FUNDS need #1; Dhrupad → MANUFACTURING need #2).

**If stuck:**
- Card missing → check the contributor's `resources/{id}.embeddingStatus` is `"ok"` and `terms.availableUntil` is past the ticket's deadline.
- Card present but no contribution panel → check `matches/{ticketId__contributorOrgId}` exists in Firestore. If not, look at `firebase functions:log --only onTicketCreated` for matching errors.

---

### Step 3a — Albin pledges FUNDS

**WHO:** Albin

**ROUTE:** From `/dashboard`, click the **"Pledge"** button on the recommendation card → lands on `/tickets/{id}`.

**ACTION:**
1. Scroll to the **"Pledge to this ticket"** card (auto-rendered for him).
2. The "Need" dropdown should default to **"#1 · FUNDS (40 desks-equivalent)"**. Leave it.
3. The "Quantity" field should pre-fill with `40` (from `match.maxContributionPossible`). Leave it.
4. Click **"Pledge now"**.

**EXPECTED:**
- Toast: **"Pledge committed. Ticket is now 40% fulfilled."**
- The pledge form is replaced by a green-bordered card: **"Your contribution is committed — 40 desks-equivalent · status COMMITTED"**.
- Need #1 progress bar fills to **100%**; Need #2 stays at 0%.
- Overall progress jumps to **40%**.
- Firebase Console → `tickets/{id}/contributions/{auto}`:
  - `contributorOrgId: <albinOrgId>`
  - `status: "COMMITTED"`
  - `commitPath: "PLEDGE_FIRST"`
- `tickets/{id}`:
  - `progressPct: 40`
  - `contributorCount: 1`
  - `participantOrgIds` now contains Niraj's + Albin's orgIds

**If stuck:** `firebase functions:log --only pledge` — look for the failed-precondition or rules error.

---

### Step 3b — Dhrupad pledges MANUFACTURING

**WHO:** Dhrupad

**ROUTE:** Same — `/dashboard` → **"Pledge"** → `/tickets/{id}`.

**ACTION:**
1. Scroll to the **"Pledge to this ticket"** card.
2. The "Need" dropdown should default to **"#2 · MANUFACTURING (60 desks)"**.
3. The "Quantity" field should pre-fill with `60`.
4. Click **"Pledge now"**.

**EXPECTED:**
- Toast: **"Pledge committed. Ticket is now 100% fulfilled."**
- Need #2 progress bar fills to **100%**.
- Overall progress: **100%**.
- Firebase Console → `tickets/{id}`:
  - `progressPct: 100`
  - `contributorCount: 2`
  - `participantOrgIds` contains all three orgIds
- Two contribution docs in `tickets/{id}/contributions`, both `status: "COMMITTED"`.
- The "Contributors (2)" strip appears at the bottom of the ticket detail with both org names as pills.

---

### Step 4 — Niraj advances to EXECUTION

**WHO:** Niraj

**ROUTE:** `/tickets/{id}` (the same ticket he raised in Step 1; refresh the page to ensure the latest phase loads)

**ACTION:** Scroll to the **"Host controls"** card. The button reads **"Move to execution"**. Click it.

**EXPECTED:**
- Toast: **"Phase: EXECUTION"**
- Phase chip flips to **"Executing"** (orange).
- The "Host controls" card switches to the EXECUTION-phase variant ("Host controls — execution") with a file input + "Mark execution complete" button.
- Firebase Console → `tickets/{id}`:
  - `phase: "EXECUTION"`
  - `phaseChangedAt: <recent timestamp>`
  - `advancedEarly: false` (because `progressPct === 100`)
- All contribution docs in `tickets/{id}/contributions` flipped to `status: "EXECUTED"`.

**If stuck:** `firebase functions:log --only advancePhase` — most likely cause is a missing `claims.orgId` on Niraj's token. Have him sign out and back in.

---

### Step 5a — Niraj uploads photo proof

**WHO:** Niraj

**ROUTE:** Same `/tickets/{id}`.

**ACTION:** In the **"Host controls — execution"** card, click the file input and pick any image (a screenshot works fine). The upload starts as soon as you select a file.

**EXPECTED:**
- Toast: **"Photo proof uploaded."**
- Firebase Console → `tickets/{id}/photoProofs/{auto}`:
  - `uploaderOrgId: <nirajOrgId>` (matches token claim — verified by rules)
  - `storagePath: "tickets/{id}/photoProofs/<uuid>.<ext>"`
  - `contentType`, `size`, `createdAt` populated
- Firebase Console → `tickets/{id}/updates/<sameProofId>`:
  - `kind: "PHOTO_PROOF"`
  - `authorOrgId: <nirajOrgId>`
- `tickets/{id}.lastUpdatedAt` bumped to a recent timestamp.

You can upload multiple proofs if you want — only the first is required for the next step.

**If stuck:**
- Toast says "permission denied" → rules denied the create. Check `request.auth.token.orgId` matches Niraj's orgId.
- File picker selects but no toast → `firebase functions:log --only onPhotoProofUploaded`.

---

### Step 5b — Niraj marks execution complete

**WHO:** Niraj

**ROUTE:** Same `/tickets/{id}`.

**ACTION:** Click the **"Mark execution complete"** button in the host card.

**GATE TO REMEMBER:** If Niraj clicks this **before** uploading any proof in 5a, the toast will read **"Upload at least one photo proof before marking execution complete."** The button stays. Upload a proof, then re-click. (Don't deliberately trigger this during the live demo unless you're showing a failure case.)

**EXPECTED:**
- Toast: **"Phase: PENDING_SIGNOFF"**
- Phase chip flips to **"Awaiting sign-off"** (orange).
- "Host controls" card switches to the PENDING_SIGNOFF variant: **"Awaiting contributor signoffs"** copy, no buttons.
- Firebase Console → `tickets/{id}`:
  - `phase: "PENDING_SIGNOFF"`
- Contribution statuses unchanged (still `EXECUTED`).

---

### Step 5c — Albin confirms delivery

**WHO:** Albin

**ROUTE:** `/tickets/{id}` (refresh if needed — the phase change should propagate via the live listener within ~2s).

**ACTION:** Scroll to the **"Sign off on this delivery"** card (only visible because his contribution is `EXECUTED` and ticket is `PENDING_SIGNOFF`). Click **"Confirm delivery"**.

**EXPECTED:**
- Toast: **"Delivery confirmed."**
- The signoff panel disappears (because his contribution status moved on).
- Firebase Console → `tickets/{id}/signoffs/{auto}`:
  - `contributorOrgId: <albinOrgId>`
  - `decision: "APPROVED"`
  - `note: ""`
  - `signedAt` populated
- Albin's contribution doc: `status: "SIGNED_OFF"`, `signedOffAt` populated.
- **Ticket stays in `PENDING_SIGNOFF`** — it's still waiting on Dhrupad. Niraj's "Awaiting contributor signoffs" card remains.

---

### Step 5d — Dhrupad confirms delivery (auto-closes the ticket)

**WHO:** Dhrupad

**ROUTE:** `/tickets/{id}`.

**ACTION:** Click **"Confirm delivery"** in the signoff card.

**EXPECTED — happens within ~3 seconds of his click:**
1. Toast (Dhrupad): **"Delivery confirmed."**
2. Dhrupad's contribution flips to `SIGNED_OFF`.
3. `onSignoffRecorded` trigger fires, sees both contributors have APPROVED with no DISPUTED, and flips the ticket.
4. **All three testers' UIs** update via the live listener:
   - Phase chip flips to **"Closed"** (gray).
   - "Host controls" card disappears for Niraj.
5. Firebase Console → `tickets/{id}`:
   - `phase: "CLOSED"`
   - `closedAt: <recent timestamp>`
   - `phaseChangedAt: <same timestamp>`

**If stuck:** the ticket sometimes takes ~5s to flip if the trigger cold-starts. If it's been >15s, check `firebase functions:log --only onSignoffRecorded` for transaction abort messages.

---

### Step 6 — Closure verification

**WHO:** Anyone

**ROUTE:** Firebase Console → Firestore → `tickets/{id}`.

**EXPECTED:**
- `phase: "CLOSED"`
- `closedAt` is a millis timestamp from a few seconds ago.
- No more docs being written to this ticket subtree.

---

### Step 7 — Badge spot-check

**WHO:** Anyone

**ROUTE:** Firebase Console → Firestore → `badges` collection.

**EXPECTED — three docs created within ~2s of closure** (all with deterministic IDs):
- `badges/{ticketId}__{nirajOrgId}` — `role: "HOST"`, `proportionalSharePct: 100`, `scorePct = 100 × Niraj's reliability multiplier` (95 if you seeded, 70 if not).
- `badges/{ticketId}__{albinOrgId}` — `role: "CONTRIBUTOR"`, `proportionalSharePct: 40`, `scorePct = 40 × Albin's reliability multiplier` (~32 if seeded 0.80, ~28 if default 0.70).
- `badges/{ticketId}__{dhrupadOrgId}` — `role: "CONTRIBUTOR"`, `proportionalSharePct: 60`, `scorePct = 60 × Dhrupad's reliability multiplier` (~54 if seeded 0.90, ~42 if default 0.70).

Each badge also carries `ticketTitle`, `ticketCategory: "EDUCATION"`, `closedAt`, and a `publicSlug` like `100-desks-for-panvel-school-<6chars>`.

**Also verify each org doc** picked up a `BadgeRef`:
- `organizations/{nirajOrgId}.badges` — array contains a new `{ticketId, closedAt, contributionSummary: "Hosted: 100 desks ..."}` entry.
- `organizations/{albinOrgId}.badges` — array contains `{contributionSummary: "₹40,000 of EDUCATION (40.0% share)"}`.
- `organizations/{dhrupadOrgId}.badges` — array contains `{contributionSummary: "₹60,000 of EDUCATION (60.0% share)"}`.

**If stuck:** `firebase functions:log --only onTicketClosed` — most likely cause is a missing org doc (admin didn't approve someone) or arrayUnion failing because the `badges` field doesn't exist on the org doc (rare).

---

## Failure tests (test manual §6)

Run these AFTER the happy path passes, on **fresh tickets** (raise a new one for each). They prove the gates hold.

### Failure 1 — Early closure blocked (DISPUTED stops auto-close)

**Setup:** Repeat Steps 1, 2, 3a, 3b, 4, 5a, 5b on a brand-new ticket (any name — e.g., "Failure test 1").

**At Step 5c — Albin disputes instead of confirming:**
1. In Albin's signoff card, click **"Dispute"**. A textarea appears.
2. Type `Test dispute — partial delivery only` in the note field.
3. Click **"Submit dispute"**.

**EXPECTED:**
- Toast (Albin): **"Dispute recorded."**
- Firebase Console → `tickets/{id}/signoffs/{auto}`: `decision: "DISPUTED"`, `note: "Test dispute — partial delivery only"`.
- Albin's contribution: `status: "DISPUTED"`.
- Ticket stays in `PENDING_SIGNOFF`.

**Now have Dhrupad approve normally:**
- Toast (Dhrupad): **"Delivery confirmed."**
- Dhrupad's contribution: `status: "SIGNED_OFF"`.
- **Ticket DOES NOT close.** Phase remains `PENDING_SIGNOFF` indefinitely.
- `onSignoffRecorded` log line: `"DISPUTED signoff present — staying PENDING_SIGNOFF"`.
- `badges` collection: **no docs for this ticketId**. Verify with a Firestore query `where ticketId == <failureTicketId>` → empty.

This proves "Early Closure → Blocked" from the test manual.

---

### Failure 2 — No-resource org rejected from pledging

**Setup:** Have a fourth tester (or one of the three from a private/incognito tab) sign up with a fresh account. Complete onboarding so the org exists and is ACTIVE, but **do not list any resources**.

**ACTION:**
1. Sign in as the new account.
2. Open `/dashboard`.
3. Open the failure-test ticket URL directly.

**EXPECTED:**
- Dashboard does NOT show the ticket under "Recommended for you" (no `match` doc was generated for this org).
- On the ticket detail page:
  - The **"Your contribution potential"** panel is hidden.
  - The **"Pledge to this ticket"** card is **not** rendered.
- The org has literally no UI affordance to pledge.
- Firebase Console → `matches` collection: **no doc with `id == ticketId__newOrgId`**.

This proves "No Resource Contribution → Rejected" from the test manual.

---

### Failure 3 — Skip verification = no impact

**Setup:** Raise a brand-new ticket through Steps 1, 2, 3a, 3b, 4 only. Stop after Niraj advances to EXECUTION.

**ACTION:** **Do nothing else.** No proof upload. No "Mark execution complete". No signoffs.

**EXPECTED (verify after waiting ~30 seconds for any latent triggers):**
- `tickets/{id}.phase` remains `"EXECUTION"`. Never reaches CLOSED.
- `tickets/{id}/photoProofs` is empty.
- `tickets/{id}/signoffs` is empty.
- Both contribution docs remain `status: "EXECUTED"` (never reach SIGNED_OFF).
- `badges` collection query `where ticketId == <thisTicketId>` returns **empty** — no badges minted.
- Each org's `organizations/{id}.badges[]` array length is unchanged from before this test.

This proves "Skip Verification → No impact" from the test manual.

---

## Cleanup — between runs

If you want to re-run the happy path with a clean slate:

1. Firebase Console → Firestore → `tickets/` — delete the test ticket docs (this auto-cascades the subcollections in the console UI).
2. Firebase Console → Firestore → `badges/` — query `where ticketId == <oldTicketId>` and delete each result (3 per ticket).
3. Each org's `organizations/{id}.badges` array still has the old `BadgeRef` — manually edit the doc and remove the matching entry, or just leave them (next badge will append, not duplicate).
4. `idempotency/*` keys auto-expire at 24h. If a tester wants to re-submit the **exact same** `requestId` immediately (rare — only matters if you copy-paste a `requestId` somewhere), delete the matching `idempotency/{uid}__{requestId}` doc.

Resources do **not** need to be re-created between runs. They stay listed.

---

## Troubleshooting cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Pledge form doesn't appear on ticket detail | No `match` doc for this contributor | Check contributor's `resources/{id}.embeddingStatus === "ok"` and `terms.availableUntil > ticket.deadline`. Re-create the resource if needed. |
| Recommendation card missing on dashboard | Same as above, OR `matches/{ticketId__orgId}` query failed | Open Firestore Console and grep for the match doc directly. |
| "Move to execution" button missing on host's view | Viewer's `claims.orgId !== ticket.hostOrgId` | Sign out and sign back in to refresh the token. |
| "Mark execution complete" throws `failed-precondition` | No proof uploaded yet | Upload at least one image first. |
| "Confirm delivery" throws `failed-precondition` | Contribution status isn't EXECUTED, OR ticket isn't PENDING_SIGNOFF | Ensure host advanced the phase in Step 4. |
| Auto-close didn't fire after second signoff | `onSignoffRecorded` transaction aborted | `firebase functions:log --only onSignoffRecorded` |
| No badges after close | `onTicketClosed` couldn't read an org doc | `firebase functions:log --only onTicketClosed`. Verify all orgs exist and are ACTIVE. |
| "App Check" toast on any callable | App Check token missing | Ensure `NEXT_PUBLIC_APP_CHECK_SITE_KEY` env var is set in deploy. Otherwise temporarily disable `enforceAppCheck` on the failing callable. |
| Photo upload toast says "permission denied" | Storage rule denied the write | Check `storage.rules` allows the `tickets/{ticketId}/photoProofs/` path for this org. |

---

**End of dry run.** If all happy-path steps land their expected results and all three failure tests behave as described, the system is judges-ready.
