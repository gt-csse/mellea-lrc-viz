import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDocument, type CitationView, type JsonObject } from "../lib/document.ts";
import { formatValue, safeUrl, targets } from "../components/judgment-values.ts";
import { assessmentFor, fieldReading, getIdentityData } from "../components/identity-data.ts";

function rootFixture(change: (root: JsonObject) => void = () => {}): CitationView {
  const raw = JSON.parse(readFileSync(new URL("./fixtures/native-document.json", import.meta.url), "utf8")).document;
  change(raw.citations[0]);
  return parseDocument(raw).citations[0];
}

function savedLookup(root: JsonObject) {
  const nodes = root.nodes as JsonObject[];
  root.reporter_exact_lookup = { node_id: nodes[2].id, outcome: "unique", response: { clusters: [{ id: "42", case_name: "Independent record", date_filed: "1969-05-12", court: "scotus" }] } };
}

test("known normalization types become readable without filling absent date parts", () => {
  assert.equal(formatValue({ id: "scotus", name: "Supreme Court of the United States" }), "Supreme Court of the United States (scotus)");
  assert.equal(formatValue({ year: 1978, month: null, day: null }), "1978");
  assert.equal(formatValue({ year: 1978, month: 6, day: null }), "1978-06");
  assert.equal(formatValue({ year: 1978, month: 6, day: 6 }), "1978-06-06");
  assert.equal(formatValue({ kind: "adversarial", plaintiff: "Alpha", defendant: "Beta" }), "Alpha v. Beta");
  assert.equal(formatValue({ docket_number: "1:24-cv-77" }), "1:24-cv-77");
});

test("native and provider reporter citations retain the edition and page", () => {
  assert.equal(formatValue({ volume: 436, reporter: { short_name: "U.S.", name: "United States Reports" }, edition: "U.S.", page: "658" }), "436 U.S. 658");
  assert.equal(formatValue([{ volume: "436", reporter: "U.S.", page: "658" }, { volume: "98", reporter: "S. Ct.", page: "2018" }]), "436 U.S. 658; 98 S. Ct. 2018");
});

test("pinpoint formatting distinguishes page, star pagination, paragraph and footnote", () => {
  const saved = [{ first: 665, last: 666, kind: "page", footnote: "7" }, { first: 4, last: 4, kind: "star", footnote: null }, { first: 8, last: 9, kind: "paragraph", footnote: null }];
  assert.equal(targets(saved), "p. 665–666 n. 7, *4, ¶ 8–9");
  assert.equal(formatValue(saved), targets(saved));
});

test("unrecognized values stay explicit, and display formatting never mutates raw JSON", () => {
  const value = { unknown: [true, null, "saved"], detail: { new_property: 7 } };
  const before = structuredClone(value);
  assert.equal(formatValue(value), JSON.stringify(value, null, 2));
  assert.deepEqual(value, before);
  const incomplete = { year: 1978, month: null, day: 6 };
  assert.equal(formatValue(incomplete), JSON.stringify(incomplete, null, 2));
});

test("source links require HTTP(S), and provider-relative paths require an explicit base", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///tmp/a", "mailto:test@example.com", "//untrusted.example/a", "https://name:secret@example.com/a", "/opinion/42/"]) assert.equal(safeUrl(url), null);
  assert.equal(safeUrl("/opinion/42/", "https://www.courtlistener.com"), "https://www.courtlistener.com/opinion/42/");
  assert.equal(safeUrl("https://example.com/evidence"), "https://example.com/evidence");
});

