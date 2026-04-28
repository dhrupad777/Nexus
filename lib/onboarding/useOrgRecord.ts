"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { OrgStatus, OrgType } from "@/lib/schemas";
import { isOrgComplete } from "./requirements";

export interface OrgGeo {
  adminRegion: string | null;
  lat: number | null;
  lng: number | null;
}

export interface OrgReliability {
  agreement: number | null;
  execution: number | null;
  closure: number | null;
}

export interface OrgBadge {
  ticketId: string;
  closedAt: number;
  contributionSummary: string | null;
}

export type OrgRecordState =
  | { loading: true }
  | { loading: false; exists: false }
  | {
      loading: false;
      exists: true;
      name: string | null;
      type: OrgType | null;
      status: OrgStatus | null;
      docsUploaded: Record<string, boolean>;
      isComplete: boolean;
      geo: OrgGeo;
      reliability: OrgReliability;
      badges: OrgBadge[];
    };

function parseScore(raw: unknown): number | null {
  if (raw && typeof raw === "object" && "score" in (raw as Record<string, unknown>)) {
    const v = (raw as { score: unknown }).score;
    return typeof v === "number" ? v : null;
  }
  return null;
}

/**
 * Live subscription to organizations/{uid} — returns the org record plus
 * a derived `isComplete` flag. Used by /onboard layout, the type-picker
 * gate, and the dashboard to decide whether to expose "edit" affordances.
 *
 * In our self-onboard scheme orgId == userUid, so passing the user's uid
 * is correct.
 *
 * Exposes geo, reliability, and badges in addition to the auth-gating
 * fields. These all live on the same `organizations/{uid}` document the
 * onSnapshot listener already reads — surfacing them adds zero queries.
 */
export function useOrgRecord(uid: string | null | undefined): OrgRecordState {
  const [state, setState] = useState<OrgRecordState>({ loading: true });

  useEffect(() => {
    if (!uid) {
      setState({ loading: false, exists: false });
      return;
    }
    const unsub = onSnapshot(
      doc(db, "organizations", uid),
      (snap) => {
        if (!snap.exists()) {
          setState({ loading: false, exists: false });
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        const rawType = data.type;
        const type: OrgType | null =
          rawType === "NGO" || rawType === "ORG" ? rawType : null;
        const rawStatus = data.status;
        const status =
          typeof rawStatus === "string" ? (rawStatus as OrgStatus) : null;
        const name = typeof data.name === "string" ? data.name : null;
        const docsUploaded =
          (data.docsUploaded as Record<string, boolean> | undefined) ?? {};

        const rawGeo = (data.geo ?? {}) as Record<string, unknown>;
        const geo: OrgGeo = {
          adminRegion:
            typeof rawGeo.adminRegion === "string" ? rawGeo.adminRegion.trim() : null,
          lat: typeof rawGeo.lat === "number" ? rawGeo.lat : null,
          lng: typeof rawGeo.lng === "number" ? rawGeo.lng : null,
        };

        const rawRel = (data.reliability ?? {}) as Record<string, unknown>;
        const reliability: OrgReliability = {
          agreement: parseScore(rawRel.agreement),
          execution: parseScore(rawRel.execution),
          closure: parseScore(rawRel.closure),
        };

        const rawBadges = Array.isArray(data.badges) ? data.badges : [];
        const badges: OrgBadge[] = rawBadges
          .map((b): OrgBadge | null => {
            if (!b || typeof b !== "object") return null;
            const x = b as Record<string, unknown>;
            const ticketId = typeof x.ticketId === "string" ? x.ticketId : null;
            if (!ticketId) return null;
            return {
              ticketId,
              closedAt: typeof x.closedAt === "number" ? x.closedAt : 0,
              contributionSummary:
                typeof x.contributionSummary === "string"
                  ? x.contributionSummary
                  : null,
            };
          })
          .filter((b): b is OrgBadge => b !== null);

        setState({
          loading: false,
          exists: true,
          name,
          type,
          status,
          docsUploaded,
          isComplete: isOrgComplete({ type, docsUploaded }),
          geo,
          reliability,
          badges,
        });
      },
      () => setState({ loading: false, exists: false }),
    );
    return unsub;
  }, [uid]);

  return state;
}
