"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Citation,
  DocumentBundle,
  Mark,
  NoncaseCitation,
  NonconformingCitation,
  identifierOf,
  parseBundle,
  pinCiteOf,
  segment
} from "../../lib/bundle";

export default function DatasetReviewer() {
  const [bundle, setBundle] = useState<DocumentBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openRoots, setOpenRoots] = useState<string[]>([]);

  function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        setBundle(parseBundle(JSON.parse(text)));
        setSelectedId(null);
        setOpenRoots([]);
        setError(null);
      })
      .catch((reason) => {
        setBundle(null);
        setError(reason instanceof Error ? reason.message : "Could not read that file.");
      });
  }

  const citations = bundle?.extraction.citations ?? [];
  const roots = useMemo(() => citations.filter((citation) => citation.is_root), [citations]);
  const shortFormsOf = useMemo(() => {
    const index = new Map<string, Citation[]>();
    for (const citation of citations) {
      if (citation.is_root) continue;
      index.set(citation.root_id, [...(index.get(citation.root_id) ?? []), citation]);
    }
    return index;
  }, [citations]);

  const marks = useMemo(() => {
    if (!bundle) return [];
    const list: Mark[] = [];
    const selectedFirst = (id: string) => (id === selectedId ? -1 : 0);
    for (const citation of [...citations].sort((a, b) => selectedFirst(a.id) - selectedFirst(b.id))) {
      const where = citation.locator ?? citation.cited_as;
      list.push({
        id: citation.id,
        start: where.start,
        end: where.end,
        className: `citation-mark${citation.id === selectedId ? " selected" : ""}`
      });
    }
    for (const row of bundle.extraction.noncase_citations) {
      list.push({
        id: row.id,
        start: row.cited_as.start,
        end: row.cited_as.end,
        className: `citation-mark noncase${row.id === selectedId ? " selected" : ""}`
      });
    }
    for (const row of bundle.extraction.nonconforming_citations) {
      list.push({
        id: row.id,
        start: row.named_as.start,
        end: row.named_as.end,
        className: `citation-mark nonconforming${row.id === selectedId ? " selected" : ""}`
      });
    }
    return list;
  }, [bundle, citations, selectedId]);

  const segments = useMemo(
    () => (bundle ? segment(bundle.text, marks) : []),
    [bundle, marks]
  );

  const documentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    documentRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId, segments]);

  function select(id: string) {
    setSelectedId(id);
    const citation = citations.find((item) => item.id === id);
    if (citation && !openRoots.includes(citation.root_id)) {
      setOpenRoots((open) => [...open, citation.root_id]);
    }
  }

  function toggleRoot(id: string) {
    setOpenRoots((open) => (open.includes(id) ? open.filter((other) => other !== id) : [...open, id]));
  }

  return (
    <main id="main-content" className="app-shell">
      <header className="header">
        <div>
          <p className="eyebrow">Extraction ground truth</p>
          <h1>mellea-LRC</h1>
        </div>
        <label className="load-control">
          <span>Open document bundle</span>
          <input type="file" accept="application/json,.json" onChange={loadFile} />
        </label>
      </header>

      {error ? <p className="error" role="alert">{error}</p> : null}

      {!bundle ? (
        <section className="empty-state" aria-labelledby="empty-title">
          <h2 id="empty-title">No document loaded</h2>
          <p>
            Open one bundle from <code>bundles/</code>, written by <code>npm run bundle</code> from
            the annotation store. A bundle is a single document: its text, the citations read out of
            it, and the hash that says which text those spans index.
          </p>
        </section>
      ) : (
        <section className="workspace tree-workspace" aria-label="Extraction annotation">
          <div className="document-panel">
            <div className="document-heading">
              <div>
                <h2>
                  {bundle.document.number} · {bundle.document.case_name}
                </h2>
                <p>{bundle.document.document_kind}</p>
              </div>
              <p>
                {bundle.document.length.toLocaleString()} characters · sha{" "}
                {bundle.document.sha256.slice(0, 12)} · {bundle.store.extraction} ·{" "}
                {bundle.store.commit ?? "—"}
              </p>
            </div>
            <div className="document-viewer" ref={documentRef}>
              {segments.map((piece, index) =>
                piece.mark ? (
                  <button
                    key={`${piece.mark.id}-${index}`}
                    type="button"
                    className={piece.mark.className}
                    data-selected={piece.mark.id === selectedId ? "true" : undefined}
                    onClick={() => select(piece.mark!.id)}
                    title={piece.mark.id}
                  >
                    {piece.text}
                  </button>
                ) : (
                  <span key={index}>{piece.text}</span>
                )
              )}
            </div>
          </div>

          <aside className="details" aria-label="Citations">
            <div className="panel-heading">
              <h2>Citations</h2>
              <p>
                {roots.length} roots · {citations.length} places
              </p>
            </div>

            <div className="tree-section">
              {roots.map((root) => (
                <Root
                  key={root.id}
                  root={root}
                  shortForms={shortFormsOf.get(root.id) ?? []}
                  open={openRoots.includes(root.id)}
                  selectedId={selectedId}
                  onToggle={() => toggleRoot(root.id)}
                  onSelect={select}
                />
              ))}
            </div>

            {bundle.extraction.noncase_citations.length ? (
              <div className="tree-section">
                <h3>Cited, and not a decision</h3>
                {bundle.extraction.noncase_citations.map((row) => (
                  <Aside
                    key={row.id}
                    id={row.id}
                    title={row.cited_as.quote}
                    note={row.note}
                    open={openRoots.includes(row.id)}
                    selected={row.id === selectedId}
                    onToggle={() => toggleRoot(row.id)}
                    onSelect={() => setSelectedId(row.id)}
                  />
                ))}
              </div>
            ) : null}

            {bundle.extraction.nonconforming_citations.length ? (
              <div className="tree-section">
                <h3>Named as authority, never located</h3>
                {bundle.extraction.nonconforming_citations.map((row) => (
                  <Aside
                    key={row.id}
                    id={row.id}
                    title={row.named_as.quote}
                    note={row.note}
                    context={row.context?.quote}
                    open={openRoots.includes(row.id)}
                    selected={row.id === selectedId}
                    onToggle={() => toggleRoot(row.id)}
                    onSelect={() => setSelectedId(row.id)}
                  />
                ))}
              </div>
            ) : null}
          </aside>
        </section>
      )}
    </main>
  );
}

