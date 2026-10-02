// Nose-ride view check (2 Oct 2026): a longboard ride that walks up to the nose; grabs your own view at moments along the
// walk, so the before/after of the camera on the nose can be looked at side by side.
//   const N = await import('./test/noseshot.js?v=' + Date.now()); const r = await N.run({ mode: 'easy', seed: 4 }); N.grid(r.shots)
const G = () => window.__g;
export const out_probe = [];
export async function run({ mode = 'easy', seed = 4, walk = [3, 10], at = [0.45, 0.8, 0.8, 0.8], gap = 0.6, probe = -1 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'ns' + Math.random(), n = 60 * 30;
  FM.addPro(nm, mode, seed, n, 'long', 'carve', { walk }); const t = FM.takes[nm]; t.init();
  const shots = [], info = []; let k = 0, lastT = -9, maxNose = 0, hangMax = 0;
  for (let i = 0; i < n && k < at.length; i++) {
    t.frame(i); const r = g.rider; maxNose = Math.max(maxNose, r.nose || 0); hangMax = Math.max(hangMax, r.hangT || 0);
    if (r.state === 'WIPE' || r.state === 'OUT') break;
    if (r.state === 'RIDE' && r.wave && (r.nose || 0) >= at[k] && r.stateT - lastT > gap) {
      draw(g); shots.push(g.renderer.domElement.toDataURL('image/jpeg', 0.75));
      if (k === probe) { const ms = []; g.scene.traverse((o) => { if (o.isMesh && o.visible) { const p = new (g.camera.position.constructor)(); o.getWorldPosition(p); if (p.distanceTo(g.camera.position) < 4) ms.push(o); } });
        out_probe.length = 0;
        { const oc = g.camera.clone(); oc.layers.set(0); const r0 = g.rider, sx = -Math.sin(r0.th), sz = Math.cos(r0.th); oc.position.set(g.rig.position.x + sx * 2.2 + Math.cos(r0.th) * 1.2, g.rig.position.y + 1.2, g.rig.position.z + sz * 2.2 + Math.sin(r0.th) * 1.2); oc.fov = 50; oc.updateProjectionMatrix(); oc.lookAt(g.rig.position.x, g.rig.position.y + 0.5, g.rig.position.z); g.renderer.render(g.scene, oc); out_probe.push(['outside', g.renderer.domElement.toDataURL('image/jpeg', 0.7)]); oc.layers.enableAll(); const hv = g.HIDELEGS.value; g.HIDELEGS.value = 0; g.renderer.render(g.scene, oc); g.HIDELEGS.value = hv; out_probe.push(['outside all', g.renderer.domElement.toDataURL('image/jpeg', 0.7)]); }
        for (const m of ms) { m.visible = false; draw(g); out_probe.push([(m.name || '?') + '/' + (m.material && m.material.name) + '/' + m.layers.mask, g.renderer.domElement.toDataURL('image/jpeg', 0.6)]); m.visible = true; } }
      info.push({ nose: +(r.nose || 0).toFixed(2), t: +r.stateT.toFixed(1), y: +(r.y / r.wave.cond.H).toFixed(2), ...where(g) }); lastT = r.stateT; k++;
    }
  }
  const r = g.rider; const out = { shots, info, end: r.state, why: r.why || '', maxNose: +maxNose.toFixed(2), hangMax: +hangMax.toFixed(1), score: r.ride && r.ride.score };
  t.done(); return out;
}
export function grid(shots, cols = 2) {
  document.querySelectorAll('.nsgrid').forEach((e) => e.remove());
  const d = document.createElement('div'); d.className = 'nsgrid';
  d.style.cssText = `position:fixed;inset:0;z-index:99999;background:#000;display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px`;
  for (const s of shots) { const i = new Image(); i.src = s; i.style.cssText = 'width:100%;height:100%;object-fit:contain'; d.appendChild(i); }
  document.body.appendChild(d);
}
// where the board's tip and your feet are in the picture: screen height from -1 (bottom edge) to 1 (top); below -1 is off screen
export function where(g) {
  const V = g.camera.position.constructor, fx = Math.cos(g.rider.th), fz = Math.sin(g.rider.th); let tip = null, best = -1e9; const v = new V();
  g.rig.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) { const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i += 2) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); const d = v.x * fx + v.z * fz; if (d > best) { best = d; tip = v.clone(); } } } });
  const sy = (p) => +p.clone().project(g.camera).y.toFixed(2), out = { fov: +g.camera.fov.toFixed(0), tipY: tip ? sy(tip) : null };
  g.rig.traverse((o) => { if (o.isBone && /^(ball_l|ball_r|calf_l|calf_r)$/.test(o.name)) { o.getWorldPosition(v); out[o.name] = sy(v); } });
  return out;
}
// the game's own two passes: the world, then your body through its own lens (as the frame loop does)
export function draw(g) {
  const R = g.renderer, c = g.camera, a = g.armCam; g.ARMCUT.value = g.rider && g.rider.standing ? g.armCutNow() : 0; a.position.copy(c.position); a.quaternion.copy(c.quaternion); a.aspect = c.aspect;
  a.fov = c.fov + (62 - c.fov) * (g.rider && g.rider.standing ? 1 : 0); a.updateProjectionMatrix();
  R.autoClear = false; R.clear(); R.render(g.scene, c); R.clearDepth(); R.render(g.scene, a); R.autoClear = true;
}
// stop the ride at a moment and leave it frozen there, so the game's own frame loop draws it (for a real screenshot)
export async function freeze({ mode = 'easy', seed = 4, walk = [3, 10], nose = 0.8, after = 0.6 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'nf' + Math.random(), n = 60 * 30;
  FM.addPro(nm, mode, seed, n, 'long', 'carve', { walk }); const t = FM.takes[nm]; t.init(); let t0 = null;
  for (let i = 0; i < n; i++) { t.frame(i); const r = g.rider; if (r.state === 'WIPE' || r.state === 'OUT') return { end: r.state };
    if (r.state === 'RIDE' && (r.nose || 0) >= nose && t0 === null) t0 = r.stateT;
    if (t0 !== null && r.stateT - t0 >= after) { g.paused = true; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; return { nose: r.nose, t: r.stateT, ...where(g) }; } }
  return { none: true };
}
// where your body parts are from your eyes, in metres: ahead along the board, down, and to the side
export function body(g) {
  const V = g.camera.position.constructor, fx = Math.cos(g.rider.th), fz = Math.sin(g.rider.th), c = g.camera.position, v = new V(), out = {};
  g.rig.traverse((o) => { if (o.isBone && /^(pelvis|spine_0[1-3]|neck_01|head|thigh_[lr]|calf_[lr]|foot_[lr]|ball_[lr])$/.test(o.name)) { o.getWorldPosition(v); const dx = v.x - c.x, dz = v.z - c.z; out[o.name] = [+(dx * fx + dz * fz).toFixed(2), +(c.y - v.y).toFixed(2), +(-dx * fz + dz * fx).toFixed(2), +v.clone().project(g.camera).y.toFixed(2)]; } });
  return out;
}
// how smooth the view is through a whole walk up (and any step back): the biggest turn and the biggest move of your eyes
// from one frame to the next, with the shipped settings or the live game's (NOSEVIEW zeroed back to how it was)
export async function smooth({ mode = 'medium', seed = 5, live = false, walk = [3, 10], cbo = {} } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), NV = g.NOSEVIEW, keep = { ...NV };
  if (live) Object.assign(NV, { down: -0.12, lens: 0, back: 0, cut: 0, arm: 0 });
  const nm = 'sm' + Math.random(); FM.addPro(nm, mode, seed, 1800, 'long', 'carve', { walk, ...cbo }); const t = FM.takes[nm]; t.init();
  const q0 = g.camera.quaternion.clone(), p0 = g.camera.position.clone(), rp0 = g.rig.position.clone(); let first = true, maxA = 0, maxP = 0, at = null, n = 0, back = 0, tipOff = 0, why = '';
  for (let i = 0; i < 1800; i++) {
    t.frame(i); const r = g.rider; if (r.state !== 'RIDE') { why = r.why || r.state; if (n) break; else continue; }
    if (g.noseV < 0.02 && !n) { first = true; continue; }
    const q = g.camera.quaternion, rel = g.camera.position.clone().sub(g.rig.position);
    if (!first) { const a = q0.angleTo(q) * 57.3, dp = rel.distanceTo(p0); if (a > maxA) { maxA = a; at = +g.noseV.toFixed(2); } maxP = Math.max(maxP, dp); }
    if (g.noseV > 0.05 && where(g).tipY < -1) tipOff++;
    q0.copy(q); p0.copy(rel); first = false; n++; if (n > 60 * 14) break;
  }
  t.done(); Object.assign(NV, keep);
  return { frames: n, maxTurnDegPerFrame: +maxA.toFixed(2), atNose: at, maxEyeMoveCmPerFrame: +(maxP * 100).toFixed(1), tipOffFrames: tipOff, end: why };
}
