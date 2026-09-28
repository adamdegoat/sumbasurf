// Snap check: the carving test surfer (skill.js 'carver': turns off the top at 80% of the face) over a few waves per
// spot; counts snaps and what they scored, the fastest pivot and widest tail slide, and how rides ended.
//   const A = await import('./test/snapab.js?x=' + Date.now()); A.run('medium', 4)
import { run as ride } from './skill.js';
const G = () => window.__g;
export function run(spot = 'medium', waves = 4, level = 'carver', seed = 7) {
  const g = G(), s0 = g.step, st = { snaps: 0, snapPts: [], lip: 0, maxTurn: 0, maxSlide: 0, tooHigh: 0 };
  let seen = 0, last = null;
  g.step = function (a, b, c) { s0.call(this, a, b, c); const r = g.rider; if (!r) return;
    if (r !== last || r.ride.moves.length < seen) { seen = 0; last = r; }
    if (r.state === 'RIDE') { st.maxTurn = Math.max(st.maxTurn, Math.abs(r.turn)); st.maxSlide = Math.max(st.maxSlide, r.slide || 0); st.maxSnapK = Math.max(st.maxSnapK || 0, r.snapK || 0); if ((r.snapK || 0) > 0.3) st.snapFrames = (st.snapFrames || 0) + 1; }
    while (r.ride.moves.length > seen) { const m = r.ride.moves[seen++]; if (m.name === 'SNAP') { st.snaps++; st.snapPts.push(+(m.pts || 0).toFixed(2)); if ((m.notes || []).includes('off the lip')) st.lip++; } }
  };
  let res; try { res = ride(spot, level, waves, seed); } finally { g.step = s0; }
  st.whys = res.whys; st.scores = res.scores; st.avgScore = res.avgScore; st.caught = res.caught;
  st.tooHigh = Object.entries(res.whys || {}).filter(([k]) => /Too high/.test(k)).reduce((x, [, v]) => x + v, 0);
  st.maxTurnDegS = Math.round(st.maxTurn * 57.3); st.maxSlideDeg = Math.round(st.maxSlide * 57.3); delete st.maxTurn; delete st.maxSlide;
  return st;
}
