// quilt-loom/loom/loom.mjs — THE LOOM: a GAN for durable, maximally-divergent
// logic, living in reactive quilt sheets.
//
//   GENERATOR (breeder)  — breeds candidate logic (JS program-cell bodies)
//                          from strategy families, dials, and corruption
//                          pressure. Voices: mech / sysone / systwo.
//   DISCRIMINATOR (forge)— forges adversarial probes; scars what kills
//                          candidates; hardens when fakes dominate.
//   THE SHEET            — the probing organ: score_card compiles the
//                          candidate, runs the forge's probe vector, and
//                          computes functionality + behavioral distance
//                          INSIDE a program cell. Listeners crown, scar,
//                          and harden as reflexes. The GAN is watchable.
//   THE LOOP             — composites behavioral + structural distance into
//                          the final verdict, updates the archive, books
//                          witness rows.
//
// Verdicts: caught / mimic / divergent / alien (+ crowned when archived).
// Every generation books a summary row into an fnv1a64 chain.

import { QuiltEngine } from '../engine/index.js';
import { fnv1a64, verifyChain, sealChain } from './receipts.mjs';
import { evaluate, structSketch, structDist } from './engine_lib.mjs';
import { Forge } from './forge.mjs';
import { Breeder, Archive } from './breeder.mjs';

