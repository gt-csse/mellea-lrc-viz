"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CitationView,
  checkpointLabel,
  DocumentView,
  JsonObject,
  JsonValue,
  NodeView,
  discoverRecords,
  getCitationAtNode,
  getField,
  getLatestRecord,
  readSpan,
  sliceSpan,
} from "../lib/document";
import { RawDialog, StatusBadge } from "./primitives";
import { formatValue } from "./judgment-values";

const FIELD_LABELS: Record<string, string> = {
  case_name: "Case name",
  locator: "Full locator",
  short_locator: "Short reporter locator",
  reference_name: "Reference name",
  id_reference: "Id. reference",
  supra_reference: "Supra reference",
  pin_cite: "Pinpoint",
  docket_entry: "Docket entry",
  court: "Court",
  date: "Date",
};

const RECORD_LABELS: Record<string, string> = {
  ...FIELD_LABELS,
  tags: "Source component tags",
  root_id: "Root assignment",
  routes: "Next substage",
  colocation_id: "Colocation assignment",
  attributions: "Attribution",
  reviews: "Attribution review",
  case_name_judgments: "Case name comparison",
  court_judgments: "Court comparison",
  date_judgments: "Date comparison",
  identity_judgments: "Identity judgment",
  body_searches: "Body search",
  body_reviews: "Body review",
  field_body_searches: "Field evidence search",
  intended_case_reviews: "Intended case review",
  docket_root_reviews: "Docket root review",
  docket_lookup: "Docket lookup",
  docket_lookup_review: "Docket lookup review",
  govinfo_docket_lookup: "GovInfo lookup",
  govinfo_docket_review: "GovInfo review",
  reporter_exact_lookup: "Reporter lookup",
  reporter_exact_docket: "Reporter docket",
  reporter_exact_candidate_dockets: "Candidate docket",
  reporter_exact_ambiguity_resolution: "Candidate resolution",
  reporter_unique_review: "Reporter review",
  reporter_ambiguous_review: "Reporter candidate review",
  reporter_root_opinion_source: "Opinion source",
  reporter_root_opinion_retrieval: "Opinion retrieval",
  reporter_root_opinion_page_index: "Opinion page index",
  reporter_page_resolutions: "Reporter page resolution",
  reporter_opinion_reviews: "Opinion page review",
  reporter_propositions: "Proposition",
  reporter_pinpoint_evidence: "Pinpoint evidence",
  reporter_opinion_evidence: "Opinion evidence",
  reporter_support_reviews: "Citation content review",
  reporter_pinpoint_judgments: "Citation content judgment",
};

const SOURCE_PRIORITY = [
  "locator",
  "short_locator",
  "reference_name",
  "id_reference",
  "supra_reference",
  "case_name",
  "pin_cite",
  "docket_entry",
  "court",
  "date",
];

const RELATIONSHIP_KEYS = new Set(["root_id", "routes", "colocation_id"]);
const PAYLOAD_KEYS = new Set([
  "response",
  "request",
  "metadata",
  "model_options",
  "output_schema",
  "grounding_context",
  "user_variables",
  "discovery_pages",
  "body",
  "text",
  "content",
  "raw_result",
  "raw_json",
  "pages",
]);

type ModelRun = { success: boolean; attempts: JsonValue[] };

