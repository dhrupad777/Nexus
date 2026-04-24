import { Suspense } from "react";
import { TicketDetail } from "./_components/TicketDetail";

/**
 * Dynamic route shell. Awaits params (Next 15+ async params) and hands the
 * ticket id to the client component which owns all listeners + renders.
 * Mirrors the resources/page.tsx pattern.
 */
export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <Suspense fallback={<p className="muted-text">Loading…</p>}>
        <TicketDetail ticketId={id} />
      </Suspense>
    </div>
  );
}
