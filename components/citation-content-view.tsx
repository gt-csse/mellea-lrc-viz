"use client";

import type { CitationView, DocumentView, JsonObject, JsonValue } from "../lib/document";
import { getField, getLatestRecord, getRootId, isToa, readSpan, sliceSpan } from "../lib/document";
import { RawDialog, StatusBadge } from "./primitives";
import { at, formatValue, GroundedQuote, index, label, nodeLabel, object, objects, recordUrl, SourceLink, string, targets } from "./judgment-utils";

type Props = { citation: CitationView; root: CitationView | null; document: DocumentView };

function referencedRecord(citation: CitationView, key: string, owner: JsonObject | null, reference: string) {
  return owner ? at(citation.raw[key], index(owner[reference])) : getLatestRecord(citation, key);
}

function evidenceRoot(document: DocumentView, root: CitationView | null, rootId: JsonValue | undefined): CitationView | null {
  const id = string(rootId);
  return id ? document.citations.find(citation => citation.id === id) ?? null : root;
}

function indexedOpinion(root: CitationView | null, opinionId: JsonValue | undefined): JsonObject | null {
  if (!root) return null;
  const pageIndex = getLatestRecord(root, "reporter_root_opinion_page_index");
  return objects(pageIndex?.opinions).find(opinion => opinion.opinion_id === opinionId) ?? null;
}

function opinionUrl(root: CitationView | null, opinionId: JsonValue | undefined): string | null {
  if (!root) return null;
  const retrieval = getLatestRecord(root, "reporter_root_opinion_retrieval");
  const opinion = objects(retrieval?.opinions).find(item => item.opinion_id === opinionId);
  const source = getLatestRecord(root, "reporter_root_opinion_source");
  return recordUrl(object(opinion?.response), "https://www.courtlistener.com")
    ?? recordUrl(object(source?.cluster), "https://www.courtlistener.com");
}

function pageAssessment(record: JsonObject | null) {
  const available = record?.pagination_available;
  const correct = record?.correct_page;
  return {
    pagination: available === true ? "Available" : available === false ? "Unavailable" : "Not recorded",
    placement: correct === true ? "Correct page" : correct === false ? "Wrong page" : "Undetermined",
    status: correct === true ? "correct" : correct === false ? "incorrect" : "undetermined",
    found: targets(record?.found_pages),
  };
}

function OpinionEvidence({ evidence, root, document, position }: { evidence: JsonObject; root: CitationView | null; document: DocumentView; position: number }) {
  const sourceRoot = evidenceRoot(document, root, evidence.root_id);
  const opinion = indexedOpinion(sourceRoot, evidence.opinion_id);
  const quote = string(evidence.quote);
  const source = string(opinion?.text);
  const span = readSpan(evidence.span);
  const grounded = !!(quote && source && span && span.end <= Array.from(source).length && sliceSpan(source, span) === quote);
  const pages = objects(opinion?.pages).filter(page => {
    const pageSpan = readSpan(page.span);
    return span && pageSpan && span.start < pageSpan.end && pageSpan.start < span.end;
  });
  return <article className="evidence-card">
    <header className="evidence-header"><div><h4>Opinion {formatValue(evidence.opinion_id)}</h4><p className="detail-note">Root {formatValue(evidence.root_id)} · evidence record {position}{pages.length ? ` · ${pages.map(page => `${page.kind === "star" ? "*" : page.kind === "paragraph" ? "¶ " : "p. "}${formatValue(page.label)}${page.edition ? ` (${formatValue(page.edition)})` : ""}`).join(", ")}` : ""}</p></div><div className="panel-actions"><SourceLink url={opinionUrl(sourceRoot, evidence.opinion_id)} /><RawDialog title="Accepted opinion evidence record" value={evidence} triggerLabel="Evidence details" /></div></header>
    {quote ? <GroundedQuote quote={quote} source={source} span={evidence.span} contextLabel="Show opinion context" /> : <p className="detail-note">No quote saved in this evidence record.</p>}
    <p className="detail-note">{grounded ? "Quote matches the root’s saved indexed opinion text." : source ? "The saved quote does not match the indexed source span at this checkpoint." : "Indexed opinion text is unavailable at this checkpoint; the saved evidence quote is shown."}</p>
  </article>;
}

