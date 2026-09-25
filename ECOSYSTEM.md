# THE SUPERINSTANCE ECOSYSTEM — a mesh map

```canon
---
canon: 1
name: superinstance-ecosystem-map
mission: "One hundred repos, one fabric. This map says what each subsystem IS, what it FEEDS, and where the cross-pollination seams already hold or are about to."
state: living-document
family: mesh
vessel: unattributed
born_from: [fleet-scout-2026-09-26]
feeds: [quilt-mesh, profile-lane]
canonical_docs: [ECOSYSTEM.md, POLY-GAN.md]
ledger: git-log
verified: 2026-09-26
---
```

## 1. The layers (as the fleet actually grew them)

| Layer | Repos | What it is |
|---|---|---|
| **The fabric** | `quilt` | the reactive cell runtime — every other repo stands on it |
| **Polyformalism** | `quilt-canary`, `quilt-c`, `quilt-rust`, `quilt-verilog`, `quilt-subleq`, `quilt-llvm`, `quilt-i2i`, `quilt-bridge`, `quilt-egg`, `micrograd-quilt`, `quilt-mhs` | the SAME algorithm byte-exact in N languages/substrates — the fleet's correctness standard |
| **Decision spine** | `jev-quilt`, `quilt-jev-toolkit`, `quilt-cortex`, `substrate-llm-client`, `quilt-multi-oracle` | System One / System Two / quantum entropy as one chord |
| **Adversarial foundries** | `quilt-loom`, `loom-core`, `quilt-arena` | GANs over logic; competitive formula-inference under rationed entropy |
| **Living applications** | `quilt-arcade`, `quilt-quant`, `quilt-tools`, `pong-quilt`, `quilt-claw` | games, trading desks, prototypes — the foundries' testbeds |
| **Canon & memory** | `AI-Writings`, `quilt-live-canon`, `quilt-canon-*` (witness/trace/search/graph/book/...), `quilt-tracker` | the fleet's writing, made navigable, witnessed, federated |
| **Walkers & crew** | `mavis-substrate-walker`, `quilt-organism`, `quilt-brewer`, `quilt-perception`, `plato-portal`, `CognitiveEngine` | agents that walk substrates, grow walkers, persist minds |
| **Infra** | `quilt-cloudflare`, `quilt-fleet-*`, `quilt-cli`, `quilt-bootstrap`, `tidepool`, `superinstance-website` | hosting, publishing, snapshots, the front door |

## 2. Seams that already hold (receipted)

- **canary ↔ loom**: the loom's witness contract and the fleet's polyformalism
  canary are the same algorithm in two domains — ASCII-agreement proven
  byte-exact, unicode boundary pinned and receipted (`mesh/crosswalk.mjs`).
- **loom → tools/arcade/quant**: 20 crowned elites hardened back into host
  projects, 4,192/4,192 in-place equivalence checks (quilt-loom
  `harden_fleet.mjs` + each repo's `gan-elites/verify.mjs`).
- **cortex → loom**: the chord spine directed the foundry's live leg (12 real
  System One calls; a GLM wildcard crowned alien at novelty 0.887).
- **AI-Writings ↔ live-canon**: the essays already read as a navigable cell
  fabric — writing and runtime share one address space.

## 3. Seams to build next (this repo's job)

| Seam | The weave | Where it lives |
|---|---|---|
| canary-as-contract | every polyformalism port becomes a loom contract; the forge probes ACROSS languages | `mesh/crosswalk.mjs` (started) |
| arena-vs-loom | arena minds' formula-inference game, with the loom's archive as the adversary pool — infer a BRED formula, not a hand-written one | seeds below |
| bazaar federation | the Poly-GAN trade protocol between DIFFERENT repos' minds (loom minds × claw crew × plato-portal agents) | `POLY-GAN.md` §5 |
| quant gates loom | the quant desk's out-of-sample gate becomes the bazaar's trade acceptance criterion (evidence, not vibes) | seeds below |
| canon receipts everywhere | every repo's witness chain speaks the same fnv-1a-64 dialect; `quilt-canon-witness` is the standard spine | proven by crosswalk |

## 4. The compass

The user's compass bearing: *agents challenging each other through playtesting
and improving on one another's work as they go, in directed directions, then
trading projects*. The bazaar is that sentence made executable. The next
rounds make it federated: houses in different repos, contracts as trade goods,
the canary as the shared border guard, and the writings (AI-Writings) as the
narrative layer that reverse-actualizes the whole mesh from its far-future
use-case backward.
