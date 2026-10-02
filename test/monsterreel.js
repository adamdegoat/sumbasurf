// Ombak Raksasa reel (2 Oct 2026, his ask: POV only, pro and smooth, one take, no cuts). The game's own tow-in (TOW IN:
// up behind the jet ski on the face, the rope drops by itself), then a pro rides the 30 m wave out. One physics step per
// frame at 60 a second (blended to 30 with motion blur, tools/video/blend.py); the view is the game's first-person camera
// with its small bumps smoothed out like a gimbal, framed as a tall slice of the game's landscape lens that leans to the wave.
//   const FM = await import('./film.js'); const MR = await import('./monsterreel.js'); MR.sims(...)   (pick a ride)
//   FM.setup(1080, 1920); FM.takes.mr = MR.take(seed, line, n); await FM.run('mr')   (repeat until done)
import * as THREE from 'three';
import { carveBrain } from './sim2.js';
const G = () => window.__g;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const NATIVE = window.__nativeRandom || (window.__nativeRandom = Math.random);
const seeded = (s) => { let x = s >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
// the pro's hands: 'race' holds the pocket high and fast, 'carve' draws long turns up and down the face, 'barrel' sets up
// behind the curl and pulls in. Always: never pointing straight down the face while fast and low (the drop rule)
function pilot(line) {
  const cb = carveBrain({ hi: 0.72, lo: 0.2, gain: 2.6 });
  return (r) => {
    const g = G(), w = r.wave; if (!w || !r.standing) return { steer: 0, stick: null, pump: false };
    const c = w.cond.speed, H = w.cond.H, sH = r.s / H, sl = w.prof.slice(r.s), top = Math.max(0.3, sl.top * (w.fade || 1)), hr = r.y / top;
    let steer = 0, stick = null;
    if (line === 'carve') steer = cb(r).steer;
    else if (line === 'barrel') { const err = r.y / H - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, c / Math.max(r.v, 1) + err * 0.9)); steer = Math.max(-1, Math.min(1, wrap(Math.asin(sn) - r.th) * 2.4)); if (!r.inBarrel && sH > -0.2 && r.stateT > 2) stick = { x: steer, y: 1 }; }
    else if (line === 'pro2') {   // steering by the barrel itself: hold ~0.75 wave heights behind the curl and a third of the way up the face; slipping back, go faster along the line and pump; getting ahead, stall and let the curl catch up
      const peel = w.cond.peel, eS = sH - (-0.75), yH = r.y / H;
      const vxD = Math.max(0.6 * peel, Math.min(1.7 * peel, peel * (1 - 0.7 * eS))), vzD = c * (1 - 0.9 * (0.33 - yH));
      const thD = Math.atan2(vzD, vxD); steer = Math.max(-1, Math.min(1, wrap(thD - r.th) * 1.6));
      if (eS > 0.35 && r.stateT > 2 && !r.tailOn && !((r.snapK || 0) > 0.2)) stick = { x: steer, y: 1 };   // (never a stall that turns into a tail slide)
      if (hr < 0.4 && r.v > 18) { const lim = 0.9; if (r.th > lim && r.th < Math.PI - lim) steer = Math.max(-1, Math.min(1, wrap(lim - r.th) * 2)); }
      return { steer, stick: stick && { x: steer, y: 1 }, pump: !stick && yH > 0.22 && (eS < -0.15 || r.gAlong < -0.05) }; }   // (no pumping down at the bottom: it only drives you further down the face)
    else if (line === 'pro') {   // the barrel, ridden like a pro: stall to get covered, but watch the depth: past ~1 wave height behind the curl, race (pump, a higher faster line) before the foam ball can catch you
      const deep = sH < -0.8, err = r.y / H - (deep ? 0.5 : 0.36) + (r.stalling ? 0.1 : 0), sn = Math.max(-0.6, Math.min(0.97, c * (deep ? 1.15 : 1) / Math.max(r.v, 1) + err * 0.9));
      steer = Math.max(-1, Math.min(1, wrap(Math.asin(sn) - r.th) * 1.3));   // (a calm hand: a steady line through the tube, not a weave) if (!deep && !r.inBarrel && sH > -0.25 && r.stateT > 2) stick = { x: steer, y: 1 };
      return { steer, stick, pump: deep || r.gAlong < -0.05 }; }
    else { const want = c + (hr - 0.55) * 3.2, base = r.v < c * 0.95 ? 1.1 : Math.asin(Math.max(-0.6, Math.min(0.97, want / Math.max(r.v, 0.5)))); steer = Math.max(-1, Math.min(1, wrap(base - r.th) * 1.8)); }
    if (hr < 0.4 && r.v > 18) { const lim = 0.9; if (r.th > lim && r.th < Math.PI - lim) steer = Math.max(-1, Math.min(1, wrap(lim - r.th) * 2)); }
    return { steer, stick, pump: r.gAlong < -0.05 };
  };
}
function begin(seed) {
  const g = G(); Math.random = seeded(seed); g.paused = true; g.T = 1000; g.useBoard('gun'); g.setMode('monster');   // (the game clock set to the same start every time: waves and wobble then replay exactly)
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); g.spawnRider();
  for (let i = 0; i < 60 * 3; i++) g.step(1 / 60, 1 / 60, false);
  g.towStart(); for (let i = 0; i < 60 * 25 && !g.towDbg.tow; i++) g.step(1 / 60, 1 / 60, false);   // (the fade, then up behind the ski)
}
// ride a seed out with no drawing: how long from the let-go, how it ended, top speed, barrel time, biggest camera turn a frame
export function sims(seeds, line = 'race', maxS = 60) {
  const g = G(), out = [];
  for (const seed of seeds) {
    try { begin(seed); const P = pilot(line); let rel = null, top = 0, tube = 0, n = 0, jerk = 0; const pq = new THREE.Quaternion().copy(g.camera.quaternion);
      for (let i = 0; i < 60 * maxS; i++) { const r = g.rider; const o = P(r); g.input.test = o.stick ? null : o.steer; g.input.stick = o.stick; g.input.paddleBtn = !!o.pump;
        g.step(1 / 60, 1 / 60, false); n++; const dq = THREE.MathUtils.radToDeg(pq.angleTo(g.camera.quaternion)); pq.copy(g.camera.quaternion);
        if (!g.towDbg.tow && r.standing && rel === null) rel = n; if (rel !== null) { top = Math.max(top, r.v * 3.6); if (r.inBarrel) tube += 1 / 60; if (n - rel > 10) jerk = Math.max(jerk, dq); }
        if (r.state === 'WIPE' || r.state === 'OUT') break; }
      const r = g.rider; out.push({ seed, towS: +((rel || n) / 60).toFixed(1), rideS: +((n - (rel || n)) / 60).toFixed(1), end: r.why || r.state, kmh: Math.round(top), tubeS: +tube.toFixed(1), score: r.ride && r.ride.score, jerkDeg: +jerk.toFixed(1) });
    } catch (e) { out.push({ seed, err: e.message }); }
    finally { Math.random = NATIVE; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; }
  }
  g.paused = false; return out;
}
// the take: n frames at 60 a second from the moment you're up behind the ski
export function take(seed, line = 'race', n = 60 * 40, smoothK = 0.1) {
  const rs = { pan: 0.5, q: null, P: null, k: 0, dir: null };
  return { n,
    init() { begin(seed); rs.P = pilot(line); rs.q = null; rs.pan = 0.5; rs.k = 0; rs.dir = null; rs.i = 0; rs.endAt = null; rs.why = ''; },
    rs,
    frame() {
      const g = G(), r = g.rider, o = rs.P(r); g.input.test = o.stick ? null : o.steer; g.input.stick = o.stick; g.input.paddleBtn = !!o.pump;
      g.step(1 / 60, 1 / 60, false); rs.i = (rs.i || 0) + 1; if (rs.endAt == null && (r.state === 'OUT' || r.state === 'WIPE')) { rs.endAt = rs.i; rs.why = r.why; }
      const c = g.camera; c.updateMatrixWorld();
      // eyes down the line (the big-wave POV): the wall and the lip beside you, the way out ahead. Eased in once you're up
      // (on the rope you look where the game looks); the aim point is ahead along the wave at the lip, a little below eye height
      const up = r.standing && r.wave && (r.state === 'RIDE' || r.state === 'POP'); rs.k = (rs.k || 0) + ((up ? 1 : 0) - (rs.k || 0)) * 0.03;
      if (rs.k > 0.01 && r.wave) { const H = r.wave.cond.H, L = r.wave.lipAt(r.s + 0.9 * H), d = new THREE.Vector3(L[0] - c.position.x, 0, L[2] + 0.12 * H - c.position.z);
        if (d.lengthSq() > 0.04) { d.normalize(); rs.dir = rs.dir ? rs.dir.lerp(d, 0.04).normalize() : d; }
        if (rs.dir) { const q0 = c.quaternion.clone(), tg = c.position.clone().addScaledVector(rs.dir, 20); tg.y = c.position.y - 5.6; c.lookAt(tg); c.quaternion.copy(q0.slerp(c.quaternion.clone(), rs.k)); c.updateMatrixWorld(); } }
      // gimbal: the turn kept, the small quick bumps (chop, each pump stroke) smoothed away
      if (!rs.q) rs.q = c.quaternion.clone(); else rs.q.slerp(c.quaternion, smoothK); c.quaternion.copy(rs.q); c.updateMatrixWorld();
      return { fov: 74, body: false, crop: 0.5 };   // (no arms: in the tall frame they covered the middle of the picture)
    },
    done() { const g = G(); Math.random = NATIVE; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; } };
}
// one ride, its line every half second: where on the wave (s and y in wave heights), speed, in the tube, stalling
export function trace(seed, line = 'pro', maxS = 40) {
  const g = G(), rows = [], rs0 = {}; begin(seed); const P = pilot(line); let rel = null;
  for (let i = 0; i < 60 * maxS; i++) { const r = g.rider, o = P(r); g.input.test = o.stick ? null : o.steer; g.input.stick = o.stick; g.input.paddleBtn = !!o.pump; g.step(1 / 60, 1 / 60, false);
    if (!g.towDbg.tow && r.standing && rel === null) rel = i;
    if (rel !== null && (i - rel) % 15 === 0 && r.wave) { const H = r.wave.cond.H; rows.push(`${((i - rel) / 60).toFixed(2)} s${(r.s / H).toFixed(2)} y${(r.y / H).toFixed(2)} v${r.v.toFixed(1)} vx${r.vx.toFixed(1)} pk${(((r.wave.peelX - (rs0.px ?? r.wave.peelX)) * 4)).toFixed(1)} th${r.th.toFixed(2)}${r.inBarrel ? ' B' : ''}${r.stalling ? ' st' : ''}${o.pump ? ' p' : ''}`); if (rows.length > 16) rows.shift(); rs0.px = r.wave.peelX; }
    if (r.state === 'WIPE' || r.state === 'OUT') { rows.push('END ' + r.why); break; } }
  Math.random = NATIVE; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; g.paused = false; return rows.join(' | ');
}
