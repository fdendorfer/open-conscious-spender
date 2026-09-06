# Scoring formula

Goal: turn an arbitrary number of flags, across an arbitrary number of categories, into one 0–100 "concern score" plus a traffic-light band — without needing to touch code when categories, weights, or severities change. All tunable inputs below live in data files, not in application logic.

## Inputs (all data-driven, extendable)

**`data/categories.json`** — one entry per flag category:
```json
{ "id": "boycott-conflict", "name": "Boycott / conflict complicity", "icon": "Megaphone", "defaultWeight": 3 }
```
Adding a new category later is just adding a new object here — no formula change needed.

**Severity multiplier** (per flag, chosen when the flag is added):
| severity   | multiplier |
|------------|-----------|
| minor      | 1         |
| moderate   | 2         |
| severe     | 3         |
| systemic   | 5         |

**Confidence multiplier** (derived from the flag's `status`):
| status      | multiplier |
|-------------|-----------|
| sourced     | 1.0       |
| unverified  | 0.6       |

**Decay multiplier** — reserved extension point, defaults to `1.0` for every flag in v1. A future version could reduce the weight of old, unresolved flags (e.g. `max(0.3, 1 - yearsSinceAdded * 0.1)`) without changing the rest of the formula.

## Step 1 — per-flag contribution

```
contribution(flag) = category.weight × severity.multiplier × confidence.multiplier × decay.multiplier
```

## Step 2 — raw total

```
raw(company) = Σ contribution(flag) for all flags on that company (and, optionally, inherited from its parent — see note below)
```

## Step 3 — normalize to 0–100

A straight sum would let a company with many flags blow past any sensible scale, and wouldn't saturate — diminishing-returns curve instead:

```
score(company) = round(100 × (1 − e^(−raw / K)))
```

`K` is a single tunable constant controlling how quickly the score saturates. Raising `K` makes the score more forgiving of multiple flags; lowering it makes individual flags hit harder.

Started at **6**, but calibrating against the first ~20 real seeded companies (`data/companies/`) showed that value saturates too fast — most real, multi-flag companies landed in the red band regardless of how they actually compared to each other, which defeats the point of a quick-glance signal. Raised to **12**, which spreads that same real seed set from 18 to 75 across all three bands. Revisit again as more companies are added — this is an empirical calibration, not a formula derived from first principles.

Example at `K = 12`:

| scenario                                              | raw | score |
|--------------------------------------------------------|-----|-------|
| one sourced, severe flag in a weight-3 category         | 9   | ~53   |
| one sourced, minor flag in a weight-2 category          | 2   | ~15   |
| two sourced, minor flags in weight-2 categories         | 4   | ~28   |

## Step 4 — traffic-light band

| score   | band   |
|---------|--------|
| 0–29    | green  |
| 30–64   | yellow |
| 65–100  | red    |

Band thresholds are constants, not hardcoded logic branches — trivially adjustable.

## Extending this later

- **New category**: add to `categories.json` with a `defaultWeight`. No formula change.
- **New severity level**: add a row to the severity table + its multiplier.
- **Decay**: implement the reserved `decay.multiplier` function; every flag already carries `dateAdded`.
- **Per-user weighting**: since categories are already just weighted, a future "mute category X" or "double-weight category Y" personal setting is a per-user override of `category.weight` at render time — no server-side change needed.

## Open question / judgment call

Default category weights (see `data/categories.json`) reflect a starting editorial judgment about relative severity (e.g. boycott/conflict complicity weighted above monopoly practices). This is a defensible starting point, not a claim of moral authority — it's a single number per category, meant to be argued over and changed via normal PRs.

## Note on parent-company inheritance

Whether a subsidiary's flags roll up into the parent's score (and vice versa) is a product decision not yet locked — likely: a company's *displayed* score is the max of its own score and its parent chain's scores, so buying from a clean subsidiary of a flagged conglomerate still surfaces the parent's flags. Revisit once the ownership graph (`docs/ARCHITECTURE.md`) is in place.
