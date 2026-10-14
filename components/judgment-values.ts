import type { CitationView, JsonObject, JsonValue } from "../lib/document.ts";
import { caseNameLabel, displayValue } from "../lib/document.ts";

export function object(value: JsonValue | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function objects(value: JsonValue | undefined): JsonObject[] {
  return Array.isArray(value) ? value.flatMap(item => object(item) ? [item as JsonObject] : []) : [];
}

export function string(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function index(value: JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, letter => letter.toUpperCase());
}

export function at(value: JsonValue | undefined, position: number | null): JsonObject | null {
  return position !== null && Array.isArray(value) ? object(value[position]) : null;
}

export function nodePosition(citation: CitationView, record: JsonObject): number {
  return citation.nodes.findIndex(node => node.id === record.node_id);
}

export function nodeLabel(citation: CitationView, record: JsonObject | null): string | null {
  if (!record) return null;
  const node = citation.nodes.find(item => item.id === record.node_id);
  return node ? label(node.substage.split(".").at(-1)!) : string(record.node_id);
}

export function targets(value: JsonValue | undefined): string {
  return objects(value).map(target => {
    const first = target.first, last = target.last;
    if (typeof first !== "number" || typeof last !== "number") return "Unrecognized saved target";
    const prefix = target.kind === "star" ? "*" : target.kind === "paragraph" ? "¶ " : "p. ";
    return `${prefix}${first}${last !== first ? `–${last}` : ""}${string(target.footnote) ? ` n. ${string(target.footnote)}` : ""}`;
  }).join(", ");
}

function reporterCitation(value: JsonObject): string | null {
  const volume = value.volume;
  const reporter = string(value.edition) ?? string(value.reporter) ?? string(object(value.reporter)?.short_name);
  if ((typeof volume !== "string" && typeof volume !== "number") || !reporter) return null;
  return [String(volume), reporter, typeof value.page === "string" || typeof value.page === "number" ? String(value.page) : null].filter(Boolean).join(" ");
}

/** Format known native types; leave unfamiliar values available without interpretation. */
export function formatValue(value: JsonValue | undefined): string {
  if (Array.isArray(value)) {
    if (!value.length) return "None recorded";
    if (value.every(item => object(item) && typeof object(item)!.first === "number" && typeof object(item)!.last === "number" && typeof object(item)!.kind === "string")) return targets(value);
    const citations = value.map(item => object(item) ? reporterCitation(object(item)!) : null);
    if (citations.every(item => item !== null)) return citations.join("; ");
    return displayValue(value);
  }
  const record = object(value);
  if (!record) return displayValue(value);
  const caseName = caseNameLabel(record);
  if (caseName) return caseName;
  if (string(record.id) && string(record.name)) return `${string(record.name)} (${string(record.id)})`;
  if (typeof record.year === "number" && Number.isInteger(record.year)) {
    const year = String(record.year).padStart(4, "0");
    if (record.month === null || record.month === undefined) return record.day === null || record.day === undefined ? year : displayValue(value);
    if (typeof record.month !== "number" || !Number.isInteger(record.month) || record.month < 1 || record.month > 12) return displayValue(value);
    const month = String(record.month).padStart(2, "0");
    if (record.day === null || record.day === undefined) return `${year}-${month}`;
    if (typeof record.day !== "number" || !Number.isInteger(record.day) || record.day < 1 || record.day > 31) return displayValue(value);
    return `${year}-${month}-${String(record.day).padStart(2, "0")}`;
  }
  if (string(record.docket_number)) return string(record.docket_number)!;
  const citation = reporterCitation(record);
  if (citation) return citation;
  if (typeof record.first === "number" && typeof record.last === "number" && typeof record.kind === "string") return targets([record]);
  if (string(record.short_name) && string(record.name)) return `${string(record.short_name)} · ${string(record.name)}`;
  return displayValue(value);
}

/** Only saved HTTP(S) URLs become links. Provider-relative paths need an explicit base. */
export function safeUrl(value: JsonValue | undefined, base?: string): string | null {
  const text = string(value);
  if (!text) return null;
  try {
    const url = base && text.startsWith("/") && !text.startsWith("//") ? new URL(text, base) : new URL(text);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function recordUrl(record: JsonObject | null, base?: string): string | null {
  if (!record) return null;
  for (const source of [record, object(record.raw_json), object(record.metadata)]) {
    for (const key of ["absolute_url", "url", "external_url", "download_url", "detailsLink", "granuleLink", "packageLink"]) {
      const url = safeUrl(source?.[key], base);
      if (url) return url;
    }
  }
  return null;
}
