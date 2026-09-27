// Difficulty check: whole sessions (wait in the lineup, paddle for waves, pop up, ride) played by a person-like test
// surfer at three skill levels. Human-ish flaws: a reaction delay on every steer, a wandering shaky hand, paddle
// timing that's early or late. Reports, per spot and level, how many waves they catch, how long they last, how
// rides end, barrel time, speed and score.
//   const S = await import('./test/skill.js'); S.run('easy', 'beginner', 8, 7)   (synchronous; returns a summary object)
import { carveBrain } from './sim2.js';
const G = () => window.__g;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const LEVELS = {
  //           reaction s   shaky hand   paddle timing +-s   line
  beginner: { delay: 0.35, shake: 0.45, timing: 0.9, line: 'mid' },
  decent:   { delay: 0.2,  shake: 0.2,  timing: 0.45, line: 'pocket' },
  good:     { delay: 0.1,  shake: 0.07, timing: 0.15, line: 'barrel' },
  carver:   { delay: 0.2,  shake: 0.2,  timing: 0.45, line: 'carve' },
  carverLow: { delay: 0.2, shake: 0.2,  timing: 0.45, line: 'carve', hi: 0.62 },
  racer:    { delay: 0.1,  shake: 0.07, timing: 0.15, line: 'pocket' },   // a good surfer who races the wave (no stalling)   // the same, turning off the top a bit lower   // a decent surfer who does turns, not just trims
};

