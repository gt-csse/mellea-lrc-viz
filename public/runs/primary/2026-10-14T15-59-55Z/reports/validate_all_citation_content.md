# validate_all_citation_content — primary

## Dataset annotations

Counts come only from native citation annotations. Each leaf uses its root's gold identity; pipeline extraction, retrieval, inherited pinpoints, and support judgments do not affect these counts.

| Pin cite annotations | All annotations | Under gold CORRECT_IDENTITY roots |
| --- | ---: | ---: |
| Total pin cite occurrences | 468 | 399 |
| Settled subtotal | 309 | 299 |
| Settled: CORRECT_PINCITE | 191 | 186 |
| Settled: WRONG_PINCITE | 118 | 113 |
| SKIPPED: UNSETTLED | 58 | 57 |
| SKIPPED: TOA | 44 | 43 |
| SKIPPED: IDENTITY_WRONG | 57 | 0 |
| Pin cite present, no validation label | 0 | 0 |

| Settled family occurrences | All annotations | Under gold CORRECT_IDENTITY roots |
| --- | ---: | ---: |
| reporter_roots | 168 (108 correct, 60 wrong) | 161 (105 correct, 56 wrong) |
| reporter_leaves | 140 (82 correct, 58 wrong) | 137 (80 correct, 57 wrong) |
| docket_roots | 0 (0 correct, 0 wrong) | 0 (0 correct, 0 wrong) |
| docket_leaves | 1 (1 correct, 0 wrong) | 1 (1 correct, 0 wrong) |

The pinpoint recall cohort contains all 299 settled annotations under gold CORRECT_IDENTITY roots, including reporter and docket families. Docket pinpoint validation is not implemented, so its settled annotations remain missing judgments. SKIPPED and unlabeled pin cites do not enter correctness metrics.

Known native page correctness within that cohort: 242. These annotations have an explicit native correct_page Boolean, independently of the content label. A null or missing correct_page is unknown and does not enter page precision.

## 1 validate_all_citation_content.prepare_root_opinions
### 1.1 validate_all_citation_content.prepare_root_opinions.retrieve_opinions

Scope: reporter roots with correct identity and a selected original CourtListener cluster.

| Metric | Result |
| --- | --- |
| reporter_roots_opinion_retrievals / reporter_roots_correct_identity | 268/268 (100.0%) |
### 1.2 validate_all_citation_content.prepare_root_opinions.index_pages

| Outcome | Count |
| --- | ---: |
| opinions_indexed | 447 |
| roots_indexed | 268 |
## 2 validate_all_citation_content.prepare_citation_evidence
### 2.1 validate_all_citation_content.prepare_citation_evidence.resolve_pages

| Outcome | Count |
| --- | ---: |
| ambiguous | 83 |
| no_pin | 132 |
| resolved | 130 |
| unlocated | 87 |
### 2.2 validate_all_citation_content.prepare_citation_evidence.select_opinions_llm

| Outcome | Count |
| --- | ---: |
| decisions | 74 |
### 2.3 validate_all_citation_content.prepare_citation_evidence.read_propositions

| Outcome | Count |
| --- | ---: |
| decisions | 300 |
| no_proposition | 32 |
### 2.4 validate_all_citation_content.prepare_citation_evidence.prepare_evidence

| Outcome | Count |
| --- | ---: |
| missing_pages | 76 |
| no_pincite | 92 |
| no_proposition | 72 |
| ready | 192 |
## 3 validate_all_citation_content.review_citation_content
### 3.1 validate_all_citation_content.review_citation_content.review_cited_pages_llm

| Outcome | Count |
| --- | ---: |
| contradicted | 16 |
| failures | 10 |
| supported | 107 |
| unavailable | 59 |

Incremental definitive judgments against the settled gold cohort.

