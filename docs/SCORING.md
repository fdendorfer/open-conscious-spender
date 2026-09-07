# Scoring formula

Goal: turn an arbitrary number of flags — positive and negative — into one 0–100 score plus a traffic-light band. 50 = neutral (no data). 100 = strongly positive. 0 = strongly negative.

## Inputs (all data-driven, extendable)

**`data/categories.json`** — one entry per flag category:
```json
{ "id": "boycott-conflict", "name": "Boycott / conflict complicity", "icon": "Megaphone", "defaultWeight": 3 }
```

**Flag polarity** — each flag is either a concern (`negative`, default) or a positive signal (`positive`).

**Severity multiplier** (per flag):
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

**Decay multiplier** — reserved extension point, defaults to `1.0`. A future version could reduce the weight of old flags without changing the rest of the formula.

## Step 1 — per-flag contribution

```
contribution(flag) = category.weight × severity.multiplier × confidence.multiplier × decay.multiplier
```

## Step 2 — raw totals (per polarity)

```
rawNeg = Σ contribution(flag)  for all negative flags
rawPos = Σ contribution(flag)  for all positive flags
```

## Step 3 — saturate each direction

A straight sum would let a company with many flags blow past any sensible scale. Apply diminishing returns separately to each direction so each component stays in [0, 50):

```
saturate(raw) = 50 × (1 − e^(−raw / K))
```

At `raw = 0`: `saturate = 0` (no effect). As `raw → ∞`: `saturate → 50` (component maxes out).

## Step 4 — combine into 0–100 score

```
score = round(50 + saturate(rawPos) − saturate(rawNeg))
```

A company with no flags has `rawPos = rawNeg = 0`, so `score = 50` exactly — neutral/unknown, not perfect. Green flags push toward 100; red flags push toward 0.

`K` is a single tunable constant. Currently **12**. Raising it makes flags hit more gently; lowering makes them hit harder. Calibrated against the first ~20 real seeded companies — revisit as more data is added.

Example at `K = 12`:

| scenario                                              | rawNeg | rawPos | score |
|-------------------------------------------------------|--------|--------|-------|
| no flags                                              | 0      | 0      | 50    |
| one sourced, severe flag in a weight-3 category        | 9      | 0      | 24    |
| same, plus one sourced, severe green flag              | 9      | 9      | 50    |
| one sourced, minor flag in a weight-2 category         | 2      | 0      | 42    |
| two sourced, minor red flags in weight-2 categories    | 4      | 0      | 36    |

## Step 5 — traffic-light band

| score   | band   | meaning                  |
|---------|--------|--------------------------|
| 66–100  | green  | low concern              |
| 34–65   | yellow | neutral / insufficient data |
| 0–33    | red    | high concern             |

## Extending this later

- **New category**: add to `categories.json` with a `defaultWeight`. No formula change.
- **New severity level**: add a row to the severity table + its multiplier.
- **Decay**: implement the reserved `decay.multiplier` function; every flag already carries `dateAdded`.
- **Per-user weighting**: categories are already just weighted numbers — a future "mute category X" is a per-user override of `category.weight` at render time, no server-side change.
- **Parent-company inheritance**: a company's displayed score could become the worst of its own score and its parent chain's scores. Not yet implemented.

## Editorial note

Default category weights reflect a starting judgment about relative severity. This is a defensible starting point, not a claim of moral authority — change via normal PRs.
