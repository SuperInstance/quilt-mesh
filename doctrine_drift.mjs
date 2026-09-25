// quilt-mesh/doctrine_drift.mjs — DOCTRINE DRIFT MEASUREMENT.
//
// POLY-GAN §5 seeds asked: (a) do foundry bloodlines drift over generations,
// (b) does a traded family become first-class doctrine in a receiver house?
// This instrument measures both from existing receipts — no new breeding.
//
//   node doctrine_drift.mjs                       (defaults below)
//   node doctrine_drift.mjs --loom <results.json> --bazaar <receipts.json>
//
// Inputs (self-contained snapshots with provenance in outputs/):
//   outputs/loom_foundry_snapshot.json  — quilt-loom offline run reports
//   outputs/bazaar_receipts.json        — the Poly-GAN v2 bazaar receipts
// Outputs:
//   outputs/drift_receipts.json         — the measurement, hash-chained
//   outputs/drift_trace.jsonl           — one row per receipt

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rowHash } from './mesh/receipts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const loomPath = argOf('--loom', join(here, 'outputs', 'loom_foundry_snapshot.json'));
const bazaarPath = argOf('--bazaar', join(here, 'outputs', 'bazaar_receipts.json'));

if (!existsSync(loomPath) || !existsSync(bazaarPath)) {
  console.error('missing inputs: run from quilt-mesh with outputs/ snapshots present');
  process.exit(1);
}
const loom = JSON.parse(readFileSync(loomPath, 'utf8'));
const bazaar = JSON.parse(readFileSync(bazaarPath, 'utf8'));

const journal = [];
let prev = 'GENESIS';
const receipt = (row) => {
  const r = { ...row };
  r.row_hash = rowHash(r, prev);
  prev = r.row_hash;
  journal.push(r);
  return r;
};

// ── Part 1: foundry bloodline drift ──────────────────────────────────────────
// Per target: (a) when does each family FIRST crown (bloodline entry time),
// (b) entropy of the crown-family distribution early vs late, (c) voice mix.
const shannon = (counts) => {
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!n) return 0;
  return -Object.values(counts).reduce((a, c) => (c ? a + (c / n) * Math.log2(c / n) : a), 0);
};

const foundry = [];
for (const rep of loom.reports) {
  const arch = rep.archive || [];
  const byFamily = {};
  for (const a of arch) byFamily[a.family] = (byFamily[a.family] || 0) + 1;
  const firstEntry = {};
  for (const a of arch) if (firstEntry[a.family] === undefined || a.gen < firstEntry[a.family]) firstEntry[a.family] = a.gen;
  const mid = Math.ceil(rep.gens / 2);
  const early = arch.filter((a) => a.gen <= mid), late = arch.filter((a) => a.gen > mid);
  const hEarly = shannon(Object.fromEntries([...new Set(arch.map((a) => a.family))].map((f) => [f, early.filter((a) => a.family === f).length])));
  const hLate = shannon(Object.fromEntries([...new Set(arch.map((a) => a.family))].map((f) => [f, late.filter((a) => a.family === f).length])));
  const voices = {};
  for (const a of arch) voices[a.voice] = (voices[a.voice] || 0) + 1;
  const row = {
    kind: 'foundry-drift', target: rep.target, crowns: arch.length,
    families: Object.keys(byFamily).length, familyMix: byFamily,
    firstEntry, entropyEarly: +hEarly.toFixed(3), entropyLate: +hLate.toFixed(3),
    drift: +(hLate - hEarly).toFixed(3), voices,
  };
  foundry.push(row);
  receipt(row);
}

// ── Part 2: bazaar belief propagation ────────────────────────────────────────
// Doctrine = the family list a house BREEDS by itself. A trade moves a family
// across the border; the house "believes" it after weaving (it re-breeds it
// in later generations). Measure: trade edges, woven rate per family, and
// whether any traded family appears in a receiver's LATER solo output.
const minds = bazaar.minds;
const edges = {};
for (const t of bazaar.trade_log || []) {
  const k = `${t.from}→${t.to}:${t.family}`;
  edges[k] = edges[k] || { from: t.from, to: t.to, family: t.family, attempts: 0, woven: 0, hashes: [] };
  edges[k].attempts++;
  if (t.woven) edges[k].woven++;
  edges[k].hashes.push(t.hash);
}
const edgeRows = Object.values(edges).map((e) => receipt({
  kind: 'bazaar-edge', ...e, wovenRate: +(e.woven / e.attempts).toFixed(3),
}));

// doctrine adoption: did a woven family show up in the receiver's own bloodlines?
const adoption = [];
for (const e of Object.values(edges)) {
  if (!e.woven) continue;
  const receiver = minds[e.to];
  const adopted = Array.isArray(receiver?.doctrine) ? receiver.doctrine.includes(e.family) : false;
  const row = receipt({ kind: 'doctrine-adoption', house: e.to, family: e.family, from: e.from, adopted: receiver ? adopted : null, note: receiver ? (adopted ? 'traded family present in house doctrine' : 'traded family woven but not (yet) doctrine') : 'house unknown to receipts' });
  adoption.push(row);
}

// ── summary ──────────────────────────────────────────────────────────────────
const driftTargets = foundry.filter((f) => f.crowns >= 4);
const widening = driftTargets.filter((f) => f.drift > 0.05).length;
const narrowing = driftTargets.filter((f) => f.drift < -0.05).length;
const summary = receipt({
  kind: 'drift-verdict',
  foundryTargets: foundry.length, driftTargets: driftTargets.length,
  entropyWidening: widening, entropyNarrowing: narrowing,
  tradeEdges: Object.keys(edges).length,
  wovenTotal: bazaar.woven ?? Object.values(edges).reduce((a, e) => a + e.woven, 0),
  caughtTotal: bazaar.caught_in_transit ?? null,
  adoptionChecked: adoption.length,
  adoptionYes: adoption.filter((a) => a.adopted === true).length,
  verdict:
    (widening > narrowing ? 'foundry bloodline entropy WIDENS over generations (crowns diversify late)' :
      narrowing > widening ? 'foundry entropy NARROWS (early crowns dominate)' :
        'foundry entropy ~stable across halves') +
    ' | ' + `bazaar: ${Object.keys(edges).length} trade edges, woven rate ` +
    +(Object.values(edges).reduce((a, e) => a + e.woven, 0) / Math.max(1, Object.values(edges).reduce((a, e) => a + e.attempts, 0))).toFixed(3),
});

const payload = { meta: { at: new Date().toISOString(), loom: loom.run ?? 'unknown', minds: Object.keys(minds) }, foundry, edges: Object.values(edges), adoption, summary, receipts: journal };
writeFileSync(join(here, 'outputs', 'drift_receipts.json'), JSON.stringify(payload, null, 1));
writeFileSync(join(here, 'outputs', 'drift_trace.jsonl'), journal.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(summary.verdict);
console.log(`receipts: ${journal.length} rows (chain tip ${String(prev).slice(2, 10)})`);
console.log('wrote outputs/drift_receipts.json + drift_trace.jsonl');
