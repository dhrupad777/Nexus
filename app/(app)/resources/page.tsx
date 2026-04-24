"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Plus,
  MapPin,
  Clock,
  Utensils,
  Shirt,
  Users,
  Stethoscope,
  Droplets,
  BookOpen,
} from "lucide-react";

type ResourceCategory = "food" | "clothing" | "people" | "medical" | "water" | "education";

type Resource = {
  id: string;
  label: string;
  count: number;
  unit: string;
  category: ResourceCategory;
  location: string;
  updated: string;
  note?: string;
};

const RESOURCES: Resource[] = [
  {
    id: "r1",
    label: "Food kits",
    count: 120,
    unit: "kits",
    category: "food",
    location: "Mumbai warehouse",
    updated: "Updated 2 days ago",
    note: "Dry rations, shelf-stable — 7-day packs",
  },
  {
    id: "r2",
    label: "Blankets",
    count: 80,
    unit: "pcs",
    category: "clothing",
    location: "Pune storage",
    updated: "Updated 5 days ago",
    note: "Wool blankets, adult-sized",
  },
  {
    id: "r3",
    label: "Volunteers",
    count: 24,
    unit: "people",
    category: "people",
    location: "Mumbai + Pune",
    updated: "Live roster",
    note: "Available weekends; 8 with first-aid training",
  },
  {
    id: "r4",
    label: "First-aid kits",
    count: 40,
    unit: "kits",
    category: "medical",
    location: "Mumbai warehouse",
    updated: "Updated 1 week ago",
  },
  {
    id: "r5",
    label: "Water bottles (1L)",
    count: 600,
    unit: "bottles",
    category: "water",
    location: "Mumbai warehouse",
    updated: "Updated 3 days ago",
  },
  {
    id: "r6",
    label: "School supplies",
    count: 150,
    unit: "sets",
    category: "education",
    location: "Pune storage",
    updated: "Updated 2 weeks ago",
    note: "Notebooks, pens, geometry boxes",
  },
];

const CATEGORY_META: Record<
  ResourceCategory,
  { label: string; icon: React.ReactNode; hue: number }
> = {
  food:      { label: "Food",      icon: <Utensils size={16} />,    hue: 25  },
  clothing:  { label: "Clothing",  icon: <Shirt size={16} />,       hue: 262 },
  people:    { label: "People",    icon: <Users size={16} />,       hue: 200 },
  medical:   { label: "Medical",   icon: <Stethoscope size={16} />, hue: 0   },
  water:     { label: "Water",     icon: <Droplets size={16} />,    hue: 195 },
  education: { label: "Education", icon: <BookOpen size={16} />,    hue: 142 },
};

export default function ResourcesPage() {
  const totalItems = RESOURCES.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="stack" style={{ gap: "24px" }}>
      <Link href="/dashboard" className="process-back">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
        <div className="stack" style={{ gap: "4px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "10px" }}>
            <Package size={24} style={{ color: "var(--color-primary)" }} />
            Resource Dashboard
          </h1>
          <p className="muted-text" style={{ fontSize: "13px" }}>
            {RESOURCES.length} categories · {totalItems.toLocaleString()} total units ready to pledge
          </p>
        </div>
        <button type="button" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Plus size={16} /> Add resource
        </button>
      </div>

      <div className="resource-grid">
        {RESOURCES.map((r) => {
          const meta = CATEGORY_META[r.category];
          return (
            <div key={r.id} className="resource-card">
              <div className="resource-card-top">
                <span
                  className="resource-icon"
                  style={{ "--res-hue": meta.hue } as React.CSSProperties}
                >
                  {meta.icon}
                </span>
                <span className="resource-category-label">{meta.label}</span>
              </div>
              <div className="resource-card-body">
                <span className="resource-count num">
                  {r.count.toLocaleString()}
                  <span className="resource-unit">{r.unit}</span>
                </span>
                <span className="resource-label">{r.label}</span>
              </div>
              {r.note && <p className="resource-note">{r.note}</p>}
              <div className="resource-meta">
                <span className="resource-meta-item">
                  <MapPin size={12} /> {r.location}
                </span>
                <span className="resource-meta-item">
                  <Clock size={12} /> {r.updated}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
