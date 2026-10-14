/** Lossless projections of the current native mellea_lrc.model.Document JSON. */
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
export interface Span { start: number; end: number }

export interface NodeView {
  raw: JsonObject;
  id: string;
  substage: string;
  index: number;
  /** Citation-level records written by this node; native Nodes own no records. */
  additions: Record<string, JsonValue>;
}

export interface CitationView {
  raw: JsonObject;
  /** The original checkpoint, also retained when raw is a node snapshot. */
  sourceRaw: JsonObject;
  id: string;
  kind: string;
  nodes: NodeView[];
  siteSpan: Span | null;
}

export interface CheckpointRun { kind: "stage" | "substage"; name: string }

export interface DocumentView {
  raw: JsonObject;
  sourceRaw: JsonObject;
  text: string;
  citations: CitationView[];
  runs: CheckpointRun[];
  stageRuns: string[];
  substageRuns: string[];
  siteReviews: JsonObject[];
  indexSpans: Span[];
  sourceMetadata: JsonObject | null;
  preprocessingMetadata: JsonObject | null;
  warnings: string[];
}

export interface CitationGroup { root: CitationView; leaves: CitationView[] }
export interface CitationGroups {
  roots: CitationGroup[];
  unassigned: CitationView[];
  withdrawn: CitationView[];
  /** Unknown or dangling root assignments remain available in navigation. */
  unknown: CitationView[];
}

export const WITHDRAWN_ROOT_ID = "__withdrawn__";
const nativeKinds = new Set(["reporter", "docket", "short_reporter", "id", "supra", "reference"]);
const siteFields: Record<string, string> = {
  reporter: "locator", docket: "locator", short_reporter: "short_locator",
  id: "id_reference", supra: "supra_reference", reference: "reference_name",
};

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Check JSON suitability without rewriting, normalizing, or stripping keys. */
function assertJson(value: unknown, path = "document", seen = new Set<object>()): asserts value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || value === null) throw new Error(`${path} must contain JSON values.`);
  if (seen.has(value)) throw new Error(`${path} contains a circular reference.`);
  seen.add(value);
  for (const [key, item] of Object.entries(value)) assertJson(item, `${path}.${key}`, seen);
  seen.delete(value);
}

export function readSpan(value: unknown): Span | null {
  if (!isJsonObject(value)) return null;
  const { start, end } = value;
  return typeof start === "number" && typeof end === "number" &&
    Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end >= start
    ? { start, end } : null;
}

/** Python native Span offsets count Unicode code points, not UTF-16 units. */
export function toUtf16Offset(text: string, codePointOffset: number): number {
  const target = Math.max(0, Math.trunc(codePointOffset));
  let index = 0;
  let count = 0;
  while (index < text.length && count < target) {
    const code = text.codePointAt(index)!;
    index += code > 0xffff ? 2 : 1;
    count++;
  }
  return index;
}

export function sliceCodePoints(text: string, start: number, end?: number): string {
  return text.slice(toUtf16Offset(text, start), end === undefined ? undefined : toUtf16Offset(text, end));
}

export function sliceSpan(text: string, span: Span): string {
  return sliceCodePoints(text, span.start, span.end);
}

/** All records at any future/unknown field remain discoverable by ownership. */
export interface RecordView { path: string; nodeId: string; raw: JsonObject }
export function discoverRecords(value: JsonValue, path = ""): RecordView[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => discoverRecords(item, `${path}[${index}]`));
  if (!isJsonObject(value)) return [];
  if (typeof value.node_id === "string") return [{ path, nodeId: value.node_id, raw: value }];
  return Object.entries(value).flatMap(([key, item]) => discoverRecords(item, path ? `${path}.${key}` : key));
}

const absent = Symbol("absent");
type Selected = JsonValue | typeof absent;

/** Stop at an owning record so arbitrary provider payload is kept intact. */
function selectRecords(value: JsonValue, nodeId: string): Selected {
  if (Array.isArray(value)) {
    const selected = value.map((item) => selectRecords(item, nodeId)).filter((item): item is JsonValue => item !== absent);
    return selected.length ? selected : absent;
  }
  if (!isJsonObject(value)) return absent;
  if (typeof value.node_id === "string") return value.node_id === nodeId ? value : absent;
  const selected = Object.entries(value).map(([key, item]) => [key, selectRecords(item, nodeId)] as const)
    .filter((entry): entry is readonly [string, JsonValue] => entry[1] !== absent);
  return selected.length ? Object.fromEntries(selected) as JsonObject : absent;
}

