import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseDocument, groupCitations, getCitationAtNode, getDocumentAtStage, getDocumentAtSubstage, isToa, checkpointLabel,
  getField, getLatestRecord, getRootId, getRootCitation, getIdentityJudgment,
  getFieldVerdict, citationLabel, locatorLabel, displayValue, caseNameLabel,
  discoverRecords, readSpan, sliceCodePoints, sliceSpan, toUtf16Offset,
  type JsonObject, type JsonValue,
} from "../lib/document.ts";

// Small, invented source created with the current Python model constructors.
// Expected checkpoints are actual Document.get_stage outputs; no model/provider ran.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/native-document.json", import.meta.url), "utf8")) as {
  document: JsonObject; snapshots: Record<string, JsonObject>;
  emptyDocument: JsonObject; emptyCompleted: JsonObject;
  pendingCreation: JsonObject; pendingDocument: JsonObject;
  substageSnapshots: Record<string, JsonObject>; stageSnapshots: Record<string, JsonObject>;
};
const fresh = () => parseDocument(structuredClone(fixture.document));

test("native JSON is retained intact alongside useful projections", () => {
  const input = structuredClone(fixture.document);
  input.new_document_metadata = { future: [null, true, 7, "saved"], details: { unknown: "preserved" } };
  const document = parseDocument(input);
  assert.equal(document.raw, input);
  assert.equal(document.sourceRaw, input);
  assert.deepEqual(document.raw, input);
  assert.equal(document.text, input.text);
  assert.equal(document.citations.length, 6);
  assert.deepEqual(document.citations.map((citation) => citation.kind), ["reporter", "docket", "short_reporter", "id", "supra", "reference"]);
  assert.deepEqual(document.warnings, []);
  assert.equal(document.sourceMetadata, input.source_metadata);
  assert.equal(document.preprocessingMetadata, input.preprocessing_metadata);
  assert.deepEqual(parseDocument(JSON.stringify(input)).raw, input);
});

test("every synthetic atomic checkpoint matches Python Document.get_substage exactly", () => {
  const document = fresh();
  for (const [stage, expected] of Object.entries(fixture.substageSnapshots)) {
    const checkpoint = getDocumentAtSubstage(document, stage);
    assert.deepEqual(checkpoint.raw, expected, stage);
    assert.deepEqual(checkpoint.warnings, [], stage);
    assert.deepEqual(parseDocument(expected).raw, expected, stage);
    assert.equal(checkpoint.sourceRaw, document.sourceRaw);
  }
  assert.throws(() => getDocumentAtStage(document, "stage_that_did_not_run"), /Stage has not run/);
});

test("semantic group recovery matches Python and includes unchanged earlier citations", () => {
  const document = fresh();
  for (const [stage, expected] of Object.entries(fixture.stageSnapshots)) {
    const checkpoint = getDocumentAtStage(document, stage);
    assert.deepEqual(checkpoint.raw, expected);
    assert.equal(checkpoint.citations.length, 2);
    assert.deepEqual(checkpoint.runs.at(-1), { kind: "stage", name: stage });
    assert.deepEqual(checkpoint.raw.index_spans, document.raw.index_spans);
    assert.deepEqual(checkpoint.raw.source_metadata, document.raw.source_metadata);
  }
  assert.throws(() => getDocumentAtStage(document, "1_locators"), /Stage has not run/);
  assert.throws(() => getDocumentAtSubstage(document, "grow_roots.discover_root_locators"), /Substage has not run/);
});

test("TOA is occurrence metadata, retained in native snapshots without tagging body leaves", () => {
  const document = fresh();
  assert.equal(isToa(document.citations[0]), true);
  assert.ok(groupCitations(document).roots[0].leaves.every(leaf => !isToa(leaf)));
  const creation = getCitationAtNode(document.citations[0], document.citations[0].nodes[0].id);
  assert.equal(isToa(creation), true);
  assert.deepEqual(creation.raw.tags, document.citations[0].raw.tags);
  assert.equal(checkpointLabel("validate_all_citation_content.review_citation_content.review_cited_pages_llm"), "Review cited pages llm");
});

