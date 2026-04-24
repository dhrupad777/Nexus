"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { OrgStatus } from "@/lib/schemas";

type State =
  | { loading: true }
  | { loading: false; status: OrgStatus | null; orgId: string | null };

/**
 * Live subscription to the signed-in user's org status via their orgId claim.
 * Returns { loading: true } until auth + claim are loaded.
 */
export function useOrgStatus(orgId: string | null | undefined): State {
  const [state, setState] = useState<State>({ loading: true });

  useEffect(() => {
    if (!orgId) {
      setState({ loading: false, status: null, orgId: null });
      return;
    }
    const ref = doc(db, "organizations", orgId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        setState({
          loading: false,
          status: (data?.status as OrgStatus | undefined) ?? null,
          orgId,
        });
      },
      () => setState({ loading: false, status: null, orgId }),
    );
    return unsub;
  }, [orgId]);

  return state;
}