function projectCitation(raw: JsonObject, sourceRaw = raw): CitationView {
  if (typeof raw.id !== "string" || !raw.id) throw new Error("Each native citation needs a nonempty id.");
  if (typeof raw.kind !== "string" || !raw.kind) throw new Error(`Citation ${raw.id} needs a kind.`);
  if (!Array.isArray(raw.nodes)) throw new Error(`Citation ${raw.id} needs a nodes array.`);
  const nodes = raw.nodes.map((item, index): NodeView => {
    if (!isJsonObject(item) || typeof item.id !== "string" || !item.id || typeof item.substage !== "string" || !item.substage) {
      throw new Error(`Citation ${raw.id} has an invalid node at index ${index}.`);
    }
    const additions: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key === "nodes" || key === "id" || key === "kind") continue;
      const selected = selectRecords(value, item.id);
      if (selected !== absent) additions[key] = selected;
    }
    return { raw: item, id: item.id, substage: item.substage, index, additions };
  });
  const citation: CitationView = { raw, sourceRaw, id: raw.id, kind: raw.kind, nodes, siteSpan: null };
  const siteField = siteFields[citation.kind];
  citation.siteSpan = siteField ? readSpan(getField(citation, siteField)?.span) : null;
  // An unfamiliar native kind still gets its explicitly saved source span.
  if (!siteField) {
    citation.siteSpan = readSpan(raw.site_span) ?? ["locator", "short_locator", "id_reference", "supra_reference", "reference_name"]
      .map((key) => readSpan(getField(citation, key)?.span)).find((span) => span !== null) ?? discoverRecords(raw)
      .map((record) => readSpan(record.raw.span)).find((span) => span !== null) ?? null;
  }
  return citation;
}

function projectDocument(raw: JsonObject, sourceRaw = raw): DocumentView {
  if (typeof raw.text !== "string") throw new Error("Native Document JSON needs a text string.");
  if (!Array.isArray(raw.citations)) throw new Error("Native Document JSON needs a citations array.");
  if (raw.stage_runs !== undefined) throw new Error("Obsolete stage_runs format. Open a current native Document with runs.");
  if (!Array.isArray(raw.runs)) throw new Error("Native Document JSON needs a runs array.");
  const runs = raw.runs.map((run, index): CheckpointRun => {
    if (!isJsonObject(run) || (run.kind !== "stage" && run.kind !== "substage") || typeof run.name !== "string" || !run.name) {
      throw new Error(`Native Document has an invalid checkpoint event at index ${index}.`);
    }
    return { kind: run.kind, name: run.name };
  });
  if (new Set(runs.map(run => `${run.kind}:${run.name}`)).size !== runs.length) throw new Error("Duplicate native checkpoint event.");
  if (!Array.isArray(raw.site_reviews)) throw new Error("Native Document JSON needs a site_reviews array.");
  const siteReviews = raw.site_reviews.map((review, index) => {
    if (!isJsonObject(review) || typeof review.substage !== "string" || !review.substage) throw new Error(`Invalid site review at index ${index}.`);
    return review;
  });
  const citations = raw.citations.map((item, index) => {
    if (!isJsonObject(item)) throw new Error(`Citation at index ${index} must be an object.`);
    const original = Array.isArray(sourceRaw.citations)
      ? sourceRaw.citations.find((candidate) => isJsonObject(candidate) && candidate.id === item.id) : undefined;
    return projectCitation(item, isJsonObject(original) ? original : item);
  });
  const warnings: string[] = [];
  const ids = new Set<string>();
  for (const citation of citations) {
    if (ids.has(citation.id)) warnings.push(`Duplicate citation id: ${citation.id}.`);
    ids.add(citation.id);
  }
  for (const citation of citations) {
    if (!nativeKinds.has(citation.kind)) warnings.push(`Unknown citation kind retained: ${citation.kind} (${citation.id}).`);
    const nodeIds = new Set(citation.nodes.map((node) => node.id));
    if (nodeIds.size !== citation.nodes.length) warnings.push(`Duplicate node id in ${citation.id}.`);
    for (const record of discoverRecords(citation.raw)) {
      if (!nodeIds.has(record.nodeId)) warnings.push(`Record ${citation.id}.${record.path} refers to missing node ${record.nodeId}.`);
    }
    const rootId = getRootId(citation);
    if (rootId !== null && rootId !== WITHDRAWN_ROOT_ID && !ids.has(rootId)) {
      warnings.push(`Citation ${citation.id} refers to missing root ${rootId}.`);
    }
  }
  return {
    raw, sourceRaw, text: raw.text, citations,
    runs, stageRuns: runs.filter(run => run.kind === "stage").map(run => run.name),
    substageRuns: runs.filter(run => run.kind === "substage").map(run => run.name),
    siteReviews,
    indexSpans: Array.isArray(raw.index_spans) ? raw.index_spans.map(readSpan).filter((span): span is Span => span !== null) : [],
    sourceMetadata: isJsonObject(raw.source_metadata) ? raw.source_metadata : null,
    preprocessingMetadata: isJsonObject(raw.preprocessing_metadata) ? raw.preprocessing_metadata : null,
    warnings,
  };
}

