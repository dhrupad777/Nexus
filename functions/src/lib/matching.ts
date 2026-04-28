export interface NeedLite {
  resourceCategory: string;
  quantity: number;
  unit: string;
  progressPct: number;
}

export interface ResourceLite {
  id: string;
  orgId: string;
  category: string;
  quantity: number;
  geo: { lat: number; lng: number; serviceRadiusKm: number };
  terms: { availableFrom: number; availableUntil: number };
  embedding: number[];
  status: string;
  embeddingStatus: string;
}

export interface OrgLite {
  status: string;
  reliability?: {
    agreement: { score: number; lastDecayAt: number | null };
    execution: { score: number; lastDecayAt: number | null };
    closure: { score: number; lastDecayAt: number | null };
  };
}

export interface Match {
  ticketId: string;
  orgId: string;
  topResourceId: string;
  score: number;
  semanticScore: number;
  reason: string;
  bestNeedIndex: number;
  maxContributionPossible: number;
  contributionFeasibility: "FULLY_COVERS" | "PARTIALLY_COVERS" | "EXCEEDS_NEED";
  contributionImpactPct: number;
  geoDistanceKm: number;
  rapidBroadcast: boolean;
  surfaced: boolean;
  dismissed: boolean;
  createdAt: number;
}

export function buildTicketEmbeddingInput(ticket: any): string {
  const title = String(ticket.title ?? "");
  const desc = String(ticket.description ?? "");
  const needsStr = (ticket.needs ?? [])
    .map((n: any) => `${n.quantity} ${n.unit} of ${n.resourceCategory}`)
    .join(", ");
  return `Ticket: ${title}. ${desc}. Needs: ${needsStr}.`;
}

export function readEmbedding(embeddingVal: any): number[] | null {
  if (!embeddingVal) return null;
  if (Array.isArray(embeddingVal)) return embeddingVal;
  // If it's a Firestore VectorValue
  if (typeof embeddingVal.toArray === "function") {
    return embeddingVal.toArray();
  }
  return null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function haversineKm(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371; // km
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLon = ((point2.lng - point1.lng) * Math.PI) / 180;
  const lat1 = (point1.lat * Math.PI) / 180;
  const lat2 = (point2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function geoScore(distanceKm: number, radiusKm: number | undefined): number {
  const r = radiusKm && radiusKm > 0 ? radiusKm : 50; // default 50km
  if (distanceKm > r) return 0;
  return 1 - distanceKm / r;
}

export function capacityScore(resourceQty: number, neededQty: number): number {
  if (neededQty <= 0) return 1;
  return Math.min(resourceQty / neededQty, 1.0);
}

export function reliabilityScore(org: OrgLite): number {
  if (!org.reliability) return 0.7; // fallback default
  const { agreement, execution, closure } = org.reliability;
  const avg = (agreement.score + execution.score + closure.score) / 3;
  return avg / 100;
}

export function hybridScore({
  sem,
  geo,
  capacity,
  reliability,
}: {
  sem: number;
  geo: number;
  capacity: number;
  reliability: number;
}): number {
  // Hybrid score (weights LOCKED as constants in lib/matching.ts):
  // finalScore = 0.5*semanticScore + 0.2*geoScore + 0.2*capacityScore + 0.1*reliabilityScore
  return 0.5 * sem + 0.2 * geo + 0.2 * capacity + 0.1 * reliability;
}

export function computeProjection(
  needs: NeedLite[],
  resourceCategory: string,
  resourceQuantity: number
) {
  const needIndex = needs.findIndex((n) => n.resourceCategory === resourceCategory);
  if (needIndex === -1) {
    return {
      bestNeedIndex: -1,
      maxContributionPossible: 0,
      contributionFeasibility: "PARTIALLY_COVERS" as const,
      contributionImpactPct: 0,
    };
  }

  const need = needs[needIndex];
  const remaining = need.quantity * (1 - need.progressPct / 100);
  const maxPossible = Math.min(resourceQuantity, remaining);
  
  let feasibility: "FULLY_COVERS" | "PARTIALLY_COVERS" | "EXCEEDS_NEED" = "PARTIALLY_COVERS";
  if (resourceQuantity >= remaining) {
    feasibility = resourceQuantity > remaining ? "EXCEEDS_NEED" : "FULLY_COVERS";
  }

  const impactPct = remaining > 0 ? (maxPossible / remaining) * 100 : 0;

  return {
    bestNeedIndex: needIndex,
    maxContributionPossible: maxPossible,
    contributionFeasibility: feasibility,
    contributionImpactPct: impactPct,
  };
}

export function scoreTicketVsResource(
  ticketEmbedding: number[],
  ticketGeo: { lat: number; lng: number },
  ticketNeeds: NeedLite[],
  resource: ResourceLite,
  org: OrgLite
) {
  const sem = cosineSimilarity(ticketEmbedding, resource.embedding);
  const dist = haversineKm(ticketGeo, resource.geo);
  const geo = geoScore(dist, resource.geo.serviceRadiusKm);
  
  const need = ticketNeeds.find((n) => n.resourceCategory === resource.category);
  const neededQty = need ? need.quantity * (1 - need.progressPct / 100) : 1;
  const cap = capacityScore(resource.quantity, Math.max(neededQty, 1));
  
  const rel = reliabilityScore(org);
  
  const finalScore = hybridScore({ sem, geo, capacity: cap, reliability: rel });
  return finalScore;
}
