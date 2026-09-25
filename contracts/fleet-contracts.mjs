// quilt-mesh/contracts/fleet-contracts.mjs — the two seed contracts of the
// bazaar, lifted verbatim from quilt-loom's foundry targets (which themselves
// were lifted from the portfolio's real logic):
//   witness_fnv — the fnv-1a-64 witness idiom (ledger-seal / ocean receipts /
//                 quilt-canary's algorithm, charCode domain)
//   gate_law    — the cortex chord gate (pmax/doubt -> accept|flag|escalate)
// NOTE on domains: witness_fnv hashes UTF-16 CODE UNITS (charCodeAt); the
// quilt-canary reference hashes UTF-8 BYTES. They agree exactly on ASCII —
// the mesh/crosswalk.mjs proves it and receipts the unicode divergence.

// ── F2: THE WITNESS — fnv-1a-64 over ASCII, hex out ─────────────────────────
// The hash every receipt in the portfolio chains on. Three exact doctrines:
// bigint single register / exact 32-bit hi-lo schoolbook multiply / paired
// char stepping. All must produce the SAME 16-hex-char witness id.
export const witness_fnv = {
  id: 'witness_fnv',
  title: 'Witness idiom — fnv-1a-64 hex',
  spec: 'Given {text} (ASCII string), compute FNV-1a 64-bit: h=0xcbf29ce484222325; for each char code c in order: h ^= c; h *= 0x100000001b3 (mod 2^64). Return h as lowercase hex, zero-padded to 16 chars.',
  probeCap: 36,
  oracle: `function solve(input) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.text.length; i++) {
    h ^= BigInt(input.text.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}`,
  canon: (o) => String(o).toLowerCase(),
  genInput(R) {
    const cs = 'abcdefghijk0123456789_{}:".';
    const n = Math.floor(R() * 48);
    let s = '';
    for (let i = 0; i < n; i++) s += cs[Math.floor(R() * cs.length)];
    return { text: s };
  },
  baseProbes: [
    { text: '' }, { text: 'a' }, { text: 'hello world' }, { text: '{"k":1}' },
    { text: 'canon:ACK' }, { text: '0'.repeat(64) }, { text: 'quilt' }, { text: 'AaAaAa' },
  ],
  rarity: (o) => (String(o).startsWith('00') ? -2 : 0),
  families: [
    {
      id: 'bigint_fold', note: 'reduce-fold over chars; mask timing is algebraically free', sound: true,
      render(R, corrupt) {
        const maskAtEnd = R() < 0.5;
        const prime = corrupt > 0.85 ? '0x100000001b7n' : '0x100000001b3n';
        const pad = corrupt > 0.8 ? 12 : 16;
        const step = maskAtEnd
          ? 'acc = (acc ^ BigInt(s.charCodeAt(i))) * P;'
          : 'acc = ((acc ^ BigInt(s.charCodeAt(i))) * P) & M;';
        return `function solve(input) {
  const s = input.text;
  const P = ${prime}, M = 0xffffffffffffffffn;
  let acc = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    ${step}
  }
  return (acc & M).toString(16).padStart(${pad}, '0');
}`;
      },
    },
    {
      id: 'hilo32', note: 'exact 32-bit schoolbook: no BigInt, hi/lo halves (prime = 2^40 + 435)', sound: true,
      render(R, corrupt) {
        const xorInto = corrupt > 0.85 ? 'hi' : 'lo';
        const low = corrupt > 0.8 ? 437 : 435;
        const carry = corrupt > 0.9 ? '' : ' + c';
        return `function solve(input) {
  const s = input.text;
  let hi = 0xcbf29ce4, lo = 0x84222325;
  for (let i = 0; i < s.length; i++) {
    const cc = s.charCodeAt(i);
    ${xorInto} = (${xorInto} ^ cc) >>> 0;
    const T = hi * ${low} + lo * 256;
    const m = lo * ${low};
    const newLo = m % 4294967296;
    const c = (m - newLo) / 4294967296;
    const T0 = T % 4294967296;
    hi = (T0${carry}) % 4294967296;
    lo = newLo;
  }
  const H = hi.toString(16).padStart(8, '0');
  const L = lo.toString(16).padStart(8, '0');
  return (H + L).toLowerCase();
}`;
      },
    },
    {
      id: 'word_pairs', note: 'paired stepping through a closure — same op order, alien shape', sound: true,
      render(R, corrupt) {
        const stride = corrupt > 0.85 ? 3 : 2;
        const swap = corrupt > 0.8;
        return `function solve(input) {
  const s = input.text;
  let h = 0xcbf29ce484222325n;
  const P = 0x100000001b3n, M = 0xffffffffffffffffn;
  const step = (ch) => { h = ((h ^ BigInt(ch.charCodeAt(0))) * P) & M; };
  for (let i = 0; i < s.length; i += ${stride}) {
    const a = s[i], b = s[i + 1];
    if (${swap}) { if (b !== undefined) step(b); step(a); }
    else { step(a); if (b !== undefined) step(b); }
  }
  return h.toString(16).padStart(16, '0');
}`;
      },
    },
  ],
};

