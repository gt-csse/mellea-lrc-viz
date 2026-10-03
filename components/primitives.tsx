"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { JsonValue } from "../lib/document";

export function humanize(value: string): string {
  return value.replace(/^\d+(?:\.\d+)?_/, "").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function StatusBadge({ value }: { value: string | null }) {
  const text = value ?? "Not evaluated";
  const normalized = text.toLowerCase();
  const tone = /^(correct_identity|correct_pincite|supported|match|correct|confirmed|success|succeeded)$/.test(normalized)
    ? "positive"
    : /^(wrong_identity|wrong_pincite|contradicted|mismatch|incorrect|failed|error)$/.test(normalized)
      ? "negative"
      : /partial|undetermined|unavailable|unresolved|not_found|missing|reading_failed/.test(normalized)
        ? "caution" : "neutral";
  return <span className={`status-badge status-badge--${tone}`}><span aria-hidden="true" className="status-dot" />{humanize(text)}</span>;
}

export function Icon({ name, size = 18 }: { name: "document" | "support" | "identity" | "nodes" | "upload" | "chevron" | "search" | "close" | "download" | "lock" | "arrow"; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    support: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z" /><path d="m9 10 2 2 4-4" /></>,
    identity: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    nodes: <><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="5" cy="19" r="2" /><path d="M5 7v10M7 5h8a4 4 0 0 1 4 4v8" /></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: <><path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function downloadJson(value: JsonValue, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Native dialog provides focus trapping, Escape dismissal, and focus restoration. */
export function RawDialog({ title, value, triggerLabel = "View source JSON" }: { title: string; value: JsonValue; triggerLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const json = useMemo(() => open ? JSON.stringify(value, null, 2) : "", [open, value]);
  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);
  const fragments = useMemo(() => {
    if (!query) return [json];
    const parts: React.ReactNode[] = [];
    const haystack = json.toLowerCase(), needle = query.toLowerCase();
    let offset = 0, at = haystack.indexOf(needle);
    while (at >= 0) {
      parts.push(json.slice(offset, at), <mark key={at}>{json.slice(at, at + query.length)}</mark>);
      offset = at + query.length;
      at = haystack.indexOf(needle, offset);
    }
    parts.push(json.slice(offset));
    return parts;
  }, [json, query]);
  return <>
    <button type="button" className="text-button raw-trigger" onClick={() => { setOpen(true); setFeedback(""); }}>{triggerLabel}<span aria-hidden="true">↗</span></button>
    {open && <dialog ref={ref} className="raw-dialog" aria-labelledby={id} onClose={() => { setOpen(false); setQuery(""); }} onClick={event => { if (event.target === event.currentTarget) ref.current?.close(); }}>
      <header className="raw-dialog-header"><div><p className="eyebrow">Original saved records</p><h2 id={id}>{title}</h2></div><button className="icon-button" type="button" aria-label="Close JSON details" onClick={() => ref.current?.close()}><Icon name="close" /></button></header>
      <div className="raw-toolbar"><label className="search-control"><Icon name="search" /><input aria-label="Find in JSON" placeholder="Find in records…" value={query} onChange={event => setQuery(event.target.value)} /></label><button className="secondary-button" type="button" onClick={() => downloadJson(value, "citation-records.json")}><Icon name="download" />Download JSON</button><button className="secondary-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(json); setFeedback("Copied"); } catch { setFeedback("Copy unavailable. Use Download JSON."); } }}>Copy</button></div>
      <pre className="raw-json" tabIndex={0}>{fragments}</pre><footer className="raw-footer"><span>Every property is retained, including model attempts and repair feedback.</span><span role="status">{feedback}</span></footer>
    </dialog>}
  </>;
}
