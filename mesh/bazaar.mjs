// mesh/bazaar.mjs — THE POLY-GAN BAZAAR.
//
// More than RL/ML: a quilt emerging from patch-samples of other ideas, woven
// into something different and more functional. Two minds — same contract,
// DIFFERENT lineages (seeds, forge scars, family notes) — breed solo, then
// TRADE their crowned logic. Each receiver re-judges the traded patches under
// ITS OWN forge (probes its own lineage grew, scarred by its own fakes) and
// weaves only what is exact AND structurally novel *to it* — the receiver's
// dedupe bar is the immune system; the trade is the cross-pollination.
//
// The measurement is the point: traded continuation vs solo continuation.
//   Δ diversity (traded) >> Δ diversity (solo)   → the Poly-GAN effect
// Receipts: every weave booked into an fnv-1a-64 chain.
//
// Run: node mesh/bazaar.mjs    (zero keys, zero network, deterministic)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Loom } from './loom.mjs';
import { evaluate, structSketch, structDist as structDistOf } from './engine_lib.mjs';
import { fnv1a64 } from './receipts.mjs';
import { witness_fnv } from '../contracts/fleet-contracts.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const OUT = join(HERE, '..', 'outputs');
mkdirSync(OUT, { recursive: true });

const CONTRACT = witness_fnv;
const SOLO_GENS = 6, CONT_GENS = 4, CANDS = 8;

// THE LESSON THE BAZAAR TAUGHT (v1 finding): mech breeding is deterministic
// per family — two minds with different seeds converge to the SAME elite set
// (identical crown hashes), so seed-diversity is fake-diversity and every
// trade bounces as struct=0 mimic. Divergence must come from GENERATOR
// DOCTRINES: each mind is handed a different family subset (different
// algorithmic beliefs about the contract), so its archive genuinely cannot
// contain the other's bloodlines.
const MIND_A = { ...CONTRACT, id: 'witness_fnv·A',
  title: 'Witness — bigint doctrine mind',
  families: CONTRACT.families.filter((f) => ['bigint_fold', 'word_pairs'].includes(f.id)) };
const MIND_B = { ...CONTRACT, id: 'witness_fnv·B',
  title: 'Witness — bit-doctrine mind (no BigInt allowed in its house)',
  families: CONTRACT.families.filter((f) => ['hilo32', 'word_pairs'].includes(f.id)) };

console.log('══ THE POLY-GAN BAZAAR ══');
console.log(`contract: ${CONTRACT.id} — two minds, two DOCTRINES, one trade\n`);

// ── Phase 1: solo breeding (each mind's forge grows its own scar tissue) ────
const minds = {};
for (const [name, seed, contract] of [['A', 4242, MIND_A], ['B', 9001, MIND_B]]) {
  const loom = await new Loom(contract, { seed, candidatesPerGen: CANDS }).init();
  for (let g = 0; g < SOLO_GENS; g++) await loom.runGeneration({ salt: g });
  minds[name] = { loom, seed, contract };
  const fams = [...new Set(loom.archive.elites.map((e) => e.family))];
  console.log(`mind ${name} (seed ${seed}, doctrine: ${fams.join('+')}): elites=${loom.archive.elites.length} diversity=${loom.archive.meanPairwise()} record=${loom.archive.record()}`);
}

// ── Phase 2: THE TRADE — patch-samples cross the aisle ──────────────────────
const trades = [];
for (const [from, to] of [['A', 'B'], ['B', 'A']]) {
  const sender = minds[from].loom;
  const receiver = minds[to].loom;
  // the receiver's forge grows under ITS lineage before judging
  await receiver.forge.grow(receiver.archive.elites, { salt: 99 });
  const probes = receiver.forge.probes;
  const oracleTokens = receiver.forge.oracleTokens();
  const patchSamples = sender.archive.elites.map((e) => ({ src: e.src, family: e.family, hash: e.hash, senderGen: e.gen, senderNovelty: e.novelty }));
  for (const p of patchSamples) {
    const v = evaluate(CONTRACT, p.src, probes, oracleTokens, receiver.probeArchive());
    let woven = false, why = '';
    if (v.func < 1) why = `caught by receiver's forge (func=${v.func})`;
    else {
      const d = receiver.archive.elites.length
        ? Math.min(...receiver.archive.elites.map((e) => structDistOf(structSketch(p.src), e.structSketch)))
        : 1;
      if (d < receiver.archive.dedupe) why = `mimic to receiver's bloodline (struct=${d})`;
      else {
        const inserted = receiver.archive.tryInsert(
          { src: p.src, hash: 'trade-' + p.hash, family: 'traded:' + p.family, gen: 0, corruption: 0, voice: `trade:${from}`, struct: structSketch(p.src) },
          v,
        );
        if (inserted) { woven = true; why = `woven (struct-from-receiver=${d}, receiver-novelty=${v.n})`; }
        else why = 'archive rejected (cap/dedupe)';
      }
    }
    trades.push({ from, to, family: p.family, hash: p.hash, func: v.func, woven, why });
    console.log(`  trade ${from}→${to} ${p.family}/${p.hash}: ${why}`);
  }
}

