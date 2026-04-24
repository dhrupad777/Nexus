import Link from "next/link";
import { NewResourceForm } from "../_components/NewResourceForm";

export default function NewResourcePage() {
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>
            List a resource
          </h1>
          <p className="muted-text">Describe one resource your org can contribute. Matches will pick it up once the embedding is generated.</p>
        </div>
        <Link href="/resources" className="btn btn-ghost">Cancel</Link>
      </div>
      <NewResourceForm />
    </div>
  );
}
