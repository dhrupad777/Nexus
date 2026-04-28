import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function diagnose() {
  console.log("══════════════════════════════════════════════════════");
  console.log("  NEXUS MATCHING DIAGNOSIS — Flexon Foods");
  console.log("══════════════════════════════════════════════════════\n");

  // ── 1. Find Flexon Foods org ──────────────────────────────────────────
  const orgsSnap = await db.collection("organizations").get();
  const flexonDoc = orgsSnap.docs.find((d) =>
    d.data().name?.toLowerCase().includes("flexon")
  );
  const albinDoc = orgsSnap.docs.find((d) =>
    d.data().name?.toLowerCase().includes("albin capital")
  );
  const nirajDoc = orgsSnap.docs.find((d) =>
    d.data().name?.toLowerCase().includes("niraj foundation")
  );

  if (!flexonDoc) {
    console.log("❌ Flexon Foods org not found in Firestore!");
    return;
  }

  const flexonData = flexonDoc.data();
  console.log(`🏢 Flexon Foods (ID: ${flexonDoc.id})`);
  console.log(`   Status:  ${flexonData.status}`);
  console.log(`   Geo:     lat=${flexonData.geo?.lat}, lng=${flexonData.geo?.lng}, region=${flexonData.geo?.adminRegion}`);
  console.log();

  // ── 2. Check Flexon's resources ───────────────────────────────────────
  console.log("📦 Flexon Resources:");
  const resourcesSnap = await db.collection("resources")
    .where("orgId", "==", flexonDoc.id)
    .get();

  if (resourcesSnap.empty) {
    console.log("   ❌ No resources found for Flexon Foods!");
  } else {
    resourcesSnap.forEach((doc) => {
      const d = doc.data();
      const embIcon = d.embeddingStatus === "ok" ? "✅" : "❌";
      console.log(`   - [${doc.id}] "${d.title}" | category=${d.category} | status=${d.status} | embedding=${embIcon} ${d.embeddingStatus ?? "MISSING"}`);
    });
  }
  console.log();

  // ── 3. Check matches for Niraj/Albin tickets ──────────────────────────
  const ticketOrgIds = [albinDoc?.id, nirajDoc?.id].filter(Boolean);
  const ticketsToCheck: { id: string; title: string; orgName: string }[] = [];

  for (const orgId of ticketOrgIds) {
    const orgName = orgId === albinDoc?.id ? "Albin Capital" : "Niraj Foundation";
    const tSnap = await db.collection("tickets")
      .where("hostOrgId", "==", orgId)
      .get();
    tSnap.docs.forEach((d) => {
      ticketsToCheck.push({ id: d.id, title: d.data().title, orgName });
    });
  }

  console.log(`🎫 Tickets from Albin Capital / Niraj Foundation: ${ticketsToCheck.length}`);
  console.log();
  console.log("🔗 Checking match docs for Flexon Foods...\n");

  let matchFound = false;
  for (const ticket of ticketsToCheck) {
    const matchId = `${ticket.id}__${flexonDoc.id}`;
    const matchDoc = await db.collection("matches").doc(matchId).get();
    if (matchDoc.exists) {
      matchFound = true;
      const m = matchDoc.data()!;
      console.log(`   ✅ MATCH EXISTS: ${matchId}`);
      console.log(`      Ticket: "${ticket.title}" (${ticket.orgName})`);
      console.log(`      Score: ${m.score?.toFixed(4)} | Surfaced: ${m.surfaced} | Dismissed: ${m.dismissed}`);
    } else {
      console.log(`   ❌ NO MATCH: ${matchId}`);
      console.log(`      Ticket: "${ticket.title}" (${ticket.orgName})`);
    }
  }

  // ── 4. Check all matches for Flexon globally ──────────────────────────
  console.log();
  const allMatchesSnap = await db.collection("matches")
    .where("orgId", "==", flexonDoc.id)
    .get();
  console.log(`📊 Total match docs for Flexon Foods in 'matches' collection: ${allMatchesSnap.size}`);
  if (!allMatchesSnap.empty) {
    allMatchesSnap.forEach((doc) => {
      const m = doc.data();
      console.log(`   - [${doc.id}] ticketId=${m.ticketId} | score=${m.score?.toFixed(4)} | surfaced=${m.surfaced}`);
    });
  }

  // ── 5. Root cause summary ─────────────────────────────────────────────
  console.log();
  console.log("══════════════════════════════════════════════════════");
  console.log("  ROOT CAUSE ANALYSIS");
  console.log("══════════════════════════════════════════════════════");

  if (resourcesSnap.empty) {
    console.log("🔴 CAUSE: Flexon Foods has NO resources listed.");
    console.log("   The matching pipeline filters out orgs with no AVAILABLE resources.");
    console.log("   FIX: Flexon Foods must create at least one resource.");
  } else {
    const availableWithEmbedding = resourcesSnap.docs.filter(
      (d) => d.data().status === "AVAILABLE" && d.data().embeddingStatus === "ok"
    );
    if (availableWithEmbedding.length === 0) {
      console.log("🔴 CAUSE: Flexon Foods has resources but none are AVAILABLE with a valid embedding.");
      console.log("   FIX: Ensure Flexon's resources have status=AVAILABLE and embeddingStatus=ok.");
    } else if (!matchFound) {
      console.log("🔴 CAUSE: Flexon has AVAILABLE resources with embeddings, but NO match docs exist.");
      console.log("   This means the tickets were created BEFORE Flexon listed resources,");
      console.log("   so the onTicketCreated flow never considered Flexon as a candidate.");
      console.log("   FIX: Re-run the Flow A matching pipeline for the affected tickets.");
    }
  }
}

diagnose().catch(console.error);