export function NodesView({ citation, document }: { citation: CitationView; document: DocumentView }) {
  const history = useRef<HTMLElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<{ source: JsonObject; nodeId: string } | null>(null);
  const selectedId = selection?.source === citation.sourceRaw ? selection.nodeId : null;
  const selectedNode = citation.nodes.find((node) => node.id === selectedId) ?? citation.nodes.at(-1);
  const snapshot = useMemo(
    () => selectedNode ? getCitationAtNode(citation, selectedNode.id) : citation,
    [citation, selectedNode],
  );
  const previousNode = selectedNode ? citation.nodes[selectedNode.index - 1] : undefined;
  const previousSnapshot = useMemo(
    () => previousNode ? getCitationAtNode(citation, previousNode.id) : null,
    [citation, previousNode],
  );
  useEffect(() => {
    inspector.current?.scrollTo({ top: 0 });
    inspector.current?.closest<HTMLElement>(".review-content")?.scrollTo({ top: 0 });
    const navigation = history.current;
    const active = navigation?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!navigation || !active) return;
    const bounds = active.getBoundingClientRect();
    const area = navigation.getBoundingClientRect();
    if (bounds.top < area.top || bounds.bottom > area.bottom) {
      navigation.scrollTop += bounds.top - area.top - navigation.clientHeight / 2 + bounds.height / 2;
    }
    const timeline = navigation.querySelector<HTMLElement>(".node-timeline");
    if (timeline && timeline.scrollWidth > timeline.clientWidth) {
      timeline.scrollLeft += bounds.left - timeline.getBoundingClientRect().left;
    }
  }, [selectedNode?.id, citation.sourceRaw]);

  if (!selectedNode) {
    return <section className="node-empty panel"><h2>Citation history</h2><p>No decision nodes are recorded for this citation.</p></section>;
  }

  const changes = discoverRecords(selectedNode.additions).map(({ path, raw }) => ({
    name: path.split(".")[0].split("[")[0], path, record: raw,
  }));
  const isCurrent = selectedNode.id === citation.nodes.at(-1)?.id;

  return (
    <section className="nodes-view" aria-label="Citation decision history">
      <aside ref={history} className="node-history-panel panel" aria-labelledby="node-history-heading">
        <div className="panel-heading">
          <div><p className="eyebrow">Citation history</p><h2 id="node-history-heading">Decision history</h2></div>
          <span>{citation.nodes.length}</span>
        </div>
        <p className="node-history-intro">Select a substage to inspect its citation snapshot and additions.</p>
        <ol className="node-timeline">
          {citation.nodes.map((node, index) => {
            const selected = node.id === selectedNode.id;
            const count = recordCount(node.additions);
            const runs = modelRuns(node.additions);
            const repairs = repairCount(runs);
            return (
              <li className={`node-step${selected ? " selected" : ""}`} key={node.id}>
                <button
                  type="button"
                  className={`node-step-button${selected ? " selected" : ""}`}
                  aria-pressed={selected}
                  aria-current={selected ? "step" : undefined}
                  aria-label={`Substage ${index + 1}: ${checkpointLabel(node.substage)}`}
                  onClick={() => setSelection({ source: citation.sourceRaw, nodeId: node.id })}
                >
                  <span className="node-step-number" aria-hidden="true">{index + 1}</span>
                  <span className="node-step-copy">
                    <strong>{checkpointLabel(node.substage)}</strong>
                    <span>{count} {count === 1 ? "record" : "records"} added{repairs ? ` · ${repairs} ${repairs === 1 ? "repair" : "repairs"}` : ""}</span>
                    {index === citation.nodes.length - 1 ? <small>Current snapshot</small> : null}
                  </span>
                </button>
                {index < citation.nodes.length - 1 ? <span className="node-connector" aria-hidden="true">↓</span> : null}
              </li>
            );
          })}
        </ol>
      </aside>

      <article ref={inspector} tabIndex={0} className="node-inspector panel" aria-labelledby="node-inspector-heading">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Substage {selectedNode.index + 1} of {citation.nodes.length}{isCurrent ? " · Current snapshot" : ""}</p>
            <h2 id="node-inspector-heading">{checkpointLabel(selectedNode.substage)}</h2>
            <p className="node-stage-id"><code>{selectedNode.substage}</code></p>
          </div>
          <RawDialog
            title={`${checkpointLabel(selectedNode.substage)} — ${selectedNode.id}`}
            triggerLabel="View raw node records"
            value={{ node: selectedNode.raw, records: selectedNode.additions }}
          />
        </header>

        <NodeMetrics node={selectedNode} />

        <section className="node-section" aria-labelledby="node-source-heading">
          <h3 id="node-source-heading">Source at this substage</h3>
          <SourceSnapshot citation={snapshot} document={document} />
        </section>

        <section className="node-section" aria-labelledby="node-fields-heading">
          <h3 id="node-fields-heading">Extraction snapshot</h3>
          <p className="node-section-note">Latest field readings through this substage.</p>
          <SnapshotFields citation={snapshot} />
          <SnapshotRelationships citation={snapshot} />
        </section>

        <section className="node-section" aria-labelledby="node-changes-heading">
          <div className="node-changes-title"><h3 id="node-changes-heading">Added at this substage</h3><span>{changes.length} {changes.length === 1 ? "record" : "records"}</span></div>
          {changes.length ? (
            <div className="node-change-list">
              {changes.map(({ name, record, path }, index) => (
                <ChangeRecord
                  key={path}
                  name={name}
                  path={path}
                  record={record}
                  previous={previousSnapshot ? getLatestRecord(previousSnapshot, name) : null}
                  ordinal={changes.filter((change) => change.name === name).length > 1 ? changes.slice(0, index).filter((change) => change.name === name).length + 1 : null}
                />
              ))}
            </div>
          ) : <p className="node-empty">This node adds no citation records.</p>}
        </section>
      </article>
    </section>
  );
}