test("obsolete node and checkpoint shapes are rejected without aliases", () => {
  const oldNode = structuredClone(fixture.document);
  const node = ((oldNode.citations as JsonObject[])[0].nodes as JsonObject[])[0];
  node.stage = node.substage; delete node.substage;
  assert.throws(() => parseDocument(oldNode), /invalid node/);
  const oldRuns = structuredClone(fixture.emptyDocument);
  oldRuns.stage_runs = []; delete oldRuns.runs;
  assert.throws(() => parseDocument(oldRuns), /Obsolete stage_runs/);
  const duplicate = structuredClone(fixture.document);
  (duplicate.runs as JsonObject[]).push((duplicate.runs as JsonObject[])[0]);
  assert.throws(() => parseDocument(duplicate), /Duplicate/);
});

test("source-only native Documents and stages with no citations render without invented outcomes", () => {
  const empty = parseDocument(fixture.emptyDocument);
  assert.equal(empty.raw, fixture.emptyDocument);
  assert.equal(empty.text, "😀 Source has no citations yet.");
  assert.deepEqual(empty.citations, []);
  assert.deepEqual(empty.stageRuns, []);
  assert.deepEqual(empty.siteReviews, []);
  assert.deepEqual(empty.warnings, []);
  assert.deepEqual(groupCitations(empty), { roots: [], unassigned: [], withdrawn: [], unknown: [] });
  assert.throws(() => getDocumentAtStage(empty, "not_started"), /Stage has not run/);
  const complete = parseDocument(fixture.emptyCompleted);
  assert.deepEqual(complete.substageRuns, ["empty_extraction"]);
  assert.deepEqual(getDocumentAtSubstage(complete, "empty_extraction").raw, fixture.emptyCompleted);
});

test("the first native citation save is retained while its creation stage is pending", () => {
  const pending = parseDocument(fixture.pendingCreation);
  assert.deepEqual(pending.stageRuns, []);
  assert.equal(pending.citations.length, 1);
  assert.equal(pending.citations[0].nodes.length, 1);
  assert.equal(pending.citations[0].nodes[0].substage, "pending_creation");
  assert.equal(locatorLabel(pending.citations[0]), "436 U.S. 658");
  assert.equal(getRootId(pending.citations[0]), null);
  assert.equal(getIdentityJudgment(pending.citations[0]), null);
  assert.equal(groupCitations(pending).unassigned.length, 1);
  assert.deepEqual(getCitationAtNode(pending.citations[0], pending.citations[0].nodes[0].id).raw, (fixture.pendingCreation.citations as JsonObject[])[0]);
  assert.deepEqual(pending.warnings, []);
  assert.throws(() => getDocumentAtStage(pending, "pending_creation"), /Stage has not run/);
});

test("native saves during a pending stage retain every latest update and recover completed stages exactly", () => {
  const pending = parseDocument(fixture.pendingDocument);
  const original = fresh();
  const previous = original.citations[0];
  const citation = pending.citations.find((item) => item.id === previous.id)!;
  assert.deepEqual(pending.raw, fixture.pendingDocument);
  assert.deepEqual(pending.stageRuns, original.stageRuns);
  assert.equal(pending.citations.length, original.citations.length + 1);
  const newlyCreated = pending.citations.find((item) => !original.citations.some((prior) => prior.id === item.id))!;
  assert.equal(newlyCreated.nodes[0].substage, "pending_update");
  assert.equal(groupCitations(pending).unassigned[0], newlyCreated);
  assert.equal(citation.nodes.length, previous.nodes.length + 2);
  assert.equal(citation.nodes[citation.nodes.length - 1].substage, "pending_update");
  assert.equal(getIdentityJudgment(citation)?.verdict, "wrong_identity");
  assert.equal(getLatestRecord(citation, "routes")?.value, "pending_followup");
  const firstUpdate = getCitationAtNode(citation, citation.nodes[citation.nodes.length - 2].id);
  assert.equal(getIdentityJudgment(firstUpdate)?.verdict, "wrong_identity");
  assert.equal(getLatestRecord(firstUpdate, "routes"), null);
  assert.deepEqual(pending.warnings, []);
  for (const [stage, expected] of Object.entries(fixture.substageSnapshots)) {
    assert.deepEqual(getDocumentAtSubstage(pending, stage).raw, expected, stage);
  }
  assert.throws(() => getDocumentAtStage(pending, "pending_update"), /Stage has not run/);
});

