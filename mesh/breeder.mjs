// quilt-loom/loom/breeder.mjs — THE GENERATOR.
//
// Three voices, one archive, MAP-Elites style selection:
//   mech    — renders a strategy family template with dials + corruption
//             pressure (0 tokens — the mechanical voice)
//   sysone  — ONE System One batch call per generation asks three typed
//             questions at once (axis, family bias, alien-ness) and the
//             answers bias the mechanical voice (batched, cheap, receipted)
//   systwo  — on deep plateau, a wildcard whole-body rewrite (expensive,
//             rare, only in LIVE legs)
//
// Selection keeps a per-target elite archive of the most divergent CORRECT
// logic — the "durable" product of the loom. Fakes are not wasted: every fake
// scars the forge.

import { fnv1a64 } from './receipts.mjs';
import { structSketch, structDist as structDistOf } from './engine_lib.mjs';

export class Breeder {
  constructor(target, { seed = 11, moth = null, jev = null } = {}) {
    this.target = target;
    this.moth = moth;
    this.jev = jev;
    this.rngState = seed >>> 0;
    this.familyStats = Object.fromEntries(target.families.map((f) => [f.id, { tries: 0, crowned: 0, caught: 0 }]));
    this.axisHistory = [];
    // novelty-search memory: per family, the structural sketches already bred
    this.seen = Object.fromEntries(target.families.map((f) => [f.id, []]));
    this.renderStats = { attempts: 0, distinct: 0, walksWon: 0 };
  }

  rng = () => {
    let x = this.rngState;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    this.rngState = x >>> 0;
    return (x >>> 0) / 4294967296;
  }

  // entropy-weighted family pick: uniform base + crowned-family boost, then
  // quantum tie-break when MOTH is present and two families sit within ε
  pickFamily(archive, axis = null) {
    const F = this.target.families;
    const weights = {};
    for (const f of F) {
      const st = this.familyStats[f.id];
      let w = 1;
      if (st.crowned > 0) w += 0.6 * Math.min(3, st.crowned);       // winners earn reproduction
      if (st.crowned === 0 && st.tries > 3) w += 0.25;              // starving families get chances
      if (axis === 'speciate') w += 0.5;                            // divergence pressure
      weights[f.id] = w;
    }
    // quantum-weighted pick through the MOTH packet when available
    if (this.moth) {
      // synchronous pick from a cached packet is not possible — the loop
      // passes a pre-fetched packet via this.pendingPacket instead
      if (this.pendingPacket) {
        const floats = this.pendingPacket.floats || [];
        const entries = Object.entries(weights);
        const total = entries.reduce((a, [, w]) => a + w, 0);
        const u = (floats[0] ?? this.rng()) * total;
        let acc = 0;
        for (const [k, w] of entries) { acc += w; if (u <= acc) return F.find((f) => f.id === k); }
        return F[F.length - 1];
      }
    }
    const entries = Object.entries(weights);
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let u = this.rng() * total;
    for (const [k, w] of entries) { u -= w; if (u <= 0) return F.find((f) => f.id === k); }
    return F[F.length - 1];
  }

  // one candidate: family × dials × corruption pressure, with NOVELTY-SEARCH
  // RENDER WALKS — the family renders a small batch of dial variants and the
  // one structurally FARTHEST from everything the family has already bred
  // wins. This is the generator's own divergence pressure: don't repeat
  // yourself, mutate away from your lineage.
  render({ family = null, corruption = 0, axis = null, packet = null } = {}) {
    this.pendingPacket = packet;
    const fam = family || this.pickFamily(this.target, axis);
    this.pendingPacket = null;
    this.familyStats[fam.id].tries++;
    const corrupt = Math.max(0, Math.min(1, corruption));
    const BATCH = 4;
    let best = null;
    const seen = this.seen[fam.id];
    for (let i = 0; i < BATCH; i++) {
      this.renderStats.attempts++;
      const src = fam.render(this.rng, corrupt);
      const hash = fnv1a64(src).slice(2, 12);
      const sk = structSketch(src);
      if (!seen.some((s) => s.hash === hash)) this.renderStats.distinct++;
      // distance to the nearest thing this family has ever bred
      let dMin = 1;
      for (const s of seen) { const d = structDistOf(sk, s.sk); if (d < dMin) dMin = d; }
      if (seen.length === 0) dMin = 1;
      if (!best || dMin > best.dMin) best = { src, hash, sk, dMin };
    }
    if (seen.length) this.renderStats.walksWon++; // walked instead of first-render
    seen.push({ hash: best.hash, sk: best.sk });
    if (seen.length > 240) seen.shift();
    return { src: best.src, family: fam.id, hash: best.hash, corruption: corrupt, voice: 'mech' };
  }

