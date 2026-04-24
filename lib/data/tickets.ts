/**
 * Ticket data model — aligned with Nexus_Ticket_Display_Spec.md §3.
 * All §-references in this file point to that spec.
 */

export type TicketMode = "RAPID" | "NON_RAPID";
export type TicketStatus = "OPEN" | "ACTIVE" | "COMPLETED";
export type TicketPhase = "PLANNING" | "EXECUTION" | "COMPLETION";
export type UrgencyLevel = "NORMAL" | "HIGH" | "EMERGENCY";
export type VerificationStatus = "VERIFIED" | "PENDING" | "UNVERIFIED";
export type ContributorStatus = "PLEDGED" | "DELIVERED" | "VERIFIED";

export type TicketNeed = {
  resource: string;
  unit: string;
  total_required: number;
  total_fulfilled: number;
};

export type Contributor = {
  org_id: string;
  org_name: string;
  resource: string;
  quantity: number;
  unit: string;
  status: ContributorStatus;
  at: string;
};

export type ProofUpdate = {
  at: string;
  note: string;
  author?: string;
};

export type Timeline = {
  start_date: string;
  expected_completion: string;
};

export type MockTicket = {
  // 3.1 Core
  id: string;
  title: string;
  category: string;
  subtype?: string;
  description: string;
  location: string;
  distance_km?: number;
  host_entity: string;
  host_verification_status: VerificationStatus;

  // 3.2 Requirement (aggregate over `needs`)
  needs: TicketNeed[];
  total_required: number;
  total_fulfilled: number;
  total_remaining: number;
  completion_percentage: number;

  // 3.3 Contribution context (per viewing entity)
  max_contribution_possible: number;
  contribution_feasibility: boolean;
  contribution_impact_percentage: number;

  // 3.4 Participation
  contributors_list: Contributor[];
  contributor_count: number;

  // 3.5 Status
  ticket_status: TicketStatus;
  phase: TicketPhase;
  urgency_level: UrgencyLevel;

  // Mode (§2)
  mode: TicketMode;

  // 3.6 Optional
  timeline?: Timeline;
  execution_plan?: string;
  proof_updates?: ProofUpdate[];

  // Display helpers
  urgency: string;      // human-friendly: "Emergency" | "High" | "Normal"
  deadline: string;     // formatted for display
  progress: number;     // mirrors completion_percentage, for components using the old field
  image?: string;
};

const urgencyLabel: Record<UrgencyLevel, string> = {
  EMERGENCY: "Emergency",
  HIGH: "High",
  NORMAL: "Normal",
};

function mkTicket(input: Omit<
  MockTicket,
  | "total_required"
  | "total_fulfilled"
  | "total_remaining"
  | "completion_percentage"
  | "contributor_count"
  | "urgency"
  | "progress"
>): MockTicket {
  const total_required = input.needs.reduce((s, n) => s + n.total_required, 0);
  const total_fulfilled = input.needs.reduce((s, n) => s + n.total_fulfilled, 0);
  const total_remaining = Math.max(0, total_required - total_fulfilled);
  const completion_percentage =
    total_required > 0 ? Math.round((total_fulfilled / total_required) * 100) : 0;
  return {
    ...input,
    total_required,
    total_fulfilled,
    total_remaining,
    completion_percentage,
    contributor_count: input.contributors_list.length,
    urgency: urgencyLabel[input.urgency_level],
    progress: completion_percentage,
  };
}