test("node snapshots isolate successive decisions within the same stage", () => {
  const reporter = fresh().citations[0];
  const firstFields = getCitationAtNode(reporter, reporter.nodes[1].id);
  assert.equal(firstFields.nodes.length, 2);
  assert.equal(firstFields.nodes[1].substage, reporter.nodes[2].substage);
  assert.equal(getField(firstFields, "case_name")?.quote, "Alpha v. Beta");
  assert.equal(getField(firstFields, "date"), null);
  assert.equal(getRootId(firstFields), null);
  assert.equal(getIdentityJudgment(firstFields), null);
  const nextFields = getCitationAtNode(reporter, reporter.nodes[2].id);
  assert.equal(getField(nextFields, "date")?.quote, "1969");
  assert.equal(getRootId(nextFields), reporter.id);
  assert.equal(getIdentityJudgment(nextFields), null);
  assert.equal(firstFields.sourceRaw, reporter.raw);
  assert.equal(getIdentityJudgment(reporter)?.verdict, "correct_identity");
  assert.throws(() => getCitationAtNode(reporter, "missing"), /has no node/);
});

test("Nodes contain only id/substage and derive every addition from citation ownership", () => {
  const document = fresh();
  for (const citation of document.citations) {
    for (const node of citation.nodes) {
      assert.deepEqual(Object.keys(node.raw).sort(), ["id", "substage"]);
      const additions = discoverRecords(node.additions);
      assert.ok(additions.every((record) => record.nodeId === node.id));
      assert.equal(additions.length, discoverRecords(citation.raw).filter((record) => record.nodeId === node.id).length);
    }
    assert.ok(citation.siteSpan);
    assert.equal(sliceSpan(document.text, citation.siteSpan!), locatorLabel(citation));
  }
  const reporter = document.citations[0];
  assert.ok(Array.isArray(reporter.nodes[1].additions.case_name));
  assert.ok(Array.isArray(reporter.nodes[2].additions.root_id));
  assert.deepEqual(reporter.nodes[2].additions.date, reporter.raw.date);
});

test("future records, nested unknown records, and arbitrary provider responses are lossless", () => {
  const input = structuredClone(fixture.document);
  const reporter = (input.citations as JsonObject[])[0];
  const nodes = reporter.nodes as JsonObject[];
  const earlyId = nodes[0].id as string;
  const lateId = nodes[nodes.length - 1].id as string;
  reporter.reporter_exact_lookup = {
    node_id: lateId, outcome: "request_failed", query: null,
    response: {
      node_id: "opaque-provider-value", details: [null, "full upstream diagnostic"],
      records: [{ node_id: "another-provider-value", arbitrary: { kept: true } }],
    },
  };
  reporter.future_history = [{ node_id: earlyId, before: true }, { node_id: lateId, after: true }];
  reporter.future_envelope = { explanation: "untouched metadata", records: [{ node_id: lateId, complete: { detail: "full nested data" } }] };
  const parsed = parseDocument(input);
  assert.deepEqual(parsed.warnings, []);
  const citation = parsed.citations[0];
  const snapshot = getCitationAtNode(citation, earlyId);
  assert.equal(snapshot.raw.reporter_exact_lookup, null);
  assert.deepEqual(snapshot.raw.future_history, [{ node_id: earlyId, before: true }]);
  assert.deepEqual(snapshot.raw.future_envelope, { explanation: "untouched metadata", records: [] });
  assert.equal(snapshot.sourceRaw, reporter);
  assert.equal(getLatestRecord(citation, "reporter_exact_lookup"), reporter.reporter_exact_lookup);
  assert.deepEqual(getCitationAtNode(citation, lateId).raw.reporter_exact_lookup, reporter.reporter_exact_lookup);
  assert.equal(citation.nodes[citation.nodes.length - 1].additions.reporter_exact_lookup, reporter.reporter_exact_lookup);
  assert.equal(discoverRecords(reporter.reporter_exact_lookup).length, 1);
  assert.ok("future_envelope" in citation.nodes[citation.nodes.length - 1].additions);
  assert.deepEqual(input, { ...fixture.document, citations: input.citations });
});