export function parseDocument(input: unknown): DocumentView {
  let parsed: unknown = input;
  if (typeof input === "string") {
    try { parsed = JSON.parse(input); }
    catch { throw new Error("The uploaded file is not valid JSON."); }
  }
  assertJson(parsed);
  if (!isJsonObject(parsed)) throw new Error("Native Document JSON must be an object.");
  return projectDocument(parsed);
}

export function getLatestRecord(citation: CitationView, key: string): JsonObject | null {
  const value = citation.raw[key];
  if (Array.isArray(value)) {
    const last = value[value.length - 1];
    return isJsonObject(last) ? last : null;
  }
  return isJsonObject(value) ? value : null;
}

export function getField(citation: CitationView, key: string): JsonObject | null {
  return getLatestRecord(citation, key);
}

export function getRootId(citation: CitationView): string | null {
  const value = getLatestRecord(citation, "root_id")?.value;
  return typeof value === "string" ? value : null;
}

export function getRootCitation(document: DocumentView, citation: CitationView): CitationView | null {
  const rootId = getRootId(citation);
  if (rootId === null || rootId === WITHDRAWN_ROOT_ID) return null;
  return document.citations.find((item) => item.id === rootId) ?? null;
}

export function groupCitations(document: DocumentView): CitationGroups {
  const roots: CitationGroup[] = document.citations.filter((citation) => getRootId(citation) === citation.id)
    .map((root) => ({ root, leaves: [] }));
  const byId = new Map(roots.map((group) => [group.root.id, group]));
  const result: CitationGroups = { roots, unassigned: [], withdrawn: [], unknown: [] };
  for (const citation of document.citations) {
    const rootId = getRootId(citation);
    if (rootId === citation.id) continue;
    if (rootId === null) result.unassigned.push(citation);
    else if (rootId === WITHDRAWN_ROOT_ID) result.withdrawn.push(citation);
    else if (byId.has(rootId)) byId.get(rootId)!.leaves.push(citation);
    else result.unknown.push(citation);
  }
  return result;
}

/** Filter by citation node order, never by stage number or lexicographic name. */
function retainRecords(value: JsonValue, nodeIds: Set<string>): Selected {
  if (Array.isArray(value)) return value.map((item) => retainRecords(item, nodeIds))
    .filter((item): item is JsonValue => item !== absent);
  if (!isJsonObject(value)) return value;
  if (typeof value.node_id === "string") return nodeIds.has(value.node_id) ? value : absent;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const retained = retainRecords(item, nodeIds);
    return [key, retained === absent ? null : retained];
  })) as JsonObject;
}

export function getCitationAtNode(citation: CitationView, nodeId: string): CitationView {
  const cutoff = citation.nodes.findIndex((node) => node.id === nodeId);
  if (cutoff < 0) throw new Error(`Citation ${citation.id} has no node ${nodeId}.`);
  const nodes = citation.nodes.slice(0, cutoff + 1);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const raw: JsonObject = { ...citation.raw, nodes: nodes.map((node) => node.raw) };
  for (const [key, value] of Object.entries(raw)) {
    if (key === "id" || key === "kind" || key === "nodes") continue;
    const retained = retainRecords(value, nodeIds);
    raw[key] = retained === absent || (key === "pin_cite" && Array.isArray(retained) && !retained.length) ? null : retained;
  }
  return projectCitation(raw, citation.sourceRaw);
}

