# Grow-roots evaluation: primary

Field-reading substage precision counts every eligible citation's field outcome, including absence, inference, and failed normalization; missing explicit gold raises.

Docket site hunting: included

Docket root review: included

## 1 grow_roots.discover_root_locators

### 1.1 grow_roots.discover_root_locators.find_full_reporter_locators

| Span precision | Normalization precision |
| ---: | ---: |
| 589/589 (100.0%) | 589/589 (100.0%) |

### 1.2 grow_roots.discover_root_locators.find_docket_locators

| Span precision | Normalization precision |
| ---: | ---: |
| 19/19 (100.0%) | 19/19 (100.0%) |

### 1.3 grow_roots.discover_root_locators.hunt_docket_locators

| Span precision | Normalization precision |
| ---: | ---: |
| 38/38 (100.0%) | 37/38 (97.4%) |

## 2 grow_roots.read_root_fields

### 2.1 grow_roots.read_root_fields.resolve_docket_entries

| Span precision | Normalization precision |
| ---: | ---: |
| 57/57 (100.0%) | 57/57 (100.0%) |

### 2.2 grow_roots.read_root_fields.resolve_colocations

| Group precision |
| ---: |
| 44/44 (100.0%) |

### 2.3 grow_roots.read_root_fields.resolve_case_names

| Span precision | Normalization precision |
| ---: | ---: |
| 581/646 (89.9%) | 581/646 (89.9%) |

### 2.4 grow_roots.read_root_fields.resolve_courts

| Span precision | Normalization precision |
| ---: | ---: |
| 625/646 (96.7%) | 620/646 (96.0%) |

### 2.5 grow_roots.read_root_fields.resolve_dates

| Span precision | Normalization precision |
| ---: | ---: |
| 632/646 (97.8%) | 632/646 (97.8%) |

### 2.6 grow_roots.read_root_fields.resolve_pin_cites

| Span precision | Normalization precision |
| ---: | ---: |
| 641/646 (99.2%) | 641/646 (99.2%) |

## 3 grow_roots.form_root_groups

### 3.1 grow_roots.form_root_groups.form_roots

| Root assignment precision |
| ---: |
| 641/646 (99.2%) |

### 3.2 grow_roots.form_root_groups.reassign_docket_roots_llm

| Reviewed root assignment precision |
| ---: |
| 27/28 (96.4%) |

## Root fields

| Field | Source/span precision | Source/span recall | Source/span overlap recall | Normalization precision | Normalization recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| full_reporter_locator | 392/392 (100.0%) | 392/393 (99.7%) | 392/393 (99.7%) | 392/392 (100.0%) | 392/393 (99.7%) |
| docket_locator | 47/48 (97.9%) | 47/47 (100.0%) | 47/47 (100.0%) | 46/48 (95.8%) | 46/47 (97.9%) |
| **overall_locator subtotal** | 439/440 (99.8%) | 439/440 (99.8%) | 439/440 (99.8%) | 438/440 (99.5%) | 438/440 (99.5%) |
| docket_entry | 47/48 (97.9%) | 47/47 (100.0%) | 47/47 (100.0%) | 47/48 (97.9%) | 47/47 (100.0%) |
| case_name | 392/440 (89.1%) | 392/440 (89.1%) | 436/440 (99.1%) | 392/440 (89.1%) | 392/440 (89.1%) |
| court | 431/440 (98.0%) | 431/440 (98.0%) | 432/440 (98.2%) | 427/440 (97.0%) | 427/440 (97.0%) |
| date | 433/440 (98.4%) | 433/440 (98.4%) | 434/440 (98.6%) | 433/440 (98.4%) | 433/440 (98.4%) |
| pin_cite | 439/440 (99.8%) | 439/440 (99.8%) | 439/440 (99.8%) | 439/440 (99.8%) | 439/440 (99.8%) |

## Root fields after validate_roots_citation_identity.lookup_docket_roots.review_govinfo_dockets_llm

| Field | Source/span precision | Source/span recall | Source/span overlap recall | Normalization precision | Normalization recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| case_name | 414/440 (94.1%) | 414/440 (94.1%) | 436/440 (99.1%) | 396/440 (90.0%) | 396/440 (90.0%) |
| court | 434/440 (98.6%) | 434/440 (98.6%) | 435/440 (98.9%) | 431/440 (98.0%) | 431/440 (98.0%) |
| date | 436/440 (99.1%) | 436/440 (99.1%) | 436/440 (99.1%) | 436/440 (99.1%) | 436/440 (99.1%) |

## Token usage

Tokens are reported subtotals, including repair attempts. Missing counters are unavailable, not zero. Cached tokens are already included in input tokens; reasoning tokens are already included in output. Cache rate uses only attempts reporting both input and cached-input counters.

| Substage | Model | Usage reported | Input tokens | Output tokens | Cached input tokens | Cache counters | Cache rate |
|---|---|---:|---:|---:|---:|---:|---:|
| grow_roots.discover_root_locators.hunt_docket_locators | openai/gpt-6-luna | 61/61 | 27,994 | 4,841 | 0 | 61/61 | 0.0% |
| grow_roots.form_root_groups.reassign_docket_roots_llm | openai/gpt-6-luna | 9/9 | 8,639 | 588 | 0 | 9/9 | 0.0% |
| **Total** |  | 70/70 | 36,633 | 5,429 | 0 | 70/70 | 0.0% |
