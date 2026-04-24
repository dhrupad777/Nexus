"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { callPledge } from "@/lib/callables";
import { authErrorToMessage } from "@/lib/auth/errors";

interface NeedRow {
  resourceCategory: string;
  quantity: number;
  unit: string;
  valuationINR: number;
  progressPct: number;
}

interface MatchHint {
  bestNeedIndex: number;
  maxContributionPossible: number;
}

function randomRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Inline pledge form for Flow B (rapid). Defaults to the match doc's
 * `bestNeedIndex` and `maxContributionPossible` so the user can submit with
 * one click. requestId is stable per form mount → double-submit dedupes
 * via the callable's idempotency wrapper (plan §A.8 #5).
 */
export function PledgeForm({
  ticketId,
  needs,
  match,
}: {
  ticketId: string;
  needs: NeedRow[];
  match: { bestNeedIndex: number; maxContributionPossible: number } | null;
}) {
  const requestId = useMemo(randomRequestId, []);
  const initialNeed = match?.bestNeedIndex ?? 0;
  const initialMax =
    match?.maxContributionPossible ?? Math.max(0, needs[initialNeed]?.quantity ?? 0);

  const [needIndex, setNeedIndex] = useState(initialNeed);
  const [quantity, setQuantity] = useState<number>(
    Number(initialMax.toFixed(2)) || needs[initialNeed]?.quantity || 1,
  );
  const [busy, setBusy] = useState(false);

  const need = needs[needIndex];
  if (!need) return null;

  const remaining = need.quantity * (1 - need.progressPct / 100);
  const ratio = need.quantity > 0 ? quantity / need.quantity : 0;
  const valuationINR = Math.round(need.valuationINR * ratio);
  const pctOfNeed = Math.min(100, Math.max(0, ratio * 100));
  const fillsPct = remaining > 0 ? Math.min(100, (quantity / remaining) * 100) : 0;

  async function submit() {
    if (quantity <= 0) {
      toast.error("Quantity must be positive.");
      return;
    }
    setBusy(true);
    try {
      const res = await callPledge({
        ticketId,
        needIndex,
        offered: {
          kind: need.resourceCategory,
          quantity,
          unit: need.unit,
          valuationINR,
          pctOfNeed,
          notes: "",
        },
        requestId,
      });
      toast.success(`Pledge committed. Ticket is now ${res.progressPct}% fulfilled.`);
    } catch (err) {
      toast.error(authErrorToMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack-sm" style={{ borderColor: "var(--color-accent, #2563eb)" }}>
      <strong>Pledge to this ticket</strong>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="form-row" style={{ flex: 1, minWidth: 200 }}>
          <label className="label">Need</label>
          <select
            className="select"
            value={needIndex}
            onChange={(e) => setNeedIndex(Number(e.target.value))}
            disabled={busy}
          >
            {needs.map((n, i) => (
              <option key={i} value={i}>
                #{i + 1} · {n.resourceCategory} ({n.quantity} {n.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="form-row" style={{ flex: 1, minWidth: 160 }}>
          <label className="label">Quantity ({need.unit})</label>
          <input
            type="number"
            className="input"
            step="any"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={busy}
          />
        </div>
      </div>
      <div className="muted-text" style={{ fontSize: 12 }}>
        Fills <strong>{Math.round(fillsPct)}%</strong> of remaining ·
        valued at ~₹{new Intl.NumberFormat("en-IN").format(valuationINR)}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={submit}
        disabled={busy || quantity <= 0}
      >
        {busy ? "Committing…" : "Pledge now"}
      </button>
    </div>
  );
}
