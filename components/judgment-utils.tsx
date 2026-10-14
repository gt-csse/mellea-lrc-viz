import type { JsonValue, Span } from "../lib/document";
import { readSpan, sliceSpan } from "../lib/document";
export { at, formatValue, index, label, nodeLabel, nodePosition, object, objects, recordUrl, safeUrl, string, targets } from "./judgment-values";

export function SourceLink({ url, children = "Open source" }: { url: string | null; children?: React.ReactNode }) {
  return url ? <a className="source-link" href={url} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span></a> : null;
}

export function GroundedQuote({ quote, source, span: spanValue, contextLabel = "Show source context" }: {
  quote: string;
  source?: string | null;
  span?: JsonValue | Span | null;
  contextLabel?: string;
}) {
  const span = readSpan(spanValue);
  const points = source ? Array.from(source) : null;
  const matches = source && points && span && span.end <= points.length && sliceSpan(source, span) === quote;
  if (!matches || !points || !span) return <blockquote className="evidence-quote">{quote}</blockquote>;
  const start = Math.max(0, span.start - 180);
  const end = Math.min(points.length, span.end + 180);
  return <>
    <blockquote className="evidence-quote"><mark className="evidence-highlight">{quote}</mark></blockquote>
    <details className="evidence-context">
      <summary>{contextLabel}<span className="detail-note"> · source characters {span.start}–{span.end}</span></summary>
      <p>{start > 0 ? "…" : ""}{points.slice(start, span.start).join("")}<mark className="evidence-highlight">{points.slice(span.start, span.end).join("")}</mark>{points.slice(span.end, end).join("")}{end < points.length ? "…" : ""}</p>
    </details>
  </>;
}
