import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkTicketsByOrg(orgNameKeyword: string) {
  // Find the org by name (case-insensitive partial match)
  const orgsSnap = await db.collection("organizations").get();
  const matchedOrgs = orgsSnap.docs.filter((doc) =>
    doc.data().name?.toLowerCase().includes(orgNameKeyword.toLowerCase())
  );

  if (matchedOrgs.length === 0) {
    console.log(`No org found matching: "${orgNameKeyword}"`);
    return;
  }

  for (const orgDoc of matchedOrgs) {
    const orgData = orgDoc.data();
    console.log(`\n🏢 Org: "${orgData.name}" (ID: ${orgDoc.id}) | Status: ${orgData.status}`);
    console.log("══════════════════════════════════════════════════════");

    const ticketsSnap = await db
      .collection("tickets")
      .where("hostOrgId", "==", orgDoc.id)
      .get();

    if (ticketsSnap.empty) {
      console.log("  No tickets found for this org.");
      continue;
    }

    const sorted = ticketsSnap.docs
      .sort((a, b) => (b.data().createdAt ?? 0) - (a.data().createdAt ?? 0))
      .slice(0, 5);

    sorted.forEach((doc) => {
      const data = doc.data();
      const embStatus = data.embeddingStatus ?? "MISSING";
      const embIcon = embStatus === "ok" ? "✅" : embStatus === "failed" ? "❌" : "⚠️";
      console.log(`  Ticket ID:         ${doc.id}`);
      console.log(`  Title:             ${data.title}`);
      console.log(`  Phase:             ${data.phase}`);
      console.log(`  Created At:        ${new Date(data.createdAt).toISOString()}`);
      console.log(`  Embedding Status:  ${embIcon} ${embStatus}`);
      console.log(`  Embedding Version: ${data.embeddingVersion ?? "N/A"}`);
      console.log("  ──────────────────────────────────────────────────");
    });
  }
}

async function main() {
  await checkTicketsByOrg("albin");
  await checkTicketsByOrg("niraj");
}

main().catch(console.error);
