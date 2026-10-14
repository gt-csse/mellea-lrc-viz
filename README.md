# Mellea citation review

A read-only workspace for the native `mellea_lrc.model.Document` JSON.
The design uses navy, warm paper, restrained brass details, and self-hosted
serif typography for legal text. Imported documents stay in the browser.

## Built-in primary corpus

The included run is `2026-10-14T15-59-55Z`: 26 primary filings, completed through
all four workflows, with their saved Markdown and JSON reports. Visiting `/` opens the
first filing; choose another from the filing selector, or link directly with
`/?document=005`. Documents are fetched individually as compressed native JSON,
verified against the saved SHA-256, and then reviewed in the browser. The four
workflow reports are available beside the selector. No backend or upload is needed.

To replace the built-in run after its four workflows and reports are complete:

```bash
npm run bundle:run -- /absolute/path/to/evaluations/results/primary/TIMESTAMP
```

The builder refuses unfinished runs. Compression preserves the original Document
bytes, including every field reading, retrieved source, judgment, and model repair.
It copies documents and workflow reports, without copying private run configuration.
Unsuccessful review attempts remain in the saved history alongside accepted judgments.

## Run

```bash
npm ci
npm run dev
```

Open <http://localhost:3000> and choose **Open Document**, or drop a JSON file.
Use Node.js 22.18 or newer for the native TypeScript test runner.

```bash
npm run typecheck
npm test
npm run build
```

## The four views

- **Document** preserves the original filing text and highlights the selected
  occurrence and its field readings. Source offsets use Python Unicode code
  points, including when the text contains supplementary characters.
- **Citation content** shows the occurrence's final support verdict, proposition,
  accepted opinion evidence, and independent page-placement assessment. A supported
  proposition does not imply a correct written page. The saved pinpoint field and support verdict names remain unchanged.
- **Identity** shows the authority's final saved verdict and independent field
  comparisons. A leaf reads its root's identity, while retaining its own support
  judgment. Comparisons use their recorded field reading and retrieved evidence.
- **Nodes** shows a citation's ordered decision history. Selecting a node reveals
  extraction state through that node and exactly which records it added. Full
  original records, including provider responses and model repairs, open in a
  searchable JSON dialog.

The citation index groups occurrences under their assigned root. Unassigned,
withdrawn, and unfamiliar relationships remain selectable. Before roots have been
formed, citations appear under **Awaiting root assignment**.

## Native checkpoints

Open a Document from any completed or in-progress stage, including preprocessing
with no citations. The checkpoint selector reconstructs completed stages from
citation-local node order and native `runs` events, matching `Document.get_stage`
and `Document.get_substage`. Semantic stages and atomic substages are separate
checkpoint choices. Nodes carry their `substage`; source reviews use the same
identifier. Obsolete `stage_runs` and node `stage` payloads are rejected.
No separate checkpoint files, backend connection, or invented judgments are needed.

Table-of-authorities tags are shown per occurrence. Their citation content review
is skipped, while identity remains available. A body leaf does not inherit its
root's TOA tag.

The native payload is retained intact. Unknown fields and records remain accessible
in JSON dialogs and downloads; unfamiliar kinds are displayed with a record notice.
The older `validated_document` schema is not supported.

## Structure

| Location | Responsibility |
| --- | --- |
| `app/` | Routes, workspace state, typography and visual system |
| `components/` | Source text, final judgments, node inspection, shared controls |
| `lib/document.ts` | Lossless native Document projections and checkpoint recovery |
| `lib/native-run.ts` | Built-in run index, verified decompression, and lazy document loading |
| `scripts/build-native-run.mjs` | Completed-run packaging with byte-identical compressed documents |
| `lib/bundle.ts` | Independent annotation-bundle reader |
| `tests/` | Native-model fixtures and adapter regression checks |

The fixture is invented text generated with the current Python models. It includes
all six citation kinds and expected checkpoints produced by the backend. An optional
corpus test compares the adapter with saved Python checkpoint fingerprints:

```bash
MELLEA_NATIVE_CORPUS_MANIFEST=/absolute/path/to/manifest.json npm test
```

The supplied manifest records both checkpoint kinds and native node snapshots.
The built-in primary corpus is packaged separately from the invented fixture.

## Annotation workspace

`/dataset` continues to open one annotation bundle. Build it from the independent
annotation store:

```bash
npm run bundle -- --store ../mellea-lrc-datasets --document 005
```

The bundle builder checks source hashes before writing. Bundles and dataset files
remain local and are not part of the application build.