/** The same event prefix and citation-local cutoff as native Document recovery. */
function getDocumentAtCheckpoint(document: DocumentView, kind: CheckpointRun["kind"], name: string): DocumentView {
  const cutoff = document.runs.findIndex(run => run.kind === kind && run.name === name);
  if (cutoff < 0) throw new Error(`${kind === "stage" ? "Stage" : "Substage"} has not run: ${name}.`);
  const runs = (document.raw.runs as JsonObject[]).slice(0, cutoff + 1);
  const included = new Set(runs.filter(run => run.kind === "substage").map(run => run.name));
  const citations = document.citations.flatMap((citation) => {
    let count = 0;
    while (count < citation.nodes.length && included.has(citation.nodes[count].substage)) count++;
    return count ? [getCitationAtNode(citation, citation.nodes[count - 1].id)] : [];
  }).sort((left, right) => (left.siteSpan?.start ?? Infinity) - (right.siteSpan?.start ?? Infinity) ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)).map((citation) => citation.raw);
  const raw: JsonObject = {
    ...document.raw, citations, runs,
    site_reviews: document.siteReviews.filter(review => included.has(review.substage)),
  };
  return projectDocument(raw, document.sourceRaw);
}

export function getDocumentAtStage(document: DocumentView, stage: string): DocumentView {
  return getDocumentAtCheckpoint(document, "stage", stage);
}

export function getDocumentAtSubstage(document: DocumentView, substage: string): DocumentView {
  return getDocumentAtCheckpoint(document, "substage", substage);
}

export function isToa(citation: CitationView): boolean {
  return Array.isArray(citation.raw.tags) && citation.raw.tags.some(tag => isJsonObject(tag) && tag.kind === "table_of_authorities");
}

/** A concise operation label; its full workflow path remains available beside it. */
export function checkpointLabel(name: string): string {
  return name.split(".").at(-1)!.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

export function getIdentityJudgment(citation: CitationView): JsonObject | null {
  return getLatestRecord(citation, "identity_judgments");
}

/** Latest recorded per-field comparison, with owning node retained for provenance. */
export function getFieldVerdict(citation: CitationView, key: string): JsonObject | null {
  const candidates: JsonObject[] = [];
  const direct = citation.raw[`${key}_judgments`];
  if (Array.isArray(direct)) candidates.push(...direct.filter(isJsonObject));
  for (const recordKey of ["reporter_unique_review", "reporter_ambiguous_review", "docket_lookup_review", "govinfo_docket_review"]) {
    const review = getLatestRecord(citation, recordKey);
    const decision = review?.decision;
    const assessment = isJsonObject(decision) ? decision[key] : null;
    if (review && isJsonObject(assessment)) candidates.push({ ...assessment, node_id: review.node_id, record_key: recordKey });
  }
  const positions = new Map(citation.nodes.map((node) => [node.id, node.index]));
  candidates.sort((left, right) => (positions.get(String(left.node_id)) ?? -1) - (positions.get(String(right.node_id)) ?? -1));
  return candidates[candidates.length - 1] ?? null;
}

export function caseNameLabel(value: JsonValue | undefined): string | null {
  if (!isJsonObject(value)) return null;
  if (value.kind === "adversarial" && typeof value.plaintiff === "string" && typeof value.defendant === "string") return `${value.plaintiff} v. ${value.defendant}`;
  if (value.kind === "in_re" && typeof value.subject === "string") return `In re ${value.subject}`;
  if (value.kind === "ex_parte" && typeof value.subject === "string") return `Ex parte ${value.subject}`;
  if (value.kind === "partial" && typeof value.partial === "string") return value.partial;
  if (value.kind === "not_stated") return "Not stated";
  return null;
}

export function locatorLabel(citation: CitationView): string {
  const key = siteFields[citation.kind];
  const field = key ? getField(citation, key) : null;
  if (typeof field?.quote === "string") return field.quote;
  if (field?.normalized !== undefined && field.normalized !== null) return displayValue(field.normalized);
  return citation.id;
}

export function citationLabel(citation: CitationView): string {
  const field = getField(citation, "case_name") ?? getField(citation, "reference_name");
  if (field?.normalizable === true) {
    if (isJsonObject(field.normalized) && field.normalized.kind === "not_stated") return locatorLabel(citation);
    const normalizedName = caseNameLabel(field.normalized);
    if (normalizedName !== null) return normalizedName;
  }
  if (typeof field?.quote === "string") return field.quote;
  return locatorLabel(citation);
}

export function displayValue(value: JsonValue | undefined): string {
  if (value === undefined) return "Not recorded";
  if (value === null) return "None";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const caseName = caseNameLabel(value);
  return caseName ?? JSON.stringify(value, null, 2);
}
