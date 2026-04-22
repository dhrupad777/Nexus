"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "./QueryProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryProvider>
  );
}
