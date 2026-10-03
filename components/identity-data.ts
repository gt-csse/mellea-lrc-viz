import type { CitationView, JsonObject, JsonValue } from "../lib/document.ts";
import { getCitationAtNode, getField, getLatestRecord } from "../lib/document.ts";
import { at, formatValue, index, label, nodePosition, object, objects, string } from "./judgment-values.ts";

export type IdentityReview = { record: JsonObject; decision: JsonObject | null; title: string; source: "lookup" | "body"; key: string };
export type IdentitySelection = { record: JsonObject; title: string; provider: string; candidate: number | null; fields: JsonObject; review?: JsonObject; body?: boolean };
export type FieldAssessment = { record: JsonObject; assessment: JsonObject; source: string; comparisonValues: JsonObject | null; filingValues: JsonObject | null };

export const identityReviewKeys = [
  ["reporter_unique_review", "Reporter lookup review", "lookup"],
  ["reporter_ambiguous_review", "Reporter candidate review", "lookup"],
  ["docket_lookup_review", "Docket lookup review", "lookup"],
  ["govinfo_docket_review", "GovInfo docket review", "lookup"],
  ["body_reviews", "Third-party body review", "body"],
] as const;

function reviewsFor(citation: CitationView): IdentityReview[] {
  return identityReviewKeys.flatMap(([key, title, source]) => {
    const value = citation.raw[key];
    const records = Array.isArray(value) ? objects(value) : object(value) ? [object(value)!] : [];
    return records.map(record => ({ record, decision: object(record.decision), title, source, key }));
  }).sort((left, right) => nodePosition(citation, left.record) - nodePosition(citation, right.record));
}

function clusterFields(citation: CitationView, record: JsonObject, selected: number): JsonObject {
  const lookup = getLatestRecord(citation, "reporter_exact_lookup");
  const docket = objects(citation.raw.reporter_exact_candidate_dockets).find(item => item.candidate_index === selected)
    ?? (lookup?.outcome === "unique" ? getLatestRecord(citation, "reporter_exact_docket") : null);
  const court = object(docket?.response);
  return { ...object(record.raw_json), ...record, ...(court ? { court: court.court_id ?? court.court } : {}) };
}

function selectedLookup(citation: CitationView, key: string, review: JsonObject | null): IdentitySelection | null {
  if (key === "docket_lookup_review" || key === "govinfo_docket_review") {
    const selected = index(object(review?.decision)?.selected_candidate_index);
    if (selected === null) return null;
    const lookup = getLatestRecord(citation, key === "docket_lookup_review" ? "docket_lookup" : "govinfo_docket_lookup");
    const candidate = at(lookup?.candidates, selected);
    const attempt = at(lookup?.attempts, index(candidate?.attempt_index));
    const page = at(attempt?.pages, index(candidate?.page_index));
    const record = at(page?.results, index(candidate?.result_index));
    return record ? { record, title: "Selected retrieved record", provider: key === "govinfo_docket_review" ? "GovInfo" : "CourtListener", candidate: selected, fields: { ...record, ...candidate }, review: review ?? undefined } : null;
  }
  const lookup = getLatestRecord(citation, "reporter_exact_lookup");
  const clusters = objects(object(lookup?.response)?.clusters);
  const resolution = getLatestRecord(citation, "reporter_exact_ambiguity_resolution");
  const selected = key === "reporter_ambiguous_review" ? index(object(review?.decision)?.selected_candidate_index)
    : lookup?.outcome === "unique" && clusters.length === 1 ? 0
      : resolution ? index(resolution.selected_candidate_index) : null;
  const record = selected !== null ? clusters[selected] : null;
  return record && selected !== null ? { record, title: "Selected retrieved record", provider: "CourtListener", candidate: selected, fields: clusterFields(citation, record, selected), review: review ?? undefined } : null;
}

function bodySelection(citation: CitationView, review: IdentityReview): IdentitySelection | null {
  const decision = review.decision;
  if (!decision || !string(decision.source)) return null;
  const search = objects(citation.raw.body_searches).find(item => item.source === decision.source);
  const record = at(search?.evidence, index(decision.evidence_index));
  return record ? { record, title: "Selected third-party citation", provider: label(string(decision.source)!), candidate: index(decision.evidence_index), fields: object(decision.third_party) ?? {}, review: review.record, body: true } : null;
}

