/**
 * auditTicketLifecycle.ts
 *
 * Full dry-run audit: for the most recent ticket raised by Niraj Foundation,
 * checks ticket phase, contributions, signoffs, resource ledger updates, and
 * badge minting.
 *
 * Usage:
 *   npx tsx -r dotenv/config scripts/auditTicketLifecycle.ts dotenv_config_path=.env.local
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ─── helpers ────────────────────────────────────────────────────────────────

function ts(val: admin.firestore.Timestamp | number | undefined): string {
  if (!val) return "—";
  if (val instanceof admin.firestore.Timestamp) {
    return val.toDate().toISOString();
  }
  return new Date(val as number).toISOString();
}

function check(label: string, pass: boolean, detail = "") {
  const icon = pass ? "✅" : "❌";
  console.log(`  ${icon}  ${label}${detail ? "  →  " + detail : ""}`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function audit() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   NEXUS DRY RUN — FULL TICKET LIFECYCLE AUDIT            ║");
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`  Run at: ${new Date().toISOString()}\n`);

  // ── 1. Resolve orgs ──────────────────────────────────────────────────────
  const orgsSnap = await db.collection("organizations").get();

  const nirajDoc = orgsSnap.docs.find((d) =>
    d.data().name?.toLowerCase().includes("niraj")
  );
  const albinDoc = orgsSnap.docs.find((d) =>
    d.data().name?.toLowerCase().includes("albin")
  );
  const dhrupadDoc = orgsSnap.docs.find((d) =>
    d.data().name?.toLowerCase().includes("dhrupad")
  );

  if (!nirajDoc || !albinDoc || !dhrupadDoc) {
    console.error("❌  Could not find all three orgs. Aborting.");
    return;
  }

  console.log("🏢  Orgs resolved:");
  console.log(`    Niraj   → ${nirajDoc.id}  (${nirajDoc.data().name})`);
  console.log(`    Albin   → ${albinDoc.id}  (${albinDoc.data().name})`);
  console.log(`    Dhrupad → ${dhrupadDoc.id}  (${dhrupadDoc.data().name})\n`);

  // ── 2. Find most-recent ticket by Niraj ──────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 1 — TICKET STATE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const ticketsSnap = await db
    .collection("tickets")
    .where("hostOrgId", "==", nirajDoc.id)
    .get();

  if (ticketsSnap.empty) {
    console.error("❌  No tickets found for Niraj Foundation. Aborting.");
    return;
  }

  // Pick the most recent
  const ticketDoc = ticketsSnap.docs.sort((a, b) => {
    const at = a.data().createdAt;
    const bt = b.data().createdAt;
    const aMs = at instanceof admin.firestore.Timestamp ? at.toMillis() : (at ?? 0);
    const bMs = bt instanceof admin.firestore.Timestamp ? bt.toMillis() : (bt ?? 0);
    return bMs - aMs;
  })[0];

  const t = ticketDoc.data();
  const ticketId = ticketDoc.id;

  console.log(`  Ticket ID:    ${ticketId}`);
  console.log(`  Title:        ${t.title}`);
  console.log(`  Created:      ${ts(t.createdAt)}`);
  console.log(`  Phase:        ${t.phase}`);
  console.log(`  Progress:     ${t.progressPct ?? 0}%`);
  console.log(`  closedAt:     ${ts(t.closedAt)}`);
  console.log(`  Participants: ${(t.participantOrgIds ?? []).length} org(s)`);
  console.log();

  check("Ticket exists in Firestore", true);
  check(
    "Phase is CLOSED",
    t.phase === "CLOSED",
    t.phase
  );
  check(
    "Progress is 100%",
    (t.progressPct ?? 0) === 100,
    `${t.progressPct ?? 0}%`
  );
  check(
    "closedAt timestamp set",
    !!t.closedAt,
    ts(t.closedAt)
  );
  check(
    "Both contributors in participantOrgIds",
    (t.participantOrgIds ?? []).includes(albinDoc.id) &&
      (t.participantOrgIds ?? []).includes(dhrupadDoc.id),
    JSON.stringify(t.participantOrgIds ?? [])
  );

  // ── 3. Contributions ─────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 2 — CONTRIBUTIONS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const contribsSnap = await db
    .collection("tickets")
    .doc(ticketId)
    .collection("contributions")
    .get();

  console.log(`  Total contributions: ${contribsSnap.size}\n`);

  let albinContrib: admin.firestore.DocumentData | null = null;
  let dhrupadContrib: admin.firestore.DocumentData | null = null;

  contribsSnap.forEach((doc) => {
    const c = doc.data();
    const orgLabel =
      c.contributorOrgId === albinDoc.id
        ? "Albin Capital"
        : c.contributorOrgId === dhrupadDoc.id
        ? "Dhrupad Manufacturing"
        : c.contributorOrgId;

    console.log(`  ── [${doc.id}]`);
    console.log(`     Org:          ${orgLabel}`);
    console.log(`     Status:       ${c.status}`);
    console.log(`     Offered qty:  ${c.offered?.quantity} ${c.offered?.unit ?? ""}`);
    console.log(`     committedAt:  ${ts(c.committedAt)}`);
    console.log(`     executedAt:   ${ts(c.executedAt)}`);
    console.log(`     signedOffAt:  ${ts(c.signedOffAt)}`);
    console.log();

    if (c.contributorOrgId === albinDoc.id) albinContrib = c;
    if (c.contributorOrgId === dhrupadDoc.id) dhrupadContrib = c;
  });

  check(
    "Albin contribution exists",
    !!albinContrib,
  );
  check(
    "Albin contribution is SIGNED_OFF",
    (albinContrib as any)?.status === "SIGNED_OFF",
    (albinContrib as any)?.status
  );
  check(
    "Dhrupad contribution exists",
    !!dhrupadContrib,
  );
  check(
    "Dhrupad contribution is SIGNED_OFF",
    (dhrupadContrib as any)?.status === "SIGNED_OFF",
    (dhrupadContrib as any)?.status
  );

  // ── 4. Signoffs ──────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 3 — SIGNOFFS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const signoffsSnap = await db
    .collection("tickets")
    .doc(ticketId)
    .collection("signoffs")
    .get();

  console.log(`  Total signoffs: ${signoffsSnap.size}\n`);

  let albinSignoff = false;
  let dhrupadSignoff = false;

  signoffsSnap.forEach((doc) => {
    const s = doc.data();
    const orgLabel =
      s.orgId === albinDoc.id
        ? "Albin Capital"
        : s.orgId === dhrupadDoc.id
        ? "Dhrupad Manufacturing"
        : s.orgId;
    console.log(`  ── [${doc.id}]`);
    console.log(`     Org:       ${orgLabel}`);
    console.log(`     Decision:  ${s.decision}`);
    console.log(`     At:        ${ts(s.createdAt)}`);
    console.log();

    if (s.orgId === albinDoc.id && s.decision === "APPROVED") albinSignoff = true;
    if (s.orgId === dhrupadDoc.id && s.decision === "APPROVED") dhrupadSignoff = true;
  });

  check("Albin signoff recorded (APPROVED)", albinSignoff);
  check("Dhrupad signoff recorded (APPROVED)", dhrupadSignoff);

  // ── 5. Photo proofs ───────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 4 — PHOTO PROOFS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const proofsSnap = await db
    .collection("tickets")
    .doc(ticketId)
    .collection("photoProofs")
    .get();

  console.log(`  Photo proofs uploaded: ${proofsSnap.size}`);
  proofsSnap.forEach((doc) => {
    const p = doc.data();
    console.log(`  ── [${doc.id}]  path=${p.storagePath}  at=${ts(p.createdAt)}`);
  });
  check("At least one photo proof uploaded", proofsSnap.size >= 1, `${proofsSnap.size} proof(s)`);

  // ── 6. Resource ledger ───────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 5 — RESOURCE LEDGER (post-close)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const albinRes = await db
    .collection("resources")
    .where("orgId", "==", albinDoc.id)
    .get();
  const dhrupadRes = await db
    .collection("resources")
    .where("orgId", "==", dhrupadDoc.id)
    .get();

  console.log("  Albin Capital resources:");
  albinRes.forEach((doc) => {
    const r = doc.data();
    console.log(`  ── [${doc.id}] "${r.title}"`);
    console.log(`     category:         ${r.category}`);
    console.log(`     quantity:         ${r.quantity}`);
    console.log(`     reservedQuantity: ${r.reservedQuantity}`);
    console.log(`     status:           ${r.status}`);
    check(
      "reservedQuantity reset to 0",
      r.reservedQuantity === 0,
      `${r.reservedQuantity}`
    );
  });

  console.log("\n  Dhrupad Manufacturing resources:");
  dhrupadRes.forEach((doc) => {
    const r = doc.data();
    console.log(`  ── [${doc.id}] "${r.title}"`);
    console.log(`     category:         ${r.category}`);
    console.log(`     quantity:         ${r.quantity}`);
    console.log(`     reservedQuantity: ${r.reservedQuantity}`);
    console.log(`     status:           ${r.status}`);
    check(
      "reservedQuantity reset to 0",
      r.reservedQuantity === 0,
      `${r.reservedQuantity}`
    );
  });

  // ── 7. Badges ────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 6 — BADGES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const badgesSnap = await db
    .collection("badges")
    .where("ticketId", "==", ticketId)
    .get();

  console.log(`  Badges minted for this ticket: ${badgesSnap.size}\n`);

  let nirajBadge = false, albinBadge = false, dhrupadBadge = false;

  badgesSnap.forEach((doc) => {
    const b = doc.data();
    const orgLabel =
      b.orgId === nirajDoc.id
        ? "Niraj Foundation"
        : b.orgId === albinDoc.id
        ? "Albin Capital"
        : b.orgId === dhrupadDoc.id
        ? "Dhrupad Manufacturing"
        : b.orgId;
    console.log(`  ── [${doc.id}]`);
    console.log(`     Org:   ${orgLabel}`);
    console.log(`     Role:  ${b.role}`);
    console.log(`     Score: ${b.score}`);
    console.log();

    if (b.orgId === nirajDoc.id) nirajBadge = true;
    if (b.orgId === albinDoc.id) albinBadge = true;
    if (b.orgId === dhrupadDoc.id) dhrupadBadge = true;
  });

  check("Badge minted for Niraj (HOST)", nirajBadge);
  check("Badge minted for Albin (CONTRIBUTOR)", albinBadge);
  check("Badge minted for Dhrupad (CONTRIBUTOR)", dhrupadBadge);

  // ── 8. Summary ───────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   FINAL AUDIT SUMMARY                                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const allPassed =
    t.phase === "CLOSED" &&
    (t.progressPct ?? 0) === 100 &&
    !!t.closedAt &&
    (albinContrib as any)?.status === "SIGNED_OFF" &&
    (dhrupadContrib as any)?.status === "SIGNED_OFF" &&
    albinSignoff &&
    dhrupadSignoff &&
    proofsSnap.size >= 1 &&
    nirajBadge &&
    albinBadge &&
    dhrupadBadge;

  if (allPassed) {
    console.log("  🎉  ALL CHECKS PASSED — Dry run ticket fully completed!");
    console.log(`      Ticket "${t.title}" is CLOSED with 100% progress.`);
    console.log("      Both resources deducted. All badges minted.");
  } else {
    console.log("  ⚠️   SOME CHECKS FAILED — see ❌ items above for details.");
  }
  console.log();
}

audit().catch(console.error);