function Root({
  root,
  shortForms,
  open,
  selectedId,
  onToggle,
  onSelect
}: {
  root: Citation;
  shortForms: Citation[];
  open: boolean;
  selectedId: string | null;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const identifier = identifierOf(root.identifier);
  return (
    <div className="root">
      <button
        type="button"
        className={`root-summary${root.id === selectedId ? " selected" : ""}`}
        aria-expanded={open}
        onClick={() => {
          onToggle();
          onSelect(root.id);
        }}
      >
        <span className="twist" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <strong>{root.case_name?.quote ?? root.cited_as.quote}</strong>
        <span className="root-meta">
          <span className="locator">{identifier ?? "no locator stated"}</span>
          {shortForms.length ? (
            <span className="count-chip">{shortForms.length} short form{shortForms.length > 1 ? "s" : ""}</span>
          ) : null}
          {root.in_table_of_authorities ? <span className="count-chip">table of authorities</span> : null}
        </span>
      </button>

      {open ? (
        <div className="root-body">
          <CitationFields citation={root} />
          {shortForms.map((shortForm) => (
            <button
              key={shortForm.id}
              type="button"
              className={`short-form${shortForm.id === selectedId ? " selected" : ""}`}
              onClick={() => onSelect(shortForm.id)}
            >
              <strong>{shortForm.cited_as.quote}</strong>
              <span>
                {shortForm.kind}
                {shortForm.pin_cite ? ` · ${pinCiteOf(shortForm.pin_cite)}` : " · no page"}
                {shortForm.in_table_of_authorities ? " · table of authorities" : ""}
              </span>
              {shortForm.note ? <span className="row-note">{shortForm.note}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CitationFields({ citation }: { citation: Citation }) {
  return (
    <dl>
      <Field label="id">{citation.id}</Field>
      <Field label="kind">{citation.kind}</Field>
      <Field label="cited as">{citation.cited_as.quote}</Field>
      {citation.locator ? <Field label="locator">{citation.locator.quote}</Field> : null}
      {citation.pin_cite ? <Field label="pin cite">{pinCiteOf(citation.pin_cite)}</Field> : null}
      {citation.colocation_id ? <Field label="colocated">{citation.colocation_id}</Field> : null}
      {citation.note ? (
        <div className="field-row">
          <dt>note</dt>
          <dd className="row-note">{citation.note}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Aside({
  id,
  title,
  note,
  context,
  open,
  selected,
  onToggle,
  onSelect
}: {
  id: string;
  title: string;
  note: string;
  context?: string;
  open: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="root">
      <button
        type="button"
        className={`root-summary${selected ? " selected" : ""}`}
        aria-expanded={open}
        onClick={() => {
          onToggle();
          onSelect();
        }}
      >
        <span className="twist" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <strong>{title}</strong>
        <span className="root-meta">
          <span className="locator">{id}</span>
        </span>
      </button>
      {open ? (
        <div className="root-body">
          {context ? <p className="row-note">{context}</p> : null}
          <p className="row-note">{note}</p>
        </div>
      ) : null}
    </div>
  );
}
