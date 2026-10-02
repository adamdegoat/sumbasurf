// Surfing regression check (2 Oct 2026, for the moves work: tail slide, big snaps, roundhouse): the same rides, seeded, on
// the code before and after a change, and a fingerprint of each (where the rider was, which way, how fast, every 15
// frames; the moves and the score). Rides that never press STALL at the lip must come out identical.
//   const RG = await import('./test/regress.js'); const out = await RG.run(); (compare out.sig before/after)
const G = () => window.__g;
const CASES = [['medium', 'carve', 'short', 3], ['medium', 'snap', 'short', 5], ['hard', 'snap', 'short', 7], ['kanan', 'cut', 'short', 8], ['easy', 'carve', 'fish', 4], ['medium', 'barrel', 'short', 9], ['easy', 'carve', 'long', 6], ['hard', 'carve', 'gun', 11]];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
export async function run(frames = 900) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), out = [];
  for (const [mode, plan, board, seed] of CASES) {
    const nm = `rg_${mode}_${plan}_${board}_${seed}`; FM.addPro(nm, mode, seed, frames, board, plan); const t = FM.takes[nm]; t.init();
    const tr = []; let last = null;
    for (let i = 0; i < frames; i++) { t.frame(i); const r = g.rider; if (i % 15 === 0) tr.push([r.state, r.x.toFixed(3), r.z.toFixed(3), r.th.toFixed(4), (r.v || 0).toFixed(3)].join(','));
      if (r.ride && r.ride.moves) last = { moves: r.ride.moves.map((m) => m.name + (m.strong ? '*' : '')).join(' '), score: r.ride.score || 0 }; if (r.state === 'WIPE' || r.state === 'OUT') { tr.push('END ' + (r.why || '')); break; } }
    t.done(); const s = tr.join('|'); out.push({ case: nm, sig: hash(s + (last ? last.moves : '')), steps: tr.length, moves: last && last.moves, score: last && last.score });
  }
  g.paused = false; return out;
}