function SourceSnapshot({ citation, document }: { citation: CitationView; document: DocumentView }) {
  const sourceLength = useMemo(() => Array.from(document.text).length, [document.text]);
  const native = SOURCE_PRIORITY.flatMap((name) => {
    const field = getField(citation, name);
    return field && typeof field.quote === "string" && field.quote.length
      ? [{ name, quote: field.quote, span: readSpan(field.span) }]
      : [];
  })[0];
  if (!native) return <p className="node-empty">No exact source quote is recorded in this snapshot. Inferred readings are labelled below.</p>;

  const span = native.span;
  const valid = !!span && span.start >= 0 && span.end > span.start && span.end <= sourceLength;
  const matches = valid && sliceSpan(document.text, span) === native.quote;
  const start = span ? Math.max(0, span.start - 160) : 0;
  const end = span ? Math.min(sourceLength, span.end + 160) : 0;
  return (
    <div>
      <blockquote className="node-source-quote">{native.quote}</blockquote>
      <p className="node-field-note">Exact {FIELD_LABELS[native.name].toLowerCase()} quote{span ? ` · Source characters ${span.start}–${span.end} (end exclusive)` : ""}</p>
      {matches && span ? (
        <details className="node-source-context">
          <summary>Surrounding source context</summary>
          <p className="node-context-text">
            {start > 0 ? "… " : ""}{sliceSpan(document.text, { start, end: span.start })}
            <mark>{native.quote}</mark>
            {sliceSpan(document.text, { start: span.end, end })}{end < sourceLength ? " …" : ""}
          </p>
        </details>
      ) : span ? <p className="node-field-note">The stored quote does not match the document text at its recorded span.</p> : null}
    </div>
  );
}