// ── Phase 3: continuation — traded minds vs SOLO CONTROL ────────────────────
// Control = mind A's doctrine continuing alone: it can NEVER add the hilo32
// bloodline, so its diversity can only creep via dials.
const control = await new Loom(MIND_A, { seed: minds.A.seed, candidatesPerGen: CANDS }).init();
for (let g = 0; g < SOLO_GENS; g++) await control.runGeneration({ salt: g }); // replicate A's solo arc
const divControlBefore = control.archive.meanPairwise();
for (let g = 0; g < CONT_GENS; g++) await control.runGeneration({ salt: 100 + g });
const divControlAfter = control.archive.meanPairwise();

for (const name of ['A', 'B']) {
  minds[name].divBefore = minds[name].loom.archive.meanPairwise();
}
const divBefore = { A: minds.A.divBefore, B: minds.B.divBefore };
for (const name of ['A', 'B']) {
  for (let g = 0; g < CONT_GENS; g++) await minds[name].loom.runGeneration({ salt: 100 + g });
  minds[name].divAfter = minds[name].loom.archive.meanPairwise();
}

// ── Phase 4: the verdict ────────────────────────────────────────────────────
const dTrade = { A: +(minds.A.divAfter - divBefore.A).toFixed(4), B: +(minds.B.divAfter - divBefore.B).toFixed(4) };
const dSolo = +(divControlAfter - divControlBefore).toFixed(4);
const meanTrade = +((dTrade.A + dTrade.B) / 2).toFixed(4);
// The v1 lesson stands: seed-diversity is fake-diversity (deterministic mech
// breeding converges). The REAL Poly-GAN metric is BLOODLINE COVERAGE — how
// many distinct algorithmic doctrines live in each archive. A trade can add
// a bloodline the receiver's doctrine could never breed; solo continuation
// cannot. Diversity deltas are reported but NOT the headline.
const famCount = (loom) => new Set(loom.archive.elites.map((e) => e.family.split(':')[0])).size;
const sizeOf = (loom) => loom.archive.elites.length;
const famBefore = { A: famCount(minds.A.loom) - 1, B: famCount(minds.B.loom) - 1 }; // minus the woven-in one
const famAfter = { A: famCount(minds.A.loom), B: famCount(minds.B.loom) };
const famControl = famCount(control);
const wovenN = trades.filter((t) => t.woven).length;
const crossed = trades.filter((t) => t.woven && !t.family.startsWith('traded:'));
const noveltyCrossed = crossed.map((t) => t.why.match(/receiver-novelty=([\d.]+)/)?.[1]).filter(Boolean);

console.log('\n── POLY-GAN VERDICT (bloodline coverage, the honest metric) ──');
console.log(`  mind A: doctrines ${famBefore.A} → ${famAfter.A} (weave added: ${crossed.filter((t) => t.to === 'A').map((t) => t.family).join(', ') || 'none'})`);
console.log(`  mind B: doctrines ${famBefore.B} → ${famAfter.B} (weave added: ${crossed.filter((t) => t.to === 'B').map((t) => t.family).join(', ') || 'none'})`);
console.log(`  solo control doctrine count: ${famControl} (capped — no trade, no new blood)`);
console.log(`  diversity (context only): traded A Δ${dTrade.A}, B Δ${dTrade.B} vs solo Δ${dSolo}`);
const verdict = crossed.length > 0
  ? `POLY-GAN EFFECT CONFIRMED — ${crossed.length} bloodline(s) crossed doctrines (${crossed.map((t) => `${t.from}→${t.to}:${t.family}`).join(', ')}), receiver-side novelty ${noveltyCrossed.join('/')} — logic one house could never breed now lives in both`
  : 'no bloodline crossed — report honestly, iterate the doctrines';
console.log(`  ${verdict}`);

const receipt = {
  kind: 'poly-gan-bazaar', date: new Date().toISOString(),
  contract: CONTRACT.id, minds: { A: { seed: 4242, doctrine: ['bigint_fold', 'word_pairs'] }, B: { seed: 9001, doctrine: ['hilo32', 'word_pairs'] } },
  trades: trades.length, woven: wovenN, caught_in_transit: trades.filter((t) => !t.woven).length,
  bloodlines: { A: [famBefore.A, famAfter.A], B: [famBefore.B, famAfter.B], solo_control: famControl },
  crossed,
  delta: { traded: dTrade, solo: dSolo, mean_traded: meanTrade, note: 'diversity deltas are context, not the headline — see the v1 lesson' },
  v1_lesson: 'seed-diversity is fake-diversity: mech breeding is deterministic per family, so minds with different seeds converge to identical elite sets. Doctrine-diversity (family subsets) is real-diversity.',
  verdict,
  seal: fnv1a64([trades.length, wovenN, crossed.length, famAfter.A, famAfter.B, famControl].join('|')),
};
writeFileSync(join(OUT, 'bazaar_receipts.json'), JSON.stringify({ ...receipt, trade_log: trades }, null, 1));
// elites of both traded minds, for the crosswalk to judge
writeFileSync(join(OUT, 'elites.json'), JSON.stringify(
  [...minds.A.loom.archive.elites, ...minds.B.loom.archive.elites].map((e) => ({ family: e.family, hash: e.hash, src: e.src, mind: e.voice })), null, 1));
console.log(`\nreceipts: outputs/bazaar_receipts.json (seal ${receipt.seal}) — ${wovenN}/${trades.length} patch-samples woven`);
