// Board regression (30 Sep 2026, adding the alaia): the four existing boards ridden by the same scripted surfer on the
// same seeded sea, 45 s each at three spots; every second the rider's position, heading and speed, and every move and
// score. Run before and after a change: the fingerprints must match exactly.
//   const R = await import('./test/boardreg.js?x=1'); await R.run()
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
const seeded = (seed) => { let st = seed >>> 0; return () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296); };
export function ride(mode, board, seed = 7, secs = 45) {
  const g = G(), rnd0 = Math.random; Math.random = seeded(seed); g.paused = true;
  try {
    g.T = 0; g.setMode(mode); g.useBoard(board); g.spawnRider(); const br = brain({}), cb = carveBrain({ hi: 0.72, lo: 0.22, gain: 2.2 }), out = [];
    for (let i = 0; i < secs * 60; i++) { const r = g.rider; if (!r) break; let o = br(r); if (r.state === 'RIDE' && r.stateT > 1) { o = cb(r); o.pump = r.v < r.wave.cond.speed * 0.85; }
      g.input.stick = null; g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false);
      if (i % 60 === 0) out.push([r.state, r.x.toFixed(3), r.z.toFixed(3), r.th.toFixed(4), r.v.toFixed(3)].join(','));
      if (r.trick && r.trick.t === 0) out.push('M' + r.trick.name); }
    return out.join('|');
  } finally { Math.random = rnd0; g.input.test = null; g.input.paddleBtn = false; }
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
export async function run(boards = ['short', 'fish', 'long', 'gun'], modes = ['medium', 'easy', 'hard']) {
  const res = {};
  for (const m of modes) for (const b of boards) { const s = ride(m, b); res[m + '/' + b] = hash(s) + ' n' + s.length; await new Promise((r) => setTimeout(r, 0)); }
  G().useBoard('short'); return res;
}
