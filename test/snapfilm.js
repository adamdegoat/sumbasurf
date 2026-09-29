// Film a carving ride, snaps and all, frame by frame (canvas only) to the local receiver (scratchpad film/recv.py, :8799).
//   const F = await import('./test/snapfilm.js?x=1'); F.prep('medium', 11, true); await F.film('after', 0, 600)   (resumable)
import { carveBrain } from './sim2.js';
import { RIDE } from '../js/surf.js?v=168';
const G = () => window.__g;
const seeded = (seed) => { let st = seed >>> 0; return () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296); };
let S = null;
export function prep(mode = 'medium', seed = 11, snap = true) {
  const g = G(); if (S && S.rnd0) Math.random = S.rnd0;
  RIDE.snap = snap ? 1 : 0;
  S = { rnd0: Math.random, i: 0, cb: carveBrain({ hi: 0.8, lo: 0.18, gain: 3.4 }), log: [] };
  Math.random = seeded(seed); g.T = 100; g.paused = true;
  document.querySelector(`[data-mode="${mode}"]`).click(); document.getElementById('goSurf').click();
  return 'ready';
}
function drive() {
  const g = G(), r = g.rider; let steer = 0, paddle = false;
  if (!r.standing) { const inc = g.incoming(); const want = inc.w && inc.t < 6 ? Math.PI / 2 : -Math.PI / 2; const d = Math.atan2(Math.sin(want - r.th), Math.cos(want - r.th)); steer = Math.max(-1, Math.min(1, d * 2)); paddle = !!(inc.w && inc.t < 2.6 && Math.abs(d) < 0.6); }
  else if (r.wave) { const o = S.cb(r); steer = o.steer; paddle = r.v < r.wave.cond.speed * 0.85; }
  g.input.test = steer; g.input.paddleBtn = paddle;
}
export function sim(maxSec = 60) {   // (run on, without filming, until standing a few seconds into the ride; returns the frame count)
  const g = G(); for (let k = 0; k < maxSec * 30; k++) { drive(); g.step(1 / 30, 1 / 30, false); S.i++; const r = g.rider; if (r.state === 'RIDE' && r.stateT > 1.5) break; if (r.state === 'OUT' || r.state === 'WIPE') break; }
  return S.i;
}
export async function film(tag, n = 450, budget = 38000) {
  const g = G(), t0 = performance.now(), cv = g.renderer.domElement; S.f = S.f || 0;
  while (S.f < n && performance.now() - t0 < budget) {
    drive(); g.step(1 / 30, 1 / 30, true);
    const url = cv.toDataURL('image/jpeg', 0.9), r = g.rider;
    S.log.push([S.f, r.state, r.trick ? r.trick.name : '', +(r.snapK || 0).toFixed(2), Math.round(Math.abs(r.turn) * 57.3), Math.round((r.slide || 0) * 57.3), +(r.v * 3.6).toFixed(0)]);
    await fetch(`http://127.0.0.1:8799/frame?tag=${tag}&i=${S.f}`, { method: 'POST', body: url }); S.f++;
    if (r.state === 'OUT' || r.state === 'WIPE') { if (!S.endAt) S.endAt = S.f; if (S.f - S.endAt > 45) break; }
  }
  return S.f >= n || S.endAt ? `${tag}: done ${S.f}` : `${tag}: ${S.f}`;
}
export const log = () => S.log;
export function done() { const g = G(); if (S && S.rnd0) Math.random = S.rnd0; RIDE.snap = 1; g.input.test = null; g.input.paddleBtn = false; g.paused = false; }
