"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { citationLabel, getDocumentAtStage, getRootId, groupCitations, locatorLabel, parseDocument, type CitationView, type DocumentView } from "../lib/document";
import { DocumentViewPanel } from "../components/document-view";
import { IdentityView } from "../components/identity-view";
import { SupportView } from "../components/support-view";
import { NodesView } from "../components/nodes-view";
import { Icon, RawDialog, downloadJson, humanize } from "../components/primitives";

type Tab = "document" | "support" | "identity" | "nodes";
const TABS: { id: Tab; label: string; icon: "document" | "support" | "identity" | "nodes"; description: string }[] = [
  { id: "document", label: "Document", icon: "document", description: "Read citation occurrences in the filing." },
  { id: "support", label: "Citation support", icon: "support", description: "Review the proposition, opinion evidence, and page accuracy." },
  { id: "identity", label: "Identity", icon: "identity", description: "Review the root authority and its field comparisons." },
  { id: "nodes", label: "Nodes", icon: "nodes", description: "Follow how this occurrence was read and reviewed." },
];

function titleOf(document: DocumentView, filename: string) {
  const metadata = document.sourceMetadata;
  for (const key of ["title", "document_name", "name"]) if (typeof metadata?.[key] === "string") return metadata[key];
  return filename.replace(/\.json$/, "").replace(/\.txt$/, "").replaceAll("__", " · ").replaceAll("_", " ").replaceAll("-", " ");
}
function kindLabel(kind: string) {
  return ({ reporter: "Reporter", docket: "Docket", short_reporter: "Short reporter", reference: "Reference", supra: "Supra", id: "Id." } as Record<string, string>)[kind] ?? humanize(kind);
}

