import { Suspense } from "react";
import { ResourceList } from "./_components/ResourceList";

export default function ResourcesPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <Suspense fallback={<p className="muted-text">Loading…</p>}>
        <ResourceList />
      </Suspense>
    </div>
  );
}
