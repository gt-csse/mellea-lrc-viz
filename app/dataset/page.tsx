"use client";

import "./dataset.css";

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

type Selection =
  | { kind: "citation"; row: Citation }
  | { kind: "noncase"; row: NoncaseCitation }
  | { kind: "nonconforming"; row: NonconformingCitation };

export default function DatasetReviewer() {
  const [bundle, setBundle] = useState<DocumentBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"citation" | "document">("citation");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openRoots, setOpenRoots] = useState<string[]>([]);

  function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        const payload = parseBundle(JSON.parse(text));
        setBundle(payload);
        setSelectedId(payload.extraction.citations[0]?.id ?? null);
        setOpenRoots([]);
        setError(null);
      })
      .catch((reason) => {
        setBundle(null);
        setSelectedId(null);
        setError(reason instanceof Error ? reason.message : "Could not read that file.");
      });
  }

  const citations = bundle?.extraction.citations ?? [];
  const roots = useMemo(() => citations.filter((citation) => citation.is_root), [citations]);
  const rootOf = useMemo(() => new Map(roots.map((root) => [root.id, root])), [roots]);
  const shortFormsOf = useMemo(() => {
    const index = new Map<string, Citation[]>();
    for (const citation of citations) {
      if (citation.is_root) continue;
      index.set(citation.root_id, [...(index.get(citation.root_id) ?? []), citation]);
    }
    return index;
  }, [citations]);

  const selected: Selection | null = useMemo(() => {
    if (!bundle || !selectedId) return null;
    const citation = citations.find((row) => row.id === selectedId);
    if (citation) return { kind: "citation", row: citation };
    const noncase = bundle.extraction.noncase_citations.find((row) => row.id === selectedId);
    if (noncase) return { kind: "noncase", row: noncase };
    const nonconforming = bundle.extraction.nonconforming_citations.find((row) => row.id === selectedId);
    if (nonconforming) return { kind: "nonconforming", row: nonconforming };
    return null;
  }, [bundle, citations, selectedId]);

  const marks = useMemo(() => {
    if (!bundle) return [];
    const list: Mark[] = [];
    const first = (id: string) => (id === selectedId ? -1 : 0);
    for (const citation of [...citations].sort((a, b) => first(a.id) - first(b.id))) {
      const where = citation.locator ?? citation.cited_as;
      list.push({
        id: citation.id,
        start: where.start,
        end: where.end,
        className: `citation-mark${citation.id === selectedId ? " selected" : ""}`
      });
    }
    for (const row of bundle.extraction.noncase_citations)
      list.push({
        id: row.id,
        start: row.cited_as.start,
        end: row.cited_as.end,
        className: `citation-mark noncase${row.id === selectedId ? " selected" : ""}`
      });
    for (const row of bundle.extraction.nonconforming_citations)
      list.push({
        id: row.id,
        start: row.named_as.start,
        end: row.named_as.end,
        className: `citation-mark nonconforming${row.id === selectedId ? " selected" : ""}`
      });
    return list;
  }, [bundle, citations, selectedId]);

  const segments = useMemo(() => (bundle ? segment(bundle.text, marks) : []), [bundle, marks]);

  const documentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    documentRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId, segments, activeView]);

  function select(id: string) {
    setSelectedId(id);
    const citation = citations.find((row) => row.id === id);
    if (citation && !citation.is_root && !openRoots.includes(citation.root_id))
      setOpenRoots((open) => [...open, citation.root_id]);
  }

  function toggle(id: string) {
    setOpenRoots((open) => (open.includes(id) ? open.filter((other) => other !== id) : [...open, id]));
  }

  const heading =
    activeView === "document"
      ? { title: "Source document", note: "Where each citation is written" }
      : { title: "Citation", note: selectedTitle(selected) };

  return (
    <main id="main-content" className="app-shell dataset-workspace">
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
        <>
          <div className="view-tabs" role="tablist" aria-label="Annotation view">
            <button
              role="tab"
              aria-selected={activeView === "citation"}
              className={activeView === "citation" ? "active" : ""}
              onClick={() => setActiveView("citation")}
            >
              Citation
            </button>
            <button
              role="tab"
              aria-selected={activeView === "document"}
              className={activeView === "document" ? "active" : ""}
              onClick={() => setActiveView("document")}
            >
              Document
            </button>
          </div>

          <section className="workspace document-workspace" aria-label="Extraction annotation">
            <aside className="citation-list" aria-label="Citations">
              <div className="panel-heading">
                <h2>Citations</h2>
                <span>{roots.length} roots</span>
              </div>

              {roots.map((root) => {
                const shortForms = shortFormsOf.get(root.id) ?? [];
                const open = openRoots.includes(root.id);
                return (
                  <div key={root.id}>
                    <button
                      className={`citation-button${root.id === selectedId ? " selected" : ""}`}
                      aria-expanded={shortForms.length ? open : undefined}
                      onClick={() => {
                        if (shortForms.length) toggle(root.id);
                        select(root.id);
                      }}
                    >
                      <strong>
                        <span className="twist" aria-hidden="true">
                          {shortForms.length ? (open ? "▾" : "▸") : ""}
                        </span>
                        {root.case_name?.quote ?? root.cited_as.quote}
                      </strong>
                      <span className="citation-button-meta">
                        <span className="locator">{identifierOf(root.identifier) ?? "no locator"}</span>
                        {shortForms.length ? (
                          <span className="count-chip">
                            {shortForms.length} short form{shortForms.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </span>
                    </button>

                    {open && shortForms.length ? (
                      <div className="branch">
                        {shortForms.map((shortForm) => (
                          <button
                            key={shortForm.id}
                            className={`citation-button${shortForm.id === selectedId ? " selected" : ""}`}
                            onClick={() => select(shortForm.id)}
                          >
                            <strong>{shortForm.cited_as.quote}</strong>
                            <span className="citation-button-meta">
                              <span>{shortForm.kind}</span>
                              <span className="locator">
                                {shortForm.pin_cite ? shortForm.pin_cite.quote : "no page"}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {bundle.extraction.noncase_citations.length ? (
                <>
                  <h3>Cited, and not a decision</h3>
                  {bundle.extraction.noncase_citations.map((row) => (
                    <button
                      key={row.id}
                      className={`citation-button${row.id === selectedId ? " selected" : ""}`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <strong>{row.cited_as.quote}</strong>
                      <span className="locator">{row.id}</span>
                    </button>
                  ))}
                </>
              ) : null}

              {bundle.extraction.nonconforming_citations.length ? (
                <>
                  <h3>Named as authority, never located</h3>
                  {bundle.extraction.nonconforming_citations.map((row) => (
                    <button
                      key={row.id}
                      className={`citation-button${row.id === selectedId ? " selected" : ""}`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <strong>{row.named_as.quote}</strong>
                      <span className="locator">{row.id}</span>
                    </button>
                  ))}
                </>
              ) : null}
            </aside>

            <section className="graph-panel" aria-labelledby="panel-title">
              <div className="panel-heading">
                <div>
                  <h2 id="panel-title">{heading.title}</h2>
                  <p>{heading.note}</p>
                </div>
                <span className="artifact-version">
                  {bundle.document.number} · {bundle.store.extraction}
                </span>
              </div>

              {activeView === "document" ? (
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
              ) : selected ? (
                <Detail selection={selected} root={rootOf.get((selected.row as Citation).root_id ?? "")} />
              ) : (
                <section className="bibliography-empty">
                  <h3>Nothing selected</h3>
                  <p>Pick a citation on the left. A root is a case the filing introduces; expanding it lists the short forms that return to it.</p>
                </section>
              )}
            </section>
          </section>
        </>
      )}
    </main>
  );
}

function selectedTitle(selection: Selection | null) {
  if (!selection) return "Select a citation";
  if (selection.kind === "citation") return selection.row.cited_as.quote;
  if (selection.kind === "noncase") return selection.row.cited_as.quote;
  return selection.row.named_as.quote;
}

function Detail({ selection, root }: { selection: Selection; root?: Citation }) {
  if (selection.kind === "citation") {
    const citation = selection.row;
    const home = citation.is_root ? citation : root;
    return (
      <section className="bibliography">
        <div className="candidate-detail">
          <div className="candidate-detail-header">
            <div>
              <p className="candidate-kicker">
                {citation.is_root ? "Root — the place that states the identifier" : `Short form of ${home?.case_name?.quote ?? home?.id ?? "its root"}`}
              </p>
              <h3>{home?.case_name?.quote ?? citation.cited_as.quote}</h3>
              <div className="candidate-title">
                <span className="locator">{identifierOf(home?.identifier) ?? "no identifier stated"}</span>
                <span className="provenance">{citation.kind}</span>
              </div>
            </div>
            <span className="outcome outcome-match">{citation.id}</span>
          </div>

          <div className="candidate-fields">
            <Field label="Cited as">
              <p className="quote">{citation.cited_as.quote}</p>
              <small>
                {citation.cited_as.start}–{citation.cited_as.end}
              </small>
            </Field>
            <Field label="Locator">
              {citation.locator ? (
                <>
                  <p className="quote">{citation.locator.quote}</p>
                  <small>
                    {citation.locator.start}–{citation.locator.end}
                  </small>
                </>
              ) : (
                <p>none written here</p>
              )}
            </Field>
            <Field label="Pin cite">
              {citation.pin_cite ? (
                <>
                  <p className="quote">{pinCiteOf(citation.pin_cite)}</p>
                  <small>{(citation.pin_cite.normalized ?? []).map((part) => part.kind).join(", ") || "not normalised"}</small>
                </>
              ) : (
                <p>no page stated</p>
              )}
            </Field>
            <Field label="Root">
              <p>{citation.root_id}</p>
              <small>{citation.is_root ? "this place introduces the case" : "the place that introduced the case"}</small>
            </Field>
            {citation.case_name ? (
              <Field label="Case name, as written">
                <p className="quote">{citation.case_name.quote}</p>
              </Field>
            ) : null}
            {citation.colocation_id ? (
              <Field label="Colocated">
                <p>{citation.colocation_id}</p>
                <small>another citation to the same case at this place</small>
              </Field>
            ) : null}
            {citation.in_table_of_authorities ? (
              <Field label="Where">
                <p>the table of authorities</p>
              </Field>
            ) : null}
          </div>

          {citation.note ? <Note>{citation.note}</Note> : null}
        </div>
      </section>
    );
  }

  if (selection.kind === "noncase") {
    const row = selection.row;
    return (
      <section className="bibliography">
        <div className="candidate-detail">
          <div className="candidate-detail-header">
            <div>
              <p className="candidate-kicker">Cited, and not a decision</p>
              <h3>{row.cited_as.quote}</h3>
            </div>
            <span className="outcome outcome-inconclusive">{row.id}</span>
          </div>
          <div className="candidate-fields">
            <Field label="Cited as">
              <p className="quote">{row.cited_as.quote}</p>
              <small>
                {row.cited_as.start}–{row.cited_as.end}
              </small>
            </Field>
          </div>
          <Note>{row.note}</Note>
        </div>
      </section>
    );
  }

  const row = selection.row;
  return (
    <section className="bibliography">
      <div className="candidate-detail">
        <div className="candidate-detail-header">
          <div>
            <p className="candidate-kicker">Named as authority, never located</p>
            <h3>{row.named_as.quote}</h3>
          </div>
          <span className="outcome outcome-mismatch">{row.id}</span>
        </div>
        <div className="candidate-fields">
          <Field label="Named as">
            <p className="quote">{row.named_as.quote}</p>
            <small>
              {row.named_as.start}–{row.named_as.end}
            </small>
          </Field>
          {row.signal ? (
            <Field label="Signal">
              <p className="quote">{row.signal.quote}</p>
            </Field>
          ) : null}
          {row.context ? (
            <Field label="In context">
              <p className="quote">{row.context.quote}</p>
            </Field>
          ) : null}
        </div>
        <Note>{row.note}</Note>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="candidate-field">
      <h4>{label}</h4>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="pinpoint-unavailable">
      <strong>The annotator&rsquo;s note</strong>
      <p>{children}</p>
    </div>
  );
}