function SnapshotFields({ citation }: { citation: CitationView }) {
  const names = Object.keys(FIELD_LABELS).filter((name) => Object.hasOwn(citation.raw, name));
  if (!names.length) return <p className="node-empty">No typed field histories are recorded.</p>;
  return (
    <div className="table-scroll">
      <table className="node-field-table fact-table">
        <thead><tr><th scope="col">Field</th><th scope="col">Source reading</th><th scope="col">Typed value</th></tr></thead>
        <tbody>
          {names.map((name) => {
            const field = getField(citation, name);
            return <tr key={name}>
              <th scope="row">{FIELD_LABELS[name]}</th>
              <td>
                {!field ? <span className="node-field-note">No reading yet</span> : typeof field.quote === "string" ? (
                  <div className="node-field-reading"><q>{field.quote}</q><FieldSpan field={field} /></div>
                ) : <span className="node-field-note">Inferred reading · no source quote</span>}
              </td>
              <td>{field ? <NormalizedReading field={field} /> : <span className="node-field-note">—</span>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotRelationships({ citation }: { citation: CitationView }) {
  const relationships = [
    { key: "root_id", label: "Root", absent: "No assignment yet", empty: "Unattached" },
    { key: "routes", label: "Next substage", absent: "No route recorded", empty: "No substage queued" },
    { key: "colocation_id", label: "Colocation", absent: "No assignment yet", empty: "None assigned" },
  ].filter(({ key }) => Object.hasOwn(citation.raw, key));
  return <dl className="node-relationships">
    {relationships.map(({ key, label, absent, empty }) => {
      const record = getLatestRecord(citation, key);
      const value = record?.value;
      return <div key={key}><dt>{label}</dt><dd>{!record ? absent : value === null ? empty : value === "__withdrawn__" ? "Withdrawn (__withdrawn__)" : <StructuredValue value={value ?? null} />}</dd></div>;
    })}
  </dl>;
}

function ChangeRecord({ name, path, record, previous, ordinal }: { name: string; path: string; record: JsonValue; previous: JsonObject | null; ordinal: number | null }) {
  const data = asObject(record);
  const isField = !!FIELD_LABELS[name] && !!data;
  const isRelationship = RELATIONSHIP_KEYS.has(name) && !!data;
  const outcome = data ? [data.outcome, data.verdict, data.result].find((value) => typeof value === "string") : undefined;
  const changedQuote = isField && previous && previous.quote !== data.quote;
  const changedValue = isField && previous && JSON.stringify(previous.normalized) !== JSON.stringify(data.normalized);
  const changedNormalization = isField && previous && (previous.normalizable !== data.normalizable || previous.normalization_error !== data.normalization_error);
  return (
    <article className="node-change">
      <div className="node-change-heading">
        <h4>{RECORD_LABELS[name] ?? humanize(name)}{ordinal ? ` ${ordinal}` : ""}</h4>
        {typeof outcome === "string" ? <StatusBadge value={outcome} /> : null}
      </div>
      {!RECORD_LABELS[name] ? <p className="node-field-note"><code>{path}</code></p> : null}
      {isField && data ? (
        <div className="node-change-value">
          <p className="node-field-note">{previous ? [changedQuote ? "Source quote changed" : "Source quote retained", changedValue ? "typed value changed" : "typed value retained", changedNormalization ? "normalization result changed" : null].filter(Boolean).join(" · ") : "First field reading"}</p>
          {typeof data.quote === "string" ? <q>{data.quote}</q> : <p className="node-field-note">Inferred reading · no source quote</p>}
          <FieldSpan field={data} />
          <NormalizedReading field={data} />
          {previous ? <details className="node-previous-reading"><summary>Previous reading</summary><div>{typeof previous.quote === "string" ? <q>{previous.quote}</q> : <p className="node-field-note">Inferred reading · no source quote</p>}<FieldSpan field={previous} /><NormalizedReading field={previous} /></div></details> : null}
        </div>
      ) : isRelationship && data ? (
        <dl className="node-change-value node-relationship-change">
          <div><dt>Before</dt><dd>{previous ? <RelationshipValue name={name} value={previous.value ?? null} /> : "No assignment recorded"}</dd></div>
          <div><dt>Added</dt><dd><RelationshipValue name={name} value={data.value ?? null} /></dd></div>
        </dl>
      ) : data ? <RecordFacts data={data} /> : <StructuredValue value={record} />}
      {data ? <ModelTraceSummary value={data} /> : null}
    </article>
  );
}

function RecordFacts({ data }: { data: JsonObject }) {
  const entries = Object.entries(data).filter(([key]) => key !== "node_id" && key !== "ivr");
  return <dl className="node-record-facts">
    {entries.map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd>{PAYLOAD_KEYS.has(key) && value && typeof value === "object" ? retainedPayload(value) : summarizeValue(value)}</dd></div>)}
  </dl>;
}

function NormalizedReading({ field }: { field: JsonObject }) {
  if (field.normalizable === false) return <div className="node-normalization-failure"><StatusBadge value="not normalizable" />{typeof field.normalization_error === "string" ? <p>{field.normalization_error}</p> : null}</div>;
  const value = field.normalized ?? null;
  if (value === null || typeof value !== "object") return <StructuredValue value={value} />;
  const summary = typedSummary(value);
  if (!summary) return <StructuredValue value={value} />;
  return <div className="node-typed-reading">
    <p className="node-typed-summary">{summary}</p>
    <details className="node-typed-details"><summary>Typed details</summary><StructuredValue value={value} /></details>
  </div>;
}

function typedSummary(value: JsonValue): string | null {
  const record = asObject(value);
  if (record?.keyword === "id" || record?.keyword === "ibid") return record.keyword === "id" ? "Id." : "Ibid.";
  if (record && Object.hasOwn(record, "antecedent") && Object.hasOwn(record, "volume")) {
    return [typeof record.antecedent === "string" ? record.antecedent : "Antecedent not stated", typeof record.volume === "number" ? `Volume ${record.volume}` : "Volume not stated"].join(" · ");
  }
  const formatted = formatValue(value);
  const trimmed = formatted.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[") ? null : formatted;
}

function FieldSpan({ field }: { field: JsonObject }) {
  const span = readSpan(field.span);
  const numberSpan = readSpan(field.number_span);
  const normalizer = typeof field.normalized_by === "string" ? field.normalized_by : null;
  if (!span && !numberSpan && !normalizer) return null;
  return <div className="node-field-note">
    {span ? <span className="node-field-span">Source characters {span.start}–{span.end}</span> : null}
    {numberSpan ? <span className="node-field-span">Docket number characters {numberSpan.start}–{numberSpan.end}</span> : null}
    {normalizer ? <span className="node-field-span">Normalized by {normalizer}</span> : null}
  </div>;
}

function RelationshipValue({ name, value }: { name: string; value: JsonValue }) {
  if (value === null) return <span>{name === "routes" ? "No substage queued" : name === "root_id" ? "Unattached" : "None assigned"} (null)</span>;
  if (name === "root_id" && value === "__withdrawn__") return <span>Withdrawn (__withdrawn__)</span>;
  return <StructuredValue value={value} />;
}

function StructuredValue({ value }: { value: JsonValue }) {
  if (value === null) return <span className="node-field-note">None</span>;
  if (typeof value !== "object") return <span>{typeof value === "boolean" ? String(value) : value}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="node-field-note">None recorded</span>;
    if (value.every((item) => item === null || typeof item !== "object")) return <span>{value.map((item) => item === null ? "null" : String(item)).join(", ")}</span>;
    return <ol className="node-typed-list">{value.map((item, index) => <li key={index}><StructuredValue value={item} /></li>)}</ol>;
  }
  const entries = Object.entries(value);
  if (!entries.length) return <span className="node-field-note">Empty object</span>;
  return <dl className="node-normalized-value">{entries.map(([key, child]) => <div key={key}><dt>{humanize(key)}</dt><dd><StructuredValue value={child} /></dd></div>)}</dl>;
}

function NodeMetrics({ node }: { node: NodeView }) {
  const runs = modelRuns(node.additions);
  const diagnostics = failureDiagnostics(node.additions);
  const attempts = runs.reduce((total, run) => total + run.attempts.length, 0);
  const repairs = repairCount(runs);
  const failedRuns = runs.filter((run) => !run.success).length;
  const failedChecks = runs.reduce((total, run) => total + run.attempts.reduce<number>((count, attempt) => {
    const requirements = asObject(attempt)?.requirements;
    return count + (Array.isArray(requirements) ? requirements.filter((requirement) => asObject(requirement)?.passed === false).length : 0);
  }, 0), 0);
  if (!diagnostics && !runs.length) return null;
  return <dl className="node-metrics" aria-label="Recorded diagnostics and model attempts">
    {diagnostics ? <div className="node-metric"><dt>Failure diagnostics</dt><dd>{diagnostics}</dd></div> : null}
    {runs.length ? <>
      <div className="node-metric"><dt>Model runs</dt><dd>{runs.length}</dd></div>
      <div className="node-metric"><dt>Model attempts</dt><dd>{attempts}</dd></div>
      <div className="node-metric"><dt>Repair attempts</dt><dd>{repairs}</dd></div>
      {failedRuns ? <div className="node-metric"><dt>Failed model runs</dt><dd>{failedRuns}</dd></div> : null}
      {failedChecks ? <div className="node-metric"><dt>Failed requirement checks</dt><dd>{failedChecks}</dd></div> : null}
    </> : null}
  </dl>;
}

function ModelTraceSummary({ value }: { value: JsonValue }) {
  const runs = modelRuns(value);
  if (!runs.length) return null;
  const attempts = runs.reduce((sum, run) => sum + run.attempts.length, 0);
  const failed = runs.filter((run) => !run.success).length;
  return <p className="node-model-summary">{runs.length} model {runs.length === 1 ? "run" : "runs"} · {attempts} {attempts === 1 ? "attempt" : "attempts"} · {repairCount(runs)} repair {repairCount(runs) === 1 ? "attempt" : "attempts"}{failed ? ` · ${failed} failed ${failed === 1 ? "run" : "runs"}` : ""}. Complete requests, responses, and requirement results are in the raw records.</p>;
}

function modelRuns(value: JsonValue): ModelRun[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(modelRuns);
  if (typeof value.success === "boolean" && Array.isArray(value.attempts) && typeof value.selected_attempt === "number") return [{ success: value.success, attempts: value.attempts }];
  return Object.entries(value).filter(([key]) => !PAYLOAD_KEYS.has(key)).flatMap(([, child]) => modelRuns(child));
}

function repairCount(runs: ModelRun[]) {
  return runs.reduce((sum, run) => sum + Math.max(0, run.attempts.length - 1), 0);
}

function failureDiagnostics(value: JsonValue): number {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce<number>((sum, child) => sum + failureDiagnostics(child), 0);
  if (typeof value.success === "boolean" && Array.isArray(value.attempts) && typeof value.selected_attempt === "number") return 0;
  return Object.entries(value).reduce((sum, [key, child]) => {
    if (PAYLOAD_KEYS.has(key)) return sum;
    if (["failure_reason", "normalization_error", "error"].includes(key) && typeof child === "string" && child) return sum + 1;
    if (key === "failure" && child) return sum + 1;
    if (["failures", "retry_failures"].includes(key) && Array.isArray(child)) return sum + child.length;
    return sum + failureDiagnostics(child);
  }, 0);
}

function recordCount(additions: Record<string, JsonValue>) {
  return discoverRecords(additions).length;
}

function asObject(value: JsonValue | undefined): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function humanize(value: string) {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function retainedPayload(value: JsonValue) {
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "item" : "items"} retained in raw records`;
  if (value && typeof value === "object") return `${Object.keys(value).length} ${Object.keys(value).length === 1 ? "field" : "fields"} retained in raw records`;
  return summarizeValue(value);
}

function summarizeValue(value: JsonValue): string {
  if (value === null) return "None";
  if (typeof value === "string") return value.length > 260 ? `${value.slice(0, 260)}… (complete text in raw records)` : value;
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "None recorded";
    if (value.every((child) => child === null || typeof child !== "object") && value.length <= 6) return value.map(summarizeValue).join(", ");
    return `${value.length} ${value.length === 1 ? "item" : "items"} retained`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "Empty object";
  const preferred = ["outcome", "verdict", "identity_verdict", "result", "is_citation", "selected_candidate_index", "root_index", "candidate_index", "root_id", "opinion_id", "docket_id", "correct_page", "pagination_available", "failure_type", "message", "reason", "query", "url", "id"];
  const meaningful = entries.flatMap(([key, child]) => {
    if (preferred.includes(key) && (child === null || typeof child !== "object")) return [[key, summarizeValue(child)] as const];
    const nested = asObject(child);
    const result = nested ? [nested.result, nested.verdict, nested.outcome].find((item) => typeof item === "string") : undefined;
    if (typeof result === "string") return [[key, result] as const];
    if (Array.isArray(child) && /quote|quer|indices|ids|choices/.test(key)) return [[key, summarizeValue(child)] as const];
    return [];
  });
  const scalars = meaningful.length ? meaningful : entries.filter(([, child]) => child !== null && typeof child !== "object").map(([key, child]) => [key, summarizeValue(child)] as const);
  if (!scalars.length) return `${entries.length} ${entries.length === 1 ? "field" : "fields"} retained`;
  const limit = meaningful.length ? 6 : 3;
  const summary = scalars.slice(0, limit).map(([key, child]) => `${humanize(key)}: ${child}`).join(" · ");
  return entries.length > scalars.slice(0, limit).length ? `${summary} · ${entries.length} fields retained` : summary;
}
