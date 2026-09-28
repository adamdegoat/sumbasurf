// Gameplay capture: the REAL game screen (HUD, live score, callouts, buttons, score screen), stepped one frame at a
// time so it stays smooth, each frame screen-captured by scratchpad gp/capsrv.py (:8798). The browser pane must be on
// screen at the region capsrv was started with.
//   const P = await import('./test/gp.js'); P.prep('medium', 3); P.sim(40)      (find the moment)
//   await P.film('uma', from, to)   (frames from..to of the ride, 30 a second; resumable: call again until done)
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const seeded = (seed) => { let st = seed >>> 0; return () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296); };
let S = null;
// a pro's ride: carve until the curl comes, then set up in the pocket, stall till it covers you and hold the line
function drive(r) {
  const g = G(); let o = S.br(r), stick = null;
  if (r.state === 'RIDE' && r.wave && r.stateT > 1.0) {
    const w = r.wave, Hh = w.cond.H, sH = r.s / Hh, yH = r.y / Hh;
    if (r.stateT > S.barrelAt) {
      const lineY = 0.35 + (r.inBarrel ? 0.05 * Math.sin(r.stateT * 2 * Math.PI / 2.6) : 0), err = yH - lineY + (r.stalling ? 0.12 : 0);
      const a0 = Math.asin(Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)));
      const stall = !(r.spitOut > 0) && (r.inBarrel ? sH > -0.6 : sH > -0.2), steer = Math.max(-1, Math.min(1, wrapA(a0 - r.th) * 3));
      o = { steer: stall ? null : steer, pump: !stall && sH < -1.2 }; if (stall) stick = { x: steer, y: 1 };
    } else { o = S.cb(r); o.pump = r.v < w.cond.speed * 0.85; }
  }
  g.input.stick = stick; g.input.test = stick ? null : o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle;
}
export function prep(mode = 'medium', seed = 3, barrelAt = 3.5) {
  const g = G(); if (S && S.rnd0) Math.random = S.rnd0;
  S = { rnd0: Math.random, i: 0, barrelAt, br: brain({}), cb: carveBrain({ hi: 0.8, lo: 0.16, gain: 3.4 }) };
  Math.random = seeded(seed); g.paused = true;
  document.querySelector(`[data-mode="${mode}"]`).click(); document.getElementById('goSurf').click();
  return 'started ' + mode;
}
// after START: wait for the game to be riding-ready, then log the ride (frame index -> state) without capturing
export function sim(secs = 40) {
  const g = G(), out = []; let r = g.rider; const n = secs * 30;
  for (let i = 0; i < n; i++) { r = g.rider; drive(r); g.step(1 / 30, 1 / 30, false); if (i % 30 === 0) out.push(`${i} ${r.state}${r.inBarrel ? ' B' : ''} t${(r.stateT || 0).toFixed(1)} sc${r.state === 'RIDE' ? r.liveScore().toFixed(1) : ''}`); if (r.state === 'OUT' || r.state === 'WIPE') { out.push(`${i} END ${r.why}`); break; } }
  return out.join(' | ');
}
const frame2 = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
export async function film(tag, from, to, budget = 38000) {
  const g = G(), t0 = performance.now();
  while (S.i <= to && performance.now() - t0 < budget) {
    const r = g.rider; drive(r);
    const show = S.i >= from; g.step(1 / 30, 1 / 30, show);
    if (show) { const m = document.getElementById('msg'); if (m.style.display === 'flex') m.style.opacity = 1;   // (the summary's fade-in runs on the page's clock, which is stopped)
      await frame2(); await fetch(`http://127.0.0.1:8798/shot?tag=${tag}&i=${S.i - from}`, { method: 'POST' }); }
    (S.log || (S.log = [])).push(`${S.i} ${r.state}${r.inBarrel ? ' B' : ''} ${r.state === 'RIDE' ? r.liveScore().toFixed(1) : ''}`);
    S.i++;
  }
  return S.i > to ? `${tag}: done` : `${tag}: ${S.i}/${to}`;
}
export const log = () => (S.log || []).filter((x, k) => k % 15 === 0).join(' | ');
export function done() { const g = G(); if (S && S.rnd0) Math.random = S.rnd0; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; g.paused = false; }
