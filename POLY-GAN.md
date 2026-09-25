# THE POLY-GAN — a patch-trade protocol for agent minds

```canon
---
canon: 1
name: poly-gan-bazaar
mission: "More than RL/ML: minds with different generator doctrines playtest each other's bred logic, trade patch-samples, and weave what survives their own immune system — a quilt emerging from patches of other ideas, more functional than any house alone."
state: working
family: divergence-foundry
vessel: unattributed
born_from: [quilt-loom, loom-core, quilt-canary, jev-quilt]
feeds: [quilt-mesh, live-canon]
canonical_docs: [POLY-GAN.md, mesh/bazaar.mjs]
ledger: git-log
verified: 2026-09-26
---
```

## 1. The idea

A GAN has a generator and a discriminator. The Poly-GAN has **many of each,
living in different houses**. Each mind is a full foundry: its own doctrine
(which algorithmic families it believes in), its own forge (probe vectors
scarred by its own fakes), its own archive (what it has crowned). No two
houses see the same contract the same way — and that is the point.

A **trade** is not a merge. When mind A sends mind B a patch-sample (a crowned
implementation), B does not trust it. B's forge re-probes it under B's own
scar tissue, B's structural immune system screens it against B's own
bloodlines, and only what is **exact AND novel-to-B** is woven into B's
archive with a `traded:` prefix and a receipt. The weave changes what B IS:
B can now breed descendants of a bloodline its own doctrine could never
produce.

## 2. The rules (v2, after the v1 lesson)

1. **Doctrine-diversity, not seed-diversity.** The v1 bazaar ran two minds on
   the same doctrine with different seeds — they converged to IDENTICAL elite
   sets (byte-identical crown hashes). Mech breeding is deterministic per
   family: seeds are fake-diversity. Real Poly-GAN requires houses that
   genuinely believe different things (family subsets, dial priors, prompt
   doctrines for the LLM voices).
2. **The receiver judges everything.** Sender receipts do not travel as truth;
   they travel as CLAIMS. The receiver's forge is the only judge that matters
   at the border.
3. **Re-trades are mimics.** A patch that came from a trade is barred from
   being traded back as new blood (struct=0 against its own source).
4. **Shared-doctrine trades bounce.** If both houses breed the same family,
   the patch is structurally 0 to the receiver — correct rejection. The
   bazaar is not a merger; it is an exchange of the *impossible*.
5. **The metric is bloodline coverage.** Diversity deltas are context, not
   headline (the weave can even lower mean-pairwise diversity while adding a
   bloodline). The honest number: how many doctrines live in the house before
   and after, vs the solo cap.

## 3. What a run looks like (v2, real numbers)

```
mind A (bigint doctrine: bigint_fold + word_pairs)   elites=3  doctrines=2
mind B (bit doctrine:   hilo32 + word_pairs)         elites=2  doctrines=2

trade A→B bigint_fold/aa28e37705: woven  (receiver-novelty 0.845)
trade A→B bigint_fold/1a40c09143: woven  (receiver-novelty 0.027)
trade B→A hilo32/3d237a99ef:      woven  (receiver-novelty 0.848)
trade *→* word_pairs/*:           mimic  (shared doctrine — correct bounce)

mind A: doctrines 2 → 3 (gained the bit-doctrine bloodline)
mind B: doctrines 2 → 3 (gained the bigint bloodline)
solo control: doctrines capped at 2 forever
```

Every woven patch is ASCII-EXACT against the fleet's polyformalism canary
(`mesh/crosswalk.mjs` judges bred elites against quilt-canary's domain) —
traded logic crosses houses *and* stays byte-faithful to the fleet standard.

## 4. Why this is more than RL/ML

RL optimizes a scalar. A Poly-GAN bazaar optimizes **a population's coverage
of a solution space** through *social* mechanics: specialization (doctrines),
trade (patch-samples), immunity (receiver-side re-judgment), and memory
(witness-chained receipts). The reward is not a number — it is **what a house
can now do that it could not do alone**. The equilibrium is not a policy; it
is a **mesh**: every house holding bloodlines it could never have bred, every
bloodline provably exact against the shared canary.

## 5. Seeds for the next rounds

- **Live voices at the border**: a receiver's systwo (LLM) voice could be
  asked to *explain* why a traded patch is alien to its house before weaving
  — the explanation becomes the trade's provenance document.
- **Doctrine drift**: after N trades, a house may promote a `traded:` family
  to a first-class doctrine (it "believes" it now) — measure belief
  propagation across the mesh.
- **Contract trades**: the deeper game — minds don't just trade
  implementations, they trade *contracts* (each house's spec is a belief
  about what matters); the crosswalk receipts where contracts genuinely
  diverge (see the utf-8/code-units finding).
