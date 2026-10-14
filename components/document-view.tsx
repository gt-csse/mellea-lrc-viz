"use client";

import { useEffect, useMemo, useRef } from "react";
import { getField, type CitationView, type DocumentView, type Span } from "../lib/document";
import { RawDialog, humanize } from "./primitives";

type Mark = { span: Span; id: string; field: string; selected: boolean };

/** Split at every boundary; overlapping locators are never discarded. Offsets are Python code points. */
function sourceSegments(text: string, marks: Mark[]) {
  const characters = Array.from(text);
  const valid = marks.filter(mark => mark.span.start >= 0 && mark.span.end <= characters.length && mark.span.start < mark.span.end);
  const starts = new Map<number, Mark[]>(), ends = new Map<number, Mark[]>();
  for (const mark of valid) {
    starts.set(mark.span.start, [...(starts.get(mark.span.start) ?? []), mark]);
    ends.set(mark.span.end, [...(ends.get(mark.span.end) ?? []), mark]);
  }
  const points = [...new Set([0, characters.length, ...starts.keys(), ...ends.keys()])].sort((a, b) => a - b);
  let active: Mark[] = [];
  return points.slice(0, -1).map((start, i) => {
    for (const mark of ends.get(start) ?? []) active = active.filter(item => item !== mark);
    active.push(...(starts.get(start) ?? []));
    const sorted = [...active].sort((a, b) => Number(b.selected) - Number(a.selected));
    return { start, text: characters.slice(start, points[i + 1]).join(""), marks: sorted };
  });
}

export function DocumentViewPanel({ document, citation, onSelect }: { document: DocumentView; citation: CitationView | null; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const marks = useMemo(() => {
    const result: Mark[] = document.citations.filter(item => item.siteSpan !== null).map(item => ({ span: item.siteSpan!, id: item.id, field: "locator", selected: item.id === citation?.id }));
    if (citation) for (const field of ["case_name", "pin_cite", "court", "date", "docket_entry"]) {
      const reading = getField(citation, field);
      if (reading?.span && typeof reading.span === "object" && !Array.isArray(reading.span)) {
        const { start, end } = reading.span;
        if (typeof start === "number" && typeof end === "number") result.push({ span: { start, end }, id: citation.id, field, selected: true });
      }
    }
    return result;
  }, [document, citation]);
  const segments = useMemo(() => sourceSegments(document.text, marks), [document.text, marks]);
  useEffect(() => {
    if (!citation) return;
    const scroller = ref.current;
    if (!scroller) return;
    const selector = `[data-source-id="${CSS.escape(citation.id)}"]`;
    const mark = scroller.querySelector<HTMLElement>(`${selector}[data-source-field="locator"]`) ?? scroller.querySelector<HTMLElement>(selector);
    if (!mark) return;
    const bounds = mark.getBoundingClientRect();
    scroller.scrollTo({ top: scroller.scrollTop + bounds.top - scroller.getBoundingClientRect().top - scroller.clientHeight / 2 + bounds.height / 2, behavior: "instant" });
  }, [citation?.id, document]);
  return <section className="source-view">
    <header className="source-toolbar"><div><h2>Source document</h2><p>The original text, with citation occurrences in place.</p></div><div className="source-legend"><span><i className="legend-mark" />Citation</span><span><i className="legend-mark selected" />Selected occurrence</span><RawDialog title="Document and complete history" value={document.raw} triggerLabel="Document JSON" /></div></header>
    <div className="filing-scroll" ref={ref} tabIndex={0} aria-label="Filing text">
      {!document.text ? <p className="empty-state">This Document contains no source text.</p> : <article className="filing-paper"><div className="paper-running-head"><span>SOURCE RECORD</span><span>{document.sourceMetadata && typeof document.sourceMetadata.source_name === "string" ? document.sourceMetadata.source_name : "Citation review"}</span></div><div className="filing-text">{segments.map(segment => {
        if (!segment.marks.length) return <span key={segment.start}>{segment.text}</span>;
        const mark = segment.marks[0];
        return <button key={segment.start} type="button" className={`source-mark ${mark.selected ? "selected" : ""} source-mark--${mark.field}`} data-source-id={mark.id} data-source-field={mark.field} aria-label={`${humanize(mark.field)}: ${segment.text}. ${segment.marks.length > 1 ? `${segment.marks.length} overlapping readings.` : ""}`} title={`${mark.id} · ${humanize(mark.field)}`} onClick={() => onSelect(mark.id)}>{segment.text}</button>;
      })}</div></article>}
    </div>
    <footer className="source-footer"><span>Offsets and quotations follow the saved source text.</span>{citation?.siteSpan && <span>Selected source span {citation.siteSpan.start.toLocaleString()}–{citation.siteSpan.end.toLocaleString()}</span>}</footer>
  </section>;
}
