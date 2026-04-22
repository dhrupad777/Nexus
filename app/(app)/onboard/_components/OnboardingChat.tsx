"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { OnboardingTurnOutputSchema } from "@/lib/schemas";
import type { OnboardingData, OrgType } from "@/lib/schemas";
import type { ChatMessage, DocsByType, UploadedDoc } from "../_lib/types";
import { clearSession, loadSession, saveSession } from "../_lib/sessionStore";
import { finalizeOrg, OnboardingDataIncompleteError } from "../_lib/finalize";
import { ChatComposer } from "./ChatComposer";
import { DocPicker } from "./DocPicker";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDay(ts: number): string {
  const today = new Date();
  const d = new Date(ts);
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type GroupedLine =
  | { kind: "day"; at: number; id: string }
  | { kind: "msg"; msg: ChatMessage; position: "single" | "top" | "middle" | "bottom"; id: string };

function groupMessages(history: ChatMessage[]): GroupedLine[] {
  const out: GroupedLine[] = [];
  let lastDayKey = "";
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const dayKey = new Date(m.at).toDateString();
    if (dayKey !== lastDayKey) {
      out.push({ kind: "day", at: m.at, id: `day-${dayKey}` });
      lastDayKey = dayKey;
    }
    const prev = history[i - 1];
    const next = history[i + 1];
    const THRESHOLD = 60_000 * 3; // 3 minutes
    const prevSame = prev && prev.role === m.role && m.at - prev.at < THRESHOLD && new Date(prev.at).toDateString() === dayKey;
    const nextSame = next && next.role === m.role && next.at - m.at < THRESHOLD && new Date(next.at).toDateString() === dayKey;
    let position: "single" | "top" | "middle" | "bottom" = "single";
    if (prevSame && nextSame) position = "middle";
    else if (!prevSame && nextSame) position = "top";
    else if (prevSame && !nextSame) position = "bottom";
    out.push({ kind: "msg", msg: m, position, id: `msg-${i}` });
  }
  return out;
}

