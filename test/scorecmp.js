// Scoring check: skill.js riders at a spot and level; every finished ride scored the new way and the old way
// (surf.js scoreRide(..., old)), with what it was made of.
//   const C = await import('./test/scorecmp.js?x=1'); C.run('medium', 'carver', 5)
import { run as ride } from './skill.js';
import { scoreRide } from '../js/surf.js?v=185';
const G = () => window.__g;
export function run(spot, lv, waves = 5, seed = 7) {
  const g = G(), s0 = g.step, rides = []; let last = '';
  g.step = function (a, b, c) { s0.call(this, a, b, c); const r = g.rider; if (!r) return;
    if (r.state !== last) { if ((r.state === 'OUT' || r.state === 'WIPE') && last === 'RIDE') { const fell = r.state === 'WIPE';
      const N = scoreRide(r.ride, fell, true), O = scoreRide(r.ride, fell, false, true);
      const kinds = {}; for (const m of r.ride.moves) kinds[m.name] = (kinds[m.name] || 0) + 1;
      rides.push({ ride: { t: r.ride.t, speed: r.ride.speed, end: r.ride.end, moves: r.ride.moves.map((m) => ({ name: m.name, pts: m.pts, base: m.base, strong: m.strong, t: m.t, dur: m.dur, notes: m.notes })) }, spot, lv, fell, t: +r.ride.t.toFixed(1), newScore: N.score, oldScore: O, excellentOk: N.excellentOk, strong: r.ride.moves.filter((m) => m.strong).map((m) => m.name).join(','), moves: Object.entries(kinds).map(([k, v]) => v + ' ' + k).join(', '), lines: N.lines.map((l) => l.name + ' ' + l.pts.toFixed(1)).join(' | ') }); }
      last = r.state; } };
  try { ride(spot, lv, waves, seed); } finally { g.step = s0; }
  return rides;
}