export function run(mode, level = 'decent', waves = 8, seed = 7, kind = 'medium') {
  const g = G(), L = LEVELS[level], dt = 1 / 30;
  const rnd0 = Math.random; let st = seed >>> 0; const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  Math.random = rnd;
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return u - 3; };
  const posErr = new WeakMap();
  const cb = carveBrain({ hi: L.hi || 0.8, lo: 0.18, gain: 3.4 }), out = [], buf = []; let curSize = 0, maxTube = 0, shake = 0, lead = 2.5, attempt = null, paddled = false, guard = 0, t = 0, lastRanch = -99;
  try {
    g.paused = true; window.RANCH_KIND = kind; g.setMode(mode);
    document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
    g.spawnRider();
    while (out.length < waves && guard++ < 30 * 60 * 12) {
      const r = g.rider;
      if (r.state === 'WIPE' || r.state === 'OUT') {
        const R = r.ride;
        const wv = r.wave, at = wv ? `s/H ${(r.s / wv.cond.H).toFixed(2)} y/top ${(r.y / Math.max(0.3, wv.prof.slice(r.s).top * (wv.fade || 1))).toFixed(2)}` : '';
        out.push({ at, caught: true, size: +curSize.toFixed(2), why: r.why || r.state, t: R.t, top: R.top, barrel: Math.max(maxTube, R.barrel || 0), score: R.score || 0, end: !!R.end, atPop: R.t < 1.2 });
        attempt = null; paddled = false; maxTube = 0; g.spawnRider(); buf.length = 0; continue;
      }
      let steer = 0, paddle = false, stick = null;
      if (!r.standing) {
        const inc = g.incoming();
        if (mode === 'ranch' && !inc.w && t - lastRanch > 4) { g.ranchSend(kind); lastRanch = t; }   // (the pool only makes a wave when you order one)
        const wantTh = inc.w && inc.t < 6 ? Math.PI / 2 : -Math.PI / 2, d = wrap(wantTh - r.th);
        steer = Math.max(-1, Math.min(1, d * 2));
        if (inc.w && inc.w !== attempt && inc.t < 6) { attempt = inc.w; lead = 2.5 + (rnd() * 2 - 1) * L.timing; paddled = false; }
        paddle = !!(inc.w && inc.t < lead && Math.abs(d) < 0.6);
        if (paddle) paddled = true;
        // like a player reading the set (and following the tip): paddle along the reef to where this wave will break,
        // a little down the line of it; a beginner reads it less well (a few metres off)
        if (inc.w && mode !== 'ranch' && inc.t >= 6 && inc.t < 12) {
          if (!posErr.has(inc.w)) posErr.set(inc.w, (rnd() * 2 - 1) * L.timing * 6);
          const dxT = inc.w.peelX + inc.w.cond.peel * inc.t + 0.3 * inc.w.cond.H + posErr.get(inc.w) - r.x;
          if (Math.abs(dxT) > 2.5) { const want = dxT > 0 ? 0 : Math.PI, dd = wrap(want - r.th); steer = Math.max(-1, Math.min(1, dd * 2)); paddle = Math.abs(dd) < 0.6; }
        }
        // a wave that went by after we paddled for it: missed
        if (attempt && paddled && (!inc.w || inc.w !== attempt) && r.state === 'LIE') { out.push({ caught: false, why: 'missed the wave' }); attempt = null; paddled = false; }
      } else {
        const w = r.wave, c = w ? w.cond.speed : 5, H = w ? w.cond.H : 1, sH = r.s / H, yH = r.y / H;
        if (L.line === 'carve' && w) { steer = cb(r).steer; }
        else if (L.line === 'barrel' && w) {   // stall until the barrel covers you, then hold the pocket
          const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, c / Math.max(r.v, 1) + err * 0.9));
          steer = Math.max(-1, Math.min(1, wrap(Math.asin(sn) - r.th) * 3));
          if (!r.inBarrel && sH > -0.2 && r.stateT > 1.5) stick = { x: steer, y: 1 };
        } else {                          // angle down the line: climb when low, drop when high
          const sl = w ? w.prof.slice(r.s) : null, top = sl ? Math.max(sl.top * (w.fade || 1), 0.3) : 1, hRel = r.y / top;
          const style = L.line === 'mid' ? 0.2 : 0.5, want = c + (hRel - (L.line === 'mid' ? 0.45 : 0.5)) * 3 * (1 + style);
          const base = r.v < c * 0.95 ? 1.1 : Math.asin(Math.max(-0.6, Math.min(0.97, want / Math.max(r.v, 0.5))));
          steer = Math.max(-1, Math.min(1, wrap(base - r.th) * 2.2));
        }
        paddle = r.gAlong < -0.05;   // pump down the face
      }
      // the human part: a shaky hand, and everything you do lands a moment late
      shake = shake * 0.93 + gauss() * L.shake * 0.12;
      buf.push({ steer: Math.max(-1, Math.min(1, steer + (r.standing ? shake : 0))), paddle, stick });
      const lag = Math.round(L.delay / dt), o = buf.length > lag ? buf.shift() : { steer: 0, paddle: false, stick: null };
      g.input.test = o.stick ? null : o.steer; g.input.stick = o.stick; g.input.paddleBtn = o.paddle;
      g.step(dt, dt, false); t += dt; if (r.inBarrel) maxTube = Math.max(maxTube, r.ride.tubeT || 0); if (r.standing && r.wave) curSize = r.wave.size || 1;
    }
  } finally { Math.random = rnd0; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; }
  const rides = out.filter((x) => x.caught), n = out.length || 1;
  const avg = (a, k) => (a.length ? a.reduce((s, x) => s + x[k], 0) / a.length : 0);
  const whys = {}; for (const x of out) whys[x.why] = (whys[x.why] || 0) + 1;
  return { mode, level, tries: out.length, caught: rides.length, madeIt: rides.filter((x) => x.end).length, wipedAtTakeoff: rides.filter((x) => x.atPop && !x.end).length,
    avgRide: +avg(rides, 't').toFixed(1), avgTop: Math.round(avg(rides, 'top')), avgBarrel: +avg(rides, 'barrel').toFixed(1), avgScore: +avg(rides, 'score').toFixed(1), minutes: +(t / 60).toFixed(1), whys, sizes: rides.map((x) => x.size).join(' '), scores: rides.map((x) => x.score.toFixed(1)).join(' '), wipesAt: rides.filter((x) => !x.end).map((x) => x.at + ' t' + x.t.toFixed(1)).join(' ; ') };
}
