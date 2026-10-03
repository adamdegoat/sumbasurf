// Tail slide scoring vet (2 Oct 2026): every ride scored twice, as it happened and as if each tail slide had stayed the
// snap it started as (same ride, same moves otherwise), so the difference is exactly what the tail slide added.
//   const S = await import('./test/tsscore.js?v=' + Date.now()); await S.run('medium', 8)
import { scoreRide } from '../js/surf.js?v=234';
import * as V from './tsvet.js?v=4';
export async function run(mode, n = 8, board = 'short') {
  const g = window.__g; if (!g.rider) await V.ride({ mode, board, maxT: 0.5 }); const P = g.rider.constructor.prototype;
  if (!P._ts0) { P._ts0 = P.tailSlide; P.tailSlide = function (crit, dur, pk) { const R = this.ride, m = [...R.moves].reverse().find((x) => x.name === 'SNAP' && R.t - x.t < 1.8); const before = m ? { pts: m.pts, base: m.base, strong: m.strong } : null; const len = R.moves.length; this._ts0(crit, dur, pk); if (m) m.was = before; else if (R.moves.length > len) { const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, k = (0.8 + 0.4 * sm(0.72, 1.1, pk)) * (0.6 + 0.4 * sm(0.25, 0.6, dur)); R.moves[R.moves.length - 1].was = { newK: k }; } }; }
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = await V.ride({ mode, board, stall: 'tail', seed: 3 + i }); const R = g.rider.ride, fell = g.rider.state === 'WIPE';
    const now = scoreRide(R, fell);
    const alt = { ...R, moves: R.moves.map((m) => !m.was ? m : m.was.newK ? { ...m, name: 'SNAP', pts: m.pts * 4.4 / 5.0 / m.was.newK, base: 4.4 } : { ...m, name: 'SNAP', pts: m.was.pts, base: m.was.base, strong: m.was.strong }) };
    const before = scoreRide(alt, fell);
    rows.push({ now, before, tails: R.moves.filter((m) => m.name === 'TAIL SLIDE').length, newOnes: R.moves.filter((m) => m.was && m.was.newK).length, doubles: R.moves.filter((m, i) => m.name === 'SNAP' && R.moves.slice(0, i).some((x) => x.name === 'TAIL SLIDE' && m.t - x.t < 1.5 && m.t - x.t >= 0)).length });
    await new Promise((res) => setTimeout(res, 0));
  }
  return rows;
}
