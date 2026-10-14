import { parseDocument, type DocumentView } from "./document.ts";

export const RUN_SCHEMA = "mellea-lrc/native-run/v1";
export const PRIMARY_RUN_INDEX = "/runs/primary/index.json";
export const WORKFLOWS = ["grow_roots", "validate_roots_citation_identity", "grow_leaves", "validate_all_citation_content"] as const;

export interface RunDocument {
  id: string;
  filename: string;
  title: string;
  url: string;
  sha256: string;
  bytes: number;
  compressedBytes: number;
  citations: number;
  roots: number;
  stages: number;
  substages: number;
}

export interface NativeRun {
  schema: typeof RUN_SCHEMA;
  runId: string;
  set: string;
  documents: RunDocument[];
  reports: Array<{ workflow: string; markdown: string; json: string }>;
}

function assetUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/runs/") && !value.includes("..") && !value.includes("\\") && !value.includes("?") && !value.includes("#");
}

/** A small static index; documents are fetched only when selected. */
export function parseNativeRun(value: unknown): NativeRun {
  if (!value || typeof value !== "object") throw new Error("The built-in run index is not an object.");
  const run = value as NativeRun;
  if (run.schema !== RUN_SCHEMA || typeof run.runId !== "string" || !run.runId || typeof run.set !== "string") throw new Error("Invalid built-in run index.");
  if (!Array.isArray(run.documents) || !run.documents.length) throw new Error("The built-in run has no documents.");
  for (const document of run.documents) {
    if (!document || typeof document.id !== "string" || typeof document.filename !== "string" || typeof document.title !== "string" || !assetUrl(document.url) || !document.url.endsWith(".json.gz") || !/^[a-f0-9]{64}$/.test(document.sha256)) throw new Error("Invalid built-in document entry.");
    for (const key of ["bytes", "compressedBytes", "citations", "roots", "stages", "substages"] as const) {
      if (!Number.isSafeInteger(document[key]) || document[key] < 0) throw new Error(`Invalid built-in document ${key}.`);
    }
  }
  if (new Set(run.documents.map(document => document.id)).size !== run.documents.length) throw new Error("Duplicate built-in document id.");
  if (!Array.isArray(run.reports) || run.reports.length !== WORKFLOWS.length || WORKFLOWS.some(workflow => run.reports.filter(report => report.workflow === workflow).length !== 1) || run.reports.some(report => !assetUrl(report.markdown) || !assetUrl(report.json))) throw new Error("The built-in run needs its four workflow reports.");
  return run;
}

/** Uncompress the original bytes and verify them before native projection. */
export async function decodeRunDocument(compressed: Uint8Array, entry: RunDocument): Promise<DocumentView> {
  if (compressed.byteLength !== entry.compressedBytes) throw new Error("The built-in document download is incomplete.");
  const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  if (bytes.byteLength !== entry.bytes) throw new Error("The built-in document has an unexpected length.");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== entry.sha256) throw new Error("The built-in document does not match its saved hash.");
  return parseDocument(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function fetchRunDocument(entry: RunDocument, signal?: AbortSignal): Promise<DocumentView> {
  const response = await fetch(entry.url, { signal });
  if (!response.ok) throw new Error(`Unable to load document ${entry.id} (HTTP ${response.status}).`);
  return decodeRunDocument(new Uint8Array(await response.arrayBuffer()), entry);
}
