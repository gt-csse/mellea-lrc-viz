// One bundle per document, built from the annotation store.
//
//   node scripts/build-bundles.mjs                 every document
//   node scripts/build-bundles.mjs --document 005  one of them
//   node scripts/build-bundles.mjs --store ../mellea-lrc-datasets --out bundles
//
// A bundle is one document: its text, the annotations about it, and the hash
// that says which text those spans index. The viewer opens one and renders it.
// Nothing joins across documents, so there is no index and nothing to preload.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const SCHEMA = "mellea-lrc/document-bundle/v1";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const STORE = option("store", "data");
const OUT = option("out", "bundles");
const ONLY = option("document", null);

const readJsonl = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

const versionOf = (name) => {
  const match = /-v(\d+)\.(\d+)$/.exec(name);
  return match ? Number(match[1]) * 1000 + Number(match[2]) : -1;
};

// Take the highest version of a dataset that is laid out per document.
function datasetDir(kind) {
  const dirs = readdirSync(STORE)
    .filter((name) => name.startsWith(`${kind}-v`) && statSync(join(STORE, name)).isDirectory())
    .sort((a, b) => versionOf(b) - versionOf(a));
  for (const dir of dirs) {
    if (existsSync(join(STORE, dir, "documents"))) return dir;
  }
  return null;
}

function storeCommit() {
  try {
    return execFileSync("git", ["-C", STORE, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function readableName(stem) {
  const [number, caseSlug = "", kindSlug = ""] = stem.split("__");
  const words = (slug) => slug.replace(/-+/g, " ").trim();
  return { number, case_name: words(caseSlug), document_kind: words(kindSlug) };
}

const extraction = datasetDir("extraction");
if (!extraction) throw new Error(`no per-document extraction dataset under ${STORE}`);

const documentsTxt = join(STORE, "corpus", "documents_txt");
const names = readdirSync(documentsTxt)
  .filter((name) => name.endsWith(".txt"))
  .filter((name) => !ONLY || name.startsWith(ONLY))
  .sort();
if (!names.length) throw new Error(`no document matches --document ${ONLY}`);

mkdirSync(OUT, { recursive: true });
const commit = storeCommit();

for (const name of names) {
  const stem = name.replace(/\.txt$/, "");
  const text = readFileSync(join(documentsTxt, name), "utf8");
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");

  const rows = readJsonl(join(STORE, extraction, "documents", `${stem}.jsonl`));
  const header = rows[0]?.unit === "header" ? rows[0] : null;
  if (!header) throw new Error(`${stem}: the annotation file does not open with a header row`);
  if (header.text?.sha256 !== sha256)
    throw new Error(
      `${stem}: the annotation file indexes a different text than corpus/documents_txt holds`
    );

  // Rows travel as the store wrote them. Every quotation is {start, end, quote},
  // already checked against this text by the store's own build, so there is
  // nothing to resolve here and nothing to normalise.
  const units = (unit) => rows.filter((row) => row.unit === unit);

  const bundle = {
    schema: SCHEMA,
    built: new Date().toISOString(),
    store: { commit, extraction },
    document: { id: name, stem, ...readableName(stem), sha256, length: text.length },
    text,
    extraction: {
      dataset: header.dataset,
      citations: units("citation"),
      noncase_citations: units("noncase_citation"),
      nonconforming_citations: units("nonconforming_citation")
    }
  };

  const path = join(OUT, `${stem}.json`);
  const json = JSON.stringify(bundle);
  writeFileSync(path, json);
  console.log(
    `${path}  ${Math.round(json.length / 1024)} KB  ` +
      `${bundle.extraction.citations.length} citations ` +
      `(${bundle.extraction.citations.filter((row) => row.is_root).length} roots), ` +
      `${bundle.extraction.noncase_citations.length} non-case, ` +
      `${bundle.extraction.nonconforming_citations.length} nonconforming`
  );
}
console.log(`\n${names.length} bundle(s) from ${extraction}, store ${commit}`);
