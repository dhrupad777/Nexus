/**
 * NEXUS demo seed — 5 orgs, 8 resources, 3 in-flight tickets, 2 closed tickets.
 *
 * Usage (against the emulator):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   npx tsx scripts/seed.ts
 *
 * Or against the live `buffet-493105` project (admin creds required):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json npx tsx scripts/seed.ts --live
 */
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const LIVE = process.argv.includes("--live");
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "buffet-493105";

if (!getApps().length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  initializeApp({
    credential: sa ? cert(JSON.parse(sa)) : applicationDefault(),
    projectId,
  });
}
const db = getFirestore();

if (!LIVE && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    "Refusing to seed: set FIRESTORE_EMULATOR_HOST (emulator) or pass --live (writes to prod).",
  );
  process.exit(1);
}

const now = Date.now();
const DAY = 86_400_000;

const rel = () => ({
  agreement: { score: 100, lastDecayAt: null },
  execution: { score: 100, lastDecayAt: null },
  closure: { score: 100, lastDecayAt: null },
});

const orgs = [
  {
    id: "ngo-ashraya",
    name: "Ashraya Foundation",
    type: "NGO",
    status: "ACTIVE",
    geo: { lat: 15.463, lng: 75.008, adminRegion: "Dharwad, KA", operatingAreas: ["Dharwad"] },
    contact: { email: "hello@ashraya.example", phone: "+91-9000000001" },
  },
  {
    id: "ngo-sahayata",
    name: "Sahayata Trust",
    type: "NGO",
    status: "ACTIVE",
    geo: { lat: 12.972, lng: 77.594, adminRegion: "Bengaluru, KA", operatingAreas: ["Bengaluru"] },
    contact: { email: "hello@sahayata.example", phone: "+91-9000000002" },
  },
  {
    id: "org-taj-manufacturing",
    name: "Taj Manufacturing Pvt Ltd",
    type: "ORG",
    status: "ACTIVE",
    geo: { lat: 15.465, lng: 75.01, adminRegion: "Dharwad, KA", operatingAreas: ["Dharwad", "Hubli"] },
    contact: { email: "csr@taj.example" },
  },
  {
    id: "org-apollo-hosp",
    name: "Apollo City Hospital",
    type: "ORG",
    status: "ACTIVE",
    geo: { lat: 12.97, lng: 77.60, adminRegion: "Bengaluru, KA", operatingAreas: ["Bengaluru"] },
    contact: { email: "csr@apollo.example" },
  },
  {
    id: "org-kirana-logistics",
    name: "Kirana Logistics",
    type: "ORG",
    status: "ACTIVE",
    geo: { lat: 19.076, lng: 72.877, adminRegion: "Mumbai, MH", operatingAreas: ["Mumbai", "Pune"] },
    contact: { email: "ops@kirana.example" },
  },
];

const resources = [
  { id: "r1", orgId: "org-taj-manufacturing", category: "MANUFACTURING", title: "400 folding tables/month", quantity: 400, unit: "tables", valuationINR: 600_000 },
  { id: "r2", orgId: "org-taj-manufacturing", category: "MATERIAL",      title: "200 steel water tanks",     quantity: 200, unit: "tanks",  valuationINR: 800_000 },
  { id: "r3", orgId: "org-apollo-hosp",       category: "SERVICE",       title: "Free OPD camp days",        quantity: 20,  unit: "days",   valuationINR: 500_000 },
  { id: "r4", orgId: "org-apollo-hosp",       category: "VOLUNTEER_HOURS", title: "Doctor volunteer hours",   quantity: 800, unit: "hours",  valuationINR: 400_000 },
  { id: "r5", orgId: "org-kirana-logistics",  category: "VEHICLE",       title: "6 trucks for relief runs",  quantity: 6,   unit: "trucks", valuationINR: 300_000, emergency: true },
  { id: "r6", orgId: "org-kirana-logistics",  category: "FOOD_KIT",      title: "500 food kits/week",        quantity: 500, unit: "kits",   valuationINR: 250_000, emergency: true },
  { id: "r7", orgId: "ngo-ashraya",           category: "SHELTER",       title: "Community hall for 150",    quantity: 150, unit: "seats",  valuationINR: 150_000 },
  { id: "r8", orgId: "ngo-sahayata",          category: "VOLUNTEER_HOURS", title: "Field volunteer hours",   quantity: 2000, unit: "hours", valuationINR: 200_000 },
];

