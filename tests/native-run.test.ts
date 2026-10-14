import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import test from "node:test";
import { buildNativeRun } from "../scripts/build-native-run.mjs";
import { decodeRunDocument, parseNativeRun, RUN_SCHEMA, WORKFLOWS, type NativeRun, type RunDocument } from "../lib/native-run.ts";
import { getDocumentAtStage } from "../lib/document.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/native-document.json", import.meta.url), "utf8"));
const timestamp = "2026-10-14T15-59-55Z";
const filename = "001__alpha-v-beta__brief.txt";

function runFixture() {
  const root = mkdtempSync(join(tmpdir(), "mellea-native-run-"));
  const runDir = join(root, timestamp);
  const output = join(root, "public");
  mkdirSync(join(runDir, "documents"), { recursive: true });
  writeFileSync(join(runDir, "run.json"), JSON.stringify({ status: "complete", end_to_end: true, workflows: WORKFLOWS, set: "primary", filings: [filename] }));
  const bytes = Buffer.from(`${JSON.stringify(fixture.completedWorkflowDocument, null, 2)}\n`);
  writeFileSync(join(runDir, "documents", `${filename}.json`), bytes);
  for (const workflow of WORKFLOWS) {
    writeFileSync(join(runDir, `${workflow}.md`), `# ${workflow}\n\nSaved report.\n`);
    writeFileSync(join(runDir, `${workflow}.json`), JSON.stringify({ workflow }));
  }
  return { root, runDir, output, bytes };
}

test("completed native run packaging preserves exact Document bytes and four reports", async () => {
  const fixture = runFixture();
  try {
    const index = parseNativeRun(buildNativeRun(fixture.runDir, fixture.output));
    assert.equal(index.schema, RUN_SCHEMA);
    assert.equal(index.documents.length, 1);
    assert.equal(index.reports.length, 4);
    const entry = index.documents[0];
    assert.equal(entry.sha256, createHash("sha256").update(fixture.bytes).digest("hex"));
    const compressed = readFileSync(join(fixture.output, timestamp, "documents/001.json.gz"));
    assert.deepEqual(gunzipSync(compressed), fixture.bytes);
    const document = await decodeRunDocument(compressed, entry);
    assert.deepEqual(document.raw, JSON.parse(fixture.bytes.toString()));
    assert.equal(document.stageRuns.length, 14);
    assert.equal(document.substageRuns.length, 46);
    assert.deepEqual(JSON.parse(readFileSync(join(fixture.output, "index.json"), "utf8")), index);
    for (const workflow of WORKFLOWS) assert.deepEqual(readFileSync(join(fixture.output, timestamp, `reports/${workflow}.md`)), readFileSync(join(fixture.runDir, `${workflow}.md`)));
    buildNativeRun(fixture.runDir, fixture.output);
    assert.deepEqual(readFileSync(join(fixture.output, timestamp, "documents/001.json.gz")), compressed);
  } finally { rmSync(fixture.root, { recursive: true, force: true }); }
});

test("unfinished runs and incomplete workflows are refused before publishing an index", () => {
  const fixture = runFixture();
  try {
    const metadata = JSON.parse(readFileSync(join(fixture.runDir, "run.json"), "utf8"));
    writeFileSync(join(fixture.runDir, "run.json"), JSON.stringify({ ...metadata, status: "running" }));
    assert.throws(() => buildNativeRun(fixture.runDir, fixture.output), /completed e2e run/);
    writeFileSync(join(fixture.runDir, "run.json"), JSON.stringify(metadata));
    const document = JSON.parse(fixture.bytes.toString()); document.runs.pop();
    writeFileSync(join(fixture.runDir, "documents", `${filename}.json`), JSON.stringify(document));
    assert.throws(() => buildNativeRun(fixture.runDir, fixture.output), /not completed all four workflows/);
    assert.throws(() => readFileSync(join(fixture.output, "index.json")), /ENOENT/);
  } finally { rmSync(fixture.root, { recursive: true, force: true }); }
});

