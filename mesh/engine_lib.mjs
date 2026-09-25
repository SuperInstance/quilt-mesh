// quilt-loom/loom/engine_lib.mjs — the three discriminating + generating
// organs of the loom, kept pure so both the host loop and the quilt program
// cells can reuse them.
//
//   compile(src)        — candidate logic → callable (new Function, like
//                         quilt's own formula/program cells)
//   fingerprint(...)    — behavioral fingerprint: canonical outputs on the
//                         forge's probe vector
//   structVec(src)      — structural sketch: token histogram + 4-gram set
//   novelty(...)        — min distance to the archive, behavioral-dominant
//   evaluate(...)       — one candidate, full verdict (func + novelty + tags)
//
// The METRIC is the GAN's discriminator: behavioral distance catches surface
// mimics; the structural sketch (α-insensitive histograms + n-grams) catches
// renamed copies; the forge's scarred probes catch lucky fakes.

import { fnv1a64 } from './receipts.mjs';

export function compile(src) {
  try {
    const f = new Function(`"use strict"; return (${src});`)();
    if (typeof f !== 'function') return null;
    return f;
  } catch {
    return null;
  }
}

// canonical output token — order-insensitive for sets, structural for grids
export function canonOut(target, out) {
  try { return target.canon(out); } catch { return '⟨canon-error⟩'; }
}

// Evaluate candidate against the probe vector. Returns per-probe verdicts.
export function runProbes(fn, probes, oracleTokens, target) {
  const results = [];
  for (let i = 0; i < probes.length; i++) {
    let tok, err = null;
    try { tok = canonOut(target, fn(probes[i])); }
    catch (e) { err = String(e && e.message || e).slice(0, 120); tok = '⟨error⟩'; }
    results.push({ ok: err === null && tok === oracleTokens[i], tok, err });
  }
  return results;
}

// ── structural sketch ────────────────────────────────────────────────────────
const TOKEN_RE = /=>|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|[{}()[\];,.]|<=|>=|===|!==|&&|\|\||[+\-*/%<>=!?:&|]/g;
const KEYWORDS = new Set(['function', 'return', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'of', 'in', 'new', 'typeof', 'true', 'false', 'null', 'undefined', 'break', 'continue']);

// α-normalize: identifiers (non-keyword, non-property) renamed by first
// occurrence — so cosmetic renaming cannot game the structural metric.
export function alphaTokens(src) {
  const tokens = String(src).match(TOKEN_RE) || [];
  const map = new Map();
  let prevDot = false, prevLet = false;
  const out = [];
  const DECLS = new Set(['function', 'const', 'let', 'var']);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isIdent = /^[A-Za-z_$][\w$]*$/.test(t) && !KEYWORDS.has(t);
    if (isIdent && !prevDot) {
      if (!map.has(t)) map.set(t, `α${map.size}`);
      out.push(map.get(t));
    } else {
      out.push(t);
    }
    prevDot = t === '.';
  }
  return out;
}

export function structSketch(src) {
  const toks = alphaTokens(src);
  const HIST_KEYS = ['for', 'while', 'if', 'return', '=>', 'α', 'function', '+', '-', '*', '<', '>', '===', '&&', '?'];
  const hist = Object.fromEntries(HIST_KEYS.map((k) => [k, 0]));
  for (const t of toks) {
    if (hist[t] !== undefined) hist[t]++;
    else if (/^α\d+$/.test(t)) hist['α']++;
  }
  const total = Math.max(1, toks.length);
  const vec = HIST_KEYS.map((k) => +(hist[k] / total).toFixed(5));
  // 3-gram set over the α-token stream — position-sensitive enough to see
  // loop-order swaps, guard placement, accumulator style (dials MOVE it)
  const grams = new Set();
  for (let i = 0; i + 3 <= toks.length; i++) grams.add(toks.slice(i, i + 3).join(' '));
  return { vec, grams, hash: fnv1a64(toks.join(' ')) };
}

export function structDist(a, b) {
  if (!a || !b) return 1;
  // histogram L1 (normalized to [0,1] by /2 since two hists each sum≈1)
  let l1 = 0;
  for (let i = 0; i < a.vec.length; i++) l1 += Math.abs(a.vec[i] - b.vec[i]);
  const h = Math.min(1, l1 / 2);
  // jaccard over 3-grams — the form-sensitive term, weight 0.7
  const inter = [...a.grams].filter((g) => b.grams.has(g)).length;
  const uni = a.grams.size + b.grams.size - inter;
  const jac = uni ? inter / uni : 0;
  return +(0.3 * h + 0.7 * (1 - jac)).toFixed(5);
}

export function behavDist(fpA, fpB) {
  if (!fpA || !fpB) return 1;
  if (fpA.length !== fpB.length) return 1;
  let miss = 0;
  for (let i = 0; i < fpA.length; i++) if (fpA[i] !== fpB[i]) miss++;
  return +(miss / fpA.length).toFixed(5);
}

// composite novelty: behavioral-dominant min-distance to the archive
export function novelty(behav, struct, archive) {
  if (!archive.length) return { n: 1, behav: 1, struct: 1, nearest: null };
  let best = null;
  for (const elite of archive) {
    const b = behavDist(behav, elite.fingerprint);
    const s = structDist(struct, elite.struct);
    const d = 0.65 * b + 0.35 * s;
    if (!best || d < best.d) best = { d, b, s, nearest: elite.hash };
  }
  return { n: +best.d.toFixed(5), behav: best.b, struct: +best.s.toFixed(5), nearest: best.nearest };
}

// full verdict for one candidate against the CURRENT forge state
export function evaluate(target, src, probes, oracleTokens, archive) {
  const fn = compile(src);
  if (!fn) return { func: 0, verdict: 'compile-error', fingerprint: null, struct: null, per: [] };
  const per = runProbes(fn, probes, oracleTokens, target);
  const func = +(per.filter((p) => p.ok).length / per.length).toFixed(5);
  const fingerprint = per.map((p) => p.tok);
  const struct = structSketch(src);
  const nov = novelty(fingerprint, struct, archive);
  let verdict;
  if (func < 1) verdict = 'caught';
  else if (!archive.length || nov.n > 0.55) verdict = 'alien';      // far from everything
  else if (nov.n > 0.12) verdict = 'divergent';
  else verdict = 'mimic';
  return { func, verdict, fingerprint, struct, per, ...nov };
}