| Occurrences | Precision |
| --- | ---: |
| reporter_roots | 54/59 (91.5%) |
| reporter_leaves | 36/41 (87.8%) |
| docket_roots | 0/0 (—) |
| docket_leaves | 0/0 (—) |
| total | 90/100 (90.0%) |

Definitive judgments outside the scored cohort: 7 (unscored).
### 3.2 validate_all_citation_content.review_citation_content.review_full_opinions_llm

| Outcome | Count |
| --- | ---: |
| contradicted | 25 |
| failures | 16 |
| not_found | 69 |
| supported | 84 |

Incremental definitive judgments against the settled gold cohort.

| Occurrences | Precision | Page precision | Found-page agreement |
| --- | ---: | ---: | ---: |
| reporter_roots | 83/90 (92.2%) | 24/29 (82.8%) | 16/17 (94.1%) |
| reporter_leaves | 61/73 (83.6%) | 22/24 (91.7%) | 16/19 (84.2%) |
| docket_roots | 0/0 (—) | 0/0 (—) | 0/0 (—) |
| docket_leaves | 0/0 (—) | 0/0 (—) | 0/0 (—) |
| total | 144/163 (88.3%) | 46/53 (86.8%) | 32/36 (88.9%) |

Definitive judgments outside the scored cohort: 15 (unscored).

Page precision scores the model's correct_page assessment against an explicit native Boolean, independently of content support. A content error can still have a correct written page. 98 assessments have known gold page correctness but no predicted Boolean; 27 have no comparable gold placement or are outside the scored cohort. Neither enters page precision. Missing pagination or an unknown native page assessment is not a page negative. The support recall denominator is unchanged.

Found-page agreement compares every reported numeric range, kind, and footnote with native positive page references, without matching provider opinion IDs. It is positive-reference agreement, not exhaustive factual precision: native found-page lists need not include every valid location. Unlisted or partly uncovered alternatives remain unscored; an explicit native incorrect-page finding can rule out a reported target inside the written pinpoint. 100 assessments have positive native references but report no found pages; 42 lack comparable references, provide unlisted alternatives, or fall outside the scored cohort. Neither enters the agreement denominator.
### 3.3 validate_all_citation_content.review_citation_content.judge_citation_content

| Outcome | Count |
| --- | ---: |
| CORRECT_PINCITE | 161 |
| UNDETERMINED | 13 |
| WRONG_PINCITE | 94 |

Incremental definitive judgments against the settled gold cohort.

| Occurrences | Precision | Page precision | Found-page agreement |
| --- | ---: | ---: | ---: |
| reporter_roots | 122/134 (91.0%) | 67/72 (93.1%) | 57/58 (98.3%) |
| reporter_leaves | 86/103 (83.5%) | 50/53 (94.3%) | 44/48 (91.7%) |
| docket_roots | 0/0 (—) | 0/0 (—) | 0/0 (—) |
| docket_leaves | 0/0 (—) | 0/0 (—) | 0/0 (—) |
| total | 208/237 (87.8%) | 117/125 (93.6%) | 101/106 (95.3%) |

Definitive judgments outside the scored cohort: 18 (unscored).

Page precision scores the final preserved correct_page assessment against an explicit native Boolean, independently of content support. A content error can still have a correct written page. 111 assessments have known gold page correctness but no predicted Boolean; 32 have no comparable gold placement or are outside the scored cohort. Neither enters page precision. Missing pagination or an unknown native page assessment is not a page negative. The support recall denominator is unchanged.

Found-page agreement compares every reported numeric range, kind, and footnote with native positive page references, without matching provider opinion IDs. It is positive-reference agreement, not exhaustive factual precision: native found-page lists need not include every valid location. Unlisted or partly uncovered alternatives remain unscored; an explicit native incorrect-page finding can rule out a reported target inside the written pinpoint. 113 assessments have positive native references but report no found pages; 49 lack comparable references, provide unlisted alternatives, or fall outside the scored cohort. Neither enters the agreement denominator.
## Citation content judgments

