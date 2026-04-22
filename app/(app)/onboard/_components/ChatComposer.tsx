"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { DocType, UploadedDoc } from "../_lib/types";

type Props = {
  busy: boolean;
  onSend(text: string): void | Promise<void>;
  onOpenDocPicker(): void;
  pendingAttachments: UploadedDoc[];
  onRemoveAttachment(docType: DocType): void;
};

export function ChatComposer({
  busy,
  onSend,
  onOpenDocPicker,
  pendingAttachments,
  onRemoveAttachment,
}: Props) {
  const [draft, setDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text && pendingAttachments.length === 0) return;
    if (busy) return;
    setDraft("");
    if (taRef.current) taRef.current.style.height = "auto";
    await onSend(text);
  }

  return (
    <div>
      {pendingAttachments.length > 0 && (
        <div className="chat-attachment-preview">
          {pendingAttachments.map((att) => (
            <div key={att.docType} className="chat-attachment-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={att.fileUrl} alt={att.docType} />
              <button type="button" onClick={() => onRemoveAttachment(att.docType)} aria-label="remove">
                ×
              </button>
              <span className="chat-attachment-label">{att.docType}</span>
            </div>
          ))}
        </div>
      )}

      <div className="chat-composer">
        <button
          type="button"
          className="chat-icon-btn"
          aria-label="Attach document photo"
          onClick={onOpenDocPicker}
        >
          📎
        </button>

        <div className="chat-composer-inner">
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              grow(e.target);
            }}
            onKeyDown={onKey}
            disabled={busy}
          />
        </div>

        <button
          type="button"
          className="chat-send-btn"
          aria-label="Send"
          onClick={send}
          disabled={busy || (!draft.trim() && pendingAttachments.length === 0)}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