test("a direct field judgment shows its exact absolute reading index", () => {
  const root = rootFixture(raw => {
    savedLookup(raw);
    const node = (raw.nodes as JsonObject[])[3].id;
    const first = (raw.case_name as JsonObject[])[0];
    (raw.case_name as JsonObject[]).push({ ...first, node_id: node, quote: "Later reread" });
    raw.case_name_judgments = [{ node_id: node, reading_index: 0, candidate_index: 0, result: "match" }];
  });
  const data = getIdentityData(root);
  const comparison = assessmentFor(data.checkpoint, data.reviews, "case_name", data.selection);
  assert.equal(fieldReading(data.checkpoint, "case_name", comparison)?.quote, "Alpha v. Beta");
  assert.equal(comparison?.comparisonValues?.id, "42");
});

test("an unavailable direct judgment with a null reading index stays unread", () => {
  const root = rootFixture(raw => {
    savedLookup(raw);
    raw.case_name_judgments = [{ node_id: (raw.nodes as JsonObject[])[3].id, reading_index: null, candidate_index: 0, result: "unavailable" }];
  });
  const data = getIdentityData(root);
  assert.equal(fieldReading(data.checkpoint, "case_name", assessmentFor(data.checkpoint, data.reviews, "case_name", data.selection)), null);
});

test("review comparisons use the filing reading at the review node", () => {
  const root = rootFixture(raw => {
    savedLookup(raw);
    const nodes = raw.nodes as JsonObject[];
    raw.reporter_unique_review = { node_id: nodes[2].id, decision: { case_name: { result: "match", reason: "Saved name review." }, reason: "Saved review." } };
    (raw.case_name as JsonObject[]).push({ ...(raw.case_name as JsonObject[])[0], node_id: nodes[3].id, quote: "Later unjudged reading" });
  });
  const data = getIdentityData(root);
  assert.equal(fieldReading(data.checkpoint, "case_name", assessmentFor(data.checkpoint, data.reviews, "case_name", data.selection))?.quote, "Alpha v. Beta");
});

test("later records cannot replace the final identity judgment's saved evidence or rationale", () => {
  const root = rootFixture(raw => {
    savedLookup(raw);
    const nodes = raw.nodes as JsonObject[];
    nodes.push({ id: "future-review", stage: "later_review" });
    raw.reporter_unique_review = { node_id: "future-review", failure_reason: "Later failed lookup." };
    (raw.case_name as JsonObject[]).push({ ...(raw.case_name as JsonObject[])[0], node_id: "future-review", quote: "Future reading" });
  });
  const data = getIdentityData(root);
  assert.equal(data.selection?.record.id, "42");
  assert.equal(data.rationale, null);
  assert.equal(data.checkpoint.nodes.at(-1)?.id, root.nodes[3].id);
  assert.equal((data.checkpoint.raw.case_name as JsonObject[]).length, 1);
  assert.equal((root.raw.case_name as JsonObject[]).length, 2);
});

test("third-party identity uses its saved provider evidence index instead of lookup metadata", () => {
  const root = rootFixture(raw => {
    savedLookup(raw);
    const nodes = raw.nodes as JsonObject[];
    raw.identity_judgments = [{ node_id: nodes[3].id, verdict: "correct_identity", basis: "third_party" }];
    raw.body_searches = [{ node_id: nodes[2].id, source: "courtlistener_opinion", evidence: [{ body_id: "first", excerpt: "unselected" }, { body_id: "chosen", excerpt: "Saved independently printed citation." }] }];
    raw.body_reviews = [{ node_id: nodes[3].id, decision: { source: "courtlistener_opinion", evidence_index: 1, third_party: { case_name: "Independent printed citation" }, filing: { case_name: "Alpha v. Beta" }, comparisons: { case_name: { result: "match", reason: "Saved body comparison." } }, reason: "Saved body rationale." } }];
  });
  const data = getIdentityData(root);
  const comparison = assessmentFor(data.checkpoint, data.reviews, "case_name", data.selection);
  assert.equal(data.selection?.record.body_id, "chosen");
  assert.equal(data.selection?.body, true);
  assert.equal(comparison?.comparisonValues?.case_name, "Independent printed citation");
  assert.equal(data.rationale, "Saved body rationale.");
});