const tickets = [
  {
    id: "t-open-1",
    hostOrgId: "ngo-ashraya",
    title: "300 tables for School X, Dharwad",
    description: "Replace broken classroom furniture for 600 students across 3 schools.",
    category: "EDUCATION",
    urgency: "NORMAL",
    rapid: false,
    needs: [
      { resourceCategory: "MANUFACTURING", quantity: 300, unit: "tables", valuationINR: 450_000,
        hostSelfPledge: { quantity: 150, valuationINR: 225_000, pctOfNeed: 50 }, progressPct: 50 },
    ],
    geo: { lat: 15.463, lng: 75.008, adminRegion: "Dharwad, KA", operatingAreas: ["Dharwad"] },
    deadline: now + 30 * DAY,
    phase: "OPEN_FOR_CONTRIBUTIONS",
    progressPct: 50,
  },
  {
    id: "t-exec-1",
    hostOrgId: "ngo-sahayata",
    title: "Monthly OPD camp — South Bengaluru",
    description: "Free health camp for 800 households; needs doctor-hours + transport.",
    category: "HEALTH",
    urgency: "NORMAL",
    rapid: false,
    needs: [
      { resourceCategory: "SERVICE",         quantity: 5,  unit: "days",  valuationINR: 125_000,
        hostSelfPledge: { quantity: 0, valuationINR: 0, pctOfNeed: 0 }, progressPct: 100 },
      { resourceCategory: "VOLUNTEER_HOURS", quantity: 200, unit: "hours", valuationINR: 100_000,
        hostSelfPledge: { quantity: 0, valuationINR: 0, pctOfNeed: 0 }, progressPct: 100 },
    ],
    geo: { lat: 12.972, lng: 77.594, adminRegion: "Bengaluru, KA", operatingAreas: ["Bengaluru"] },
    deadline: now + 10 * DAY,
    phase: "EXECUTION",
    progressPct: 100,
  },
  {
    id: "t-rapid-1",
    hostOrgId: "ngo-sahayata",
    title: "Flood relief — Panvel belt",
    description: "Unseasonal flooding; 1,200 families displaced. Food + shelter + transport.",
    category: "DISASTER",
    urgency: "EMERGENCY",
    rapid: true,
    needs: [
      { resourceCategory: "FOOD_KIT", quantity: 1000, unit: "kits",   valuationINR: 500_000,
        hostSelfPledge: { quantity: 100, valuationINR: 50_000, pctOfNeed: 10 }, progressPct: 35 },
      { resourceCategory: "VEHICLE",  quantity: 4,    unit: "trucks", valuationINR: 200_000,
        hostSelfPledge: { quantity: 0, valuationINR: 0, pctOfNeed: 0 }, progressPct: 75 },
    ],
    geo: { lat: 18.988, lng: 73.117, adminRegion: "Panvel, MH", operatingAreas: ["Panvel"] },
    deadline: now + 2 * DAY,
    phase: "OPEN_FOR_CONTRIBUTIONS",
    progressPct: 45,
  },
  {
    id: "t-closed-1",
    hostOrgId: "ngo-ashraya",
    title: "School supplies, Hubli",
    description: "Closed: supplies delivered to 5 schools.",
    category: "EDUCATION",
    urgency: "NORMAL",
    rapid: false,
    needs: [
      { resourceCategory: "MATERIAL", quantity: 500, unit: "kits", valuationINR: 200_000,
        hostSelfPledge: { quantity: 100, valuationINR: 40_000, pctOfNeed: 20 }, progressPct: 100 },
    ],
    geo: { lat: 15.365, lng: 75.123, adminRegion: "Hubli, KA", operatingAreas: ["Hubli"] },
    deadline: now - 10 * DAY,
    phase: "CLOSED",
    progressPct: 100,
    closedAt: now - 5 * DAY,
  },
  {
    id: "t-closed-2",
    hostOrgId: "ngo-sahayata",
    title: "Cyclone Mandous — mobile clinics",
    description: "Closed: 18 mobile clinic days delivered across 4 districts.",
    category: "DISASTER",
    urgency: "EMERGENCY",
    rapid: true,
    needs: [
      { resourceCategory: "SERVICE", quantity: 18, unit: "days", valuationINR: 600_000,
        hostSelfPledge: { quantity: 0, valuationINR: 0, pctOfNeed: 0 }, progressPct: 100 },
    ],
    geo: { lat: 13.082, lng: 80.270, adminRegion: "Chennai, TN", operatingAreas: ["Chennai"] },
    deadline: now - 30 * DAY,
    phase: "CLOSED",
    progressPct: 100,
    closedAt: now - 20 * DAY,
  },
];

