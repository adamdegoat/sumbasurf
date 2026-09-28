// Re-score saved rides (scorecmp.js output) with different scoring settings, to tune without riding again.
//   const T = await import('./test/scoretune.js?x=1'); T.report(__cmp, T.P0)
import { MOVE_BASE } from '../js/surf.js?v=163';
export const P0 = { barrelK: 1, base: { ...MOVE_BASE }, repTurn: 0.7, repBig: 0.6, W: [1, 0.8, 0.6, 0.45, 0.35, 0.25, 0.18, 0.12], variety: 0.4, K: 8, rule: true, strongTurn: true };
export function score(ride, fell, P) {
  const ms = (fell ? ride.moves.filter((m) => m.t < ride.t - 0.8) : ride.moves).map((m) => (MOVE_BASE[m.name] && m.base ? { ...m, pts: m.pts * (P.base[m.name] + m.base - MOVE_BASE[m.name]) / m.base } : m.name === 'BARREL' ? { ...m, pts: m.pts * (P.barrelK || 1) } : m));
  const seen = {}, items = [...ms].sort((a, b) => b.pts - a.pts).map((m) => { const n = (seen[m.name] = (seen[m.name] || 0) + 1); return { m, v: m.pts * Math.pow(m.name === 'TURN' ? P.repTurn : P.repBig, n - 1) }; }).sort((a, b) => b.v - a.v);
  let raw = items.reduce((a, it, i) => a + it.v * (P.W[i] || 0.08), 0);
  const kinds = new Set(ms.filter((m) => m.name !== 'TURN').map((m) => m.name.replace('AIR 360', 'AIR'))).size;
  raw += P.variety * Math.max(0, kinds - 1) + Math.min(0.4, ride.speed * 0.015) + (ride.end && !fell ? 0.4 : 0);
  if (fell) raw *= 0.85;
  let s = 10 * (1 - Math.exp(-raw / P.K));
  const strong = ms.filter((m) => m.strong && (P.strongTurn || m.name !== 'TURN')), sk = new Set(strong.map((m) => m.name.replace('AIR 360', 'AIR'))).size;
  if (P.rule && !(sk >= 2 || strong.length >= 3) && s > 7.5) s = 7.5 + 0.4 * (1 - Math.exp(-(s - 7.5) / 0.4));
  return Math.round(10 * s) / 10;
}
export function report(R, P) {
  R = R.filter((r) => r.ride);
  const S = R.map((r) => ({ r, s: score(r.ride, r.fell, P) }));
  const has = (r, k) => r.ride.moves.some((m) => m.name === k);
  const bigTurns = (r) => r.ride.moves.filter((m) => (m.name === 'SNAP' || m.name === 'CUTBACK') && m.strong).length;
  const grp = (f) => { const a = S.filter((x) => f(x.r)); return a.length ? { n: a.length, avg: +(a.reduce((q, x) => q + x.s, 0) / a.length).toFixed(1), best: Math.max(...a.map((x) => x.s)) } : null; };
  const band = (s) => (s < 2 ? '0-1.9' : s < 5 ? '2-4.9' : s < 6.5 ? '5-6.4' : s < 8 ? '6.5-7.9' : s < 8.5 ? '8-8.4' : '8.5+');
  const bands = {}; for (const x of S) bands[band(x.s)] = (bands[band(x.s)] || 0) + 1;
  const lv = {}; for (const l of ['beginner', 'decent', 'carver', 'good']) lv[l] = grp((r) => r.lv === l);
  return { bands, byLevel: lv,
    turnsNoBarrel_3plusStrong: grp((r) => !has(r, 'BARREL') && bigTurns(r) >= 3 && !r.fell),
    turnsNoBarrel_1to2Strong: grp((r) => !has(r, 'BARREL') && bigTurns(r) >= 1 && bigTurns(r) < 3 && !r.fell),
    barrelOnlyNoBigTurns: grp((r) => has(r, 'BARREL') && bigTurns(r) === 0 && !r.fell),
    barrelPlusBigTurn: grp((r) => has(r, 'BARREL') && bigTurns(r) >= 1 && !r.fell),
    fell: grp((r) => r.fell) };
}