test("missing fields and stages stay absent, and all five case-name forms render", () => {
  const document = getDocumentAtSubstage(fresh(), "1_locators");
  const reporter = document.citations[0];
  assert.equal(getRootId(reporter), null);
  assert.equal(getIdentityJudgment(reporter), null);
  assert.equal(getField(reporter, "pin_cite"), null);
  assert.equal(getField(reporter, "case_name"), null);
  assert.equal(getFieldVerdict(reporter, "case_name"), null);
  assert.equal(citationLabel(reporter), "436 U.S. 658");
  assert.equal(caseNameLabel({ kind: "adversarial", plaintiff: "A", defendant: "B" }), "A v. B");
  assert.equal(caseNameLabel({ kind: "in_re", subject: "A" }), "In re A");
  assert.equal(caseNameLabel({ kind: "ex_parte", subject: "A" }), "Ex parte A");
  assert.equal(caseNameLabel({ kind: "partial", partial: "A" }), "A");
  assert.equal(caseNameLabel({ kind: "not_stated", plaintiff: null, defendant: null, subject: null, partial: null }), "Not stated");
  assert.equal(displayValue(undefined), "Not recorded");
  assert.equal(displayValue(false), "false");
  assert.equal(displayValue(0), "0");
  assert.equal(displayValue(null), "None");
});

test("citation headings use the normalized name while preserving the exact source quote", () => {
  const input = structuredClone(fixture.document);
  const raw = (input.citations as JsonObject[])[0];
  const field = (raw.case_name as JsonObject[])[0];
  field.normalized = { kind: "adversarial", plaintiff: "Alpha Corporation", defendant: "Beta LLC", subject: null, partial: null };
  field.normalized_by = "model";
  const citation = parseDocument(input).citations[0];
  assert.equal(citationLabel(citation), "Alpha Corporation v. Beta LLC");
  assert.equal(getField(citation, "case_name")?.quote, "Alpha v. Beta");
  field.normalizable = false;
  field.normalized = null;
  field.normalization_error = "Saved historical reading failure";
  assert.equal(citationLabel(parseDocument(input).citations[0]), "Alpha v. Beta");
  field.normalizable = true;
  field.normalized = { kind: "not_stated", plaintiff: null, defendant: null, subject: null, partial: null };
  field.normalization_error = null;
  assert.equal(citationLabel(parseDocument(input).citations[0]), "436 U.S. 658");
});

test("root navigation nests attached occurrences and keeps dummy and unassigned entries", () => {
  const document = fresh();
  const groups = groupCitations(document);
  assert.equal(groups.roots.length, 2);
  assert.equal(groups.roots[0].leaves.length, 3);
  assert.equal(groups.withdrawn.length, 1);
  assert.equal(groups.unassigned.length, 0);
  assert.equal(groups.unknown.length, 0);
  const flattened = [...groups.roots.flatMap((group) => [group.root, ...group.leaves]), ...groups.unassigned, ...groups.withdrawn, ...groups.unknown];
  assert.equal(new Set(flattened.map((citation) => citation.id)).size, document.citations.length);
  assert.equal(getRootCitation(document, groups.roots[0].leaves[0]), groups.roots[0].root);
  assert.equal(getRootCitation(document, groups.withdrawn[0]), null);
  assert.equal(groupCitations(getDocumentAtSubstage(document, "1_locators")).unassigned.length, 2);
  const input = structuredClone(fixture.document);
  const leaf = (input.citations as JsonObject[]).find((citation) => citation.kind === "id")!;
  (leaf.root_id as JsonObject[])[0].value = "root-that-is-not-present";
  const corrupted = parseDocument(input);
  assert.equal(groupCitations(corrupted).unknown.length, 1);
  assert.ok(corrupted.warnings.some((message) => message.includes("missing root")));
  assert.equal(corrupted.raw, input);
});

test("Unicode source spans use Python code points, including supplementary characters", () => {
  const text = "😀 A𝄞B e\u0301";
  assert.equal(toUtf16Offset(text, 1), 2);
  assert.equal(sliceCodePoints(text, 2, 5), "A𝄞B");
  assert.equal(sliceSpan(text, { start: 0, end: 1 }), "😀");
  assert.equal(sliceCodePoints(text, 6, 8), "e\u0301");
  assert.equal(sliceCodePoints(text, 99, 100), "");
  assert.deepEqual(readSpan({ start: 0, end: 0, retained: "unknown" }), { start: 0, end: 0 });
  assert.equal(readSpan({ start: -1, end: 2 }), null);
  assert.equal(readSpan({ start: 0.5, end: 2 }), null);
});