function lookupSelection(citation: CitationView, reviews: IdentityReview[]): IdentitySelection | null {
  for (const review of [...reviews].reverse()) {
    if (review.source !== "lookup") continue;
    const selected = selectedLookup(citation, review.key, review.record);
    // A retained reporter review has an explicit candidate decision, including none.
    if (selected || review.key.startsWith("reporter_")) return selected;
  }
  return selectedLookup(citation, "reporter_exact_lookup", null);
}

/** The final verdict's evidence is bounded to its owning node, independently of later edits. */
export function getIdentityData(authority: CitationView) {
  const judgment = getLatestRecord(authority, "identity_judgments");
  const judgmentNode = string(judgment?.node_id);
  const checkpoint = judgmentNode && authority.nodes.some(node => node.id === judgmentNode)
    ? getCitationAtNode(authority, judgmentNode) : authority;
  const reviews = reviewsFor(checkpoint);
  const latestReview = reviews.at(-1) ?? null;
  const bodyReview = [...reviews].reverse().find(review => review.source === "body" && string(review.decision?.source));
  const selection = judgment?.basis === "third_party" ? (bodyReview ? bodySelection(checkpoint, bodyReview) : null)
    : !judgment && bodyReview && latestReview === bodyReview ? bodySelection(checkpoint, bodyReview)
      : lookupSelection(checkpoint, reviews);
  return { judgment, checkpoint, reviews, latestReview, selection, rationale: string(latestReview?.decision?.reason) ?? string(latestReview?.record.failure_reason) };
}

export function externalValue(fields: JsonObject | null, key: string): JsonValue | undefined {
  if (!fields) return undefined;
  const aliases: Record<string, string[]> = {
    case_name: ["case_name", "caseName", "case_name_full", "caseNameFull", "title"],
    court: ["court_id", "courtId", "court", "court_code", "courtCode"],
    date: ["date", "date_filed", "dateFiled", "dateIssued", "issued_on"],
    docket_number: ["docket_number", "docketNumber", "caseNumber", "case_number", "locator"],
  };
  return (aliases[key] ?? [key]).map(alias => fields[alias]).find(value => value !== null && value !== undefined);
}

export function assessmentFor(citation: CitationView, reviews: IdentityReview[], key: string, selection: IdentitySelection | null): FieldAssessment | null {
  const direct = objects(citation.raw[`${key}_judgments`]).filter(record => !selection || selection.body || selection.candidate === null || record.candidate_index === selection.candidate);
  const assessed: FieldAssessment[] = reviews.flatMap(review => {
    const comparisons = review.source === "body" ? object(review.decision?.comparisons) : review.decision;
    const assessment = object(comparisons?.[review.source === "body" && key === "docket_number" ? "locator" : key]);
    if (!assessment) return [];
    const atReview = citation.nodes.some(node => node.id === review.record.node_id) ? getCitationAtNode(citation, String(review.record.node_id)) : citation;
    return [{ record: review.record, assessment, source: review.title,
      comparisonValues: review.source === "body" ? object(review.decision?.third_party) : selectedLookup(atReview, review.key, review.record)?.fields ?? null,
      filingValues: review.source === "body" ? object(review.decision?.filing) : null }];
  });
  const exact: FieldAssessment[] = direct.map(record => {
    const candidate = index(record.candidate_index);
    const cluster = at(object(getLatestRecord(citation, "reporter_exact_lookup")?.response)?.clusters, candidate);
    return { record, assessment: record, source: `Exact lookup comparison · candidate ${formatValue(record.candidate_index)}`, comparisonValues: cluster && candidate !== null ? clusterFields(citation, cluster, candidate) : null, filingValues: null };
  });
  return [...exact, ...assessed].sort((left, right) => nodePosition(citation, left.record) - nodePosition(citation, right.record)).at(-1) ?? null;
}

/** Direct indexes are absolute history references; reviews use that node's filing reread. */
export function fieldReading(citation: CitationView, key: string, assessed: FieldAssessment | null): JsonObject | null {
  const fieldKey = key === "docket_number" ? "locator" : key;
  if (assessed?.assessment.reading_index === null) return null;
  const readingIndex = index(assessed?.assessment.reading_index);
  if (readingIndex !== null) return at(citation.raw[fieldKey], readingIndex);
  const nodeId = string(assessed?.record.node_id);
  const atReview = nodeId && citation.nodes.some(node => node.id === nodeId) ? getCitationAtNode(citation, nodeId) : citation;
  return getField(atReview, fieldKey);
}
