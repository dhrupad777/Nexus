"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, getAppCheckClient } from "@/lib/firebase/client";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  claims: { role?: string; orgId?: string } | null;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true, claims: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokenClaims, setTokenClaims] = useState<AuthCtx["claims"]>(null);
  const [userDocOrgId, setUserDocOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks the last refresh attempt so we don't spam getIdToken(true).
  const refreshedForUidRef = useRef<string | null>(null);

  useEffect(() => {
    // App Check must initialize on the client before any secured call.
    getAppCheckClient();

    // onIdTokenChanged fires on sign-in/out AND token refresh, so claims set
    // by bootstrapPlatformAdmin (which calls getIdToken(true)) flow into state
    // without requiring a sign-out/sign-in cycle.
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const tokenResult = await u.getIdTokenResult();
        setTokenClaims({
          role: tokenResult.claims.role as string | undefined,
          orgId: tokenResult.claims.orgId as string | undefined,
        });
      } else {
        setTokenClaims(null);
        setUserDocOrgId(null);
        refreshedForUidRef.current = null;
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Fallback: subscribe to users/{uid} so callers see the user's orgId from
  // Firestore even when the cached ID-token claim is missing (users who
  // joined after approveOrg ran, or before their first token refresh).
  useEffect(() => {
    if (!user) {
      setUserDocOrgId(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const data = snap.data() as { orgId?: string | null } | undefined;
        setUserDocOrgId(typeof data?.orgId === "string" && data.orgId ? data.orgId : null);
      },
      () => setUserDocOrgId(null),
    );
    return unsub;
  }, [user]);

  // Universal post-approval token refresh. The org doc lives at
  // organizations/{uid} during the self-onboard scheme, so subscribing by
  // uid covers both PENDING_REVIEW and ACTIVE states. When status flips to
  // ACTIVE while claims.orgId is still missing, force a refresh once.
  // Lifted from app/(app)/dashboard/page.tsx so every page (including
  // /resources) benefits without copying the effect.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, "organizations", user.uid),
      (snap) => {
        const data = snap.data();
        const status = data?.status as string | undefined;
        if (
          status === "ACTIVE" &&
          !tokenClaims?.orgId &&
          refreshedForUidRef.current !== user.uid
        ) {
          refreshedForUidRef.current = user.uid;
          void user.getIdToken(true).catch((err) => {
            console.warn("[auth] post-approval token refresh failed", err);
          });
        }
      },
      () => {
        // Snapshot error (rules deny, doc missing): nothing to refresh.
      },
    );
    return unsub;
  }, [user, tokenClaims?.orgId]);

  // Effective claims: token claim wins when present (it's the canonical
  // source after approveOrg), Firestore users/{uid}.orgId is the fallback
  // for users who joined the org after approval.
  const claims: AuthCtx["claims"] = user
    ? {
        role: tokenClaims?.role,
        orgId: tokenClaims?.orgId ?? userDocOrgId ?? undefined,
      }
    : null;

  return <Ctx.Provider value={{ user, loading, claims }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
