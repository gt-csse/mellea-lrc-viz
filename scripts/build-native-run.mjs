// Copy one completed native run into static, byte-identical compressed assets.
// No annotations, credentials, model sessions, or provider calls are needed.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { groupCitations, parseDocument } from "../lib/document.ts";
import { RUN_SCHEMA, WORKFLOWS } from "../lib/native-run.ts";

const FINAL_STAGES = [
  "grow_roots.form_root_groups",
  "validate_roots_citation_identity.corroborate_locator_bodies",
  "grow_leaves.correct_leaf_readings",
  "validate_all_citation_content.review_citation_content",
];

function assertNoCredentials(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach(assertNoCredentials); return; }
  for (const [key, item] of Object.entries(value)) {
    if (["api_key", "apikey", "authorization", "password", "client_secret", "access_token", "refresh_token"].includes(key.toLowerCase()) && item) throw new Error(`Refusing to publish a credential field: ${key}`);
    assertNoCredentials(item);
  }
}

export function buildNativeRun(runDir, outputRoot = "public/runs/primary") {
  const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
  if (run.status !== "complete" || run.end_to_end !== true || JSON.stringify(run.workflows) !== JSON.stringify(WORKFLOWS)) throw new Error("Only a completed e2e run can be embedded.");
  if (run.set !== "primary" || !Array.isArray(run.filings) || !run.filings.length) throw new Error("Expected a completed primary corpus run.");
  const runId = basename(resolve(runDir));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/.test(runId)) throw new Error("Expected a timestamped run directory.");
  const assets = [];
  const documents = run.filings.map(filename => {
    if (typeof filename !== "string" || basename(filename) !== filename || !filename.endsWith(".txt")) throw new Error("Invalid run document filename.");
    const id = filename.split("__")[0];
    if (!/^\d{3}$/.test(id)) throw new Error("Expected a three-digit primary document id.");
    const bytes = readFileSync(join(runDir, "documents", `${filename}.json`));
    const document = parseDocument(bytes.toString("utf8"));
    if (FINAL_STAGES.some(stage => !document.stageRuns.includes(stage))) throw new Error(`Document ${id} has not completed all four workflows.`);
    assertNoCredentials(document.raw);
    const compressed = gzipSync(bytes, { level: 9 });
    if (!gunzipSync(compressed).equals(bytes)) throw new Error(`Document ${id} failed compressed byte verification.`);
    assets.push({ path: `documents/${id}.json.gz`, bytes: compressed });
    return {
      id, filename: `${filename}.json`, title: filename.replace(/\.txt$/, "").split("__").slice(1).join(" · ").replaceAll("-", " "),
      url: `/runs/primary/${runId}/documents/${id}.json.gz`,
      sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, compressedBytes: compressed.length,
      citations: document.citations.length, roots: groupCitations(document).roots.length,
      stages: document.stageRuns.length, substages: document.substageRuns.length,
    };
  });
  if (new Set(documents.map(document => document.id)).size !== documents.length) throw new Error("Duplicate primary document id.");
  const reports = WORKFLOWS.map(workflow => {
    for (const extension of ["md", "json"]) assets.push({ path: `reports/${workflow}.${extension}`, bytes: readFileSync(join(runDir, `${workflow}.${extension}`)) });
    return { workflow, markdown: `/runs/primary/${runId}/reports/${workflow}.md`, json: `/runs/primary/${runId}/reports/${workflow}.json` };
  });
  const index = { schema: RUN_SCHEMA, runId, set: run.set, documents, reports };
  // All files are validated before the published index changes.
  for (const asset of assets) {
    const path = join(outputRoot, runId, asset.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, asset.bytes);
  }
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error("Usage: npm run bundle:run -- /absolute/path/to/completed/run [output-directory]");
  const index = buildNativeRun(process.argv[2], process.argv[3]);
  console.log(`Embedded ${index.documents.length} documents from ${index.runId}; ${(index.documents.reduce((sum, document) => sum + document.compressedBytes, 0) / 1048576).toFixed(1)} MiB compressed. Four workflow reports copied.`);
}
