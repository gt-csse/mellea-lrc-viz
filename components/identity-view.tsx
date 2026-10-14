"use client";

import type { CitationView, DocumentView, JsonObject } from "../lib/document";
import { citationLabel, getField, getLatestRecord, getRootId, locatorLabel } from "../lib/document";
import { RawDialog, StatusBadge } from "./primitives";
import { formatValue, GroundedQuote, label, nodeLabel, object, objects, recordUrl, SourceLink, string } from "./judgment-utils";
import { assessmentFor, externalValue, fieldReading, getIdentityData, identityReviewKeys } from "./identity-data";

type Props = { citation: CitationView; root: CitationView | null; document: DocumentView };
export function IdentityView({ citation, root, document }: Props) {
  const rootId = getRootId(citation);
  const authority = root ?? (rootId === citation.id ? citation : null);
  const inherited = !!authority && authority.id !== citation.id;
  const identity = authority ? getIdentityData(authority) : null;
  const judgment = identity?.judgment ?? null;
  const checkpoint = identity?.checkpoint ?? authority;
  const relevantReviews = identity?.reviews ?? [];
  const latestReview = identity?.latestReview ?? null;
  const selection = identity?.selection ?? null;
  const rationale = identity?.rationale ?? null;
  const verdict = string(judgment?.verdict);
  const fields = ["case_name", "court", "date", ...(authority?.kind === "docket" || string(object(getField(authority ?? citation, "locator")?.normalized)?.docket_number) ? ["docket_number"] : [])];
  const intendedReview = authority ? getLatestRecord(authority, "intended_case_reviews") : null;
  const intended = object(intendedReview?.decision);
  const lookupRecords = authority ? Object.fromEntries(["reporter_exact_lookup", "reporter_exact_docket", "reporter_exact_candidate_dockets", "reporter_exact_ambiguity_resolution", "docket_lookup", "govinfo_docket_lookup", "body_searches", "field_body_searches"].filter(key => authority.raw[key] !== undefined).map(key => [key, authority.raw[key]])) as JsonObject : {};

  return <div className="judgement-view identity-view">
    <section className="result-banner">
      <div>
        <p className="result-banner__eyebrow">Authority identity · {inherited ? "inherited from root" : "root result"}</p>
        <h2 className="result-banner__title">{authority ? citationLabel(authority) : "No resolved root"}</h2>
        <p className="result-banner__meta">{authority ? `${authority.id} · ${locatorLabel(authority)}` : rootId === "__withdrawn__" ? "This occurrence has been withdrawn from a real root." : rootId ? `Root ${rootId} is absent from this document.` : "This occurrence has no root assignment at this checkpoint."}</p>
      </div>
      <div className="panel-actions"><StatusBadge value={verdict} />{judgment && <RawDialog title="Saved identity judgment" value={judgment} triggerLabel="Judgment details" />}</div>
    </section>
    {inherited && <p className="inherited-note">Identity belongs to root {authority!.id}. This occurrence uses its saved identity judgment.</p>}
    {!judgment && <div className="empty-state"><h3>No identity judgment recorded</h3><p>{authority ? "The root has no saved final identity verdict at this checkpoint. Retrieval results and field comparisons below are evidence for review." : "Resolve or select a root to inspect the authority’s identity evidence."}</p></div>}

    {authority && <>

      <section className="panel">
        <header className="panel-header"><div><h3 className="panel-title">Root field comparisons</h3><p className="panel-subtitle">Filing readings used by the recorded comparisons</p></div><RawDialog title="Root fields and all comparison histories" value={Object.fromEntries([...fields, "locator", "case_name_judgments", "court_judgments", "date_judgments", ...identityReviewKeys.map(([key]) => key)].filter(key => authority.raw[key] !== undefined).map(key => [key, authority.raw[key]])) as JsonObject} triggerLabel="All field records" /></header>
        <div className="table-scroll"><table className="compact-table identity-table"><thead><tr><th scope="col">Field</th><th scope="col">Filing reading</th><th scope="col">Compared record</th><th scope="col">Assessment</th></tr></thead><tbody>
          {fields.map(key => {
            const assessed = assessmentFor(checkpoint!, relevantReviews, key, selection);
            const reading = fieldReading(checkpoint!, key, assessed);
            const external = externalValue(assessed ? assessed.comparisonValues : selection?.fields ?? null, key);
            const quote = string(assessed?.filingValues?.[key === "docket_number" ? "locator" : key]) ?? string(reading?.quote);
            const normalized = reading?.normalized;
            const normalizedText = normalized === undefined || normalized === null ? null : formatValue(normalized);
            const inferred = key === "court" && reading?.quote === null && authority.kind === "reporter" && normalized !== null && normalized !== undefined;
            const reason = string(assessed?.assessment.reason);
            return <tr key={key}><th scope="row">{key === "docket_number" ? "Docket" : label(key)}</th><td><div className="field-reading">{quote ?? (inferred ? "Inferred from reporter" : reading ? "Saved normalized reading" : "Not read")}</div>{normalizedText && normalizedText.trim() !== quote?.trim() && <div className="field-normalized">{normalizedText}</div>}{string(reading?.normalization_error) && <p className="detail-note">{string(reading?.normalization_error)}</p>}</td><td>{external === undefined ? <span className="detail-note">No saved value</span> : formatValue(external)}</td><td><StatusBadge value={string(assessed?.assessment.result)} />{reason && <p className="detail-note">{reason}</p>}{assessed && <div className="detail-note">{assessed.source}<RawDialog title={`${label(key)} assessment`} value={assessed.record} triggerLabel="Details" /></div>}</td></tr>;
          })}
        </tbody></table></div>
      </section>

      <section className="panel">
        <header className="panel-header"><div><h3 className="panel-title">Identity rationale</h3><p className="panel-subtitle">{latestReview ? `${latestReview.title} · ${nodeLabel(authority, latestReview.record) ?? "saved review"}` : judgment ? nodeLabel(authority, judgment) ?? "Saved judgment" : "No review saved"}{string(judgment?.basis) ? ` · ${label(string(judgment?.basis)!)}` : ""}</p></div>{latestReview && <RawDialog title={latestReview.title} value={latestReview.record} triggerLabel="Review & attempts" />}</header>
        <p className="rationale">{rationale ?? (judgment ? "The saved identity judgment does not include a prose rationale. Its supporting records remain available below." : "No identity review rationale is available at this checkpoint.")}</p>
      </section>

      <section className="panel">
        <header className="panel-header"><div><h3 className="panel-title">Retrieved identity evidence</h3><p className="panel-subtitle">{selection ? selection.provider : "Saved provider results"}</p></div><RawDialog title="Complete identity retrieval records" value={lookupRecords} triggerLabel="All retrieval records" /></header>
        {selection ? <article className="evidence-card">
          <header className="evidence-header"><div><h4>{selection.title}</h4><p className="detail-note">{selection.body ? `Body ${formatValue(selection.record.body_id)}` : `Record ${formatValue(selection.record.id ?? selection.record.package_id ?? selection.record.packageId ?? selection.record.granule_id ?? selection.record.granuleId)}`}{selection.candidate !== null ? ` · saved index ${selection.candidate}` : ""}</p></div><div className="panel-actions"><SourceLink url={recordUrl(selection.record, selection.provider.startsWith("CourtListener") ? "https://www.courtlistener.com" : undefined)} /><RawDialog title="Selected retrieved identity record" value={selection.record} triggerLabel="Record details" /></div></header>
          {selection.body && string(selection.record.excerpt) ? <><GroundedQuote quote={string(selection.review?.grounded_quote) ?? string(object(selection.review?.decision)?.citation_quote) ?? string(selection.record.excerpt)!} source={string(selection.record.excerpt)} span={selection.review?.quote_span} /><p className="detail-note">{string(object(selection.review?.decision)?.treatment) ? label(string(object(selection.review?.decision)?.treatment)!) : "Saved independent citation"}{string(selection.record.issued_on) ? ` · issued ${string(selection.record.issued_on)}` : ""}</p></> : <dl className="metadata-list"><div><dt>Case</dt><dd>{formatValue(externalValue(selection.fields, "case_name"))}</dd></div><div><dt>Court</dt><dd>{formatValue(externalValue(selection.fields, "court"))}</dd></div><div><dt>Date</dt><dd>{formatValue(externalValue(selection.fields, "date"))}</dd></div><div><dt>Citations / docket</dt><dd>{formatValue(selection.record.citations ?? externalValue(selection.fields, "docket_number"))}</dd></div></dl>}
        </article> : <div className="empty-state"><h4>No selected retrieved record</h4><p>No saved review or exact lookup identifies a selected record at this checkpoint. Complete search responses, failures, and unselected candidates are available in the retrieval details.</p></div>}
      </section>

      {intendedReview && <section className="panel"><header className="panel-header"><div><h3 className="panel-title">Possible intended case</h3><p className="panel-subtitle">A separate suggestion from the written locator’s identity judgment</p></div><RawDialog title="Intended case review and attempts" value={intendedReview} triggerLabel="Suggestion details" /></header><p className="rationale">{string(intended?.reason) ?? string(intendedReview.failure_reason) ?? "No accepted intended-case decision."}</p>{string(intended?.case_name) && <p>{string(intended?.case_name)}{string(intended?.locator) ? ` · ${string(intended?.locator)}` : ""}</p>}{string(intendedReview.grounded_quote) && <blockquote className="evidence-quote">{string(intendedReview.grounded_quote)}</blockquote>}</section>}

      {objects(authority.raw.identity_judgments).length > 1 && <section className="panel"><header className="panel-header"><div><h3 className="panel-title">Identity history</h3><p className="panel-subtitle">Earlier recorded verdicts remain available</p></div><RawDialog title="All saved identity judgments" value={authority.raw.identity_judgments ?? []} triggerLabel="Full history" /></header><div className="evidence-stack">{objects(authority.raw.identity_judgments).map((record, position) => <div className="evidence-header" key={`${string(record.node_id)}-${position}`}><span>{nodeLabel(authority, record)}</span><StatusBadge value={string(record.verdict)} /></div>)}</div></section>}
      <div className="raw-actions"><RawDialog title={`Complete root ${authority.id}`} value={authority.raw} triggerLabel="Complete root JSON" />{inherited && <RawDialog title={`Occurrence ${citation.id}`} value={citation.raw} triggerLabel="Occurrence JSON" />}</div>
    </>}
  </div>;
}