export default function Page() {
  const [saved, setSaved] = useState<DocumentView | null>(null);
  const [filename, setFilename] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("document");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mobileNavigator, setMobileNavigator] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigatorDialog = useRef<HTMLDialogElement>(null);
  const importTicket = useRef(0);
  const deferredQuery = useDeferredValue(query);
  const document = useMemo(() => saved && checkpoint ? getDocumentAtStage(saved, checkpoint) : saved, [saved, checkpoint]);
  const groups = useMemo(() => document ? groupCitations(document) : null, [document]);
  const selected = document?.citations.find(item => item.id === selectedId) ?? document?.citations[0] ?? null;
  const rootId = selected ? getRootId(selected) : null;
  const root = document?.citations.find(item => item.id === rootId) ?? null;
  const filtered = useMemo(() => {
    if (!groups) return null;
    const search = deferredQuery.trim().toLowerCase();
    const matches = (citation: CitationView) => !search || [citationLabel(citation), locatorLabel(citation), citation.id, citation.kind].join(" ").toLowerCase().includes(search);
    return {
      roots: groups.roots.filter(group => matches(group.root) || group.leaves.some(matches)),
      unassigned: groups.unassigned.filter(matches),
      withdrawn: groups.withdrawn.filter(matches),
      unknown: groups.unknown.filter(matches),
    };
  }, [groups, deferredQuery]);

  useEffect(() => {
    if (selected && root && selected.id !== root.id) setExpanded(current => new Set([...current, root.id]));
  }, [selected?.id, root?.id]);

  useEffect(() => {
    const dialog = navigatorDialog.current;
    if (!dialog) return;
    if (mobileNavigator && !dialog.open) dialog.showModal();
    if (!mobileNavigator && dialog.open) dialog.close();
  }, [mobileNavigator]);

  async function openFile(file: File) {
    const ticket = ++importTicket.current;
    setLoading(true); setError(null);
    try {
      const data = parseDocument(JSON.parse(await file.text()));
      if (ticket !== importTicket.current) return;
      setSaved(data); setFilename(file.name); setCheckpoint("");
      setSelectedId(data.citations[0]?.id ?? null); setExpanded(new Set()); setQuery("");
      setActiveTab("document");
    } catch (reason) {
      if (ticket === importTicket.current) setError(reason instanceof Error ? reason.message : "Could not read this Document. Open a native Document JSON file.");
    } finally {
      if (ticket === importTicket.current) setLoading(false);
      if (input.current) input.current.value = "";
    }
  }
  function onFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void openFile(file); }
  function onDrop(event: DragEvent) { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void openFile(file); }
  function select(id: string) { setSelectedId(id); setMobileNavigator(false); }
  function toggleRoot(id: string) { setExpanded(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault(); setActiveTab(TABS[next].id);
    window.document.getElementById(`tab-${TABS[next].id}`)?.focus();
  }
  const citationButton = (citation: CitationView, nested = false) => <button type="button" key={citation.id} className={`citation-item ${nested ? "citation-item--leaf" : ""} ${selected?.id === citation.id ? "selected" : ""}`} onClick={() => select(citation.id)} aria-current={selected?.id === citation.id ? "true" : undefined}>
    <span className="citation-item-title">{nested ? locatorLabel(citation) || citationLabel(citation) : citationLabel(citation)}</span>
    <span className="citation-item-subtitle">{nested || locatorLabel(citation) === citationLabel(citation) ? kindLabel(citation.kind) : locatorLabel(citation) || kindLabel(citation.kind)}</span>
  </button>;

  const navigatorContents = <>
    <header className="navigator-heading"><div><span className="eyebrow">CITATION INDEX</span><h2>Authorities</h2></div><button type="button" className="icon-button mobile-only" aria-label="Close citation navigator" onClick={() => setMobileNavigator(false)}><Icon name="close" /></button></header><label className="search-control navigator-search"><Icon name="search" size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a case or locator…" aria-label="Find a citation" /></label><div className="navigation-scroll">
          {filtered?.roots.map(({ root, leaves }, index) => <section key={root.id} className="root-group"><div className={`root-row ${selected?.id === root.id ? "selected" : ""}`}><span className="root-number">{String(index + 1).padStart(2, "0")}</span>{citationButton(root)}{leaves.length > 0 && <button type="button" className={`expand-root ${expanded.has(root.id) || !!query ? "is-expanded" : ""}`} aria-label={`${expanded.has(root.id) ? "Collapse" : "Expand"} ${leaves.length} occurrences for ${citationLabel(root)}`} aria-expanded={expanded.has(root.id) || !!query} onClick={() => toggleRoot(root.id)}><span>{leaves.length}</span><Icon name="chevron" size={13} /></button>}</div>{(expanded.has(root.id) || !!query) && leaves.length > 0 && <div className="leaf-list">{leaves.map(leaf => citationButton(leaf, true))}</div>}</section>)}
          {filtered && ([{ label: "Awaiting root assignment", citations: filtered.unassigned }, { label: "Unattached / withdrawn", citations: filtered.withdrawn }, { label: "Unrecognized relationships", citations: filtered.unknown }]).map(group => group.citations.length ? <section className="unattached-group" key={group.label}><h3>{group.label}<span>{group.citations.length}</span></h3>{group.citations.map(item => citationButton(item))}</section> : null)}
          {document?.citations.length === 0 ? <p className="navigation-empty">No citations have been created at this checkpoint.</p> : filtered && !filtered.roots.length && !filtered.unassigned.length && !filtered.withdrawn.length && !filtered.unknown.length ? <p className="navigation-empty">No citations match “{query}”.</p> : null}
        </div><footer className="navigator-footer">Roots organize every occurrence.<br />Identity belongs to the authority.</footer>
  </>;

  return <main id="main-content" className={`review-workspace ${dragging ? "is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={onDrop}>
    <input ref={input} className="visually-hidden" type="file" accept="application/json,.json" aria-label="Open Document JSON" onChange={onFile} />
    <header className="workspace-header"><div className="workspace-heading"><p className="eyebrow">Authority. Evidence. Provenance.</p><h1>{document ? titleOf(document, filename) : "Citation review"}</h1><p className="workspace-subtitle">{document ? `${document.citations.length.toLocaleString()} occurrences · ${groups?.roots.length.toLocaleString()} roots · ${document.stageRuns.length} completed stages` : "A considered view of legal citations and the evidence behind them."}</p></div><div className="workspace-actions">{document && <><RawDialog title="Complete saved Document" value={document.raw} triggerLabel="Document JSON" /><button type="button" className="icon-button" aria-label="Download displayed Document" title="Download displayed Document" onClick={() => downloadJson(document.raw, filename || "document.json")}><Icon name="download" /></button></>}<button type="button" className="primary-button" onClick={() => input.current?.click()} disabled={loading}><Icon name="upload" />{loading ? "Reading document…" : document ? "Open another document" : "Open Document"}</button></div></header>
    {error && <div className="import-error" role="alert"><strong>Unable to open this file</strong><p>{error}</p><button type="button" className="text-button" onClick={() => input.current?.click()}>Choose another file</button></div>}
    {!document ? <section className="welcome"><div className="welcome-copy"><span className="section-number">THE REVIEW WORKSPACE</span><h2>Read the record.<br />Understand the reasoning.</h2><p>Follow each citation from the source document to its authority, supporting evidence, and complete decision history.</p><button type="button" className="primary-button" onClick={() => input.current?.click()} disabled={loading}><Icon name="upload" />{loading ? "Reading document…" : "Open a saved Document"}</button><p className="local-note"><Icon name="lock" size={14} />Your document stays in this browser.</p><span className="drop-hint">or drop a Document JSON file anywhere</span></div><div className="welcome-outline"><p className="eyebrow">Four views. One record.</p>{TABS.map((tab, index) => <div key={tab.id} className="welcome-feature"><span className="feature-number">0{index + 1}</span><div><h3>{tab.label}</h3><p>{tab.description}</p></div><Icon name={tab.icon} size={22} /></div>)}<p className="welcome-footnote">Open an extraction checkpoint, a completed validation, or any stage in between.</p></div></section> : <>
      <div className="checkpoint-bar"><div><span className="checkpoint-dot" /><span>{checkpoint ? "Historical checkpoint" : "Saved document"}</span><span className="checkpoint-filename">{filename}</span></div><label className="checkpoint-control">Checkpoint<select value={checkpoint} onChange={event => setCheckpoint(event.target.value)}><option value="">Latest saved state</option>{saved?.stageRuns.map(stage => <option key={stage} value={stage}>{stage.split("_")[0]} · {humanize(stage)}</option>)}</select></label></div>
      {document.warnings?.length ? <details className="document-warnings"><summary>{document.warnings.length} record {document.warnings.length === 1 ? "notice" : "notices"}</summary><ul>{document.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details> : null}
      <div className="review-grid">
        <aside className="citation-navigator desktop-navigator" aria-label="Citation navigation">{navigatorContents}</aside>
        <dialog ref={navigatorDialog} className="citation-drawer" aria-label="Citation navigation" onClose={() => setMobileNavigator(false)} onCancel={() => setMobileNavigator(false)}>
          <aside className="citation-navigator">{navigatorContents}</aside>
        </dialog>
        <section className="review-main"><div className="selection-bar"><button className="secondary-button mobile-only" onClick={() => setMobileNavigator(true)} type="button">Citation index</button><div className="selection-info"><span className="selection-kind">{selected ? kindLabel(selected.kind) : "Document"}</span><span className="selection-title">{selected ? citationLabel(selected) : "No citation selected"}</span>{selected && root && selected.id !== root.id && <span className="selection-root">↳ {citationLabel(root)}</span>}</div>{selected && <span className="selection-id" title={selected.id}>{selected.id}</span>}</div>
          <div className="review-tabs" role="tablist" aria-label="Citation views">{TABS.map((tab, i) => <button type="button" key={tab.id} id={`tab-${tab.id}`} role="tab" aria-controls={`panel-${tab.id}`} aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)} onKeyDown={event => tabKeys(event, i)}><Icon name={tab.icon} size={16} />{tab.label}{tab.id === "nodes" && selected && <span className="tab-count">{selected.nodes.length}</span>}</button>)}</div>
          <div className={`review-content review-content--${activeTab}`} role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={0}>
            {activeTab === "document" ? <DocumentViewPanel document={document} citation={selected} onSelect={select} /> : selected ? activeTab === "identity" ? <IdentityView citation={selected} root={root} document={document} /> : activeTab === "support" ? <SupportView citation={selected} root={root} document={document} /> : <NodesView citation={selected} document={document} /> : <div className="empty-state"><h2>No citation selected</h2><p>Choose an occurrence from the index. A Document before extraction is still available in the Document tab.</p></div>}
          </div>
        </section>
      </div>
    </>}
    <footer className="workspace-footer"><span>mellea · Legal reference checking</span><span><Icon name="lock" size={12} />Local, read-only review</span></footer>
    {dragging && <div className="drop-overlay" aria-hidden="true"><Icon name="upload" size={40} /><h2>Open this Document</h2><p>Drop your saved JSON file to begin.</p></div>}
  </main>;
}
