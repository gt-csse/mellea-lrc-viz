"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./dataset.module.css";
import {
  Annotation,
  Bundle,
  DatasetDocument,
  Evidence,
  Mark,
  Root,
  Span,
  caseNameOf,
  identifierOf,
  labelClass,
  parseBundle,
  segment
} from "../../lib/dataset";

const BUNDLE_URL = "/dataset-bundle.json";

const CLASS_FOR: Record<string, string> = {
  WRONG_IDENTITY: styles.wrongIdentity,
  WRONG_PINCITE: styles.wrongPincite,
  CORRECT_IDENTITY: styles.correct,
  CORRECT_PINCITE: styles.correct,
  UNDETERMINED: styles.undetermined
};

const BADGE_FOR: Record<string, string> = {
  WRONG_IDENTITY: styles.wrongIdentity,
  WRONG_PINCITE: styles.wrongPincite,
  CORRECT_IDENTITY: styles.correct,
  CORRECT_PINCITE: styles.correct,
  UNDETERMINED: styles.undetermined
};

export default function DatasetReviewer() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"documents" | "coverage">("documents");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  const [pane, setPane] = useState<string>("filing");
  const [focus, setFocus] = useState<Span | null>(null);
  const [label, setLabel] = useState("all");
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(BUNDLE_URL)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("no bundle"))))
      .then((value) => {
        if (cancelled) return;
        const parsed = parseBundle(value);
        setBundle(parsed);
        setDocumentId(parsed.documents[0]?.id ?? null);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function openFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        const parsed = parseBundle(JSON.parse(text));
        setBundle(parsed);
        setDocumentId(parsed.documents[0]?.id ?? null);
        setRootId(null);
        setError(null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not read that file."));
  }

  const document = bundle?.documents.find((item) => item.id === documentId) ?? null;

  const identityByRoot = useMemo(() => {
    const index = new Map<string, Annotation>();
    document?.identity.forEach((row) => row.root_id && index.set(row.root_id, row));
    return index;
  }, [document]);

  const pinciteByOccurrence = useMemo(() => {
    const index = new Map<string, Annotation>();
    document?.pincite.forEach((row) => row.occurrence_id && index.set(row.occurrence_id, row));
    return index;
  }, [document]);

  const occurrencesByRoot = useMemo(() => {
    const index = new Map<string, DatasetDocument["occurrences"]>();
    document?.occurrences.forEach((occurrence) => {
      const list = index.get(occurrence.root_id) ?? [];
      list.push(occurrence);
      index.set(occurrence.root_id, list);
    });
    return index;
  }, [document]);

  const roots = useMemo(() => {
    if (!document) return [];
    const wanted = query.trim().toLowerCase();
    return document.roots.filter((root) => {
      const identity = identityByRoot.get(root.id);
      const pincites = (occurrencesByRoot.get(root.id) ?? [])
        .map((occurrence) => pinciteByOccurrence.get(occurrence.id))
        .filter(Boolean) as Annotation[];
      if (label !== "all") {
        const labels = [identity?.label, ...pincites.map((row) => row.label)];
        if (!labels.includes(label)) return false;
      }
      if (source !== "all" && identity?.source !== source) return false;
      if (wanted) {
        const haystack = [
          caseNameOf(root.case_name_as_written),
          identifierOf(root.identifier),
          root.id
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(wanted)) return false;
      }
      return true;
    });
  }, [document, identityByRoot, occurrencesByRoot, pinciteByOccurrence, label, source, query]);

  const selectedRoot = document?.roots.find((root) => root.id === rootId) ?? null;

  const paneTextId =
    pane === "filing" ? document?.text_id ?? null : pane.startsWith("ruling:") ? pane : null;
  const paneText = paneTextId ? bundle?.texts[paneTextId] ?? "" : "";

  const marks = useMemo(() => {
    if (!document || !paneTextId) return [];
    const list: Mark[] = [];
    if (focus && focus.text === paneTextId) {
      list.push({
        start: focus.start,
        end: focus.end,
        className: `${styles.evidenceMark} ${styles.selectedMark}`,
        key: "focus"
      });
    }
    if (paneTextId !== document.text_id) return list;
    const ordered = [...document.occurrences].sort((a, b) => {
      const selected = (occurrence: typeof a) => (occurrence.root_id === rootId ? 0 : 1);
      return selected(a) - selected(b);
    });
    for (const occurrence of ordered) {
      const identity = identityByRoot.get(occurrence.root_id);
      const pincite = pinciteByOccurrence.get(occurrence.id);
      const worst =
        identity?.label === "WRONG_IDENTITY"
          ? "WRONG_IDENTITY"
          : pincite?.label === "WRONG_PINCITE"
            ? "WRONG_PINCITE"
            : (identity?.label ?? "UNDETERMINED");
      const selected = occurrence.root_id === rootId;
      list.push({
        start: occurrence.locator_span.start,
        end: occurrence.locator_span.end,
        className: `${styles.hit} ${CLASS_FOR[worst] ?? styles.undetermined}${selected ? ` ${styles.selectedMark}` : ""}`,
        key: occurrence.id,
        title: `${occurrence.id} · ${occurrence.kind} · ${worst}`
      });
    }
    for (const unread of document.unread_names) {
      list.push({
        start: unread.span.start,
        end: unread.span.end,
        className: `${styles.hit} ${styles.unread}`,
        key: unread.id,
        title: `${unread.id} · ${unread.label} · a case named where no citation was read`
      });
    }
    return list;
  }, [document, paneTextId, focus, rootId, identityByRoot, pinciteByOccurrence]);

  const segments = useMemo(() => (paneText ? segment(paneText, marks) : []), [paneText, marks]);

  // What the text pane scrolls to: the evidence span when one is being shown,
  // otherwise the first place the selected citation is stated.
  const focusKey = useMemo(() => {
    if (focus) return "focus";
    if (!rootId || !document) return null;
    const first = document.occurrences
      .filter((occurrence) => occurrence.root_id === rootId)
      .sort((a, b) => a.locator_span.start - b.locator_span.start)[0];
    return first?.id ?? null;
  }, [focus, rootId, document]);

  const textRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const target = textRef.current?.querySelector('[data-focus="true"]');
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusKey, pane, segments]);

  function selectOccurrenceMark(key: string) {
    const occurrence = document?.occurrences.find((item) => item.id === key);
    if (occurrence) {
      setRootId(occurrence.root_id);
      setFocus(null);
    }
  }

  function showEvidence(evidence: Evidence) {
    if (!evidence.span?.text) return;
    setPane(evidence.span.text === document?.text_id ? "filing" : evidence.span.text);
    setFocus(evidence.span);
  }

  if (loading) return <main className={styles.shell}><p className={styles.empty}>Loading the bundle…</p></main>;

  if (!bundle)
    return (
      <main className={styles.shell}>
        <Header bundle={null} onOpen={openFile} />
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <section className={styles.empty}>
          <h2>No bundle loaded</h2>
          <p>
            Build one from the annotation store with <code>npm run bundle</code>, which writes{" "}
            <code>public/dataset-bundle.json</code>, or open a bundle from disk. The bundle is not
            committed: the store it is built from is not public.
          </p>
        </section>
      </main>
    );

  return (
    <main className={styles.shell}>
      <Header bundle={bundle} onOpen={openFile} />
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <div className={styles.tabs} role="tablist" aria-label="Dataset view">
        <button role="tab" aria-selected={tab === "documents"} className={tab === "documents" ? styles.active : ""} onClick={() => setTab("documents")}>
          Documents
        </button>
        <button role="tab" aria-selected={tab === "coverage"} className={tab === "coverage" ? styles.active : ""} onClick={() => setTab("coverage")}>
          Coverage
        </button>
      </div>

      {tab === "coverage" ? (
        <Coverage bundle={bundle} onOpenDocument={(id) => { setDocumentId(id); setRootId(null); setTab("documents"); }} />
      ) : (
        <section className={styles.workspace} aria-label="Dataset reviewer">
          <aside className={styles.rail}>
            {!document ? null : (
              <>
                <div className={styles.railHeading}>
                  <h2>Documents</h2>
                  <span>{bundle.documents.length}</span>
                </div>
                {bundle.documents.map((item) => (
                  <button
                    key={item.id}
                    className={`${styles.docButton}${item.id === documentId ? ` ${styles.selected}` : ""}`}
                    onClick={() => { setDocumentId(item.id); setRootId(null); setPane("filing"); setFocus(null); }}
                  >
                    <strong>{item.number} · {item.case_name}</strong>
                    <small>{item.document_kind}</small>
                    <span className={styles.docCounts}>
                      <span className={`${styles.badge} ${styles.plain}`}>{item.counts.roots} roots</span>
                      {item.counts.wrong_identity ? <span className={`${styles.badge} ${styles.wrongIdentity}`}>{item.counts.wrong_identity} identity</span> : null}
                      {item.counts.wrong_pincite ? <span className={`${styles.badge} ${styles.wrongPincite}`}>{item.counts.wrong_pincite} pincite</span> : null}
                    </span>
                  </button>
                ))}
              </>
            )}
          </aside>

          <div className={styles.centre}>
            <div className={styles.paneTabs}>
              <button className={pane === "filing" ? styles.active : ""} onClick={() => { setPane("filing"); setFocus(null); }}>
                The filing
              </button>
              {(document?.rulings ?? []).map((rulingId) => {
                const ruling = bundle.rulings.find((item) => item.ruling_id === rulingId);
                return (
                  <button
                    key={rulingId}
                    className={pane === `ruling:${rulingId}` ? styles.active : ""}
                    onClick={() => { setPane(`ruling:${rulingId}`); setFocus(null); }}
                    title={ruling?.description}
                  >
                    The order · {ruling?.case_number ?? rulingId}
                  </button>
                );
              })}
              <span className={styles.paneNote}>
                {pane === "filing"
                  ? `${document?.length.toLocaleString()} characters · sha ${document?.sha256.slice(0, 12)}`
                  : bundle.rulings.find((item) => `ruling:${item.ruling_id}` === pane)?.description}
              </span>
            </div>
            <div className={styles.text} ref={textRef}>
              {segments.map((piece, index) =>
                piece.mark ? (
                  <mark
                    key={`${piece.mark.key}-${index}`}
                    className={piece.mark.className}
                    title={piece.mark.title}
                    data-focus={piece.mark.key === focusKey ? "true" : undefined}
                    onClick={() => selectOccurrenceMark(piece.mark!.key)}
                  >
                    {piece.text}
                  </mark>
                ) : (
                  <span key={index}>{piece.text}</span>
                )
              )}
            </div>
          </div>

          <aside className={styles.detail}>
            <div className={styles.filters}>
              <input placeholder="Search case name or locator" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select value={label} onChange={(event) => setLabel(event.target.value)}>
                <option value="all">Every label</option>
                <option value="WRONG_IDENTITY">WRONG_IDENTITY</option>
                <option value="WRONG_PINCITE">WRONG_PINCITE</option>
                <option value="CORRECT_IDENTITY">CORRECT_IDENTITY</option>
                <option value="CORRECT_PINCITE">CORRECT_PINCITE</option>
                <option value="UNDETERMINED">UNDETERMINED</option>
              </select>
              <select value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="all">Every source</option>
                {Object.keys(bundle.totals.identity_sources).map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            {selectedRoot ? (
              <>
                <button className={styles.back} onClick={() => { setRootId(null); setFocus(null); }}>← every citation</button>
                <RootDetail
                  root={selectedRoot}
                  identity={identityByRoot.get(selectedRoot.id) ?? null}
                  occurrences={occurrencesByRoot.get(selectedRoot.id) ?? []}
                  pinciteByOccurrence={pinciteByOccurrence}
                  onShowEvidence={showEvidence}
                />
              </>
            ) : (
              <>
                <div className={styles.railHeading}>
                  <h2>Citations</h2>
                  <span>{roots.length} of {document?.roots.length ?? 0}</span>
                </div>
                {roots.map((root) => {
                  const identity = identityByRoot.get(root.id);
                  return (
                    <button key={root.id} className={styles.citeButton} onClick={() => { setRootId(root.id); setFocus(null); setPane("filing"); }}>
                      <strong>{caseNameOf(root.case_name_as_written) ?? "no case name written"}</strong>
                      <small>{identifierOf(root.identifier)} · {root.id}</small>
                      <span>
                        <span className={`${styles.badge} ${BADGE_FOR[identity?.label ?? ""] ?? styles.plain}`}>
                          {identity?.label ?? "no identity row"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </aside>
        </section>
      )}
    </main>
  );
}

function Header({ bundle, onOpen }: { bundle: Bundle | null; onOpen: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <header className={styles.header}>
      <div>
        <p className="eyebrow">Dataset reviewer</p>
        <h1>mellea-LRC</h1>
      </div>
      <div className={styles.provenance}>
        {bundle ? (
          <>
            <span className={styles.chip}><strong>{String(bundle.store.extraction)}</strong> {String(bundle.store.extraction_layout)}</span>
            <span className={styles.chip}><strong>{String(bundle.store.validation)}</strong> {String(bundle.store.validation_layout)}</span>
            <span className={styles.chip}>store <strong>{String(bundle.store.commit ?? "—")}</strong></span>
            <span className={styles.chip}>built {new Date(bundle.built).toLocaleString()}</span>
          </>
        ) : null}
        <label className="load-control" style={{ minWidth: 150, padding: "8px 12px" }}>
          <span>Open bundle</span>
          <input type="file" accept="application/json,.json" onChange={onOpen} />
        </label>
      </div>
    </header>
  );
}

function RootDetail({
  root,
  identity,
  occurrences,
  pinciteByOccurrence,
  onShowEvidence
}: {
  root: Root;
  identity: Annotation | null;
  occurrences: DatasetDocument["occurrences"];
  pinciteByOccurrence: Map<string, Annotation>;
  onShowEvidence: (evidence: Evidence) => void;
}) {
  return (
    <>
      <h3>{caseNameOf(root.case_name_as_written) ?? "no case name written"}</h3>
      <p className={styles.muted}>{identifierOf(root.identifier)} · {root.id}</p>

      {identity ? <AnnotationCard annotation={identity} title="Identity" onShowEvidence={onShowEvidence} /> : null}

      {occurrences.map((occurrence) => {
        const pincite = pinciteByOccurrence.get(occurrence.id);
        return (
          <div key={occurrence.id} className={styles.card}>
            <div className={styles.cardHead}>
              <strong>{occurrence.id}</strong>
              <span className={`${styles.badge} ${BADGE_FOR[pincite?.label ?? ""] ?? styles.plain}`}>
                {pincite?.label ?? "no page cited"}
              </span>
            </div>
            <dl>
              <div className={styles.field}><dt>as written</dt><dd>{occurrence.matched_text}</dd></div>
              <div className={styles.field}><dt>kind</dt><dd>{occurrence.kind} · {occurrence.role}</dd></div>
              {occurrence.pin_cite_written ? (
                <div className={styles.field}><dt>pin cite</dt><dd>{occurrence.pin_cite_written.text}</dd></div>
              ) : null}
              {occurrence.scope !== "in_scope" ? (
                <div className={styles.field}><dt>scope</dt><dd>{occurrence.scope}{occurrence.basis ? ` · ${occurrence.basis}` : ""}</dd></div>
              ) : null}
            </dl>
            {occurrence.note ? <p className={styles.note}>{occurrence.note}</p> : null}
            {pincite ? <AnnotationBody annotation={pincite} onShowEvidence={onShowEvidence} /> : null}
          </div>
        );
      })}
    </>
  );
}

function AnnotationCard({ annotation, title, onShowEvidence }: { annotation: Annotation; title: string; onShowEvidence: (evidence: Evidence) => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <strong>{title}</strong>
        <span className={`${styles.badge} ${BADGE_FOR[annotation.label ?? ""] ?? styles.plain}`}>{annotation.label}</span>
      </div>
      <AnnotationBody annotation={annotation} onShowEvidence={onShowEvidence} />
    </div>
  );
}

function AnnotationBody({ annotation, onShowEvidence }: { annotation: Annotation; onShowEvidence: (evidence: Evidence) => void }) {
  return (
    <>
      <dl>
        {annotation.subclasses.length ? (
          <div className={styles.field}><dt>subclasses</dt><dd>{annotation.subclasses.join(", ")}</dd></div>
        ) : null}
        <div className={styles.field}><dt>decided by</dt><dd>{annotation.source ?? "—"}</dd></div>
        {annotation.basis ? <div className={styles.field}><dt>basis</dt><dd>{annotation.basis}</dd></div> : null}
        {annotation.authority ? (
          <div className={styles.field}>
            <dt>archive</dt>
            <dd>
              {annotation.authority.case_name ?? annotation.authority.kind}
              {annotation.authority.date_filed ? ` · ${annotation.authority.date_filed}` : ""}
              {annotation.authority.ids?.length ? ` · ${annotation.authority.kind} ${annotation.authority.ids.join(", ")}` : ""}
            </dd>
          </div>
        ) : null}
        {annotation.records_at_locator !== null ? (
          <div className={styles.field}><dt>at locator</dt><dd>{annotation.records_at_locator} record(s)</dd></div>
        ) : null}
        {annotation.proposition ? (
          <div className={styles.field}><dt>cited for</dt><dd>{annotation.proposition}</dd></div>
        ) : null}
      </dl>
      {annotation.note ? <p className={styles.note}>{annotation.note}</p> : null}
      {annotation.evidence.map((item, index) => (
        <EvidenceItem key={index} evidence={item} onShow={onShowEvidence} />
      ))}
    </>
  );
}

function EvidenceItem({ evidence, onShow }: { evidence: Evidence; onShow: (evidence: Evidence) => void }) {
  const source = evidence.source ?? { kind: "unknown" };
  return (
    <div className={styles.evidence}>
      <div className={styles.evidenceHead}>
        <span className={`${styles.badge} ${styles.plain}`}>{evidence.shows ?? "shows nothing stated"}</span>
        {source.external_url ? (
          <a className={styles.sourceLink} href={source.external_url} target="_blank" rel="noreferrer">
            {source.kind}{source.id ? ` ${source.id}` : ""} ↗
          </a>
        ) : (
          <span className={styles.outside}>{source.label ?? source.kind}</span>
        )}
      </div>
      {evidence.proposition ? <p className={styles.muted}>cited for: {evidence.proposition}</p> : null}
      {evidence.quote ? <p className={styles.quote}>“{evidence.quote}”</p> : null}
      {evidence.note ? <p className={styles.muted}>{evidence.note}</p> : null}
      <div className={styles.evidenceHead} style={{ marginTop: 6, marginBottom: 0 }}>
        {evidence.locatable ? (
          <>
            <button className={styles.locate} onClick={() => onShow(evidence)}>show it in the text</button>
            {evidence.span_from === "match" ? (
              <span className={styles.outside}>span matched by this viewer, not by the store</span>
            ) : null}
          </>
        ) : evidence.outside_store ? (
          <span className={styles.outside}>outside this store — nothing here to point at</span>
        ) : evidence.quote ? (
          <span className={styles.unplaced}>not found in the text it quotes</span>
        ) : null}
      </div>
    </div>
  );
}

function Coverage({ bundle, onOpenDocument }: { bundle: Bundle; onOpenDocument: (id: string) => void }) {
  const rows = (counts: Record<string, number>) =>
    Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className={styles.coverage}>
      <section>
        <h2>Identity</h2>
        <table className={styles.table}>
          <tbody>
            {rows(bundle.totals.identity_labels).map(([key, n]) => (
              <tr key={key}><td>{key}</td><td className="n">{n}</td></tr>
            ))}
          </tbody>
        </table>
        <h2 style={{ marginTop: 14 }}>Decided by</h2>
        <table className={styles.table}>
          <tbody>
            {rows(bundle.totals.identity_sources).map(([key, n]) => (
              <tr key={key}><td>{key}</td><td className="n">{n}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Pin cite</h2>
        <table className={styles.table}>
          <tbody>
            {rows(bundle.totals.pincite_labels).map(([key, n]) => (
              <tr key={key}><td>{key}</td><td className="n">{n}</td></tr>
            ))}
          </tbody>
        </table>
        <h2 style={{ marginTop: 14 }}>Decided by</h2>
        <table className={styles.table}>
          <tbody>
            {rows(bundle.totals.pincite_sources).map(([key, n]) => (
              <tr key={key}><td>{key}</td><td className="n">{n}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Evidence</h2>
        <table className={styles.table}>
          <tbody>
            <tr><td>items</td><td className="n">{bundle.totals.evidence.total}</td></tr>
            <tr><td>placed in a text this store holds</td><td className="n">{bundle.totals.evidence.with_span}</td></tr>
            <tr><td>outside the store</td><td className="n">{bundle.totals.evidence.outside_store}</td></tr>
            <tr><td>quoted but not found</td><td className="n">{bundle.totals.evidence.unplaced}</td></tr>
            <tr><td>ambiguous — the quote occurs twice</td><td className="n">{bundle.totals.evidence.ambiguous}</td></tr>
            <tr><td>span written by the store</td><td className="n">{bundle.totals.evidence.span_from_store ?? 0}</td></tr>
            <tr><td>span matched by this viewer</td><td className="n">{bundle.totals.evidence.span_from_match ?? 0}</td></tr>
          </tbody>
        </table>
        <p className={styles.muted} style={{ marginTop: 10 }}>
          An item is placed when the build found its quote in the filing or in the order it came
          from, and wrote back a span. One that is not found is shown as such rather than hidden:
          the quote and the text disagree, and which is right is a question for the annotator.
        </p>
      </section>

      <section className={styles.wide}>
        <h2>By document</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>document</th><th>kind</th>
              <th className="n">roots</th><th className="n">occurrences</th>
              <th className="n">wrong identity</th><th className="n">wrong pincite</th>
              <th className="n">undetermined</th><th className="n">names, no citation</th>
            </tr>
          </thead>
          <tbody>
            {bundle.documents.map((document) => (
              <tr key={document.id}>
                <td>
                  <button className={styles.back} style={{ padding: 0 }} onClick={() => onOpenDocument(document.id)}>
                    {document.number} · {document.case_name}
                  </button>
                </td>
                <td>{document.document_kind}</td>
                <td className="n">{document.counts.roots}</td>
                <td className="n">{document.counts.occurrences}</td>
                <td className="n">{document.counts.wrong_identity}</td>
                <td className="n">{document.counts.wrong_pincite}</td>
                <td className="n">{document.counts.undetermined}</td>
                <td className="n">{document.counts.unread_names}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
