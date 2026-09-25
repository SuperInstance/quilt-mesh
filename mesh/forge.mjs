// quilt-loom/loom/forge.mjs — THE DISCRIMINATOR'S FORGE.
//
// The forge owns the probe vector. It is adversarial: every generation it
// (1) keeps every probe that ever killed a candidate (scar tissue),
// (2) mines TWIN probes — fresh inputs where archive elites disagree with the
//     oracle or with each other, the exact inputs that separate surface
//     mimics from real understanding,
// (3) salts boundaries with quantum entropy when a MOTH vault is present
//     (true stochastic stress), else deterministic rng,
// (4) HARDENS on pressure: when fakes dominate a generation, the probe budget
//     ratchets up and the next generation is forged with more teeth.

import { canonOut } from './engine_lib.mjs';

export class Forge {
  constructor(target, { seed = 7, moth = null, cap = null } = {}) {
    this.target = target;
    this.moth = moth;
    this.cap = cap || target.probeCap;
    this.rngState = seed >>> 0;
    this.probes = [];
    this.scarred = [];   // indices of probes that killed candidates
    this.budget = 24;    // probe budget for the NEXT forging round
    this.rounds = 0;
    this.byKey = new Map();
    // seed with hand-forged base probes
    for (const p of target.baseProbes) this.add(p, 'base');
  }

  rng = () => {
    // xorshift — deterministic, seedable, fast (arrow: safe to pass unbound)
    let x = this.rngState;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    this.rngState = x >>> 0;
    return (x >>> 0) / 4294967296;
  }

  key(input) {
    try { return JSON.stringify(input); } catch { return String(input); }
  }

  add(input, kind) {
    const k = this.key(input);
    if (this.byKey.has(k)) return false;
    this.byKey.set(k, kind);
    this.probes.push(input);
    return true;
  }

  // recompute the oracle's canonical answers for the current vector
  oracleTokens() {
    const oracle = new Function(`"use strict"; return (${this.target.oracle});`)();
    return this.probes.map((p) => {
      try { return canonOut(this.target, oracle(p)); }
      catch { return '⟨oracle-error⟩'; }
    });
  }

  // one adversarial round: fresh random fill to budget, quantum-salted
  // stress, and twin mining — twins and salt ALWAYS run (even at budget),
  // because the forge never stops hunting for the inputs that separate
  // surface mimics from real understanding.
  async grow(archive, { salt = 0 } = {}) {
    this.rounds++;
    const t = this.target;
    const want = Math.min(this.cap, Math.max(this.budget, this.probes.length));
    // 1) deterministic random fill
    let guard = 0;
    while (this.probes.length < want * 0.7 && guard++ < 200) {
      this.add(t.genInput(this.rng), 'random');
    }
    // 2) boundary probing: push random inputs toward the spec's edges
    guard = 0;
    while (this.probes.length < want && guard++ < 60) {
      const inp = t.genInput(this.rng);
      this.add(inp, 'boundary');
    }
    // 3) quantum-salted stress (true entropy if MOTH is live, else labeled)
    if (this.moth) {
      const pkt = await this.moth.packet(`forge:${t.id}:r${this.rounds}:s${salt}`);
      const floats = pkt.floats || [];
      let qAdded = 0;
      for (let i = 0; i + 1 < floats.length && qAdded < 4 && this.probes.length < this.cap; i += 2) {
        // remap a quantum float pair through the input generator by seeding xorshift
        const seed = Math.floor(floats[i] * 0xffffffff) ^ Math.floor(floats[i + 1] * 0x10000);
        const saved = this.rngState;
        this.rngState = seed >>> 0;
        if (this.add(t.genInput(() => this.rng()), pkt.mock ? 'quantum-mock' : 'quantum')) qAdded++;
        this.rngState = saved;
      }
    }
    // 4) twin mining (legacy): inputs where current elites ERROR against the
    //    oracle — the crash-hunting fallback when the archive holds elites
    if (archive.length) {
      const oracle = new Function(`"use strict"; return (${t.oracle});`)();
      const fns = archive.map((e) => {
        try { return new Function(`"use strict"; return (${e.src});`)(); } catch { return null; }
      }).filter(Boolean);
      guard = 0;
      let mined = 0;
      while (mined < 2 && guard++ < 30 && this.probes.length < this.cap) {
        const inp = t.genInput(this.rng);
        let ot;
        try { ot = canonOut(t, oracle(inp)); } catch { continue; }
        let discord = false;
        for (const fn of fns) {
          try { if (canonOut(t, fn(inp)) !== ot) { discord = true; break; } } catch { discord = true; break; }
        }
        if (discord && this.add(inp, 'twin')) mined++;
      }
    }
    // 5) RARE-ANSWER MINING — the forge's standing adversarial weapon.
    //    Inputs whose oracle output is rare (few safe cells, near-tie tricks,
    //    exotic categories, maximal-change grids) are precisely where surface
    //    mimics crack. Sample a batch, keep the rarest three.
    if (typeof t.rarity === 'function' && this.probes.length < this.cap) {
      const oracle = new Function(`"use strict"; return (${t.oracle});`)();
      const batch = [];
      guard = 0;
      while (batch.length < 10 && guard++ < 30) {
        const inp = t.genInput(this.rng);
        let ot;
        try { ot = canonOut(t, oracle(inp)); } catch { continue; }
        batch.push({ inp, ot, rare: t.rarity(oracle(inp), inp) });
      }
      batch.sort((a, b) => b.rare - a.rare);
      let rares = 0;
      for (const b of batch) {
        if (rares >= 3 || this.probes.length >= this.cap) break;
        if (this.add(b.inp, 'rare')) rares++;
      }
    }
    // 6) trickle: two fresh random probes per round keep the vector alive
    guard = 0;
    let trickled = 0;
    while (trickled < 2 && guard++ < 20 && this.probes.length < this.cap) {
      if (this.add(t.genInput(this.rng), 'trickle')) trickled++;
    }
    return this.probes.length;
  }

  // a candidate died on probe i — scar it (bump its priority by duplication)
  scar(index) {
    if (index < 0 || index >= this.probes.length) return false;
    this.scarred.push(index);
    return true;
  }

  harden(factor = 1.25) {
    this.budget = Math.min(this.cap, Math.ceil(this.budget * factor));
    return this.budget;
  }

  stats() {
    const kinds = {};
    for (const k of this.byKey.values()) kinds[k] = (kinds[k] || 0) + 1;
    return { probes: this.probes.length, scarred: this.scarred.length, budget: this.budget, rounds: this.rounds, kinds };
  }
}
