"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, getAppCheckClient } from "@/lib/firebase/client";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  claims: { role?: string; orgId?: string } | null;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true, claims: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AuthCtx["claims"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // App Check must initialize on the client before any secured call.
    getAppCheckClient();

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const tokenResult = await u.getIdTokenResult();
        setClaims({
          role: tokenResult.claims.role as string | undefined,
          orgId: tokenResult.claims.orgId as string | undefined,
        });
      } else {
        setClaims(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return <Ctx.Provider value={{ user, loading, claims }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