The fixed gold cohort contains every native CORRECT_PINCITE or WRONG_PINCITE under a gold CORRECT_IDENTITY root. Reporter and docket roots and their leaves are included; a leaf uses its root's gold identity. SKIPPED and occurrences without a pin cite are excluded. Opinion retrieval, identity admission, and page/proposition success never narrow the recall denominator. Precision is correct definitive judgments / issued definitive judgments within this gold cohort; recall is correct definitive judgments / all settled gold. UNDETERMINED is a recall miss. Wrong verdicts receive no recall credit.

| Occurrences | Precision | Recall | Page precision | Found-page agreement | Wrong verdicts | Undetermined | Missing judgments | Missing opinions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| reporter_roots | 122/134 (91.0%) | 122/161 (75.8%) | 67/72 (93.1%) | 57/58 (98.3%) | 12 | 7 | 20 | 20 |
| reporter_leaves | 86/103 (83.5%) | 86/137 (62.8%) | 50/53 (94.3%) | 44/48 (91.7%) | 17 | 5 | 29 | 29 |
| docket_roots | 0/0 (—) | 0/0 (—) | 0/0 (—) | 0/0 (—) | 0 | 0 | 0 | 0 |
| docket_leaves | 0/0 (—) | 0/1 (0.0%) | 0/0 (—) | 0/0 (—) | 0 | 0 | 1 | 1 |
| total | 208/237 (87.8%) | 208/299 (69.6%) | 117/125 (93.6%) | 101/106 (95.3%) | 29 | 12 | 50 | 50 |

Missing-opinion counts describe coverage and may overlap undetermined or missing judgments. Support on another page or in an opinion without pagination can still be CORRECT_PINCITE. Docket pinpoint validation is not implemented, so its settled annotations remain missing judgments.

Page precision scores the final preserved correct_page assessment against an explicit native Boolean, independently of content support. A content error can still have a correct written page. 111 assessments have known gold page correctness but no predicted Boolean; 32 have no comparable gold placement or are outside the scored cohort. Neither enters page precision. Missing pagination or an unknown native page assessment is not a page negative. The support recall denominator is unchanged.

Found-page agreement compares every reported numeric range, kind, and footnote with native positive page references, without matching provider opinion IDs. It is positive-reference agreement, not exhaustive factual precision: native found-page lists need not include every valid location. Unlisted or partly uncovered alternatives remain unscored; an explicit native incorrect-page finding can rule out a reported target inside the written pinpoint. 113 assessments have positive native references but report no found pages; 49 lack comparable references, provide unlisted alternatives, or fall outside the scored cohort. Neither enters the agreement denominator.

## Token usage

Tokens are reported subtotals, including repair attempts. Missing counters are unavailable, not zero. Cached tokens are already included in input tokens; reasoning tokens are already included in output. Cache rate uses only attempts reporting both input and cached-input counters.

| Substage | Model | Usage reported | Input tokens | Output tokens | Cached input tokens | Cache counters | Cache rate |
|---|---|---:|---:|---:|---:|---:|---:|
| validate_all_citation_content.prepare_citation_evidence.select_opinions_llm | openai/gpt-6-luna | 74/74 | 2,412,194 | 7,755 | 1,047,786 | 74/74 | 43.4% |
| validate_all_citation_content.prepare_citation_evidence.read_propositions | openai/gpt-6-luna | 274/274 | 271,406 | 65,625 | 3,235 | 274/274 | 1.2% |
| validate_all_citation_content.review_citation_content.review_cited_pages_llm | glm-5 | 248/257 | 870,445 | 144,967 | Unavailable | 0/257 | Unavailable |
| validate_all_citation_content.review_citation_content.review_full_opinions_llm | glm-5 | 222/235 | 4,768,287 | 180,928 | Unavailable | 0/235 | Unavailable |
| **Total** |  | 818/840 | 8,322,332 | 399,275 | 1,051,021 | 348/840 | 39.2% |