function PageEvidence({ reference, root, document, position }: { reference: JsonObject; root: CitationView | null; document: DocumentView; position: number }) {
  const opinion = indexedOpinion(root, reference.opinion_id);
  const page = at(opinion?.pages, index(reference.page_index));
  const span = readSpan(page?.span);
  const source = string(opinion?.text);
  const pageText = source && span ? sliceSpan(source, span) : null;
  return <details className="evidence-card page-evidence">
    <summary className="evidence-header"><span>Opinion {formatValue(reference.opinion_id)} · {page ? `${page.kind === "star" ? "*" : page.kind === "paragraph" ? "¶ " : "p. "}${formatValue(page.label)}` : `page index ${formatValue(reference.page_index)}`}</span><span className="detail-note">{reference.pagination_confirmed === true ? "Pagination confirmed" : "Pagination not confirmed"}</span></summary>
    {pageText ? <p className="evidence-quote">{Array.from(pageText).slice(0, 700).join("")}{Array.from(pageText).length > 700 ? "…" : ""}</p> : <p className="detail-note">The referenced indexed page text is absent at this checkpoint.</p>}
    <div className="raw-actions"><SourceLink url={opinionUrl(root, reference.opinion_id)} /><RawDialog title={`Cited page reference ${position}`} value={{ reference, page: page ?? null }} triggerLabel="Page & reference details" /></div>
  </details>;
}

