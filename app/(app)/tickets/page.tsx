import TicketsClient from "./TicketsClient";

// Force dynamic rendering — never prerender, never CDN-cache. The earlier
// deploy that lacked this file cached a 404 at the edge; force-dynamic
// guarantees a fresh response on every request.
export const dynamic = "force-dynamic";

export default function Page() {
  return <TicketsClient />;
}