test("publication refuses credential fields and omits private run configuration", () => {
  const fixture = runFixture();
  try {
    const document = JSON.parse(fixture.bytes.toString()); document.external = { authorization: "private-test-value" };
    writeFileSync(join(fixture.runDir, "documents", `${filename}.json`), JSON.stringify(document));
    assert.throws(() => buildNativeRun(fixture.runDir, fixture.output), /credential field/);
    writeFileSync(join(fixture.runDir, "documents", `${filename}.json`), fixture.bytes);
    const metadata = JSON.parse(readFileSync(join(fixture.runDir, "run.json"), "utf8"));
    writeFileSync(join(fixture.runDir, "run.json"), JSON.stringify({ ...metadata, api_key: "private-test-value" }));
    const index = buildNativeRun(fixture.runDir, fixture.output);
    assert.ok(!JSON.stringify(index).includes("private-test-value"));
    assert.throws(() => readFileSync(join(fixture.output, timestamp, "run.json")), /ENOENT/);
  } finally { rmSync(fixture.root, { recursive: true, force: true }); }
});

test("verified decompression rejects incomplete and altered document bytes", async () => {
  const bytes = Buffer.from(JSON.stringify(fixture.document));
  const compressed = gzipSync(bytes);
  const entry: RunDocument = { id: "001", filename: "source.json", title: "Source", url: "/runs/primary/demo/001.json.gz", bytes: bytes.length, compressedBytes: compressed.length, sha256: createHash("sha256").update(bytes).digest("hex"), citations: 6, roots: 2, stages: 1, substages: 7 };
  assert.deepEqual((await decodeRunDocument(compressed, entry)).raw, fixture.document);
  await assert.rejects(() => decodeRunDocument(compressed.subarray(1), entry), /incomplete/);
  await assert.rejects(() => decodeRunDocument(compressed, { ...entry, sha256: "0".repeat(64) }), /saved hash/);
  await assert.rejects(() => decodeRunDocument(compressed, { ...entry, bytes: entry.bytes + 1 }), /unexpected length/);
});

test("static run index requires one entry per document and all four workflow reports", () => {
  const fixture = runFixture();
  try {
    const index = parseNativeRun(buildNativeRun(fixture.runDir, fixture.output));
    const corrupt = (change: (index: NativeRun) => void) => { const copy = structuredClone(index); change(copy); return copy; };
    assert.throws(() => parseNativeRun(corrupt(index => index.documents.push(index.documents[0]))), /Duplicate/);
    assert.throws(() => parseNativeRun(corrupt(index => { index.documents[0].url = "https://external.example/run.json.gz"; })), /Invalid built-in document/);
    assert.throws(() => parseNativeRun(corrupt(index => { index.reports.pop(); })), /four workflow reports/);
  } finally { rmSync(fixture.root, { recursive: true, force: true }); }
});

test("the built-in primary corpus opens all 26 native Documents and their stage checkpoints", async () => {
  const index = parseNativeRun(JSON.parse(readFileSync(new URL("../public/runs/primary/index.json", import.meta.url), "utf8")));
  assert.equal(index.documents.length, 26);
  for (const entry of index.documents) {
    const compressed = readFileSync(new URL(`../public${entry.url}`, import.meta.url));
    const document = await decodeRunDocument(compressed, entry);
    assert.deepEqual(document.warnings, [], entry.id);
    assert.equal(document.citations.length, entry.citations, entry.id);
    assert.equal(document.stageRuns.length, entry.stages, entry.id);
    assert.equal(document.substageRuns.length, entry.substages, entry.id);
    for (const stage of document.stageRuns) {
      const checkpoint = getDocumentAtStage(document, stage);
      assert.deepEqual(checkpoint.warnings, [], `${entry.id}: ${stage}`);
      assert.equal(checkpoint.runs.at(-1)?.name, stage);
    }
  }
  for (const report of index.reports) {
    assert.ok(readFileSync(new URL(`../public${report.markdown}`, import.meta.url), "utf8").trim());
    JSON.parse(readFileSync(new URL(`../public${report.json}`, import.meta.url), "utf8"));
  }
});
