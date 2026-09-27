// The moment you catch a wave: paddle into it holding the button (like a player), then ride on with no input for 2.5 s.
// Every frame is drawn for real and timed (a first-time shader build shows as a long frame), and the camera's movement
// is logged so a jump, a jerk or a sudden spin shows as a spike. First-person frames around the catch go to :8799.
//   const C = await import('./test/catchvet.js'); await C.run('medium', 7)
const G = () => window.__g;
let _E = null;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export async function run(mode = 'medium', seed = 7, film = true) {
  const g = G(), rd = g.renderer, c = g.camera, gl = rd.getContext(), name = `cv_${window.__cvTag || ""}${mode}_${seed}`;
  const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  _E = _E || new c.rotation.constructor(); const log = [], shots = []; let popI = -1, target = null, go = false;
  const lp = c.position.clone(), lq = c.quaternion.clone(); let lv = 0;
  try {
    g.paused = true; g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); g.spawnRider();
    const r = g.rider;
    for (let i = 0; i < 60 * 45; i++) {
      const inc = g.incoming(); if (!target && inc.w && inc.t < 9) target = inc.w;
      let steer = 0, paddle = false;
      if (popI < 0) {
        const dxT = target ? target.peelX + target.cond.peel * inc.t + 0.3 * target.cond.H - r.x : 0;
        if (target && inc.t > 3 && Math.abs(dxT) > 2.5) { const d = wrap((dxT > 0 ? 0 : Math.PI) - r.th); steer = Math.max(-1, Math.min(1, d * 2)); paddle = Math.abs(d) < 0.6; }
        else { const d = wrap((target ? Math.PI / 2 : -Math.PI / 2) - r.th); steer = Math.max(-1, Math.min(1, d * 2)); if (!go && target && inc.t < 2.5) go = true; paddle = go && Math.abs(d) < 0.5; }
      }
      g.input.test = steer; g.input.paddleBtn = paddle && !r.standing;
      const t0 = performance.now(); g.step(1 / 60, 1 / 60, false);
      rd.setPixelRatio(1); rd.setSize(640, 296, false);
      const aa = g.armCam; c.aspect = aa.aspect = 640 / 296; c.updateProjectionMatrix(); aa.updateProjectionMatrix(); rd.autoClear = false; rd.clear(); if (g.mirror) g.flipProj(c); rd.render(g.scene, c); if (g.mirror) g.flipProj(c); aa.position.copy(c.position); aa.quaternion.copy(c.quaternion); rd.clearDepth(); if (g.mirror) g.flipProj(aa); rd.render(g.scene, aa); if (g.mirror) g.flipProj(aa); rd.autoClear = true; gl.finish(); const ms = performance.now() - t0;   // (what the player sees: the world, then the arms on top) const ms = performance.now() - t0;
      if (popI < 0 && r.state === 'POP') popI = i;
      // camera: speed (m/s), change of speed in one frame (a jerk), and how fast it turns (deg/s)
      const v = c.position.distanceTo(lp) * 60, ang = lq.angleTo(c.quaternion) * 57.3 * 60;
      log.push({ i, st: r.state, t: +r.stateT.toFixed(2), ms: +ms.toFixed(1), v: +v.toFixed(2), dv: +(v - lv).toFixed(2), rot: +ang.toFixed(0), eye: +(c.position.y - g.rig.position.y).toFixed(2), rv: +r.v.toFixed(1), eu: (() => { _E.setFromQuaternion(c.quaternion, 'YXZ'); return [_E.x, _E.y, _E.z].map((v) => +(v * 57.3).toFixed(2)); })() });
      lv = v; lp.copy(c.position); lq.copy(c.quaternion);
      if (film && true) { shots.push([i, rd.domElement.toDataURL('image/jpeg', 0.7)]); if (shots.length > 120 && popI < 0) shots.shift(); }
      if (popI >= 0 && i > popI + 150) break;
      if (r.state === 'WIPE' || r.state === 'OUT') break;
    }
  } finally { Math.random = rnd0; g.input.test = null; g.input.paddleBtn = false; }
  const around = log.filter((x) => popI >= 0 && x.i >= popI - 90 && x.i <= popI + 150);
  if (film) {
    const keep = shots.filter(([i]) => i >= popI - 60 && i <= popI + 90).map(([i, u], k) => [k, u]);
    await fetch(`http://127.0.0.1:8799/b?shot=${name}`, { method: 'POST', body: JSON.stringify(keep) });
  }
  await fetch(`http://127.0.0.1:8799/f?shot=${name}_meta&i=0`, { method: 'POST', body: JSON.stringify({ popI, around }) });
  return `${mode}/${seed}: ${popI < 0 ? 'no catch' : 'caught'} ${g.rider.state}`;
}
