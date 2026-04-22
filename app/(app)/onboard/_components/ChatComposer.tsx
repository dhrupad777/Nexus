"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Plus, ArrowUp, Mic } from "lucide-react";
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
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
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

  const hasDraft = draft.trim().length > 0 || pendingAttachments.length > 0;

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
          aria-label="Attach document or photo"
          onClick={onOpenDocPicker}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>

        <div className="chat-composer-inner">
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Message"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              grow(e.target);
            }}
            onKeyDown={onKey}
            disabled={busy}
          />
          {hasDraft ? (
            <button
              type="button"
              className="chat-send-btn"
              aria-label="Send"
              onClick={send}
              disabled={busy}
            >
              <ArrowUp size={16} strokeWidth={3} />
            </button>
          ) : (
            <span className="chat-mic-btn" aria-hidden="true">
              <Mic size={16} strokeWidth={2} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
