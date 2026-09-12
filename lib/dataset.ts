// The shape the dataset viewer reads. It is produced by scripts/build-bundle.mjs
// from the annotation store, and every span in it indexes a text carried in the
// same file, so nothing here has to be resolved at read time.

export type Span = { text?: string; start: number; end: number; ambiguous?: boolean };

export type Identifier = {
  kind: string;
  volume?: string;
  reporter?: string;
  reporter_as_written?: string;
  page?: string;
  docket_number?: string;
  court?: string;
  court_name?: string;
  court_text?: string;
};

export type CaseName = { plaintiff: string | null; defendant: string | null };

export type Evidence = {
  shows: string | null;
  source: { kind: string; id?: string; external_url?: string | null; label?: string };
  quote: string | null;
  proposition: string | null;
  span: Span | null;
  locatable: boolean;
  outside_store?: boolean;
  span_from?: "store" | "match";
  note?: string | null;
};

export type Annotation = {
  unit: "identity" | "pincite";
  id: string;
  root_id: string | null;
  occurrence_id: string | null;
  span: Span | null;
  matched_text: string | null;
  identifier: Identifier | null;
  case_name_as_written: CaseName | null;
  kind: string | null;
  role: string | null;
  scope: string | null;
  pin_cite: { text: string; span: Span } | null;
  records_at_locator: number | null;
  proposition: string | null;
  authority: { kind: string; ids: string[]; case_name?: string; date_filed?: string } | null;
  label: string | null;
  subclasses: string[];
  source: string | null;
  basis: string | null;
  note: string | null;
  evidence: Evidence[];
};

export type Root = {
  id: string;
  identifier: Identifier;
  case_name_as_written: CaseName;
  stated_at: { span: Span; matched_text: string };
  colocation_id: string | null;
  note: string | null;
};

export type Occurrence = {
  id: string;
  root_id: string;
  kind: string;
  role: string;
  span: Span;
  locator_span: Span;
  matched_text: string;
  pin_cite_written: { text: string; span: Span } | null;
  scope: string;
  basis: string | null;
  note: string | null;
  in_table_of_authorities: boolean | null;
};

export type UnreadName = {
  id: string;
  span: Span;
  text: string;
  signal: string;
  signal_span: Span;
  label: string;
  citation_as_written: string;
  note: string | null;
  context: { quote: string; span: Span | null; locatable: boolean } | null;
};

export type DatasetDocument = {
  id: string;
  stem: string;
  number: string;
  case_name: string;
  document_kind: string;
  text_id: string;
  sha256: string;
  length: number;
  rendering: { backend?: string; backend_version?: string; layout_rules?: string[] } | null;
  rulings: string[];
  roots: Root[];
  occurrences: Occurrence[];
  unread_names: UnreadName[];
  identity: Annotation[];
  pincite: Annotation[];
  counts: Record<string, number>;
};

export type Ruling = {
  ruling_id: string;
  court: string;
  case_name: string;
  case_number: string;
  description: string;
  courtlistener_url: string;
  filings: string[];
  text_id: string;
  sha256: string;
  length: number;
};

export type Bundle = {
  schema: string;
  built: string;
  store: Record<string, string | number | null>;
  totals: {
    roots: number;
    occurrences: number;
    unread_names: number;
    identity_labels: Record<string, number>;
    pincite_labels: Record<string, number>;
    identity_sources: Record<string, number>;
    pincite_sources: Record<string, number>;
    basis: Record<string, number>;
    evidence: Record<string, number>;
  };
  texts: Record<string, string>;
  documents: DatasetDocument[];
  rulings: Ruling[];
};

export const BUNDLE_SCHEMA = "mellea-lrc/dataset-viewer-bundle/v1";

export function parseBundle(value: unknown): Bundle {
  if (!value || typeof value !== "object") throw new Error("That file is not JSON this viewer reads.");
  const bundle = value as Bundle;
  if (bundle.schema !== BUNDLE_SCHEMA)
    throw new Error(
      `Expected a ${BUNDLE_SCHEMA} bundle. Rebuild it with \`npm run bundle\` against the current store.`
    );
  return bundle;
}

/* ---------- text with marks ------------------------------------------------- */

export type Mark = { start: number; end: number; className: string; key: string; title?: string };
export type Segment = { text: string; mark: Mark | null };

// Marks arrive in priority order; one that overlaps an accepted mark is dropped
// rather than nested, so the rendered text stays a flat list of segments and the
// offsets stay the document's own.
export function segment(text: string, marks: Mark[]): Segment[] {
  const taken: Mark[] = [];
  for (const mark of marks) {
    if (mark.start < 0 || mark.end > text.length || mark.end <= mark.start) continue;
    if (taken.some((other) => mark.start < other.end && other.start < mark.end)) continue;
    taken.push(mark);
  }
  taken.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let at = 0;
  for (const mark of taken) {
    if (mark.start > at) segments.push({ text: text.slice(at, mark.start), mark: null });
    segments.push({ text: text.slice(mark.start, mark.end), mark });
    at = mark.end;
  }
  if (at < text.length) segments.push({ text: text.slice(at), mark: null });
  return segments;
}

export const labelClass = (label: string | null | undefined) =>
  label ? label.toLowerCase().replace(/_/g, "-") : "none";

export const caseNameOf = (name: CaseName | null | undefined) => {
  if (!name) return null;
  const parts = [name.plaintiff, name.defendant].filter(Boolean);
  return parts.length ? parts.join(" v. ") : null;
};

export const identifierOf = (identifier: Identifier | null | undefined) => {
  if (!identifier) return "—";
  if (identifier.kind === "docket")
    return [identifier.docket_number, identifier.court_text ?? identifier.court]
      .filter(Boolean)
      .join(" · ");
  return [identifier.volume, identifier.reporter_as_written ?? identifier.reporter, identifier.page]
    .filter(Boolean)
    .join(" ");
};

export const titleOf = (document: DatasetDocument) =>
  `${document.number} · ${document.case_name}`;
