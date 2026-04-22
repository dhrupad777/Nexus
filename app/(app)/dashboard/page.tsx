"use client";

import Link from "next/link";

export default function DashboardStub() {
  return (
    <div className="stack" style={{ maxWidth: 640, margin: "64px auto", textAlign: "center" }}>
      <span className="badge badge-normal" style={{ alignSelf: "center" }}>
        Coming up
      </span>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em" }}>
        Dashboard in next step
      </h1>
      <p className="muted-text" style={{ fontSize: 16, lineHeight: 1.55 }}>
        Your organization is saved. Once a Platform Admin approves your
        documents, you&apos;ll see your matches, resources, and tickets here.
      </p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link href="/" className="btn btn-ghost">Back home</Link>
      </div>
    </div>
  );
}
