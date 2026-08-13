# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev          # dev server on :3000 (append `-- --port 4000` for another port)
npm run build        # production build
npm start            # serve the production build
npm run typecheck    # tsc --noEmit
```

Requires Node 20.9+ (Next.js 16). There is no test suite and no linter configured — `npm run typecheck` is the only automated check, so run it after edits.

## What this is

A browser-only viewer for `mellea-lrc` validation artifacts (`validated.json`). No server, no database, no API calls, no environment variables: the user picks a file with the header's file input, `FileReader` reads it, and everything renders client-side. Preserve that property — do not add fetches, telemetry, or server routes that would send artifact contents anywhere.

Only schema 2 `validated_document` artifacts open. `isValidatedDocument` in `app/page.tsx` gates on `schema_version === 2 && artifact_type === "validated_document"`; anything else (including extraction-only artifacts, which contain no validation nodes) is rejected with *"Expected a schema 2 validated_document serialization artifact."*

## Architecture

Nearly the entire app is `app/page.tsx` (~700 lines, `"use client"`), with `app/globals.css` holding all styling as plain hand-written CSS keyed to semantic class names (`.candidate-tab`, `.evidence-highlight-*`, `.graph-node`) plus CSS custom properties (`--accent`, `--warning`, `--danger`) defined at the top. `app/layout.tsx` is a bare shell. There is no component library, no CSS-in-JS, and no state manager.

**Data shape.** The parsed payload has two parallel citation arrays that are joined by `citation_id`:
- `source.citations[]` — where each citation sits in the filing (`span`, `matched_text`), used for the document view and for citation labels.
- `citations[]` — per-citation validation results: a flat `nodes[]` list (each with `depends_on`) plus an optional `aggregation` (`CitationSummary`) holding `candidates[]`, `overall_outcome`, and per-candidate `pinpoint` evidence.

Nearly every lookup in the file is a `.find()` on `citation_id`, `node_id`, or `assessment_node_id`. Node objects are open-ended (`[key: string]: JsonValue`) so the details pane can dump unrecognized serialized fields verbatim — don't tighten those types in a way that drops unknown keys.

**State.** All top-level state lives in `Page`: the loaded document, `selectedCitationId`, `selectedNodeId`, `activeView` (`"bibliography" | "document" | "graph"`), and the parse error. The three tabs share one selected citation, so selecting in any view drives the others. `Bibliography` owns its own candidate selection and evidence-modal state, resetting both via an effect keyed on `aggregation.node_id`.

**Graph layout is computed, not a library.** `buildGraph` assigns each node a level by recursive max-depth over `depends_on`, centers each level horizontally, and returns absolute pixel positions; `StaticGraph` renders nodes as absolutely positioned buttons over an SVG layer of bezier edges. The `GRAPH_*` constants drive all geometry — change those rather than the arithmetic.

**Span-based text rendering.** Both the document view and the evidence modal render text by walking sorted character spans and slicing the original string. Two things matter: spans are validated against `text.length` (`validSpan`) before use because artifact spans can be stale or out of range, and overlapping spans are skipped (`if (highlight.start < cursor) continue`) rather than nested. `balancedEvidenceExcerpt` then windows long reporter-page text to roughly `EVIDENCE_EXCERPT_CHARS` around the highlights. Whitespace fidelity in the document view depends on `white-space: pre-wrap` in the CSS.

## Gotchas

- `Page` names its state variable `document`, shadowing the global. Inside `Page`, `document` is the artifact; components outside it (e.g. `EvidenceModal`) use the real DOM `document`. Be deliberate about which one a new reference means.
- Outcome and status strings from the artifact flow straight into class names (`outcome-${outcome}`, `STATUS_CLASS[status]`). A new outcome value from mellea-lrc renders unstyled until `globals.css` gains a matching rule.
- Accessibility is deliberate throughout: tabs carry `role="tab"`/`aria-selected`/`aria-controls`, the details pane is `aria-live`, the modal is `role="dialog" aria-modal` with Escape-to-close and body scroll locking, and highlight legends are labelled. Keep new interactive UI at that level.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
