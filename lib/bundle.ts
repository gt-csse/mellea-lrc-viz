// One document, as `scripts/build-bundles.mjs` writes it: the text, the
// annotations about it, and the hash saying which text those spans index.

export const BUNDLE_SCHEMA = "mellea-lrc/document-bundle/v1";

export type Quotation = { start: number; end: number; quote: string };

export type Identifier = {
  kind: "reporter" | "docket" | string;
  volume?: string | null;
  reporter?: string;
  reporter_as_written?: string;
  page?: string;
  docket_number?: string;
  court?: string;
  court_name?: string;
  court_text?: string;
};

export type PinCite = Quotation & {
  normalized?: Array<{ first: number; last: number; kind: string }>;
};

export type Citation = {
  unit: "citation";
  id: string;
  is_root: boolean;
  root_id: string;
  kind: string;
  identifier?: Identifier;
  case_name?: Quotation;
  cited_as: Quotation;
  locator?: Quotation;
  pin_cite?: PinCite;
  colocation_id?: string;
  in_table_of_authorities?: boolean;
  note?: string;
};

export type NoncaseCitation = { unit: "noncase_citation"; id: string; cited_as: Quotation; note: string };

export type NonconformingCitation = {
  unit: "nonconforming_citation";
  id: string;
  named_as: Quotation;
  signal?: Quotation;
  context?: Quotation;
  note: string;
};

export type DocumentBundle = {
  schema: string;
  built: string;
  store: { commit: string | null; extraction: string };
  document: {
    id: string;
    stem: string;
    number: string;
    case_name: string;
    document_kind: string;
    sha256: string;
    length: number;
  };
  text: string;
  extraction: {
    dataset: string;
    citations: Citation[];
    noncase_citations: NoncaseCitation[];
    nonconforming_citations: NonconformingCitation[];
  };
};

export function parseBundle(value: unknown): DocumentBundle {
  if (!value || typeof value !== "object") throw new Error("That file is not JSON.");
  const bundle = value as DocumentBundle;
  if (bundle.schema !== BUNDLE_SCHEMA)
    throw new Error(`Expected a ${BUNDLE_SCHEMA} file. Build one with \`npm run bundle\`.`);
  if (bundle.text.length !== bundle.document.length)
    throw new Error("The bundle's text is not the length its header states.");
  return bundle;
}

/* ---------- text with marks ------------------------------------------------ */

export type Mark = { id: string; start: number; end: number; className: string };
export type Segment = { text: string; mark: Mark | null };

// Marks arrive in priority order; one overlapping a mark already taken is
// dropped rather than nested, so the rendered text stays a flat list and the
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

export function identifierOf(identifier: Identifier | undefined) {
  if (!identifier) return null;
  if (identifier.kind === "docket")
    return [identifier.docket_number, identifier.court_text ?? identifier.court].filter(Boolean).join(" · ");
  return [identifier.volume, identifier.reporter_as_written ?? identifier.reporter, identifier.page]
    .filter(Boolean)
    .join(" ");
}

export function pinCiteOf(pin: PinCite | undefined) {
  if (!pin) return null;
  const pages = (pin.normalized ?? [])
    .map((part) => (part.first === part.last ? `${part.first}` : `${part.first}–${part.last}`))
    .join(", ");
  return pages && pages !== pin.quote ? `${pin.quote}  →  ${pages}` : pin.quote;
}