export function CitationContentView({ citation, root, document }: Props) {
  if (isToa(citation)) return <div className="judgement-view">
    <section className="result-banner"><div><p className="result-banner__eyebrow">Citation content · this occurrence</p><h2 className="result-banner__title">Table of authorities</h2><p className="result-banner__meta">{citation.id}</p></div><StatusBadge value="skipped" /></section>
    <section className="toa-notice"><h3>Identity still applies</h3><p>This occurrence identifies an authority without making an argument. Citation content review is skipped. Its case identity remains available in the Identity tab.</p></section>
    <div className="raw-actions"><RawDialog title="Source component tags" value={citation.raw.tags ?? []} triggerLabel="TOA source tags" /><RawDialog title={`Complete occurrence ${citation.id}`} value={citation.raw} triggerLabel="Complete occurrence JSON" /></div>
  </div>;
  const judgment = getLatestRecord(citation, "reporter_pinpoint_judgments");
  const latestReview = getLatestRecord(citation, "reporter_support_reviews");
  const review = referencedRecord(citation, "reporter_support_reviews", judgment, "review_index");
  const decision = object(review?.decision);
  const evidence = referencedRecord(citation, "reporter_pinpoint_evidence", judgment ?? review, "evidence_index");
  const proposition = referencedRecord(citation, "reporter_propositions", evidence, "proposition_index");
  const propositionDecision = object(proposition?.decision);
  const resolutionOwner = evidence ?? proposition;
  const resolution = referencedRecord(citation, "reporter_page_resolutions", resolutionOwner, "resolution_index");
  const resolutionIndex = resolutionOwner ? index(resolutionOwner.resolution_index) : objects(citation.raw.reporter_page_resolutions).length - 1;
  const opinionReview = [...objects(citation.raw.reporter_opinion_reviews)].reverse().find(record => record.resolution_index === resolutionIndex) ?? null;
  const opinionDecision = object(opinionReview?.decision);
  const sourceRoot = evidenceRoot(document, root, evidence?.root_id ?? resolution?.root_id ?? getRootId(citation));
  const pageIndex = sourceRoot ? getLatestRecord(sourceRoot, "reporter_root_opinion_page_index") : null;
  const retrieval = sourceRoot ? getLatestRecord(sourceRoot, "reporter_root_opinion_retrieval") : null;
  const pin = getField(citation, "pin_cite");
  const pagination = pageAssessment(judgment ?? decision);
  const quotedEvidence = objects(decision?.evidence);
  const acceptedIndices = Array.isArray(review?.opinion_evidence_indices) ? review.opinion_evidence_indices : [];
  const accepted = acceptedIndices.flatMap((value, position) => {
    const record = at(citation.raw.reporter_opinion_evidence, index(value));
    return record ? [{ record, position: index(value)!, quotePosition: position }] : [];
  });
  const passages = objects(proposition?.passages);
  const verdict = string(judgment?.verdict);
  const rawRecords = Object.fromEntries(["pin_cite", "reporter_page_resolutions", "reporter_opinion_reviews", "reporter_propositions", "reporter_pinpoint_evidence", "reporter_support_reviews", "reporter_opinion_evidence", "reporter_pinpoint_judgments"].filter(key => citation.raw[key] !== undefined).map(key => [key, citation.raw[key]])) as JsonObject;

  return <div className="judgement-view citation-content-view">
    <section className="result-banner"><div><p className="result-banner__eyebrow">Citation content · this occurrence</p><h2 className="result-banner__title">Does the opinion support this use?</h2><p className="result-banner__meta">{citation.id} · written pinpoint: {string(pin?.quote) ?? "No pinpoint reading"}{string(review?.scope) ? ` · ${label(string(review?.scope)!)}` : ""}</p></div><div className="panel-actions"><StatusBadge value={verdict} />{judgment && <RawDialog title="Saved final citation content judgment" value={judgment} triggerLabel="Judgment details" />}</div></section>
    {!judgment && <div className="empty-state"><h3>No final citation content judgment recorded</h3><p>{citation.kind === "docket" ? "This checkpoint has no reporter support review for the docket occurrence." : "The pipeline has not saved a final citation content judgment for this occurrence at this checkpoint."}</p></div>}

    <section className="panel"><header className="panel-header"><div><h3 className="panel-title">Support and page placement</h3><p className="panel-subtitle">The recorded support verdict and page precision are separate assessments</p></div><RawDialog title="All occurrence support records" value={rawRecords} triggerLabel="All support records" /></header>
      <dl className="metadata-list support-assessment"><div><dt>Content support review</dt><dd><StatusBadge value={string(decision?.result)} />{review && <span className="detail-note">{nodeLabel(citation, review)}</span>}</dd></div><div><dt>Pagination</dt><dd>{pagination.pagination}</dd></div><div><dt>Written page placement</dt><dd><StatusBadge value={judgment || decision ? pagination.status : null} /><span className="detail-note">{judgment || decision ? pagination.placement : "No page assessment saved"}</span></dd></div><div><dt>Recovered locations</dt><dd>{pagination.found || (judgment || decision ? "No locations recorded" : "Not assessed")}</dd></div></dl>
      {(string(judgment?.reason) || string(decision?.reason)) && <details className="judgment-rationale"><summary>Judgment rationale</summary><p className="rationale">{string(judgment?.reason) ?? string(decision?.reason)}</p>{string(decision?.reason) && decision?.reason !== judgment?.reason && <details className="review-rationale"><summary>Opinion review rationale</summary><p className="rationale">{string(decision?.reason)}</p></details>}</details>}
      {string(review?.failure_reason) && <p className="rationale">{string(review?.failure_reason)}</p>}
      {judgment?.review_index !== undefined && judgment.review_index !== null && !review && <p className="detail-note">The final judgment’s referenced review is absent at this checkpoint.</p>}
      {latestReview && latestReview !== review && <div className="raw-actions"><span className="detail-note">An additional saved support review is available.</span><RawDialog title="Latest saved support review" value={latestReview} triggerLabel="Latest review & attempts" /></div>}
      {review && <div className="raw-actions"><RawDialog title="Linked support review and all attempts" value={review} triggerLabel="Review & attempts" /></div>}
    </section>

    <section className="panel"><header className="panel-header"><div><h3 className="panel-title">Attributed proposition</h3><p className="panel-subtitle">Exact passages attributed to this citation in the filing</p></div>{proposition && <RawDialog title="Proposition extraction and attempts" value={proposition} triggerLabel="Proposition details" />}</header>
      {passages.length ? <div className="evidence-stack">{passages.map((passage, position) => <article className="evidence-card" key={`${string(passage.quote)}-${position}`}><p className="detail-note">Filing passage {position + 1}</p>{string(passage.quote) && <GroundedQuote quote={string(passage.quote)!} source={document.text} span={passage.span} contextLabel="Show filing context" />}</article>)}</div> : Array.isArray(propositionDecision?.quotes) && propositionDecision.quotes.length ? <div className="evidence-stack">{propositionDecision.quotes.map((quote, position) => string(quote) ? <blockquote className="evidence-quote" key={position}>{string(quote)}</blockquote> : null)}<p className="detail-note">The saved proposition quotes have no source spans at this checkpoint.</p></div> : <div className="empty-state"><h4>No proposition passage recorded</h4><p>{string(proposition?.failure_reason) ?? string(propositionDecision?.reason) ?? "No accepted filing passage is saved for this occurrence."}</p></div>}
      {string(propositionDecision?.reason) && passages.length > 0 && <p className="detail-note">{string(propositionDecision?.reason)}</p>}
    </section>

    <section className="panel"><header className="panel-header"><div><h3 className="panel-title">Opinion evidence</h3><p className="panel-subtitle">Accepted excerpts from the independent opinion, linked by saved history indices</p></div><RawDialog title="All saved opinion evidence" value={citation.raw.reporter_opinion_evidence ?? []} triggerLabel="All evidence records" /></header>
      {accepted.length ? <div className="evidence-stack">{accepted.map(({ record, position }) => <OpinionEvidence key={`${string(record.node_id)}-${position}`} evidence={record} root={root} document={document} position={position} />)}</div> : quotedEvidence.length ? <div className="evidence-stack">{quotedEvidence.map((quote, position) => <article className="evidence-card" key={position}><header className="evidence-header"><h4>Opinion {formatValue(quote.opinion_id)}</h4><RawDialog title="Opinion quote in review decision" value={quote} triggerLabel="Quote details" /></header>{string(quote.quote) && <blockquote className="evidence-quote">{string(quote.quote)}</blockquote>}<p className="detail-note">The review’s accepted evidence reference is unavailable at this checkpoint.</p></article>)}</div> : <div className="empty-state"><h4>No opinion excerpt recorded</h4><p>{string(review?.failure_reason) ?? string(evidence?.reason) ?? "This occurrence has no accepted opinion evidence linked to its saved support review."}</p></div>}
    </section>

    <section className="panel"><header className="panel-header"><div><h3 className="panel-title">Page resolution and source opinion</h3><p className="panel-subtitle">{sourceRoot ? `Indexed opinion bodies belong to root ${sourceRoot.id}` : "No referenced root opinion source is available"}</p></div><div className="panel-actions">{resolution && <RawDialog title="Page resolution record" value={resolution} triggerLabel="Resolution details" />}{evidence && <RawDialog title="Pinpoint evidence assembly" value={evidence} triggerLabel="Evidence assembly" />}</div></header>
      <div className="stage-strip"><div className="stage-step"><span>Page resolution</span><StatusBadge value={string(resolution?.outcome)} /></div><div className="stage-step"><span>Evidence assembly</span><StatusBadge value={string(evidence?.outcome)} /></div><div className="stage-step"><span>Opinion selection</span><span className="detail-note">{opinionReview ? opinionDecision ? "Review saved" : "Review failed" : "No review saved"}</span></div></div>
      {string(resolution?.reason) && <p className="detail-note">{string(resolution?.reason)}</p>}
      {opinionReview && <div className="raw-actions"><span className="detail-note">{string(opinionDecision?.reason) ?? string(opinionReview.failure_reason)}</span><RawDialog title="Opinion page selection review and attempts" value={opinionReview} triggerLabel="Selection review" /></div>}
      {objects(evidence?.pages).length > 0 && <div className="evidence-stack">{objects(evidence?.pages).map((reference, position) => <PageEvidence key={`${string(reference.opinion_id)}-${position}`} reference={reference} root={sourceRoot} document={document} position={position} />)}</div>}
      {retrieval && <div className="evidence-stack">{objects(retrieval.opinions).map((opinion, position) => <div className="evidence-header" key={`${string(opinion.opinion_id)}-${position}`}><span>Opinion {formatValue(opinion.opinion_id)}</span><div className="panel-actions"><StatusBadge value={string(opinion.outcome)} /><SourceLink url={opinionUrl(sourceRoot, opinion.opinion_id)} /><RawDialog title={`Retrieved opinion ${formatValue(opinion.opinion_id)}`} value={opinion} triggerLabel="Retrieved body" /></div></div>)}</div>}
      {!retrieval && !pageIndex && <p className="detail-note">No saved root opinion retrieval or page index is available at this checkpoint.</p>}
      <div className="raw-actions">{pageIndex && <RawDialog title="Complete indexed root opinion text and pagination" value={pageIndex} triggerLabel="Indexed opinion text" />}{retrieval && <RawDialog title="All retrieved opinion responses" value={retrieval} triggerLabel="All retrieved responses" />}</div>
    </section>
    <div className="raw-actions"><RawDialog title={`Complete occurrence ${citation.id}`} value={citation.raw} triggerLabel="Complete occurrence JSON" /></div>
  </div>;
}
