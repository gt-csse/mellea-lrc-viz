# Grow-leaves evaluation: primary

Through `grow_leaves.correct_leaf_readings.correct_leaf_fields`. Only completed substages are scored. The workflow attribution summary appears after Id. attribution has run.

Substage tables score only that substage's decisions. Creation substages score every field outcome for each created citation, including not_stated or null outcomes. Absence is correct only when independently annotated as not_stated. Later reading substages likewise count each eligible citation's field outcome, including absence. Unmatched predictions and failed normalizations remain in the denominator. A matched annotation missing a required normalization target raises instead of narrowing the denominator. Workflow recall uses annotated leaves of completed discovery types, including inherited repeated full citations; unrun discovery types are omitted. The citation unit defines annotation scope; bare references remain as out_of_scope_citation rows and are not scored. All citations attached to the dummy head are excluded from the workflow source-span and attribution summary predictions. Their histories and creation-substage scores remain intact; annotated recall denominators remain unchanged.

## 1 grow_leaves.grow_short_reporter_leaves

### 1.1 grow_leaves.grow_short_reporter_leaves.find_short_reporter_citations

| Metric | Precision |
| --- | ---: |
| locator_span | 40/41 (97.6%) |
| locator_normalization | 40/41 (97.6%) |
| pin_cite_span | 40/41 (97.6%) |
| pin_cite_normalization | 40/41 (97.6%) |

### 1.2 grow_leaves.grow_short_reporter_leaves.resolve_colocations

No precision score: independent short-reporter group annotations are not defined.

### 1.3 grow_leaves.grow_short_reporter_leaves.resolve_case_names

| Metric | Precision |
| --- | ---: |
| case_name_span | 38/41 (92.7%) |
| case_name_normalization | 38/41 (92.7%) |

### 1.4 grow_leaves.grow_short_reporter_leaves.attribute_citations

| Metric | Precision |
| --- | ---: |
| attribution | 40/40 (100.0%) |

## 2 grow_leaves.grow_reference_leaves

### 2.1 grow_leaves.grow_reference_leaves.find_reference_citations

| Metric | Precision |
| --- | ---: |
| case_name_span | 8/8 (100.0%) |
| case_name_normalization | 8/8 (100.0%) |
| pin_cite_span | 8/8 (100.0%) |
| pin_cite_normalization | 8/8 (100.0%) |

### 2.2 grow_leaves.grow_reference_leaves.attribute_citations

| Metric | Precision |
| --- | ---: |
| attribution | 8/8 (100.0%) |

## 3 grow_leaves.grow_id_leaves

### 3.1 grow_leaves.grow_id_leaves.find_id_citations

| Metric | Precision |
| --- | ---: |
| citation_span | 34/61 (55.7%) |
| pin_cite_span | 34/61 (55.7%) |
| pin_cite_normalization | 34/61 (55.7%) |

### 3.2 grow_leaves.grow_id_leaves.attribute_citations

| Metric | Precision |
| --- | ---: |
| attribution | 33/34 (97.1%) |

## 4 grow_leaves.grow_supra_leaves

### 4.1 grow_leaves.grow_supra_leaves.find_supra_citations

| Metric | Precision |
| --- | ---: |
| span | — (no decisions) |
| normalization | — (no decisions) |

### 4.2 grow_leaves.grow_supra_leaves.resolve_case_names

| Metric | Precision |
| --- | ---: |
| span | — (no decisions) |
| normalization | — (no decisions) |

### 4.3 grow_leaves.grow_supra_leaves.resolve_pin_cites

| Metric | Precision |
| --- | ---: |
| span | — (no decisions) |
| normalization | — (no decisions) |

### 4.4 grow_leaves.grow_supra_leaves.attribute_citations_rule

| Metric | Precision |
| --- | ---: |
| attribution | — (no decisions) |

### 4.5 grow_leaves.grow_supra_leaves.review_attributions_llm

| Metric | Precision |
| --- | ---: |
| attribution | — (no decisions) |

## 5 grow_leaves.correct_leaf_readings

### 5.1 grow_leaves.correct_leaf_readings.correct_leaf_fields

| Metric | Precision |
| --- | ---: |
| case_name_span | 250/254 (98.4%) |
| case_name_normalization | 246/254 (96.9%) |
| pin_cite_span | 284/288 (98.6%) |
| pin_cite_normalization | 284/288 (98.6%) |
| court_span | 200/206 (97.1%) |
| court_normalization | 198/206 (96.1%) |
| date_span | 205/206 (99.5%) |
| date_normalization | 204/206 (99.0%) |

## Leaf source spans

| Kind | Precision | Recall |
| --- | ---: | ---: |
| FullCaseCitation | 197/197 (100.0%) | 197/197 (100.0%) |
| DocketCitation | 9/9 (100.0%) | 9/10 (90.0%) |
| ShortCaseCitation | 40/40 (100.0%) | 40/40 (100.0%) |
| ReferenceCitation | 8/8 (100.0%) | 8/8 (100.0%) |
| IdCitation | 34/34 (100.0%) | 34/34 (100.0%) |
| SupraCitation | — | — |
| all_leaves | 288/288 (100.0%) | 288/289 (99.7%) |

## Leaf attribution

| Kind | Precision | Recall |
| --- | ---: | ---: |
| FullCaseCitation | 197/197 (100.0%) | 197/197 (100.0%) |
| DocketCitation | 9/9 (100.0%) | 9/10 (90.0%) |
| ShortCaseCitation | 40/40 (100.0%) | 40/40 (100.0%) |
| ReferenceCitation | 8/8 (100.0%) | 8/8 (100.0%) |
| IdCitation | 33/34 (97.1%) | 33/34 (97.1%) |
| SupraCitation | — | — |
| all_leaves | 287/288 (99.7%) | 287/289 (99.3%) |

## Token usage

Tokens are reported subtotals, including repair attempts. Missing counters are unavailable, not zero. Cached tokens are already included in input tokens; reasoning tokens are already included in output. Cache rate uses only attempts reporting both input and cached-input counters.

| Substage | Model | Usage reported | Input tokens | Output tokens | Cached input tokens | Cache counters | Cache rate |
|---|---|---:|---:|---:|---:|---:|---:|
| grow_leaves.grow_short_reporter_leaves.attribute_citations | openai/gpt-6-luna | 2/2 | 19,120 | 117 | 0 | 2/2 | 0.0% |
| grow_leaves.grow_id_leaves.attribute_citations | openai/gpt-6-luna | 61/61 | 681,818 | 5,749 | 534,079 | 61/61 | 78.3% |
| grow_leaves.correct_leaf_readings.correct_leaf_fields | openai/gpt-6-luna | 313/313 | 772,930 | 80,985 | 250,989 | 313/313 | 32.5% |
| **Total** |  | 376/376 | 1,473,868 | 86,851 | 785,068 | 376/376 | 53.3% |