export function OnboardingChat({ type }: { type: OrgType | undefined }) {
  const { user } = useAuth();
  const router = useRouter();

  const [booted, setBooted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [partialData, setPartialData] = useState<OnboardingData>({});
  const [docs, setDocs] = useState<DocsByType>({});
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<UploadedDoc[]>([]);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const seed: Partial<OnboardingData> = type ? { type } : {};
    const loaded = loadSession(seed);
    setSessionId(loaded.sessionId);
    setHistory(loaded.history);
    setPartialData(loaded.partialData);
    setDocs(loaded.docs);

    if (loaded.history.length === 0) {
      const greeting =
        type === "NGO"
          ? "Hey 👋 I'm the Nexus assistant. I'll help you register your NGO — just chat like normal.\n\nWhat's the legal name of your organization?"
          : type === "ORG"
            ? "Hey 👋 I'm the Nexus assistant. I'll help you register your organization — just chat like normal.\n\nWhat's the registered legal name?"
            : "Hey 👋 Before we start — are you registering as an NGO or as an Organization?";
      const first: ChatMessage = { role: "assistant", content: greeting, at: Date.now() };
      setHistory([first]);
      saveSession({
        history: [first],
        partialData: loaded.partialData,
        sessionId: loaded.sessionId,
        docs: loaded.docs,
      });
    }
    setBooted(true);
  }, [type]);

  useEffect(() => {
    // auto-scroll to latest message when history or busy changes
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [history.length, busy]);

  const lines = useMemo(() => groupMessages(history), [history]);

  async function send(text: string) {
    const atts = pendingAttachments;
    const timestamp = Date.now();
    setPendingAttachments([]);

    const userMsg: ChatMessage = {
      role: "user",
      content: text || (atts.length ? "(attached documents)" : ""),
      at: timestamp,
      attachments: atts.length ? atts : undefined,
    };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    saveSession({ history: nextHistory, partialData, sessionId, docs });
    setBusy(true);

    try {
      const res = await fetch("/api/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          partialData,
          userMessage: userMsg.content,
        }),
      });
      const json = await res.json();

      if (json.fallback) {
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: "I'm having trouble right now — let me open the form so you don't lose what we've got. Tap below to continue.",
          at: Date.now(),
        };
        const afterFallback = [...nextHistory, assistantMsg];
        setHistory(afterFallback);
        saveSession({ history: afterFallback, partialData, sessionId, docs });
        toast.info("Switching to the form view.");
        router.push("/onboard/form");
        return;
      }

      const parsed = OnboardingTurnOutputSchema.safeParse(json.output);
      if (!parsed.success) {
        toast.error("Unexpected response — opening the form.");
        router.push("/onboard/form");
        return;
      }

      const out = parsed.data;
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: out.assistantMessage,
        at: Date.now(),
      };
      const updatedHistory = [...nextHistory, assistantMsg];
      setHistory(updatedHistory);
      setPartialData(out.updatedData);
      saveSession({ history: updatedHistory, partialData: out.updatedData, sessionId, docs });

      if (out.done) await finalize(out.updatedData, docs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network_error";
      toast.error(`Couldn't reach the assistant (${msg}). Try again.`);
    } finally {
      setBusy(false);
    }
  }

  async function finalize(data: OnboardingData, docsToSave: DocsByType) {
    if (!user) {
      toast.error("You need to be signed in to save your organization.");
      return;
    }
    try {
      await finalizeOrg(user.uid, data, docsToSave);
      clearSession();
      toast.success("Organization saved. We'll review your docs shortly.");
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof OnboardingDataIncompleteError) {
        toast.error(`Still missing: ${err.missing.join(", ")} — let's finish that up.`);
        return;
      }
      const m = err instanceof Error ? err.message : "save_failed";
      toast.error(`Couldn't save: ${m}`);
    }
  }

  function handleUploadedDoc(doc: UploadedDoc) {
    const nextDocs: DocsByType = { ...docs, [doc.docType]: doc };
    setDocs(nextDocs);
    saveSession({ history, partialData, sessionId, docs: nextDocs });
    setPendingAttachments((p) => {
      const without = p.filter((a) => a.docType !== doc.docType);
      return [...without, doc];
    });
  }

  function removeAttachment(docType: string) {
    setPendingAttachments((p) => p.filter((a) => a.docType !== docType));
  }

  if (!booted) {
    return <div className="chat-page"><div className="chat-surface"><p className="muted-text" style={{ padding: 24 }}>Warming up…</p></div></div>;
  }

  if (!user) {
    return (
      <div className="chat-page">
        <div className="chat-surface">
          <p className="muted-text" style={{ padding: 24 }}>Sign in to continue onboarding.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-topbar">
        <div className="chat-topbar-left">
          <div className="chat-avatar" aria-hidden>N</div>
          <div>
            <div className="chat-topbar-title">Nexus assistant</div>
            <div className="chat-topbar-sub">
              {type ? `Registering as ${type === "NGO" ? "NGO" : "Organization"}` : "Onboarding"}
              {busy ? " · typing…" : " · online"}
            </div>
          </div>
        </div>
        <Link href="/onboard/form" className="chat-switch-link">Use a form</Link>
      </header>

      <div className="chat-surface">
        <ol className="chat-list" ref={listRef}>
          <AnimatePresence initial={false}>
            {lines.map((line) => {
              if (line.kind === "day") {
                return (
                  <li key={line.id} style={{ listStyle: "none", display: "contents" }}>
                    <div className="chat-day">{formatDay(line.at)}</div>
                  </li>
                );
              }
              const { msg, position } = line;
              const rowClass = msg.role === "user" ? "chat-row chat-row-user" : "chat-row chat-row-bot";
              const bubbleBase = msg.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-bot";
              const grouped =
                position === "top" ? " is-grouped-top"
                : position === "middle" ? " is-grouped-middle"
                : position === "bottom" ? ""
                : "";
              return (
                <motion.li
                  key={line.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className={rowClass}
                  style={{ listStyle: "none" }}
                >
                  {msg.attachments?.length ? (
                    <div className="stack-sm" style={{ alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      {msg.attachments.map((a) => (
                        <div key={a.docType} className="chat-bubble-image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.fileUrl} alt={a.docType} />
                          <div className="chat-image-caption">{a.docType}</div>
                        </div>
                      ))}
                      {msg.content && msg.content !== "(attached documents)" && (
                        <div className={bubbleBase + grouped}>{msg.content}</div>
                      )}
                    </div>
                  ) : (
                    <div className={bubbleBase + grouped}>{msg.content}</div>
                  )}
                  {(position === "single" || position === "bottom") && (
                    <span className="chat-meta">{formatTime(msg.at)}</span>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>

          {busy && (
            <li className="chat-row chat-row-bot" style={{ listStyle: "none" }}>
              <div className="chat-bubble chat-bubble-bot chat-typing" aria-label="assistant is typing">
                <span /><span /><span />
              </div>
            </li>
          )}
        </ol>
      </div>

      <ChatComposer
        busy={busy}
        onSend={send}
        onOpenDocPicker={() => setPickerOpen(true)}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={removeAttachment}
      />

      <DocPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        type={type}
        uid={user.uid}
        uploaded={docs}
        onUploaded={handleUploadedDoc}
      />
    </div>
  );
}
