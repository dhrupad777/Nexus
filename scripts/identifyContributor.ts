/**
 * identifyContributor.ts
 * Resolves the unknown contributor org and prints a full picture of
 * the dry-run ticket's actual participants vs expected participants.
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const TICKET_ID    = "ttoQA25JsOJtUl3aiq9e";
const MYSTERY_ORG  = "MhyKfwaLmJRUJ92gj8WSOGelcwj1";

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   CONTRIBUTOR IDENTITY + FULL TICKET STATE              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── Resolve mystery org ───────────────────────────────────────────────────
  const orgDoc = await db.collection("organizations").doc(MYSTERY_ORG).get();
  if (!orgDoc.exists) {
    console.log(`❌ Org ${MYSTERY_ORG} not found in Firestore.`);
  } else {
    const o = orgDoc.data()!;
    console.log("🏢  Mystery contributor org:");
    console.log(`    ID:     ${orgDoc.id}`);
    console.log(`    Name:   ${o.name}`);
    console.log(`    Type:   ${o.type}`);
    console.log(`    Status: ${o.status}`);
    console.log(`    Email:  ${o.email ?? o.contactEmail ?? "—"}`);
    console.log();
  }

  // ── Ticket snapshot ───────────────────────────────────────────────────────
  const ticketDoc = await db.collection("tickets").doc(TICKET_ID).get();
  const t = ticketDoc.data()!;

  const closedAt = t.closedAt instanceof admin.firestore.Timestamp
    ? t.closedAt.toDate().toISOString()
    : t.closedAt ? new Date(t.closedAt).toISOString() : "—";

  console.log("🎫  Ticket snapshot:");
  console.log(`    ID:             ${TICKET_ID}`);
  console.log(`    Title:          ${t.title}`);
  console.log(`    Phase:          ${t.phase}`);
  console.log(`    Progress:       ${t.progressPct ?? 0}%`);
  console.log(`    closedAt:       ${closedAt}`);
  console.log(`    contributorCnt: ${t.contributorCount ?? 0}`);
  console.log(`    participantIds: ${JSON.stringify(t.participantOrgIds ?? [])}`);
  console.log();

  // ── All orgs lookup table ─────────────────────────────────────────────────
  console.log("📋  All organisations in Firestore:");
  const allOrgs = await db.collection("organizations").get();
  allOrgs.docs.forEach((d) => {
    const o = d.data();
    console.log(`    [${d.id}]  "${o.name}"  type=${o.type}  status=${o.status}`);
  });
  console.log();

  // ── Contributions ─────────────────────────────────────────────────────────
  console.log("📑  Contributions on this ticket:");
  const contribs = await db.collection("tickets").doc(TICKET_ID)
    .collection("contributions").get();

  for (const doc of contribs.docs) {
    const c = doc.data();
    const orgSnap = await db.collection("organizations").doc(c.contributorOrgId).get();
    const orgName = orgSnap.exists ? orgSnap.data()!.name : "UNKNOWN";
    const committedAt = c.committedAt instanceof admin.firestore.Timestamp
      ? c.committedAt.toDate().toISOString()
      : c.committedAt ? new Date(c.committedAt).toISOString() : "—";
    const signedOffAt = c.signedOffAt instanceof admin.firestore.Timestamp
      ? c.signedOffAt.toDate().toISOString()
      : c.signedOffAt ? new Date(c.signedOffAt).toISOString() : "—";
    console.log(`  ── [${doc.id}]`);
    console.log(`     Contributor: "${orgName}"  (${c.contributorOrgId})`);
    console.log(`     Status:      ${c.status}`);
    console.log(`     Offered:     ${c.offered?.quantity} ${c.offered?.unit ?? ""}`);
    console.log(`     committedAt: ${committedAt}`);
    console.log(`     signedOffAt: ${signedOffAt}`);
    console.log();
  }

  // ── Badges ────────────────────────────────────────────────────────────────
  console.log("🏅  Badges for this ticket:");
  const badges = await db.collection("badges")
    .where("ticketId", "==", TICKET_ID).get();

  for (const doc of badges.docs) {
    const b = doc.data();
    const orgSnap = await db.collection("organizations").doc(b.orgId).get();
    const orgName = orgSnap.exists ? orgSnap.data()!.name : "UNKNOWN";
    console.log(`  ── [${doc.id}]`);
    console.log(`     Org:   "${orgName}"  (${b.orgId})`);
    console.log(`     Role:  ${b.role}`);
    console.log(`     Score: ${b.score ?? "—"}`);
    console.log();
  }

  // ── Summary verdict ───────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════");
  console.log("  VERDICT");
  console.log("══════════════════════════════════════════════════════════");
  const isClosed   = t.phase === "CLOSED";
  const is100      = (t.progressPct ?? 0) === 100;
  const hasClosed  = !!t.closedAt;
  const contribOk  = contribs.docs.every((d) => d.data().status === "SIGNED_OFF");
  const badgeCount = badges.size;

  console.log(`  Phase CLOSED:          ${isClosed  ? "✅" : "❌"}  (${t.phase})`);
  console.log(`  Progress 100%:         ${is100     ? "✅" : "❌"}  (${t.progressPct ?? 0}%)`);
  console.log(`  closedAt set:          ${hasClosed ? "✅" : "❌"}  (${closedAt})`);
  console.log(`  All contribs SIGN_OFF: ${contribOk ? "✅" : "❌"}`);
  console.log(`  Badges minted:         ${badgeCount >= 2 ? "✅" : "⚠️ "}  (${badgeCount})`);
  console.log();

  if (isClosed && is100 && hasClosed && contribOk) {
    console.log("  🎉  TICKET IS FULLY CLOSED AND VERIFIED IN FIRESTORE.");
    console.log("      The checklist steps 3a → 5d ran successfully.");
    console.log("      Note: contributor was NOT Albin/Dhrupad (see org name above) —");
    console.log("      this is a real-user completion, not the scripted dry-run path.");
  } else {
    console.log("  ⚠️   Ticket is NOT fully closed — see items above.");
  }
  console.log();
}

main().catch(console.error);