test("native errors are informative and unfamiliar kinds or records remain inspectable", () => {
  assert.throws(() => parseDocument("{broken"), /not valid JSON/);
  assert.throws(() => parseDocument({ schema_version: 2, documents: [] }), /text string/);
  assert.throws(() => parseDocument({ text: "source" }), /citations array/);
  assert.throws(() => parseDocument({ ...fixture.emptyDocument, citations: [null] }), /must be an object/);
  const input = structuredClone(fixture.document);
  const unknown = (input.citations as JsonObject[])[0];
  unknown.kind = "future_kind";
  unknown.future_record = { node_id: "node-not-present", detail: ["preserved"] };
  const document = parseDocument(input);
  assert.equal(document.citations[0].raw, unknown);
  assert.equal(document.citations[0].siteSpan?.start, 17);
  assert.ok(document.warnings.some((message) => message.includes("Unknown citation kind")));
  assert.ok(document.warnings.some((message) => message.includes("missing node")));
});

test("per-field verdicts use recorded node chronology and retain review provenance", () => {
  const input = structuredClone(fixture.document);
  const reporter = (input.citations as JsonObject[])[0];
  const nodes = reporter.nodes as JsonObject[];
  reporter.case_name_judgments = [{ node_id: nodes[2].id, result: "mismatch", reading_index: 0, candidate_index: 0 }];
  reporter.reporter_unique_review = {
    node_id: nodes[3].id, decision: { case_name: { result: "match", reason: "Saved later comparison" } },
  };
  const citation = parseDocument(input).citations[0];
  assert.equal(getFieldVerdict(citation, "case_name")?.result, "match");
  assert.equal(getFieldVerdict(citation, "case_name")?.record_key, "reporter_unique_review");
  assert.equal(getFieldVerdict(getCitationAtNode(citation, nodes[2].id as string), "case_name")?.result, "mismatch");
});

/** Cross-language semantic hash: numeric doubles and UTF-8 strings are exact. */
function fingerprint(value: JsonValue): string {
  const hash = createHash("sha256");
  function add(item: JsonValue) {
    if (item === null) { hash.update("n"); return; }
    if (typeof item === "boolean") { hash.update(item ? "t" : "f"); return; }
    if (typeof item === "number") {
      const bytes = Buffer.allocUnsafe(8); bytes.writeDoubleBE(item);
      hash.update("d"); hash.update(bytes); return;
    }
    if (typeof item === "string") {
      const bytes = Buffer.from(item, "utf8");
      hash.update(`s${bytes.length}:`); hash.update(bytes); return;
    }
    if (Array.isArray(item)) {
      hash.update("["); for (const child of item) add(child); hash.update("]"); return;
    }
    hash.update("{");
    const compare = (left: string, right: string) => {
      const a = Array.from(left, (character) => character.codePointAt(0)!);
      const b = Array.from(right, (character) => character.codePointAt(0)!);
      for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
      return a.length - b.length;
    };
    for (const key of Object.keys(item).sort(compare)) { add(key); add(item[key]); }
    hash.update("}");
  }
  add(value); return hash.digest("hex");
}

test("every durable native checkpoint matches Python projections when corpus manifest is supplied", {
  skip: !process.env.MELLEA_NATIVE_CORPUS_MANIFEST,
}, () => {
  const manifest = JSON.parse(readFileSync(process.env.MELLEA_NATIVE_CORPUS_MANIFEST!, "utf8")) as {
    documents: Array<{ path: string; checkpoints: Array<{ kind: "stage" | "substage"; name: string; fingerprint: string }>; nodes: Array<{ citationId: string; nodeId: string; fingerprint: string }> }>;
  };
  let stages = 0;
  let nodes = 0;
  for (const entry of manifest.documents) {
    const document = parseDocument(readFileSync(entry.path, "utf8"));
    assert.deepEqual(document.warnings, [], entry.path);
    for (const expected of entry.checkpoints) {
      const checkpoint = expected.kind === "stage" ? getDocumentAtStage(document, expected.name) : getDocumentAtSubstage(document, expected.name);
      assert.equal(fingerprint(checkpoint.raw), expected.fingerprint, `${entry.path}: ${expected.name}`);
      assert.deepEqual(checkpoint.warnings, [], `${entry.path}: ${expected.name}`);
      stages++;
    }
    for (const expected of entry.nodes) {
      const citation = document.citations.find((item) => item.id === expected.citationId)!;
      assert.equal(fingerprint(getCitationAtNode(citation, expected.nodeId).raw), expected.fingerprint, `${entry.path}: ${expected.nodeId}`);
      nodes++;
    }
  }
  console.log(`Native Python parity: ${manifest.documents.length} documents, ${stages} stages, ${nodes} node snapshots.`);
});