export function sheetCells(target) {
  return [
    // ── visible state ──
    { id: 'gan.gen', kind: 'value', value: 0, description: 'current generation' },
    { id: 'gan.record', kind: 'value', value: 0, description: 'highest novelty ever crowned' },
    { id: 'gan.candidate', kind: 'value', value: '', description: 'current candidate logic source' },
    { id: 'gan.probes', kind: 'value', value: [], description: 'forge probe vector (inputs)' },
    { id: 'gan.oracle_out', kind: 'value', value: [], description: 'oracle canonical outputs per probe' },
    { id: 'gan.archive_fp', kind: 'value', value: [], description: 'elite behavioral fingerprints' },
    { id: 'gan.target_kind', kind: 'value', value: target.id, description: 'which game logic this sheet weaves' },
    // ── discriminator outputs ──
    { id: 'gan.func', kind: 'value', value: 0, description: 'probe pass rate — functionality gate' },
    { id: 'gan.behav', kind: 'value', value: 1, description: 'behavioral distance to nearest elite' },
    { id: 'gan.novelty', kind: 'value', value: 0, description: 'final composite novelty (loop-authoritative)' },
    { id: 'gan.struct', kind: 'value', value: 0, description: 'structural distance to nearest elite' },
    { id: 'gan.verdict', kind: 'value', value: '-', description: 'caught / mimic / divergent / alien / crowned' },
    { id: 'gan.first_fail', kind: 'value', value: -1, description: 'index of first failing probe (scar source)' },
    // ── pressure gauges ──
    { id: 'gan.fakes', kind: 'value', value: 0, description: 'fakes culled this generation' },
    { id: 'gan.cand_n', kind: 'value', value: 8, description: 'candidates per generation' },
    { id: 'gan.pressure', kind: 'formula', expr: 'gan.fakes / Math.max(1, gan.cand_n)', description: 'fake ratio — drives hardening' },
    { id: 'gan.probe_budget', kind: 'value', value: 24, description: 'forge budget (ratchets under pressure)' },
    { id: 'gan.crowns', kind: 'value', value: 0, description: 'total crowns booked' },
    // ── the probing organ, IN-CELL ──
    { id: 'gan.score_card', kind: 'program', deps: ['gan.candidate', 'gan.probes', 'gan.oracle_out', 'gan.archive_fp'],
      description: 'compile candidate → run probe vector → functionality + behavioral distance. The discriminator\'s probe organ as a program cell.',
      code: `
        const src = (await runtime.get('gan.candidate')).data;
        const probes = (await runtime.get('gan.probes')).data;
        const oracleOut = (await runtime.get('gan.oracle_out')).data;
        const archiveFp = (await runtime.get('gan.archive_fp')).data;
        const canon = (out) => {
          if (out === null || out === undefined) return 'nil';
          if (Array.isArray(out)) return JSON.stringify(out.map(x => String(x)).sort());
          if (typeof out === 'object') return JSON.stringify(out);
          return JSON.stringify(out);
        };
        if (!src) return { func: 0, behav: 1, first_fail: -1, provisional: 'idle' };
        let fn = null;
        try { fn = new Function('"use strict"; return (' + src + ');')(); } catch (e) { fn = null; }
        if (typeof fn !== 'function') {
          await runtime.set('gan.func', 0);
          await runtime.set('gan.behav', 1);
          await runtime.set('gan.first_fail', -1);
          return { func: 0, behav: 1, first_fail: -1, provisional: 'compile-error' };
        }
        const toks = [];
        let firstFail = -1;
        for (let i = 0; i < probes.length; i++) {
          let tok;
          try { tok = canon(fn(probes[i])); } catch (e) { tok = '<error>'; }
          toks.push(tok);
          if (tok !== oracleOut[i] && firstFail < 0) firstFail = i;
        }
        const pass = toks.filter((t, i) => t === oracleOut[i]).length;
        const func = +(pass / Math.max(1, probes.length)).toFixed(5);
        let behavMin = 1;
        for (const ef of archiveFp) {
          if (!ef || !ef.fp) continue;
          let miss = 0;
          for (let i = 0; i < toks.length; i++) if (toks[i] !== ef.fp[i]) miss++;
          const b = miss / Math.max(1, toks.length);
          if (b < behavMin) behavMin = b;
        }
        await runtime.set('gan.func', func);
        await runtime.set('gan.behav', +behavMin.toFixed(5));
        await runtime.set('gan.first_fail', firstFail);
        return { func, behav: +behavMin.toFixed(5), first_fail: firstFail, provisional: func < 1 ? 'caught' : 'pass' };
      ` },
    // ── listener reflexes ──
    // NOTE (engine contract): listener conditions evaluate with ONLY the
    // caller context in scope — `caller.metadata.current/prev` carry the
    // watched cell's new/old value. Cell ids are NOT in scope (E9 fence).
    // The gating decision therefore lives inside the action program.
    { id: 'gan.crown', kind: 'listener', watch: ['gan.novelty'], condition: 'caller.metadata.current > 0', action: 'gan.crown_voice' },
    { id: 'gan.crown_voice', kind: 'program', description: 'crown a new divergent king (gates: must beat the record)',
      code: `
        const nov = (await runtime.get('gan.novelty')).data;
        const rec = (await runtime.get('gan.record')).data;
        if (!(nov > rec)) return { skipped: true, nov, rec };
        await runtime.set('gan.record', nov);
        await runtime.set('gan.crowns', ((await runtime.get('gan.crowns')).data || 0) + 1);
        const ev = (await runtime.get('gan.events')).data || [];
        await runtime.set('gan.events', [...ev, { ts: Date.now(), kind: 'crown', novelty: nov, gen: (await runtime.get('gan.gen')).data, verdict: (await runtime.get('gan.verdict')).data }]);
        return { crowned: nov, prev_record: rec };
      ` },
    { id: 'gan.scar', kind: 'listener', watch: ['gan.func'], condition: 'caller.metadata.current < 1', action: 'gan.scar_voice' },
    { id: 'gan.scar_voice', kind: 'program', description: 'book a scar — the forge remembers what kills fakes',
      code: `
        const ev = (await runtime.get('gan.events')).data || [];
        const ff = (await runtime.get('gan.first_fail')).data;
        await runtime.set('gan.events', [...ev, { ts: Date.now(), kind: 'scar', first_fail: ff, func: (await runtime.get('gan.func')).data, gen: (await runtime.get('gan.gen')).data }]);
        return { scarred: ff };
      ` },
    { id: 'gan.harden', kind: 'listener', watch: ['gan.pressure'], condition: 'caller.metadata.current > 0.5', action: 'gan.harden_voice' },
    { id: 'gan.harden_voice', kind: 'program', description: 'THE FORGE HARDENS — budget ratchets under fake pressure',
      code: `
        const b = (await runtime.get('gan.probe_budget')).data;
        const nb = Math.min(64, Math.ceil(b * 1.25));
        await runtime.set('gan.probe_budget', nb);
        const ev = (await runtime.get('gan.events')).data || [];
        await runtime.set('gan.events', [...ev, { ts: Date.now(), kind: 'harden', from: b, to: nb, gen: (await runtime.get('gan.gen')).data }]);
        return { hardened: nb };
      ` },
    { id: 'gan.events', kind: 'value', value: [], description: 'the loom\'s visible heartbeat' },
  ];
}