export const MOCK_TICKETS: MockTicket[] = [
  mkTicket({
    id: "TKT-8924",
    title: "Emergency Medical Supplies",
    category: "Medical",
    subtype: "Trauma / first-aid",
    description:
      "Urgent need for first-aid kits, IV fluids, and on-ground medical personnel for flood-affected districts.",
    location: "Beirut, Lebanon",
    distance_km: 12,
    host_entity: "SEEDS India",
    host_verification_status: "VERIFIED",
    mode: "RAPID",
    urgency_level: "EMERGENCY",
    phase: "EXECUTION",
    ticket_status: "ACTIVE",
    deadline: "24 Oct 2026",
    image: "/ticket-medical.jpg",
    needs: [
      { resource: "First-aid kits", unit: "kits", total_required: 400, total_fulfilled: 260 },
      { resource: "IV fluids", unit: "units", total_required: 800, total_fulfilled: 520 },
      { resource: "Medical volunteers", unit: "people", total_required: 20, total_fulfilled: 12 },
    ],
    max_contribution_possible: 40,
    contribution_feasibility: true,
    contribution_impact_percentage: 10,
    contributors_list: [
      { org_id: "O-101", org_name: "Red Cross India", resource: "First-aid kits", quantity: 200, unit: "kits", status: "DELIVERED", at: "Oct 12, 2026 · 11:45 AM" },
      { org_id: "O-204", org_name: "Doctors Without Borders", resource: "Medical volunteers", quantity: 10, unit: "people", status: "DELIVERED", at: "Oct 13, 2026 · 08:30 AM" },
      { org_id: "O-315", org_name: "GiveIndia", resource: "IV fluids", quantity: 520, unit: "units", status: "VERIFIED", at: "Oct 13, 2026 · 02:17 PM" },
      { org_id: "O-412", org_name: "Apollo Hospitals", resource: "First-aid kits", quantity: 60, unit: "kits", status: "PLEDGED", at: "Oct 15, 2026 · 04:20 PM" },
    ],
    timeline: { start_date: "Oct 12, 2026", expected_completion: "Oct 24, 2026" },
    execution_plan:
      "Distribute across 3 relief camps, rotate medical teams in 48h shifts, file daily proof updates.",
    proof_updates: [
      { at: "Oct 16, 2026 · 07:00 AM", note: "Moved to Execution phase. Distribution began at Camp A.", author: "SEEDS India" },
      { at: "Oct 18, 2026 · 06:30 PM", note: "60% supplies delivered; medical team treated ~850 patients.", author: "Dr. Rhea (MSF)" },
    ],
  }),
  mkTicket({
    id: "TKT-8921",
    title: "Winter Clothing Drive",
    category: "Clothing",
    subtype: "Cold weather",
    description: "Blankets and warm clothing for displaced families ahead of winter.",
    location: "Amman, Jordan",
    distance_km: 180,
    host_entity: "Goonj",
    host_verification_status: "VERIFIED",
    mode: "NON_RAPID",
    urgency_level: "HIGH",
    phase: "PLANNING",
    ticket_status: "OPEN",
    deadline: "30 Oct 2026",
    image: "/ticket-winter.jpg",
    needs: [
      { resource: "Blankets", unit: "pcs", total_required: 2000, total_fulfilled: 500 },
      { resource: "Winter jackets", unit: "pcs", total_required: 800, total_fulfilled: 340 },
    ],
    max_contribution_possible: 80,
    contribution_feasibility: true,
    contribution_impact_percentage: 4,
    contributors_list: [
      { org_id: "O-101", org_name: "Red Cross", resource: "Blankets", quantity: 500, unit: "pcs", status: "PLEDGED", at: "Oct 20, 2026 · 10:00 AM" },
      { org_id: "O-508", org_name: "Uniqlo Foundation", resource: "Winter jackets", quantity: 340, unit: "pcs", status: "PLEDGED", at: "Oct 22, 2026 · 03:15 PM" },
    ],
    timeline: { start_date: "Oct 20, 2026", expected_completion: "Nov 15, 2026" },
  }),
  mkTicket({
    id: "TKT-8890",
    title: "School Rebuilding Fund",
    category: "Infrastructure",
    subtype: "Education",
    description: "Rebuild primary school damaged by flooding; restore learning for 420 students.",
    location: "Gaza",
    distance_km: 60,
    host_entity: "Pratham",
    host_verification_status: "VERIFIED",
    mode: "NON_RAPID",
    urgency_level: "NORMAL",
    phase: "COMPLETION",
    ticket_status: "ACTIVE",
    deadline: "12 Nov 2026",
    image: "/ticket-school.jpg",
    needs: [
      { resource: "Construction materials", unit: "lots", total_required: 10, total_fulfilled: 9 },
      { resource: "School supplies", unit: "sets", total_required: 420, total_fulfilled: 420 },
    ],
    max_contribution_possible: 1,
    contribution_feasibility: true,
    contribution_impact_percentage: 10,
    contributors_list: [
      { org_id: "O-701", org_name: "Habitat for Humanity", resource: "Construction materials", quantity: 9, unit: "lots", status: "DELIVERED", at: "Oct 28, 2026" },
      { org_id: "O-802", org_name: "Pratham", resource: "School supplies", quantity: 420, unit: "sets", status: "VERIFIED", at: "Oct 30, 2026" },
    ],
    proof_updates: [
      { at: "Nov 02, 2026", note: "9 of 10 material lots installed. Final lot scheduled Nov 08.", author: "Pratham" },
    ],
  }),
  mkTicket({
    id: "TKT-8875",
    title: "Clean Water Initiative",
    category: "WASH",
    subtype: "Water purification",
    description: "Deploy water purification units to 4 villages; deliver 20k bottles weekly.",
    location: "Sana'a, Yemen",
    distance_km: 420,
    host_entity: "WaterAid",
    host_verification_status: "VERIFIED",
    mode: "NON_RAPID",
    urgency_level: "HIGH",
    phase: "COMPLETION",
    ticket_status: "COMPLETED",
    deadline: "—",
    image: "/ticket-water.jpg",
    needs: [
      { resource: "Purification units", unit: "units", total_required: 4, total_fulfilled: 4 },
      { resource: "Water bottles (1L)", unit: "bottles", total_required: 20000, total_fulfilled: 20000 },
    ],
    max_contribution_possible: 0,
    contribution_feasibility: false,
    contribution_impact_percentage: 0,
    contributors_list: [
      { org_id: "O-915", org_name: "WaterAid", resource: "Purification units", quantity: 4, unit: "units", status: "VERIFIED", at: "Sep 10, 2026" },
    ],
  }),
  mkTicket({
    id: "TKT-8842",
    title: "Food Relief Packages",
    category: "Food",
    subtype: "Dry rations",
    description: "Dry-ration food kits for 1,200 households impacted by drought.",
    location: "Khartoum, Sudan",
    distance_km: 95,
    host_entity: "Akshaya Patra",
    host_verification_status: "PENDING",
    mode: "NON_RAPID",
    urgency_level: "HIGH",
    phase: "PLANNING",
    ticket_status: "OPEN",
    deadline: "05 Nov 2026",
    image: "/ticket-food.jpg",
    needs: [
      { resource: "Food kits", unit: "kits", total_required: 1200, total_fulfilled: 120 },
    ],
    max_contribution_possible: 120,
    contribution_feasibility: true,
    contribution_impact_percentage: 10,
    contributors_list: [
      { org_id: "O-101", org_name: "Red Cross", resource: "Food kits", quantity: 120, unit: "kits", status: "PLEDGED", at: "Oct 24, 2026" },
    ],
    timeline: { start_date: "Oct 24, 2026", expected_completion: "Nov 05, 2026" },
  }),
];

/** Spec phases considered "active" — used by homepage filter. */
export const ACTIVE_PHASES: TicketPhase[] = ["PLANNING", "EXECUTION"];

export function getTicketById(id: string) {
  return MOCK_TICKETS.find((t) => t.id === id);
}

export function phaseLabel(phase: TicketPhase): string {
  const map: Record<TicketPhase, string> = {
    PLANNING: "Planning",
    EXECUTION: "Execution",
    COMPLETION: "Completion",
  };
  return map[phase];
}

export function statusLabel(status: TicketStatus): string {
  const map: Record<TicketStatus, string> = {
    OPEN: "Open",
    ACTIVE: "Active",
    COMPLETED: "Completed",
  };
  return map[status];
}
