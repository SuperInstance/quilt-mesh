// mesh/crosswalk.mjs — THE CROSSWALK: a semantic diff between repos.
//
// The fleet already shipped the same algorithm twice:
//   quilt-canary       — FNV-1a 64 over UTF-8 BYTES (canary.py: s.encode())
//   quilt-loom targets — the witness idiom over UTF-16 CODE UNITS (charCodeAt)
// Byte-identical implementations in the same domain is the canary standard;
// byte-identical LOOKING implementations in DIFFERENT domains is a silent
// contract divergence — the exact class of bug the polyformalism family
// exists to prevent. The crosswalk makes the boundary VISIBLE and receipted:
//   1. ASCII domain: loom oracle vs canary semantics vs the loom's BRED
//      elites — must agree byte-exactly (the mesh holds).
//   2. Unicode domain: they must diverge — and the crosswalk pins the exact
//      probes where they do, so every consumer picks a domain ON PURPOSE.
// Run: node mesh/crosswalk.mjs   (zero keys, zero network)

import { compile } from './engine_lib.mjs';
import { fnv1a64 } from './receipts.mjs';
import { witness_fnv } from '../contracts/fleet-contracts.mjs';

// ── the canary semantics, vendored 1:1 from SuperInstance/quilt-canary ──────
// (canary.py: h over s.encode('utf-8') — attributed, see NOTICE)
function canaryFnvUtf8(s) {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(s)) {
    h = h ^ BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}
// the loom witness oracle (charCode domain), compiled from the contract
const loomFnvChar = compile(witness_fnv.oracle);

const ASCII_PROBES = ['', 'a', 'hello world', '{"k":1}', 'canon:ACK', 'quilt', '0'.repeat(64), 'AaAaAa'];
const UNICODE_PROBES = ['café Δ 日本語', 'naïve—résumé', '🌊quilt', 'Ω'];

let asciiAgree = 0, unicodeDiverge = 0;
const divergences = [];

console.log('══ CROSSWALK: quilt-canary (utf-8 bytes) × quilt-loom witness (code units) ══\n');
for (const s of ASCII_PROBES) {
  const a = canaryFnvUtf8(s), b = loomFnvChar({ text: s });
  const ok = a === b;
  if (ok) asciiAgree++;
  else divergences.push({ probe: s, canary: a, loom: b });
  console.log(`  ascii ${JSON.stringify(s).padEnd(20)} canary=${a} loom=${b} ${ok ? 'AGREE' : 'DIVERGE'}`);
}
console.log('');
for (const s of UNICODE_PROBES) {
  const a = canaryFnvUtf8(s), b = loomFnvChar({ text: s });
  const ok = a === b;
  if (!ok) unicodeDiverge++;
  else divergences.push({ probe: s, canary: a, loom: b, kind: 'unexpected-agreement' });
  console.log(`  uni   ${JSON.stringify(s).padEnd(20)} canary=${a} loom=${b} ${ok ? 'AGREE (would be a silent bug!)' : 'DIVERGE (documented boundary)'}`);
}

// the loom's BRED elites, judged against both domains
console.log('\n── bred elites vs the canary domain ──');
import { readFileSync, existsSync } from 'node:fs';
const elitesPath = new URL('../outputs/elites.json', import.meta.url).pathname;
let eliteRows = [];
if (existsSync(elitesPath)) {
  const elites = JSON.parse(readFileSync(elitesPath, 'utf8'));
  for (const e of elites.slice(0, 4)) {
    const fn = compile(e.src);
    const asciiOk = ASCII_PROBES.every((s) => fn({ text: s }) === canaryFnvUtf8(s));
    const uniOk = UNICODE_PROBES.every((s) => fn({ text: s }) === canaryFnvUtf8(s));
    eliteRows.push(`${e.family}/${e.hash}: ascii ${asciiOk ? 'EXACT' : 'off'} — utf-8 domain ${uniOk ? 'EXACT' : 'divergent (code-unit domain, by contract)'}`);
    console.log('  ' + eliteRows[eliteRows.length - 1]);
  }
} else {
  console.log('  (no outputs/elites.json yet — run mesh/bazaar.mjs first)');
}

const receipt = {
  kind: 'mesh-crosswalk',
  date: new Date().toISOString(),
  repos: ['SuperInstance/quilt-canary', 'SuperInstance/quilt-loom'],
  ascii_agreement: `${asciiAgree}/${ASCII_PROBES.length}`,
  unicode_documented_divergence: `${unicodeDiverge}/${UNICODE_PROBES.length}`,
  domain_law: 'FNV-1a-64 is domain-parameterized: bytes(utf-8) vs code-units(utf-16) agree exactly on ASCII and diverge elsewhere. Both are "correct"; consumers must choose ON PURPOSE.',
  divergences,
  seal: fnv1a64(['crosswalk', asciiAgree, unicodeDiverge].join('|')),
};
console.log(`\nreceipt seal: ${receipt.seal}`);
console.log(asciiAgree === ASCII_PROBES.length ? 'MESH HOLDS on the shared domain ✓' : 'MESH BROKEN on the shared domain ✗');
process.exit(asciiAgree === ASCII_PROBES.length ? 0 : 1);
