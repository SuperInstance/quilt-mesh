# DOCTRINE DRIFT — the measurement (2026-09-26)

POLY-GAN §5 asked two seed questions. This instrument answers both from
existing receipts — no new breeding, no live calls, 18 hash-chained rows
(`outputs/drift_receipts.json`, `drift_trace.jsonl`; chart:
`outputs/doctrine_drift.png`).

**Run it:** `node doctrine_drift.mjs` (inputs are provenance-noted snapshots
in `outputs/`: the loom foundry's 1920-specimen offline run + the Poly-GAN
v2 bazaar receipts).

## 1. Foundry bloodline entropy NARROWS — the archive saturates early

Per-target Shannon entropy of the crowned-family distribution, first half of
generations vs second half (loom offline run, 24 gens, 1920 candidates):

| target | crowns | families | H early | H late |
|---|---|---|---|---|
| mines_safe | 3 | 2 | 0.918 | 0 |
| reversi_flips | 7 | 4 | 1.500 | 0 |
| life_step | 8 | 4 | 1.906 | 0 |
| hearts_trick | 11 | 4 | 1.561 | 0 |
| holdem_cat | 6 | 3 | 1.585 | 0 |
| pager_band / witness_fnv / cosine_sparse / hand_eval5 / gate_law | 3–4 | 3 | 0.918–1.585 | 0 |

Every bloodline crowns in the FIRST half; second-half entropy is zero across
all 10 targets. The MAP-Elites archive is a *saturating* structure: after the
families fill, generations only re-derive mimics. This quantifies the stage-11
finding ("mechanical voice saturates at ~11–17 shapes per target") and sharpens
it: **saturation is temporal as well as numerical** — late mech generations
contribute nothing new. The engines of novelty past saturation are exactly the
two voices we added: System One direction and System Two wildcards (the live
legs; the crowned GLM alien at novelty 0.887 came after mech saturation).

## 2. The bazaar border has an immune system — and it works

Trade edges from the v2 bazaar (2 houses, 7 attempts, 3 woven, 4 caught):

| edge | family | attempts → woven | |
|---|---|---|---|
| A→B | bigint_fold | 2 → 2 | strong belief-good: both weaves accepted |
| B→A | hilo32 | 1 → 1 | accepted |
| A→B | word_pairs | 1 → 0 | caught in transit |
| B→A | word_pairs | 1 → 0 | caught in transit |
| B→A | **traded:bigint_fold** | 2 → 0 | **re-trade bounces** |

The doctrine "re-trades are mimics — a patch that came from a trade is barred
from being traded back as new blood" is now visible in data as a 0/2 bounce:
house A received bigint_fold from B, wove it, and when B's later lineage of
the same family tried to re-enter A's border, A's forge rejected every
attempt. The border distinguishes *native* novelty from *imported* novelty —
an immune system against circular belief inflation.

## 3. Doctrine adoption did not happen (yet) — the honest negative

The §5 seed asked whether a house promotes a traded family to first-class
doctrine ("it believes it now"). Measured: **no adoption** — `bigint_fold`
wove into B but never entered B's breeding doctrine; `hilo32` likewise for A.
Woven logic lives in the receiver's archive but does not yet breed. That is
the difference between *having* and *believing*; the mesh currently has an
immune system without a naturalization process. If adoption is wanted, the
promotion rule must be explicit (e.g. a traded family that survives N
receiver-side hardenings without a scar earns a doctrine slot) — that is the
natural v3 protocol step, and this instrument is the yardstick it must move.

## Method notes

- Entropy computed over crowned families per half-run; crowns are the
  MAP-Elites archive entries (`outputs/loom_foundry_snapshot.json`,
  copied from quilt-loom `outputs/results.json`, offline run `divergence-foundry`,
  0 live calls, provenance in that repo).
- Bazaar edges aggregated from `outputs/bazaar_receipts.json` trade_log
  (Poly-GAN v2, doctrine-diverse minds A/B, seal in receipts).
- Everything is deterministic and replayable: `node doctrine_drift.mjs`.