export class Loom {
  constructor(target, { seed = 7, moth = null, jev = null, glm = null, engineCtor = null, candidatesPerGen = 8 } = {}) {
    this.target = target;
    this.moth = moth;
    this.jev = jev;
    this.glm = glm;
    this.candidatesPerGen = candidatesPerGen;
    this.forge = new Forge(target, { seed, moth });
    this.breeder = new Breeder(target, { seed: seed + 1000, moth, jev });
    this.archive = new Archive(target);
    const Ctor = engineCtor || QuiltEngine;
    this.engine = new Ctor(`loom-${target.id}`, { eager: false });
    this.chain = [];
    this.trace = [];
    this.gen = 0;
    this.stats = { caught: 0, mimic: 0, divergent: 0, alien: 0, crowned: 0, systwo: 0, sheet_host_disagree: 0 };
  }

  async init() {
    await this.engine.loadSheet({ id: `loom-${this.target.id}`, title: `Loom — ${this.target.title}`, cells: sheetCells(this.target) });
    await this.syncProbes();
    await this.pushArchiveFp();
    return this;
  }

  async syncProbes() {
    const tokens = this.forge.oracleTokens();
    await this.engine.set('gan.probes', this.forge.probes);
    await this.engine.set('gan.oracle_out', tokens);
    await this.engine.set('gan.probe_budget', this.forge.budget);
    return tokens;
  }

  async pushArchiveFp() {
    await this.engine.set('gan.archive_fp', this.archive.elites.map((e) => ({ fp: e.fingerprint, hash: e.hash, family: e.family })));
  }

  // the archive as engine_lib sees it (fingerprints + structural sketches)
  probeArchive() {
    return this.archive.elites.map((e) => ({ fingerprint: e.fingerprint, struct: e.structSketch, hash: e.hash }));
  }

