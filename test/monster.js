// The monster wave check (1 Oct 2026): test surfers towed into the 30 m wave by the jet ski (no paddling in), then riding it
// at skill.js's levels (a reaction delay, a shaky hand, their own line). Reports per level how many waves they make, how
// rides end, ride time, top speed and score.
//   const M = await import('./test/monster.js?v=' + Date.now()); M.run('good', 6, 7)   (synchronous; returns a summary)
import { carveBrain } from './sim2.js';
import { LEVELS } from './skill.js';
const G = () => window.__g;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function run(level = 'decent', waves = 6, seed = 7, mode = 'monster', board = 'gun', tow = true, aware = true) {
  const g = G(), L = LEVELS[level], dt = 1 / 30;
  const rnd0 = Math.random; let st = seed >>> 0; const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  Math.random = rnd;
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return u - 3; };
  const cb = carveBrain({ hi: L.hi || 0.8, lo: 0.18, gain: 3.4 }), out = [], buf = []; let shake = 0, guard = 0, top = 0, paddleCaught = 0;
  const board0 = g.board;
  try {
    g.paused = true; g.useBoard(board); g.setMode(mode);
    document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
    g.spawnRider();
    while (out.length < waves && guard++ < 30 * 60 * 12) {
      const r = g.rider;
      if (r.state === 'WIPE' || r.state === 'OUT') {
        const R = r.ride;
        const wv = r.wave; out.push({ why: r.why || r.state, t: +R.t.toFixed(1), top: Math.round(top), score: R.score || 0, end: !!R.end, towed: !!r.towed, at: wv ? `wT ${(g.T - wv.tBreak).toFixed(1)} s/H ${(r.s / wv.cond.H).toFixed(2)} y ${r.y.toFixed(1)} z ${r.z.toFixed(0)}` : '' });
        top = 0; r.towed = false; g.spawnRider(); buf.length = 0; continue;
      }
      let steer = 0, paddle = false, stick = null;
      if (!r.standing) {
        // waiting out the back: tow in as soon as a wave has started to break (the game's TOW IN does the same)
        const inc = g.incoming(), w = inc.w, tw = g.waves.find((v) => g.T - v.tBreak >= 0.2 && g.T - v.tBreak < 3 && !v.towed);   // (the game's TOW IN takes you to the wave that's just breaking, wherever you're sitting)
        if (tow && tw) { tw.towed = true; g.towNow(tw); }
        else if (!tow && w && inc.t < 2.5) { const d = wrap(Math.PI / 2 - r.th); steer = Math.max(-1, Math.min(1, d * 2)); paddle = Math.abs(d) < 0.6; }   // (tow = false: paddle hard at every wave, to prove paddling alone can't catch it)
      } else {
        if (!r.towed) paddleCaught++;
        const w = r.wave, c = w ? w.cond.speed : 5, H = w ? w.cond.H : 1, sH = r.s / H, yH = r.y / H;
        if (L.line === 'carve' && w) { steer = cb(r).steer; }
        else if (L.line === 'barrel' && w) {
          const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, c / Math.max(r.v, 1) + err * 0.9));
          steer = Math.max(-1, Math.min(1, wrap(Math.asin(sn) - r.th) * 3));
          if (!r.inBarrel && sH > -0.2 && r.stateT > 1.5) stick = { x: steer, y: 1 };
        } else {
          const sl = w ? w.prof.slice(r.s) : null, tp = sl ? Math.max(sl.top * (w.fade || 1), 0.3) : 1, hRel = r.y / tp;
          const style = L.line === 'mid' ? 0.2 : 0.5, want = c + (hRel - (L.line === 'mid' ? 0.45 : 0.5)) * 3 * (1 + style);
          const base = r.v < c * 0.95 ? 1.1 : Math.asin(Math.max(-0.6, Math.min(0.97, want / Math.max(r.v, 0.5))));
          steer = Math.max(-1, Math.min(1, wrap(base - r.th) * 2.2));
        }
        // (a player who's read the drop tip: never points within ~35 deg of straight down while fast and low on the face)
        if (aware && w) { const sl = w.prof.slice(r.s), hr = r.y / Math.max(0.3, sl.top * (w.fade || 1)); if (hr < 0.4 && r.v > 18) { const lim = 0.9, want = Math.min(r.th, lim); if (r.th > lim && r.th < Math.PI - lim) steer = Math.max(-1, Math.min(1, wrap(want - r.th) * 3)); } }
        paddle = r.gAlong < -0.05;
        top = Math.max(top, r.v * 3.6);
      }
      shake = shake * 0.93 + gauss() * L.shake * 0.12;
      buf.push({ steer: Math.max(-1, Math.min(1, steer + (r.standing ? shake : 0))), paddle, stick });
      const lag = Math.round(L.delay / dt), o = buf.length > lag ? buf.shift() : { steer: 0, paddle: false, stick: null };
      g.input.test = o.stick ? null : o.steer; g.input.stick = o.stick; g.input.paddleBtn = o.paddle;
      g.step(dt, dt, false);
    }
  } finally { Math.random = rnd0; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; if (board0) g.useBoard(board0); }
  const whys = {}; for (const o of out) whys[o.why] = (whys[o.why] || 0) + 1;
  const avg = (k) => (out.length ? +(out.reduce((s, o) => s + o[k], 0) / out.length).toFixed(1) : 0);
  return { level, waves: out.length, made: out.filter((o) => o.end).length, paddleCaught, avgRide: avg('t'), avgTop: avg('top'), maxTop: Math.max(0, ...out.map((o) => o.top)), avgScore: avg('score'),
    scores: out.map((o) => o.score.toFixed(1)).join(' '), whys, lying: out.filter((o) => !o.towed).map((o) => o.at) };
}
