"use client";

import type { NativeRun } from "../lib/native-run";

export function RunSelector({ run, selectedId, loading, onSelect }: {
  run: NativeRun;
  selectedId: string;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  return <section className="run-selector" aria-label="Built-in primary corpus">
    <div className="run-selector-heading"><span className="eyebrow">PRIMARY CORPUS</span><p>{run.documents.length} filings, with their evidence and decision history</p></div>
    <label className="run-document-control">Filing<select aria-label="Filing" value={selectedId} onChange={event => onSelect(event.target.value)} aria-describedby="run-loading">
      <option value="" disabled>Choose a filing</option>
      {run.documents.map(document => <option key={document.id} value={document.id}>{document.id} · {document.title}</option>)}
    </select></label>
    <span id="run-loading" className="run-loading" role="status" aria-live="polite">{loading ? "Loading filing…" : `${run.runId.slice(0, 10)} run`}</span>
    <details className="run-reports"><summary>Workflow reports</summary><ul>{run.reports.map(report => <li key={report.workflow}><a href={report.markdown} target="_blank" rel="noopener noreferrer">{report.workflow.replaceAll("_", " ")}</a><a href={report.json} target="_blank" rel="noopener noreferrer" aria-label={`${report.workflow.replaceAll("_", " ")} JSON`}>JSON</a></li>)}</ul></details>
  </section>;
}
