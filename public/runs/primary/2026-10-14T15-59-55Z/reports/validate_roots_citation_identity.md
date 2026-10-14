# validate_roots_citation_identity evaluation: primary

Checkpoint: validate_roots_citation_identity.corroborate_locator_bodies.review_locator_bodies_llm completed. Field identity judgments are scored through validate_roots_citation_identity.lookup_docket_roots.review_govinfo_dockets_llm; the body review's printed citation comparisons have no corresponding field identity gold. The locator-body review's overall identity verdict is scored separately. Later intended-case candidates do not change that identity score.

## 1 validate_roots_citation_identity.lookup_reporter_roots

### 1.1 validate_roots_citation_identity.lookup_reporter_roots.retrieve_clusters

| Metric | Coverage |
| --- | ---: |
| Citations with records / citations queried | 308/392 (78.6%) |

### 1.2 validate_roots_citation_identity.lookup_reporter_roots.retrieve_dockets

| Metric | Coverage |
| --- | ---: |
| Citations with records / citations queried | 299/299 (100.0%) |

### 1.3 validate_roots_citation_identity.lookup_reporter_roots.judge_unique_rule

| Field | Precision |
| --- | ---: |
| case_name | 216/255 (84.7%) |
| court | 244/250 (97.6%) |
| date | 251/254 (98.8%) |

### 1.4 validate_roots_citation_identity.lookup_reporter_roots.judge_ambiguous_rule

| Field | Precision |
| --- | ---: |
| case_name | 9/9 (100.0%) |
| court | 8/8 (100.0%) |
| date | 9/9 (100.0%) |

### 1.5 validate_roots_citation_identity.lookup_reporter_roots.review_unique_llm

| Field | Precision |
| --- | ---: |
| case_name | 68/70 (97.1%) |
| court | 65/70 (92.9%) |
| date | 66/70 (94.3%) |

### 1.6 validate_roots_citation_identity.lookup_reporter_roots.review_ambiguous_llm

| Field | Precision |
| --- | ---: |
| case_name | 42/42 (100.0%) |
| court | 41/42 (97.6%) |
| date | 42/42 (100.0%) |

## 2 validate_roots_citation_identity.lookup_docket_roots

### 2.1 validate_roots_citation_identity.lookup_docket_roots.retrieve_courtlistener_dockets

| Metric | Coverage |
| --- | ---: |
| Citations with records / citations queried | 43/48 (89.6%) |

### 2.2 validate_roots_citation_identity.lookup_docket_roots.review_courtlistener_dockets_llm

| Field | Precision |
| --- | ---: |
| case_name | 33/34 (97.1%) |
| court | 33/34 (97.1%) |
| date | 31/34 (91.2%) |

### 2.3 validate_roots_citation_identity.lookup_docket_roots.retrieve_govinfo_dockets

| Metric | Coverage |
| --- | ---: |
| Citations with records / citations queried | 5/14 (35.7%) |

### 2.4 validate_roots_citation_identity.lookup_docket_roots.review_govinfo_dockets_llm

| Field | Precision |
| --- | ---: |
| case_name | 4/4 (100.0%) |
| court | 4/4 (100.0%) |
| date | 4/4 (100.0%) |

### 2.5 validate_roots_citation_identity.lookup_docket_roots.judge_identity_from_fields

| Issued verdict | Count |
| --- | ---: |
| correct_identity | 29 |
| undetermined | 1 |
| wrong_identity | 8 |

## 3 validate_roots_citation_identity.corroborate_locator_bodies

### 3.1 validate_roots_citation_identity.corroborate_locator_bodies.retrieve_courtlistener_opinions

| Metric | Coverage |
| --- | ---: |
| Citations with records / citations queried | 18/97 (18.6%) |

### 3.2 validate_roots_citation_identity.corroborate_locator_bodies.retrieve_courtlistener_filings

| Metric | Coverage |
| --- | ---: |
| Citations with records / citations queried | 64/97 (66.0%) |

### 3.3 validate_roots_citation_identity.corroborate_locator_bodies.retrieve_govinfo_opinions

| Metric | Coverage |
| --- | ---: |
| Citations with records / citations queried | 51/97 (52.6%) |

### 3.4 validate_roots_citation_identity.corroborate_locator_bodies.review_locator_bodies_llm

| Issued verdict | Count |
| --- | ---: |
| correct_identity | 39 |
| partially_corroborated | 1 |
| undetermined | 1 |
| wrong_identity | 7 |

## Root field judgments after docket lookup

| Field | Precision | Recall |
| --- | ---: | ---: |
| case_name | 342/345 (99.1%) | 342/440 (77.7%) |
| court | 332/339 (97.9%) | 332/440 (75.5%) |
| date | 336/343 (98.0%) | 336/440 (76.4%) |

## Root identity after locator-body review

A locator-body verdict takes precedence over a lookup-derived verdict. Parenthetical figures include partially_corroborated as a positive prediction; it counts as correct only against CORRECT_IDENTITY gold. Undetermined roots remain in the recall denominator.

| Precision | Recall | Undetermined |
| ---: | ---: | ---: |
| 378/389 (97.2%) (including partial: 379/390 = 97.2%) | 378/440 (85.9%) (including partial: 379/440 = 86.1%) | 4 |

## Token usage

Tokens are reported subtotals, including repair attempts. Missing counters are unavailable, not zero. Cached tokens are already included in input tokens; reasoning tokens are already included in output. Cache rate uses only attempts reporting both input and cached-input counters.

| Substage | Model | Usage reported | Input tokens | Output tokens | Cached input tokens | Cache counters | Cache rate |
|---|---|---:|---:|---:|---:|---:|---:|
| validate_roots_citation_identity.lookup_reporter_roots.review_unique_llm | glm-5 | 72/72 | 82,370 | 31,075 | Unavailable | 0/72 | Unavailable |
| validate_roots_citation_identity.lookup_reporter_roots.review_ambiguous_llm | glm-5 | 47/47 | 82,010 | 18,585 | Unavailable | 0/47 | Unavailable |
| validate_roots_citation_identity.lookup_docket_roots.review_courtlistener_dockets_llm | glm-5 | 41/41 | 521,512 | 26,969 | Unavailable | 0/41 | Unavailable |
| validate_roots_citation_identity.lookup_docket_roots.review_govinfo_dockets_llm | glm-5 | 8/8 | 11,079 | 4,811 | Unavailable | 0/8 | Unavailable |
| validate_roots_citation_identity.corroborate_locator_bodies.review_locator_bodies_llm | glm-5 | 106/106 | 930,314 | 88,664 | Unavailable | 0/106 | Unavailable |
| **Total** |  | 274/274 | 1,627,285 | 170,104 | Unavailable | 0/274 | Unavailable |