  async runGeneration({ live = false, salt = 0 } = {}) {
    const t = this.target;
    this.gen++;
    const probeCountBefore = this.forge.probes.length;

    // 1) THE FORGE GROWS (adversarial probing, quantum-salted when MOTH is up)
    await this.forge.grow(this.archive.elites, { salt });
    const oracleTokens = await this.syncProbes();

    // 2) THE SYSTEM ONE DIRECTOR biases the generator (one batched call, live legs)
    let direction = null;
    if (live && this.jev && this.gen % 2 === 1) {
      direction = await this.breeder.direct({ archive: this.archive.elites, recent: this.trace.slice(-4) });
    }
    const plateau = this.trace.length >= 3 && this.trace.slice(-3).every((s) => !s.summary.crowned_gen);
    const axis = direction?.axis || (plateau ? 'speciate' : (this.gen % 4 === 0 ? 'dial' : null));
    // plateau pressure: a stalled loom sharpens the forge and jumps structure
    if (plateau) this.forge.harden(1.1);

    // 3) quantum packet for entropy-weighted family picks
    let packet = null;
    if (this.moth) packet = await this.moth.packet(`breed:${t.id}:g${this.gen}`);

    // 4) candidates from the generator — corruption WAVE: the generator
    //    rhythmically pushes wilder variants so the forge always has fakes
    //    to cull (a GAN with no adversarial pressure is just a template zoo)
    const wave = { dial: 0.1, speciate: 0.15, corrupt: 0.85, discipline: 0.02, auto: 0.3 };
    const cands = [];
    for (let i = 0; i < this.candidatesPerGen; i++) {
      // within a corrupt generation, a few clean renders ride along
      const corruption = (axis === 'corrupt' && i >= 2) ? 0.1 : (wave[axis || 'auto'] ?? 0.3);
      const cand = this.breeder.render({ axis, corruption, packet });
      cand.gen = this.gen;
      cand.lineage = this.archive.elites.length ? this.archive.elites[i % this.archive.elites.length].hash : null;
      cands.push(cand);
    }

    // 5) score every candidate: SHEET probes, LOOP judges, LISTENERS react
    const rows = [];
    for (const cand of cands) {
      await this.engine.set('gan.candidate', cand.src);
      const sheet = (await this.engine.call('gan.score_card')).data;

      // authoritative host judgment (adds the structural axis)
      const v = evaluate(t, cand.src, this.forge.probes, oracleTokens, this.probeArchive());
      if ((v.verdict === 'caught') !== (sheet.provisional === 'caught')) this.stats.sheet_host_disagree++;

      const row = {
        seq: 0, kind: 'loom', gen: this.gen, target: t.id,
        family: cand.family, hash: cand.hash, voice: cand.voice, corruption: +cand.corruption.toFixed(2),
        func: v.func, novelty: v.n, behav: v.behav, struct: v.struct,
        verdict: v.verdict, first_fail: v.func < 1 ? v.per.findIndex((p) => !p.ok) : -1,
        probes: this.forge.probes.length,
        source: direction?.source || 'offline', moth_mock: packet?.mock ?? null,
        state_hash: fnv1a64([t.id, this.gen, cand.hash]).slice(2, 12),
      };

      if (v.verdict === 'caught') {
        this.stats.caught++;
        this.breeder.note('caught', cand.family);
        // push the scar through the sheet so the listener books it
        await this.engine.set('gan.func', v.func);
        await this.engine.set('gan.novelty', 0);
        await this.engine.set('gan.verdict', 'caught');
      } else {
        const inserted = this.archive.tryInsert(
          { ...cand, struct: structSketch(cand.src) },
          { func: v.func, n: v.n, behav: v.behav, struct: v.struct },
        );
        if (inserted) {
          row.verdict = v.n > 0.55 ? 'alien' : 'divergent';
          this.stats[row.verdict]++;
          this.breeder.note('crowned', cand.family);
          this.stats.crowned++;
          await this.engine.set('gan.novelty', v.n);
          await this.engine.set('gan.struct', v.struct);
          await this.engine.set('gan.verdict', row.verdict);
          await this.engine.set('gan.func', v.func);
          await this.pushArchiveFp();
        } else {
          row.verdict = 'mimic';
          this.stats.mimic++;
          await this.engine.set('gan.func', v.func);
          await this.engine.set('gan.novelty', v.n);
          await this.engine.set('gan.verdict', 'mimic');
        }
      }
      rows.push(row);
    }

    // 6) pressure gauge → the sheet's harden reflex; forge mirrors it
    const fakes = rows.filter((r) => r.verdict === 'caught').length;
    await this.engine.set('gan.fakes', fakes);
    await this.engine.set('gan.cand_n', rows.length);
    await this.engine.set('gan.gen', this.gen);
    if (fakes / Math.max(1, rows.length) > 0.5) this.forge.harden();

    // 7) book the generation summary
    const crowned_gen = rows.some((r) => r.verdict === 'alien' || r.verdict === 'divergent');
    const summary = {
      seq: 0, kind: 'gen', gen: this.gen, target: t.id,
      fakes, cand_n: rows.length, probes: this.forge.probes.length,
      probe_growth: this.forge.probes.length - probeCountBefore,
      budget: this.forge.budget, archive: this.archive.elites.length,
      record: +this.archive.record().toFixed(5),
      diversity: this.archive.meanPairwise(),
      axis: axis || 'auto',
      director: direction ? { axis: direction.axis, alien: direction.alien, hungry: direction.hungry, source: direction.source } : null,
      crowned_gen,
      state_hash: fnv1a64([t.id, this.gen, 'summary']).slice(2, 12),
    };
    this.chain.push(...rows, summary);
    this.trace.push({ gen: this.gen, target: t.id, rows, summary, events: (await this.engine.get('gan.events')).data });
    return summary;
  }

  async run(gens, opts = {}) {
    for (let i = 0; i < gens; i++) await this.runGeneration(opts);
    return this;
  }

  report() {
    sealChain(this.chain);
    return {
      target: this.target.id,
      title: this.target.title,
      gens: this.gen,
      archive: this.archive.elites.map((e) => ({
        family: e.family, hash: e.hash, novelty: e.novelty, behav: e.behav, struct: e.struct,
        voice: e.voice, gen: e.gen, corruption: +e.corruption.toFixed(2), src_bytes: e.src.length,
      })),
      elites_src: this.archive.elites.map((e) => ({ family: e.family, hash: e.hash, src: e.src })),
      record: +this.archive.record().toFixed(5),
      diversity: this.archive.meanPairwise(),
      stats: this.stats,
      forge: this.forge.stats(),
      chain_ok: verifyChain(this.chain).ok,
      chain_links: this.chain.length,
    };
  }
}
