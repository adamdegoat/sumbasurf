// Tail slide vet (2 Oct 2026): rides driven by a bot, with the tail slide on (as shipped) or off (RIDE.tail = 0, the old
// physics), so a wipeout count says whether the tail slide trips up players who were never trying one.
//   const V = await import('./test/tsvet.js?v=' + Date.now()); await V.ride({ mode: 'medium', board: 'short', stall: 'habit' })
import { RIDE } from '../js/surf.js?v=233';
const G = () => window.__g;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
let FM = null;
// stall: 'none' | 'habit' (holds STALL 1.5-3 s at random moments, and whenever high on the face, like a barrel hunter) |
//        'tail' (taps STALL 0.4 s at each snap: the real tail slide) | 'hold' (holds STALL right through each snap, 2 s)
export async function ride({ mode = 'medium', board = 'short', stall = 'none', tailOff = false, seed = 5, maxT = 60, stance = null, dt = 1 / 60 } = {}) {
  FM = FM || await import('./film.js?v=' + Date.now());
  const g = G(), nm = 'tv' + Math.random(); FM.addPro(nm, mode, seed, 10, board, 'snap'); const t = FM.takes[nm]; t.init(); t.done();
  g.useBoard(board); if (stance) g.useStance(stance); if (tailOff) RIDE.tail = 0;
  const { brain } = await import('./sim2.js'); const br = brain({}); g.paused = true; g.rider.reset(4, -8, -Math.PI / 2);
  let warnSeen = 0, warns = 0, holdT = -1, cool = 0, ph = 'up', maxSlide = 0, tsFrames = 0, bad = null; const tricks = [];
  for (let i = 0; i < maxT / dt; i++) {
    const r = g.rider; const o = br(r); let steer = o.steer, pump = !!o.paddle;
    let hT = 0;
    if (r.state === 'RIDE' && r.wave && r.stateT > 1) {
      const w = r.wave, c = w.cond.speed, sl = w.prof.slice(r.s), relVz = r.vz - c; hT = r.y / Math.max(sl.top, 0.3);
      const aim = (vz) => wrap(Math.asin(Math.max(-0.95, Math.min(0.97, vz / Math.max(r.v, 0.5)))) - r.th);
      if (ph === 'up' && hT > 0.74) ph = 'snap'; else if (ph === 'snap' && relVz > 1.2) ph = 'down'; else if (ph === 'down' && hT < 0.22) ph = 'up';
      const d = ph === 'up' ? aim(0.2 * c) : aim(1.7 * c); steer = ph === 'snap' ? Math.sign(d) : Math.max(-1, Math.min(1, d * 3)); pump = ph !== 'snap' && r.v < c * 0.95;
    }
    if (r.state === 'RIDE' && holdT < 0 && cool <= 0) {
      if (stall === 'tail' && (r.snapK || 0) > 0.5) holdT = 0.4;
      else if (stall === 'hold' && (r.snapK || 0) > 0.3) holdT = 2.0;
      else if (stall === 'prehold' && ph === 'up' && hT > 0.55) holdT = 2.5;   // (already holding STALL up high before the snap, like a barrel hunter)
      else if (stall === 'react' && (r.snapK || 0) > 0.3) holdT = 3.0;   // (holds on through the snap, lets go 0.25 s after the warning shows)
      else if (stall === 'habit' && (Math.random() < 0.012 || hT > 0.7 && Math.random() < 0.05)) holdT = 1.5 + Math.random() * 1.5;
    }
    if (stall === 'react' && holdT >= 0 && document.getElementById('hint').textContent.startsWith('Let go')) { warnSeen++; if (warnSeen === 1) holdT = Math.min(holdT, 0.25); }
    let st = false; if (holdT >= 0) { st = true; holdT -= dt; if (holdT < 0) cool = stall === 'habit' ? 0.5 + Math.random() : 1.5; } else cool -= dt;
    if (st) { g.input.test = null; g.input.stick = { x: steer || 0, y: 1 }; } else { g.input.stick = null; g.input.test = steer; }
    g.input.paddleBtn = r.standing ? pump : !!o.paddle;
    g.step(dt, dt, false);
    if (/^Let go/.test(document.getElementById('hint').textContent) && document.getElementById('stall').classList.contains('bog')) warns++;
    if (holdT < 0) warnSeen = 0;
    if (r.state === 'RIDE') { maxSlide = Math.max(maxSlide, r.slide || 0); if (r.tsT > 0) tsFrames++; }
    if (![r.x, r.z, r.y, r.th, r.v].every(Number.isFinite)) { bad = 'NaN'; break; }
    if (r.trick && tricks[tricks.length - 1] !== r.trick.name) tricks.push(r.trick.name);
    if (r.state === 'WIPE' || r.state === 'OUT') break;
  }
  const r = g.rider; g.input.stick = null; g.input.test = null; g.input.paddleBtn = false; g.paused = false;
  if (tailOff) g.useBoard(board);   // (puts RIDE.tail back for this board)
  return { end: r.state, why: r.why || '', rodeT: +(r.ride && r.ride.t || 0).toFixed(1), score: r.ride && r.ride.score, maxDeg: Math.round(maxSlide * 57.3), tsFrames, tails: tricks.filter((x) => x.includes('TAIL')).length, warns, bad, tricks };
}
