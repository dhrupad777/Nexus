/**
 * verifyFailureTest.ts
 *
 * After manually performing a Part C failure-test scenario in the browser,
 * run this script with the new ticket ID to verify the expected Firestore state.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/verifyFailureTest.ts <ticketId> <C1|C2|C3|C4|C5|C6|C7>
 *
 * Example:
 *   npx tsx --env-file-if-exists=.env.local scripts/verifyFailureTest.ts abc123 C1
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─── helpers ────────────────────────────────────────────────────────────────

function pass(msg: string) { console.log(`  ✅  ${msg}`); }
function fail(msg: string) { console.log(`  ❌  ${msg}`); }
function info(msg: string) { console.log(`  ℹ️   ${msg}`); }
function sep()             { console.log("  " + "─".repeat(56)); }

function ts(val: admin.firestore.Timestamp | number | undefined): string {
  if (!val) return "—";
  if (val instanceof admin.firestore.Timestamp) return val.toDate().toISOString();
  return new Date(val as number).toISOString();
}

async function getTicket(ticketId: string) {
  const snap = await db.collection("tickets").doc(ticketId).get();
  if (!snap.exists) throw new Error(`Ticket ${ticketId} not found`);
  return snap.data()!;
}

async function getContributions(ticketId: string) {
  const snap = await db.collection("tickets").doc(ticketId).collection("contributions").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getBadges(ticketId: string) {
  const snap = await db.collection("badges").where("ticketId", "==", ticketId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getSignoffs(ticketId: string) {
  const snap = await db.collection("tickets").doc(ticketId).collection("signoffs").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function resolveOrg(keyword: string) {
  const snap = await db.collection("organizations").get();
  return snap.docs.find((d) => d.data().name?.toLowerCase().includes(keyword.toLowerCase()));
}

// ─── test runners ────────────────────────────────────────────────────────────

async function runC1(ticketId: string) {
  console.log("\n📋  C.1 — Dispute blocks auto-close\n");
  const t = await getTicket(ticketId);
  const contribs = await getContributions(ticketId);
  const badges   = await getBadges(ticketId);
  const signoffs = await getSignoffs(ticketId);

  info(`Phase:        ${t.phase}`);
  info(`closedAt:     ${ts(t.closedAt)}`);
  info(`Contributions: ${contribs.length}`);
  info(`Signoffs:      ${signoffs.length}`);
  info(`Badges:        ${badges.length}`);
  sep();

  const hasDispute = signoffs.some((s: any) => s.decision === "DISPUTED");
  const notClosed  = t.phase !== "CLOSED";
  const noBadges   = badges.length === 0;

  hasDispute ? pass("At least one signoff has decision=DISPUTED") : fail("No DISPUTED signoff found");
  notClosed  ? pass(`Phase is NOT CLOSED  (${t.phase})`) : fail(`Phase is CLOSED — should be blocked by dispute`);
  noBadges   ? pass("No badges minted (dispute blocks closure)") : fail(`${badges.length} badge(s) were minted — should be 0`);
}

async function runC2(ticketId: string) {
  console.log("\n📋  C.2 — Org with no resources can't pledge\n");
  const contribs = await getContributions(ticketId);

  info(`Contributions on ticket: ${contribs.length}`);
  sep();

  const noResourceContrib = contribs.every((c: any) => c.status !== "PROPOSED" && c.status !== "COMMITTED");

  noResourceContrib
    ? pass("No PROPOSED or COMMITTED contributions from resource-less org")
    : fail("A contribution was created — server should have rejected it");

  info("Also verify in browser: pledge form Submit button is disabled for the 4th org.");
  info("To test server-layer: invoke callables directly and confirm rejection error.");
}

async function runC3(ticketId: string) {
  console.log("\n📋  C.3 — Skip verification = no badges\n");
  const t      = await getTicket(ticketId);
  const badges = await getBadges(ticketId);

  info(`Phase:   ${t.phase}`);
  info(`Badges:  ${badges.length}`);
  sep();

  t.phase === "EXECUTION"
    ? pass("Phase is EXECUTION (host never advanced past execution)")
    : fail(`Phase is ${t.phase} — expected EXECUTION`);

  badges.length === 0
    ? pass("No badges minted (execution not verified)")
    : fail(`${badges.length} badge(s) minted — should be 0`);
}

async function runC4(ticketId: string) {
  console.log("\n📋  C.4 — Incremental partial pledges (50→30)\n");
  const t        = await getTicket(ticketId);
  const contribs = await getContributions(ticketId);

  const albinDoc = await resolveOrg("albin");
  const albinId  = albinDoc?.id;

  const albinContribs = contribs.filter((c: any) => c.contributorOrgId === albinId);
  const totalQty      = albinContribs.reduce((s: number, c: any) => s + (c.offered?.quantity ?? 0), 0);

  info(`Albin org ID:  ${albinId}`);
  info(`Albin contributions: ${albinContribs.length}`);
  albinContribs.forEach((c: any, i: number) => {
    info(`  [${i + 1}] status=${c.status}  qty=${c.offered?.quantity}`);
  });
  info(`Total qty committed: ${totalQty}`);
  info(`Ticket progressPct: ${t.progressPct}`);
  sep();

  albinContribs.length === 2
    ? pass("Two separate contributions from Albin on same ticket")
    : fail(`Expected 2 contributions, found ${albinContribs.length}`);

  totalQty === 80
    ? pass("Total offered quantity = 80 (50+30)")
    : fail(`Total quantity = ${totalQty}, expected 80`);

  t.progressPct === 100
    ? pass("Overall progress = 100%")
    : fail(`Progress = ${t.progressPct}%, expected 100`);

  // Check resource reservedQuantity
  if (albinId) {
    const resSnap = await db.collection("resources").where("orgId", "==", albinId).get();
    resSnap.docs.forEach((d) => {
      const r = d.data();
      info(`Resource "${r.title}": qty=${r.quantity} reservedQty=${r.reservedQuantity}`);
    });
  }
}

async function runC5(ticketId: string) {
  console.log("\n📋  C.5 — Phase advance auto-rejects stranded PROPOSED\n");
  const t        = await getTicket(ticketId);
  const contribs = await getContributions(ticketId);

  const albinDoc    = await resolveOrg("albin");
  const dhrupadDoc  = await resolveOrg("dhrupad manufacturing");
  const albinId     = albinDoc?.id;
  const dhrupadId   = dhrupadDoc?.id;

  const albinContrib   = contribs.find((c: any) => c.contributorOrgId === albinId);
  const dhrupadContrib = contribs.find((c: any) => c.contributorOrgId === dhrupadId);

  info(`Albin contribution:   status=${(albinContrib as any)?.status ?? "NOT FOUND"}`);
  info(`Dhrupad contribution: status=${(dhrupadContrib as any)?.status ?? "NOT FOUND"}`);
  info(`Ticket phase: ${t.phase}`);
  sep();

  (albinContrib as any)?.status === "REJECTED"
    ? pass("Albin's contribution auto-REJECTED on phase advance")
    : fail(`Albin's contribution status = ${(albinContrib as any)?.status ?? "NOT FOUND"}, expected REJECTED`);

  const rejectReason = (albinContrib as any)?.rejectReason ?? "";
  rejectReason.includes("auto-rejected")
    ? pass(`rejectReason contains "auto-rejected": "${rejectReason}"`)
    : fail(`rejectReason missing or wrong: "${rejectReason}"`);

  (dhrupadContrib as any)?.status === "SIGNED_OFF" || (dhrupadContrib as any)?.status === "COMMITTED" || (dhrupadContrib as any)?.status === "EXECUTED"
    ? pass(`Dhrupad contribution progressed normally (${(dhrupadContrib as any)?.status})`)
    : fail(`Dhrupad contribution status = ${(dhrupadContrib as any)?.status}`);

  const badges = await getBadges(ticketId);
  const albinBadge = badges.find((b: any) => b.orgId === albinId);
  !albinBadge
    ? pass("No badge minted for Albin (auto-rejected, not a contributor)")
    : fail("Albin got a badge — should not have");
}

async function runC6(ticketId: string) {
  console.log("\n📋  C.6 — Per-need over-pledge is blocked\n");
  const contribs = await getContributions(ticketId);
  const t        = await getTicket(ticketId);

  const albinDoc = await resolveOrg("albin");
  const albinId  = albinDoc?.id;
  const albinContribs = contribs.filter((c: any) => c.contributorOrgId === albinId && c.status !== "REJECTED");
  const totalFilled = albinContribs.reduce((s: number, c: any) => s + (c.offered?.quantity ?? 0), 0);

  info(`Need capacity (from ticket): ${JSON.stringify(t.needs?.map((n: any) => ({ qty: n.quantity, unit: n.unit })))}`);
  info(`Albin non-rejected contributions: ${albinContribs.length}`);
  info(`Total filled by Albin: ${totalFilled}`);
  info(`Ticket progressPct: ${t.progressPct}`);
  sep();

  t.progressPct === 100
    ? pass("Need at 100% after first pledge")
    : fail(`Progress is ${t.progressPct}% — need should be at 100`);

  albinContribs.length === 1
    ? pass("Only 1 non-rejected contribution (second attempt was blocked)")
    : fail(`${albinContribs.length} non-rejected contributions — over-pledge may have succeeded`);

  info("Verify in browser: pledge form shows max=0 and Submit is disabled after need is at 100%.");
}

async function runC7(ticketId: string) {
  console.log("\n📋  C.7 — Host rejects; contributor re-pledges\n");
  const contribs = await getContributions(ticketId);
  const t        = await getTicket(ticketId);

  const albinDoc  = await resolveOrg("albin");
  const albinId   = albinDoc?.id;
  const albinContribs = contribs.filter((c: any) => c.contributorOrgId === albinId);
  const rejected  = albinContribs.filter((c: any) => c.status === "REJECTED");
  const active    = albinContribs.filter((c: any) => c.status !== "REJECTED");

  info(`Albin total contributions: ${albinContribs.length}`);
  info(`  REJECTED: ${rejected.length}`);
  info(`  Active (non-rejected): ${active.length}`);
  info(`  Active statuses: ${active.map((c: any) => c.status).join(", ") || "none"}`);
  info(`Ticket progressPct: ${t.progressPct}`);
  sep();

  rejected.length >= 1
    ? pass(`${rejected.length} REJECTED contribution(s) — host rejection recorded`)
    : fail("No REJECTED contributions found — was the host rejection done?");

  if (active.length >= 1) {
    pass(`Re-pledge submitted (${active.length} active contribution) — status: ${active[0].status}`);
  } else {
    info("No re-pledge yet — Albin has not re-pledged after rejection.");
  }

  info("Verify in browser: REJECTED card is hidden; pledge form is still visible and enabled.");
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const [, , ticketId, scenario] = process.argv;

  if (!ticketId || !scenario) {
    console.log("\nUsage:");
    console.log("  npx tsx --env-file-if-exists=.env.local scripts/verifyFailureTest.ts <ticketId> <C1|C2|C3|C4|C5|C6|C7>\n");
    console.log("Examples:");
    console.log("  npx tsx --env-file-if-exists=.env.local scripts/verifyFailureTest.ts abc123def C1");
    console.log("  npx tsx --env-file-if-exists=.env.local scripts/verifyFailureTest.ts xyz789 C4\n");
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   NEXUS — FAILURE TEST VERIFIER                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Ticket: ${ticketId}`);
  console.log(`  Test:   ${scenario.toUpperCase()}`);
  console.log(`  Run at: ${new Date().toISOString()}\n`);

  switch (scenario.toUpperCase()) {
    case "C1": await runC1(ticketId); break;
    case "C2": await runC2(ticketId); break;
    case "C3": await runC3(ticketId); break;
    case "C4": await runC4(ticketId); break;
    case "C5": await runC5(ticketId); break;
    case "C6": await runC6(ticketId); break;
    case "C7": await runC7(ticketId); break;
    default:
      console.error(`Unknown scenario: ${scenario}. Must be one of C1–C7.`);
      process.exit(1);
  }

  console.log();
}

main().catch(console.error);
