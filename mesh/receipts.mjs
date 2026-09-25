// quilt-loom/loom/receipts.mjs — vendored witness idiom (from quilt-cortex,
// which ported it from the fleet toolkit). Self-contained on purpose: the
// loom must run with zero sibling probing so the package is portable.

export function fnv1a64(input) {
  let h = 0xcbf29ce484222325n, p = 0x100000001b3n, mask = 0xffffffffffffffffn;
  const s = typeof input === 'string' ? input : JSON.stringify(input);
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * p) & mask;
  }
  return '0x' + h.toString(16).padStart(16, '0');
}

export function rowHash(row, prevHash) {
  const { row_hash, ...rest } = row;
  return fnv1a64([prevHash, rest]);
}

export function sealChain(rows, genesis = 'GENESIS') {
  let prev = genesis;
  for (const r of rows) { prev = rowHash(r, prev); r.row_hash = prev; }
  return rows;
}

export function verifyChain(rows, genesis = 'GENESIS') {
  let prev = genesis;
  for (const r of rows) {
    if (r.row_hash === undefined) return { ok: false, at: r.seq ?? null, why: 'missing row_hash' };
    const { row_hash, ...rest } = r;
    const want = rowHash(rest, prev);
    if (want !== r.row_hash) return { ok: false, at: r.seq ?? null, why: 'hash mismatch' };
    prev = r.row_hash;
  }
  return { ok: true, links: rows.length };
}

// mulberry32 — deterministic seeded rng (the OFF voice's metronome)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
