"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { RaiseTicketInputSchema, type RaiseTicketInput } from "@/lib/schemas";
import { callRaiseTicket } from "@/lib/callables";
import { authErrorToMessage } from "@/lib/auth/errors";
import { storage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

const CATEGORIES = [
  "MATERIAL",
  "FUNDS",
  "MANUFACTURING",
  "VENUE",
  "VEHICLE",
  "VOLUNTEER_HOURS",
  "SERVICE",
  "SHELTER",
  "LOGISTICS",
  "FOOD_KIT",
] as const;

// Ticket-level domain. Matches the categories used in seed data + the
// standard NGO/relief verticals visible on the public homepage filters.
const TICKET_CATEGORIES = [
  "EDUCATION",
  "HEALTH",
  "DISASTER",
  "FOOD",
  "WATER_SANITATION",
  "SHELTER",
  "LIVELIHOOD",
  "WOMENS_EMPOWERMENT",
  "CHILD_WELFARE",
  "ENVIRONMENT",
  "TECHNOLOGY",
  "COMMUNITY",
  "OTHER",
] as const;

function randomRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const MAX_IMAGES = 6;

export default function NewTicketPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // A single requestId lives for the lifetime of this page — if the user hits
  // submit twice (double-click, retry after a transient error), the callable
  // deduplicates via the idempotency helper. Per plan §A.8 #5.
  const requestId = useMemo(randomRequestId, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !user) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Up to ${MAX_IMAGES} images.`);
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const urls = await Promise.all(
        picked.map(async (file) => {
          const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
          const safe = `${randomRequestId()}.${ext}`;
          const path = `tickets/uploads/${user.uid}/${requestId}/${safe}`;
          await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
          return getDownloadURL(storageRef(storage, path));
        }),
      );
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      toast.error(authErrorToMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  const defaultDeadline = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }, []);

  const form = useForm<RaiseTicketInput>({
    resolver: zodResolver(RaiseTicketInputSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "EDUCATION",
      urgency: "NORMAL",
      needs: [
        {
          resourceCategory: "MATERIAL",
          quantity: 1,
          unit: "units",
          valuationINR: 0,
          hostSelfPledge: { quantity: 0, valuationINR: 0, pctOfNeed: 0 },
        },
      ],
      geo: { lat: 0, lng: 0, adminRegion: "", operatingAreas: [] as string[] },
      deadline: new Date(defaultDeadline).getTime(),
      requestId,
    },
  });

  const needs = useFieldArray({ control: form.control, name: "needs" });

  async function onSubmit(values: RaiseTicketInput) {
    setBusy(true);
    try {
      const res = await callRaiseTicket({
        ...values,
        images: images.length > 0 ? images : undefined,
      });
      toast.success(res.rapid ? "Emergency ticket broadcast" : "Ticket raised");
      router.push(`/tickets/${res.ticketId}`);
    } catch (err) {
      toast.error(authErrorToMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const urgency = form.watch("urgency");

  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto" }}>
      <header className="stack-sm">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700 }}>
          Raise a ticket
        </h1>
        <p className="muted-text">
          Tell Nexus what you need. We&apos;ll match you to verified contributors.
        </p>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="stack">
        <div className="card stack">
          <div className="form-row">
            <label htmlFor="title" className="label">Title</label>
            <input id="title" className="input" {...form.register("title")} />
            {form.formState.errors.title && (
              <span className="error-text">{form.formState.errors.title.message}</span>
            )}
          </div>

          <div className="form-row">
            <label htmlFor="description" className="label">What do you need, and why?</label>
            <textarea id="description" className="textarea"
                      {...form.register("description")} />
            {form.formState.errors.description && (
              <span className="error-text">{form.formState.errors.description.message}</span>
            )}
          </div>

          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            <div className="form-row" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="category" className="label">Category</label>
              <select id="category" className="select" {...form.register("category")}>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-row" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="urgency" className="label">Urgency</label>
              <select id="urgency" className="select" {...form.register("urgency")}>
                <option value="NORMAL">Normal — agreement-first</option>
                <option value="EMERGENCY">Emergency — broadcast + instant pledges</option>
              </select>
            </div>
          </div>

          {urgency === "EMERGENCY" && (
            <p className="badge badge-emergency" style={{ alignSelf: "flex-start" }}>
              Broadcast mode: all eligible orgs will be notified. You can&apos;t switch back.
            </p>
          )}
        </div>

        {/* ── Images ── */}
        <div className="card stack">
          <header className="stack-sm" style={{ gap: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Photos</h2>
            <p className="muted-text" style={{ fontSize: 13, margin: 0 }}>
              Add up to {MAX_IMAGES} photos. The first becomes the cover; multiple turn into a slideshow on the card.
            </p>
          </header>

          <div className="ticket-img-grid">
            {images.map((url, i) => (
              <div key={url} className="ticket-img-tile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} />
                {i === 0 && <span className="ticket-img-cover">Cover</span>}
                <button
                  type="button"
                  className="ticket-img-remove"
                  onClick={() => removeImage(i)}
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {images.length < MAX_IMAGES && (
              <label className={`ticket-img-add${uploading ? " ticket-img-add--busy" : ""}`}>
                {uploading ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {uploading ? "Uploading…" : "Add photo"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <div className="card stack">
          <header className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Needs</h2>
            <button type="button" className="btn btn-ghost"
                    onClick={() => needs.append({
                      resourceCategory: "MATERIAL",
                      quantity: 1,
                      unit: "units",
                      valuationINR: 0,
                      hostSelfPledge: { quantity: 0, valuationINR: 0, pctOfNeed: 0 },
                    })}>
              + Add need
            </button>
          </header>

          {needs.fields.map((field, i) => (
            <div key={field.id} className="stack-sm"
                 style={{ padding: 16, background: "var(--color-surface-2)", borderRadius: "var(--radius-md)" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>Need #{i + 1}</strong>
                {needs.fields.length > 1 && (
                  <button type="button" className="muted-text"
                          style={{ background: "none", border: "none", cursor: "pointer" }}
                          onClick={() => needs.remove(i)}>Remove</button>
                )}
              </div>

              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="form-row" style={{ flex: 1, minWidth: 180 }}>
                  <label className="label">Resource</label>
                  <Controller
                    control={form.control}
                    name={`needs.${i}.resourceCategory`}
                    render={({ field: f }) => (
                      <select className="select" {...f}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  />
                </div>
                <div className="form-row" style={{ flex: 1, minWidth: 120 }}>
                  <label className="label">Quantity</label>
                  <input type="number" className="input" step="any"
                         {...form.register(`needs.${i}.quantity`, { valueAsNumber: true })} />
                </div>
                <div className="form-row" style={{ flex: 1, minWidth: 120 }}>
                  <label className="label">Unit</label>
                  <input className="input" {...form.register(`needs.${i}.unit`)} />
                </div>
                <div className="form-row" style={{ flex: 1, minWidth: 140 }}>
                  <label className="label">Valuation (INR)</label>
                  <input type="number" className="input" step="any"
                         {...form.register(`needs.${i}.valuationINR`, { valueAsNumber: true })} />
                </div>
              </div>

              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="form-row" style={{ flex: 1, minWidth: 140 }}>
                  <label className="label">You pledge (qty)</label>
                  <input type="number" className="input" step="any"
                         {...form.register(`needs.${i}.hostSelfPledge.quantity`, { valueAsNumber: true })} />
                </div>
                <div className="form-row" style={{ flex: 1, minWidth: 140 }}>
                  <label className="label">You pledge (INR)</label>
                  <input type="number" className="input" step="any"
                         {...form.register(`needs.${i}.hostSelfPledge.valuationINR`, { valueAsNumber: true })} />
                </div>
                <div className="form-row" style={{ flex: 1, minWidth: 140 }}>
                  <label className="label">% of need covered by host</label>
                  <input type="number" className="input" step="any" min={0} max={100}
                         {...form.register(`needs.${i}.hostSelfPledge.pctOfNeed`, { valueAsNumber: true })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Location & deadline</h2>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div className="form-row" style={{ flex: 1, minWidth: 200 }}>
              <label className="label">Admin region (city/state)</label>
              <input className="input" placeholder="e.g. Dharwad, KA"
                     {...form.register("geo.adminRegion")} />
            </div>
            <div className="form-row" style={{ flex: 1, minWidth: 120 }}>
              <label className="label">Latitude</label>
              <input type="number" className="input" step="any"
                     {...form.register("geo.lat", { valueAsNumber: true })} />
            </div>
            <div className="form-row" style={{ flex: 1, minWidth: 120 }}>
              <label className="label">Longitude</label>
              <input type="number" className="input" step="any"
                     {...form.register("geo.lng", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="form-row">
            <label className="label">Deadline</label>
            <Controller
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <input
                  type="date"
                  className="input"
                  value={field.value ? new Date(field.value).toISOString().slice(0, 10) : ""}
                  onChange={(e) => field.onChange(new Date(e.target.value).getTime())}
                />
              )}
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
          {busy ? "Submitting…" : urgency === "EMERGENCY" ? "Broadcast emergency" : "Raise ticket"}
        </button>
      </form>
    </div>
  );
}
