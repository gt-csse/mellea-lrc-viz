// Builds the dataset viewer bundle from the annotation store.
//
// The store is normalised for annotation: rows in one place, text in another,
// orders in a third. A browser with no server cannot chase that, so this reads
// it once and writes a single self-contained file the viewer loads.
//
//   node scripts/build-bundle.mjs [--store data] [--out public/dataset-bundle.json]
//
// Every quote that comes from a text the store holds is resolved to a span here,
// at build time, so the viewer highlights rather than searches. A quote that
// cannot be placed is marked, not dropped.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";

const BUNDLE_SCHEMA = "mellea-lrc/dataset-viewer-bundle/v1";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const STORE = option("store", "data");
const OUT = option("out", "public/dataset-bundle.json");

/* ---------- text matching -------------------------------------------------- */

// Collapse whitespace and unify the characters a converter and a typist disagree
// about, keeping a map back to the original offsets. Matching happens on the
// normalised text; what gets written is the original slice, damage included.
function normaliseWithMap(text) {
  const out = [];
  const map = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (/\s/.test(char)) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
      out.push(" ");
      map.push(i);
      continue;
    }
    lastWasSpace = false;
    let mapped = char;
    if (char === "‘" || char === "’") mapped = "'";
    else if (char === "“" || char === "”") mapped = '"';
    else if (char === "–" || char === "—") mapped = "-";
    out.push(mapped.toLowerCase());
    map.push(i);
  }
  return { text: out.join(""), map };
}

const normalisedCache = new Map();
function normalised(textId, text) {
  if (!normalisedCache.has(textId)) normalisedCache.set(textId, normaliseWithMap(text));
  return normalisedCache.get(textId);
}

// Returns the span of `quote` in the text, or null. Reports ambiguity rather
// than hiding it: a quote that occurs twice is a quote the annotation does not
// pin down.
function locate(quote, textId, text) {
  if (!quote || !quote.trim()) return null;
  const hay = normalised(textId, text);
  const needle = normaliseWithMap(quote).text.trim();
  if (needle.length < 8) return null;
  const at = hay.text.indexOf(needle);
  if (at < 0) return null;
  const again = hay.text.indexOf(needle, at + 1);
  const start = hay.map[at];
  const end = hay.map[at + needle.length - 1] + 1;
  return { text: textId, start, end, ambiguous: again >= 0 };
}

/* ---------- reading the store ---------------------------------------------- */

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readJsonl = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

const versionOf = (name) => {
  const match = /-v(\d+)\.(\d+)$/.exec(name);
  return match ? Number(match[1]) * 1000 + Number(match[2]) : -1;
};

// The store is mid-migration: extraction is per-document files under v3.0 while
// validation is still one flat file. Take the highest version of each, whichever
// layout it is in.
function readDataset(kind) {
  const dirs = readdirSync(STORE)
    .filter((name) => name.startsWith(`${kind}-v`) && statSync(join(STORE, name)).isDirectory())
    .sort((a, b) => versionOf(b) - versionOf(a));
  for (const dir of dirs) {
    const here = join(STORE, dir);
    const perDocument = join(here, "documents");
    if (existsSync(perDocument)) {
      const rows = readdirSync(perDocument)
        .filter((name) => name.endsWith(".jsonl"))
        .flatMap((name) => readJsonl(join(perDocument, name)));
      if (rows.length) return { version: dir, rows, layout: "documents/" };
    }
    const inside = join(here, `${dir}.jsonl`);
    if (existsSync(inside)) return { version: dir, rows: readJsonl(inside), layout: "one file" };
    const beside = join(STORE, `${dir}.jsonl`);
    if (existsSync(beside)) return { version: dir, rows: readJsonl(beside), layout: "one file beside" };
  }
  throw new Error(`no ${kind} dataset found under ${STORE}`);
}

/* ---------- normalising rows for the viewer -------------------------------- */

// v2.1 writes `reason` and `comment`; v3.0 writes `basis` and `note`. The viewer
// should not have to know which store it was handed.
const basisOf = (row) => row.basis ?? row.reason ?? null;
const noteOf = (row) => row.note ?? row.comment ?? null;

const CLUSTER = /^cluster\s+(\d+)$/i;
const DOCKET = /^docket\s+(\d+)$/i;

