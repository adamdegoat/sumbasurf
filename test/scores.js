// Score survey: skill.js riders of each level at every spot; every finished ride's score and the raw points behind it
// (so the judge's scale can be set without re-riding: raw -> score is 10(1 - e^(-raw/K))).
//   const S = await import('./test/scores.js'); S.run()   (synchronous: blocks the page for a few minutes)
import { run as ride } from './skill.js';
const G = () => window.__g;
export function run(spots = ['easy', 'medium', 'hard', 'kanan', 'hiu', 'extreme'], levels = ['beginner', 'decent', 'carver', 'good'], waves = 6) {
  const g = G(), s0 = g.step, rides = []; let last = '', cur = null;
  g.step = function (a, b, c) { s0.call(this, a, b, c); const r = g.rider; if (!r) return;
    if (r.state !== last) { if ((r.state === 'OUT' || r.state === 'WIPE') && last === 'RIDE') { const J = r.liveScore(r.state === 'WIPE', true); const K = 8; const raw = J.score >= 9.99 ? 99 : -K * Math.log(1 - J.score / 10);
      rides.push({ spot: cur.spot, lv: cur.lv, score: J.score, raw: +raw.toFixed(2), t: +r.ride.t.toFixed(1), fell: r.state === 'WIPE', lines: J.lines.map((l) => l.name + ' ' + l.pts.toFixed(1) + (l.notes.length ? ' (' + l.notes.join(', ') + ')' : '')) }); }
      last = r.state; } };
  try { for (const spot of spots) for (const lv of levels) { cur = { spot, lv }; ride(spot, lv, waves, 7); } } finally { g.step = s0; }
  return rides;
}
