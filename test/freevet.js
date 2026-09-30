// Free-surf beach vet (30 Sep 2026): scripted sessions on the free beach, reporting anything broken.
//   const V = await import('./test/freevet.js?v=' + Date.now()); await V.all()
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
const bad = (v) => !Number.isFinite(v);
const errs = [];
window.addEventListener('error', (e) => errs.push(String(e.message)));
function tap(el) { for (const ev of ['pointerup']) el.dispatchEvent(new PointerEvent(ev, { bubbles: true, cancelable: true })); }
function vis(id) { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }
// ride n waves with the autopilot from wherever you are, checking every frame
export async function rides(n = 6, { maxSec = 400, carve = true, jump = true } = {}) {
  const g = G(); g.paused = true; const br = brain({}), cb = carveBrain({ hi: 0.7, lo: 0.25, gain: 3.4 });
  const out = { rides: [], problems: [], states: {} }; let prev = '', endAt = 0, lieSince = 0, stuck = 0;
  for (let i = 0; i < 60 * maxSec && out.rides.length < n; i++) {
    const r = g.rider;
    if (!r) { if (g.strand) { out.problems.push('on foot at ' + i); break; } g.step(1 / 60, 1 / 60, false); continue; }
    let o = br(r); if (carve && r.state === 'RIDE' && r.stateT > 1) o = cb(r);
    g.input.test = o.steer; g.input.paddleBtn = r.standing ? false : !!o.paddle; g.step(1 / 60, 1 / 60, false);
    const q = g.rider; if (!q) continue; const st = q.state; out.states[st] = (out.states[st] || 0) + 1;
    if (bad(q.x) || bad(q.z) || bad(q.v) || bad(g.camera.position.x) || bad(g.camera.position.y)) { out.problems.push(`NaN at frame ${i} state ${st}`); break; }
    if (vis('msg')) out.problems.push(`score screen shown (${st})`);
    if ((st === 'WIPE' || st === 'OUT') && prev !== st && (prev === 'RIDE' || prev === 'POP' || prev === 'LIE')) { endAt = i; out.rides.push(`${st} ${q.why} at ${q.x.toFixed(0)},${q.z.toFixed(0)} ride ${q.ride.t.toFixed(1)}s`); }
    if ((st === 'WIPE' || st === 'OUT') && i - endAt > 60 * 8) { out.problems.push(`stuck in ${st} ${((i - endAt) / 60).toFixed(0)} s: ${q.why}`); break; }
    if (st === 'LIE') { if (prev !== 'LIE') lieSince = i; if (i - lieSince > 60 * 120) { stuck++; out.problems.push(`lying 120 s without a wave at ${q.x.toFixed(0)},${q.z.toFixed(0)}`); lieSince = i; if (stuck > 1) break; } }
    if (jump && st === 'LIE' && vis('freeOut') && i - (out.jumpAt || -1e9) > 60 * 3) { out.jumpAt = i; out.jumps = (out.jumps || 0) + 1; tap(document.getElementById('freeOut')); await new Promise((res) => setTimeout(res, 700)); }
    prev = st;
  }
  g.input.test = null; g.input.paddleBtn = false; return out;
}
export function freshFree(q = '') {
  const g = G(); g.paused = true; return g.start('free');
}
// is each buoy sitting on the water?
export function buoys() {
  const g = G(), res = []; g.scene.children.forEach((c) => { if (c.isGroup && c.scale.x > 1.8 && c.scale.x < 2 && c.children.length === 3) res.push(c); });
  return res.map((b) => ({ vis: b.visible, x: b.position.x.toFixed(0), z: b.position.z.toFixed(0), y: b.position.y.toFixed(2) }));
}
export { errs };