  // System One director: ONE batched call, THREE typed questions. Returns
  // the axis + alien reading so the caller can bias the next render.
  async direct({ archive, recent }) {
    if (!this.jev) return null;
    const plateau = recent.length >= 3 && recent.slice(-3).every((r) => !r.crowned);
    const state = [
      `target: ${this.target.id} — ${this.target.spec}`,
      `archive size: ${archive.length}; recent generations crowned: ${recent.slice(-4).filter((r) => r.crowned).length}`,
      `family ledger: ${JSON.stringify(this.familyStats)}`,
      plateau ? 'STATUS: novelty plateau — nothing new has been crowned recently.' : 'STATUS: diverging.',
    ].join('\n');
    const questions = {
      axis: {
        type: 'choice',
        instructions: 'Which mutation axis should the generator push NEXT to find a maximally different CORRECT implementation?',
        criteria: {
          speciate: 'jump to a different structural family entirely',
          dial: 'stay in family but re-roll the structural dials',
          corrupt: 'raise corruption pressure — breed wilder variants, let the forge cull',
          discipline: 'lower corruption — too many fakes lately, aim for clean renders',
        },
      },
      alien: {
        type: 'score',
        instructions: 'How alien is the current archive lineage compared to a textbook implementation?',
        criteria: ['textbook', 'familiar', 'odd', 'alien'],
      },
      hungry: {
        type: 'noul',
        instructions: 'Is the archive still hungry for more divergent members?',
      },
    };
    const { answers, source, mock } = await this.jev.decide(state, questions, { tag: `loom-direct:${this.target.id}` });
    const axis = answers.axis?.choice || 'dial';
    this.axisHistory.push({ axis, source, mock });
    return { axis, alien: answers.alien?.score, hungry: answers.hungry?.noul, source, mock, plateau };
  }

  note(verdict, familyId) {
    if (verdict === 'crowned') this.familyStats[familyId].crowned++;
    if (verdict === 'caught') this.familyStats[familyId].caught++;
  }
}

// ── the elite archive (the durable product) ─────────────────────────────────
export class Archive {
  constructor(target, { cap = 12, dedupe = 0.06 } = {}) {
    this.target = target;
    this.cap = cap;
    this.dedupe = dedupe; // structural distance below which two elites are "the same shape"
    this.elites = [];
    this.rejected = 0;
    this.everCrowned = 0;
  }

  tryInsert(cand, verdict) {
    if (verdict.func < 1) return false;
    // dedupe against existing elites (structural sketch vs sketch)
    for (const e of this.elites) {
      const d = structDistOf(cand.struct, e.structSketch);
      if (d < this.dedupe) { this.rejected++; return false; }
    }
    const entry = {
      src: cand.src,
      hash: cand.hash,
      family: cand.family,
      voice: cand.voice || 'mech',
      gen: cand.gen,
      novelty: verdict.n,
      behav: verdict.behav,
      struct: verdict.struct,
      fingerprint: verdict.fingerprint,
      structSketch: cand.struct,
      lineage: cand.lineage || null,
      corruption: cand.corruption ?? 0,
    };
    if (this.elites.length < this.cap) {
      this.elites.push(entry);
      this.elites.sort((a, b) => b.novelty - a.novelty);
      this.everCrowned++;
      return true;
    }
    // crowd-replace the least novel elite
    const worst = this.elites[this.elites.length - 1];
    if (verdict.n > worst.novelty) {
      this.elites[this.elites.length - 1] = entry;
      this.elites.sort((a, b) => b.novelty - a.novelty);
      this.everCrowned++;
      return true;
    }
    this.rejected++;
    return false;
  }

  record() {
    return this.elites.length ? Math.max(...this.elites.map((e) => e.novelty)) : 0;
  }

  meanPairwise() {
    // mean pairwise STRUCTURAL distance — the diversity index of the elites
    const S = this.elites.map((e) => e.structSketch || structSketch(e.src));
    let sum = 0, n = 0;
    for (let i = 0; i < S.length; i++) for (let k = i + 1; k < S.length; k++) {
      sum += structDistOf(S[i], S[k]); n++;
    }
    return n ? +(sum / n).toFixed(5) : 0;
  }
}