function parseSource(raw) {
  if (raw && typeof raw === "object") return raw;
  if (!raw) return { kind: "unknown" };
  const text = String(raw).trim();
  if (/^https?:\/\//.test(text)) return { kind: "web", external_url: text };
  const cluster = CLUSTER.exec(text);
  if (cluster)
    return {
      kind: "cluster",
      id: cluster[1],
      external_url: `https://www.courtlistener.com/opinion/${cluster[1]}/`
    };
  const docket = DOCKET.exec(text);
  if (docket)
    return {
      kind: "docket",
      id: docket[1],
      external_url: `https://www.courtlistener.com/docket/${docket[1]}/`
    };
  if (/^the filing/i.test(text)) return { kind: "filing", label: text };
  if (/cited page|opinion/i.test(text)) return { kind: "opinion", label: text };
  if (/run$/i.test(text)) return { kind: "run", label: text };
  return { kind: "other", label: text };
}

// Two evidence shapes exist today: {shows, source, quote} and the court-sourced
// {label, proposition, ruling_evidence}. Both become one shape here.
function normaliseEvidence(item, context) {
  const courtShaped = item.ruling_evidence !== undefined;
  const quote = courtShaped ? item.ruling_evidence : item.quote;
  const shows = courtShaped ? "court_finding" : item.shows ?? null;
  const source = courtShaped ? { kind: "ruling" } : parseSource(item.source);
  const evidence = {
    shows,
    source,
    quote: quote ?? null,
    proposition: item.proposition ?? null,
    span: null,
    locatable: false
  };

  // Resolve against a text the store actually holds.
  if (quote) {
    if (source.kind === "filing") {
      const span = locate(quote, context.documentTextId, context.documentText);
      if (span) Object.assign(evidence, { span, locatable: true });
    } else if (source.kind === "ruling") {
      for (const ruling of context.rulings) {
        const span = locate(quote, ruling.text_id, ruling.text);
        if (span) {
          Object.assign(evidence, { span, locatable: true });
          evidence.source = {
            kind: "ruling",
            id: ruling.ruling_id,
            external_url: ruling.courtlistener_url ?? null
          };
          break;
        }
      }
    }
    if (!evidence.locatable && source.kind !== "filing" && source.kind !== "ruling") {
      // Outside the store by nature: an opinion page, an archive record, a URL.
      evidence.outside_store = true;
    }
  }
  return evidence;
}

function normaliseAnnotation(row, context) {
  const evidence = (row.evidence ?? []).map((item) => normaliseEvidence(item, context));
  return {
    unit: row.unit,
    id: row.id,
    root_id: row.root_id ?? null,
    occurrence_id: row.occurrence_id ?? null,
    span: row.span ?? null,
    matched_text: row.matched_text ?? null,
    identifier: row.identifier ?? null,
    case_name_as_written: row.case_name_as_written ?? null,
    kind: row.kind ?? null,
    role: row.role ?? null,
    scope: row.scope ?? null,
    pin_cite: row.pin_cite ?? row.pin_cite_written ?? null,
    records_at_locator: row.records_at_locator ?? null,
    authority: row.authority ?? null,
    label: row.label ?? null,
    subclasses: row.subclasses ?? [],
    source: row.source ?? null,
    basis: basisOf(row),
    note: noteOf(row),
    evidence
  };
}

/* ---------- build ----------------------------------------------------------- */

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

function storeCommit() {
  try {
    return execFileSync("git", ["-C", STORE, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8"
    }).trim();
  } catch {
    return null;
  }
}

function readableName(stem) {
  const [number, caseSlug = "", docSlug = ""] = stem.split("__");
  const words = (slug) => slug.replace(/-+/g, " ").replace(/\s+/g, " ").trim();
  return { number, case_name: words(caseSlug), document_kind: words(docSlug) };
}

const corpusDir = join(STORE, "corpus");
const documentsTxt = join(corpusDir, "documents_txt");
const corpusMeta = existsSync(join(corpusDir, "documents.json"))
  ? readJson(join(corpusDir, "documents.json")).documents ?? {}
  : {};

const extraction = readDataset("extraction");
const validation = readDataset("validation");

const texts = {};

// Rulings first: evidence resolution needs their text.
const rulingIndex = readJson(join(STORE, "rulings", "rulings.json")).rulings ?? [];
const rulings = rulingIndex.map((ruling) => {
  const path = join(STORE, "rulings", ruling.text ?? `rulings_txt/${ruling.ruling_id}.txt`);
  const text = readFileSync(path, "utf8");
  const text_id = `ruling:${ruling.ruling_id}`;
  texts[text_id] = text;
  return { ...ruling, text_id, text, sha256: sha256(text), length: text.length };
});

const rulingsFor = (documentName) =>
  rulings.filter((ruling) => (ruling.filings ?? []).includes(documentName));

const byDocument = new Map();
const documentNames = readdirSync(documentsTxt)
  .filter((name) => name.endsWith(".txt"))
  .sort();

for (const name of documentNames) {
  const text = readFileSync(join(documentsTxt, name), "utf8");
  const text_id = `document:${name}`;
  texts[text_id] = text;
  byDocument.set(name, {
    id: name,
    stem: name.replace(/\.txt$/, ""),
    ...readableName(name.replace(/\.txt$/, "")),
    text_id,
    sha256: sha256(text),
    length: text.length,
    rendering: corpusMeta[name] ?? null,
    rulings: rulingsFor(name).map((ruling) => ruling.ruling_id),
    roots: [],
    occurrences: [],
    unread_names: [],
    identity: [],
    pincite: []
  });
}

const context = (documentName) => {
  const document = byDocument.get(documentName);
  return {
    documentTextId: document.text_id,
    documentText: texts[document.text_id],
    rulings: rulingsFor(documentName)
  };
};

for (const row of extraction.rows) {
  if (row.unit === "header" || !byDocument.has(row.document)) continue;
  const document = byDocument.get(row.document);
  if (row.unit === "root") {
    document.roots.push({
      id: row.id,
      identifier: row.identifier,
      case_name_as_written: row.case_name_as_written,
      stated_at: row.stated_at,
      colocation_id: row.colocation_id ?? null,
      note: noteOf(row)
    });
  } else if (row.unit === "occurrence") {
    document.occurrences.push({
      id: row.id,
      root_id: row.root_id,
      kind: row.kind,
      role: row.role,
      span: row.span,
      locator_span: row.locator_span,
      matched_text: row.matched_text,
      pin_cite_written: row.pin_cite_written,
      scope: row.scope,
      reason: row.reason ?? null,
      note: noteOf(row),
      in_table_of_authorities: row.in_table_of_authorities ?? null
    });
  } else if (row.unit === "unread_name") {
    const quote = row.quote ?? null;
    const span = quote ? locate(quote, document.text_id, texts[document.text_id]) : null;
    document.unread_names.push({
      id: row.id,
      span: row.span,
      text: row.text,
      signal: row.signal,
      signal_span: row.signal_span,
      label: row.label,
      citation_as_written: row.citation_as_written,
      note: noteOf(row),
      context: quote ? { quote, span, locatable: Boolean(span) } : null
    });
  }
}

for (const row of validation.rows) {
  if (row.unit === "header" || !byDocument.has(row.document)) continue;
  const document = byDocument.get(row.document);
  const annotation = normaliseAnnotation(row, context(row.document));
  if (row.unit === "identity") document.identity.push(annotation);
  else if (row.unit === "pincite") document.pincite.push(annotation);
}

/* ---------- totals ---------------------------------------------------------- */

const tally = (rows, field) =>
  rows.reduce((into, row) => {
    const key = row[field] ?? "none";
    into[key] = (into[key] ?? 0) + 1;
    return into;
  }, {});

const documents = [...byDocument.values()].map((document) => ({
  ...document,
  counts: {
    roots: document.roots.length,
    occurrences: document.occurrences.length,
    unread_names: document.unread_names.length,
    identity: document.identity.length,
    pincite: document.pincite.length,
    wrong_identity: document.identity.filter((row) => row.label === "WRONG_IDENTITY").length,
    wrong_pincite: document.pincite.filter((row) => row.label === "WRONG_PINCITE").length,
    undetermined: document.pincite.filter((row) => row.label === "UNDETERMINED").length
  }
}));

const allIdentity = documents.flatMap((document) => document.identity);
const allPincite = documents.flatMap((document) => document.pincite);
const allEvidence = [...allIdentity, ...allPincite].flatMap((row) => row.evidence);

const bundle = {
  schema: BUNDLE_SCHEMA,
  built: new Date().toISOString(),
  store: {
    commit: storeCommit(),
    extraction: extraction.version,
    extraction_layout: extraction.layout,
    validation: validation.version,
    validation_layout: validation.layout,
    documents: documents.length,
    rulings: rulings.length
  },
  totals: {
    roots: documents.reduce((n, d) => n + d.counts.roots, 0),
    occurrences: documents.reduce((n, d) => n + d.counts.occurrences, 0),
    unread_names: documents.reduce((n, d) => n + d.counts.unread_names, 0),
    identity_labels: tally(allIdentity, "label"),
    pincite_labels: tally(allPincite, "label"),
    identity_sources: tally(allIdentity, "source"),
    pincite_sources: tally(allPincite, "source"),
    basis: tally([...allIdentity, ...allPincite], "basis"),
    evidence: {
      total: allEvidence.length,
      with_span: allEvidence.filter((item) => item.locatable).length,
      ambiguous: allEvidence.filter((item) => item.span?.ambiguous).length,
      outside_store: allEvidence.filter((item) => item.outside_store).length,
      unplaced: allEvidence.filter(
        (item) => !item.locatable && !item.outside_store && item.quote
      ).length
    }
  },
  texts,
  documents: documents.map(({ ...document }) => document),
  rulings: rulings.map(({ text, ...ruling }) => ruling)
};

const json = JSON.stringify(bundle);
mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
writeFileSync(OUT, json);

const megabytes = (json.length / 1024 / 1024).toFixed(2);
console.log(`${OUT}  ${megabytes} MB`);
console.log(`  ${bundle.store.extraction} (${extraction.layout}), ${bundle.store.validation} (${validation.layout}), store ${bundle.store.commit}`);
console.log(`  ${bundle.totals.roots} roots, ${bundle.totals.occurrences} occurrences, ${allIdentity.length} identity, ${allPincite.length} pincite`);
console.log(
  `  evidence ${bundle.totals.evidence.total}: ${bundle.totals.evidence.with_span} placed, ` +
    `${bundle.totals.evidence.outside_store} outside the store, ${bundle.totals.evidence.unplaced} unplaced, ` +
    `${bundle.totals.evidence.ambiguous} ambiguous`
);