const badges = [
  { orgId: "ngo-ashraya",     ticketId: "t-closed-1", ticketTitle: "School supplies, Hubli",          contributionSummary: "Hosted; 100 kits self-pledged",     closedAt: now - 5 * DAY,  publicSlug: "ashraya-hubli-supplies" },
  { orgId: "org-taj-manufacturing", ticketId: "t-closed-1", ticketTitle: "School supplies, Hubli",   contributionSummary: "400 kits manufactured + delivered", closedAt: now - 5 * DAY,  publicSlug: "taj-hubli-supplies" },
  { orgId: "ngo-sahayata",    ticketId: "t-closed-2", ticketTitle: "Cyclone Mandous — mobile clinics", contributionSummary: "Hosted; coordinated 4 districts",  closedAt: now - 20 * DAY, publicSlug: "sahayata-mandous" },
  { orgId: "org-apollo-hosp", ticketId: "t-closed-2", ticketTitle: "Cyclone Mandous — mobile clinics", contributionSummary: "18 doctor-days delivered",         closedAt: now - 20 * DAY, publicSlug: "apollo-mandous" },
];

async function run() {
  console.log(`Seeding ${LIVE ? "LIVE (" + projectId + ")" : "EMULATOR"}…`);

  const batch = db.batch();

  for (const o of orgs) {
    batch.set(db.collection("organizations").doc(o.id), {
      name: o.name,
      type: o.type,
      status: o.status,
      govtDocs: [],
      geo: o.geo,
      reliability: rel(),
      badges: [],
      contact: o.contact,
      createdAt: now - 60 * DAY,
    });
  }

  for (const r of resources) {
    batch.set(db.collection("resources").doc(r.id), {
      orgId: r.orgId,
      category: r.category,
      title: r.title,
      quantity: r.quantity,
      unit: r.unit,
      valuationINR: r.valuationINR,
      terms: { availableFrom: now, availableUntil: now + 180 * DAY, conditions: "" },
      geo: { lat: 0, lng: 0, adminRegion: "IN", operatingAreas: [], serviceRadiusKm: 200 },
      emergencyContract: {
        enabled: Boolean((r as { emergency?: boolean }).emergency),
        emergencyCategories: [],
        maxQuantityPerTicket: r.quantity,
        autoNotify: Boolean((r as { emergency?: boolean }).emergency),
      },
      status: "AVAILABLE",
    });
  }

  for (const t of tickets) {
    batch.set(db.collection("tickets").doc(t.id), {
      hostOrgId: t.hostOrgId,
      title: t.title,
      description: t.description,
      category: t.category,
      urgency: t.urgency,
      rapid: t.rapid,
      needs: t.needs,
      geo: t.geo,
      deadline: t.deadline,
      phase: t.phase,
      progressPct: t.progressPct,
      advancedEarly: false,
      createdAt: now - 5 * DAY,
      phaseChangedAt: now - 2 * DAY,
      closedAt: (t as { closedAt?: number }).closedAt ?? null,
    });
  }

  for (const [i, b] of badges.entries()) {
    batch.set(db.collection("badges").doc(`b${i + 1}`), b);
  }

  await batch.commit();
  console.log(
    `Done. Orgs:${orgs.length}  Resources:${resources.length}  Tickets:${tickets.length}  Badges:${badges.length}`,
  );
  // unused import guard
  void FieldValue;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