// ── M2: THE CORTEX GATE LAW (chord law 5) ───────────────────────────────────
// p_max >= 0.55 AND doubt < 0.5 -> fast-accept; p_max >= 0.35 -> flagged;
// else escalate. Doubt vetoes the fast path (never escalates by itself).
// Grid inputs (k/20) land exactly on both boundaries: the forge farms them.
export const gate_law = {
  id: 'gate_law',
  title: 'Cortex chord — the gate law',
  spec: 'Given {probs} (2-5 calibrated probabilities on a 0.05 grid) and {doubt} (0-1, 0.05 grid): let pmax = max(probs). If pmax >= 0.55 AND doubt < 0.5 -> mode "accept". Else if pmax >= 0.35 -> mode "flag". Else -> mode "escalate". Return {mode, pmax} (pmax as a number).',
  probeCap: 36,
  oracle: `function solve(input) {
  let pmax = input.probs[0];
  for (const p of input.probs) if (p > pmax) pmax = p;
  let mode;
  if (pmax >= 0.55 && input.doubt < 0.5) mode = 'accept';
  else if (pmax >= 0.35) mode = 'flag';
  else mode = 'escalate';
  return { mode, pmax };
}`,
  canon: (o) => JSON.stringify({ mode: String(o.mode), pmax: Number(o.pmax).toFixed(2) }),
  genInput(R) {
    const k = () => 3 + Math.floor(R() * 18);            // 3..20 -> 0.15..1.00
    const n = 2 + Math.floor(R() * 4);
    const probs = Array.from({ length: n }, () => k() / 20);
    if (R() < 0.4) probs[0] = (R() < 0.5 ? 7 : 11) / 20;  // farm the boundaries
    return { probs, doubt: Math.floor(R() * 21) / 20 };
  },
  baseProbes: [
    { probs: [0.55, 0.3], doubt: 0.2 },
    { probs: [0.55, 0.3], doubt: 0.5 },
    { probs: [0.55, 0.3], doubt: 0.55 },
    { probs: [0.35, 0.2], doubt: 0.0 },
    { probs: [0.3, 0.15], doubt: 0.0 },
    { probs: [1.0, 0.05], doubt: 0.45 },
    { probs: [1.0, 0.05], doubt: 0.9 },
    { probs: [0.15, 0.35, 0.2], doubt: 0.5 },
  ],
  rarity: (o) => -(o.mode === 'escalate' ? 2 : (o.mode === 'accept' ? 1 : 0)),
  families: [
    {
      id: 'reduce_carrier', note: 'single reduce pass carrying (pmax, mode) simultaneously', sound: true,
      render(R, corrupt) {
        const t1 = corrupt > 0.8 ? 0.5 : 0.55;
        const dv = corrupt > 0.85 ? '>' : '<';
        return `function solve(input) {
  const st = input.probs.reduce(
    (acc, p) => {
      const m = p ${'>'} acc.pmax ? p : acc.pmax;
      return { pmax: m, mode: (m >= ${t1} && input.doubt ${dv} 0.5) ? 'accept' : (m >= 0.35 ? 'flag' : 'escalate') };
    },
    { pmax: input.probs[0], mode: 'escalate' },
  );
  return st;
}`;
      },
    },
    {
      id: 'sorted_index', note: 'sorted-first pmax + boolean-sum mode index with doubt downgrade', sound: true,
      render(R, corrupt) {
        const t1 = corrupt > 0.8 ? 0.5 : 0.55;
        const dv = corrupt > 0.85 ? '<' : '>=';
        return `function solve(input) {
  const sorted = [...input.probs].sort((a, b) => b - a);
  const pmax = sorted[0];
  let idx = (pmax >= 0.35) + (pmax >= ${t1});
  if (idx === 2 && input.doubt ${dv} 0.5) idx = 1;
  const mode = ['escalate', 'flag', 'accept'][idx];
  return { mode, pmax };
}`;
      },
    },
    {
      id: 'math_max_ternary', note: 'spread Math.max + nested ternary one-liner', sound: true,
      render(R, corrupt) {
        const t1 = corrupt > 0.8 ? 0.5 : 0.55;
        const dv = corrupt > 0.85 ? '>=' : '<';
        return `function solve(input) {
  const pmax = Math.max(...input.probs);
  const mode = (pmax >= ${t1} && input.doubt ${dv} 0.5) ? 'accept'
    : (pmax >= 0.35 ? 'flag' : 'escalate');
  return { mode, pmax };
}`;
      },
    },
  ],
};

export const BAZAAR_CONTRACTS = [witness_fnv, gate_law];
