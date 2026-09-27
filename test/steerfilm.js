// the same scripted thumb on the same wave, filmed first person (size locked): full right, back, full left, half, ...
// so old and new steering can be compared frame for frame. Frames + the thumb position go to the receiver (:8799).
import { moment } from './shots.js';
const G = () => window.__g;
const post = async (name, i, rd) => { const b = await (await fetch(rd.domElement.toDataURL('image/jpeg', 0.85))).blob(); await fetch(`http://127.0.0.1:8799/f?shot=${name}&i=${i}`, { method: 'POST', body: b }); };
// thumb plan (seconds, thumb): steady, a hard turn one way, recover, a half-thumb turn, a flick the other way
const PLAN = [[0.8, 0], [0.7, -1], [0.6, 0.75], [0.9, 0], [0.9, -0.5], [0.6, 0.5], [0.8, 0]];   // (share of the thumb pad)
const thumb = (t) => { let a = 0; for (const [d, x] of PLAN) { if (t < a + d) return x; a += d; } return 0; };
export async function film(name, { mode = 'medium', seed = 7 } = {}) {
  const g = G(); await moment(mode, 'trim', seed);
  const fov0 = g.camera.fov, afov = g.armCam.fov, asp = g.camera.aspect, r = g.rider, rd = g.renderer, log = [];
  const fix = () => { rd.setPixelRatio(1.5); rd.setSize(844, 390, false); for (const c of [g.camera, g.armCam]) c.aspect = asp; g.camera.fov = fov0; g.armCam.fov = afov; g.camera.updateProjectionMatrix(); g.armCam.updateProjectionMatrix(); };
  const total = PLAN.reduce((a, p) => a + p[0], 0);
  for (let i = 0; i < total * 60; i++) {
    const pad = thumb(i / 60), a0 = Math.abs(pad), x = a0 < 0.08 ? 0 : Math.sign(pad) * Math.pow((a0 - 0.08) / 0.92, window.__curve || 1.15); g.input.test = x; g.input.paddleBtn = false; g.step(1 / 60, 1 / 60, false);
    if (i % 2 === 0) { fix(); rd.autoClear = false; rd.clear(); rd.render(g.scene, g.camera); const a = g.armCam; a.position.copy(g.camera.position); a.quaternion.copy(g.camera.quaternion); rd.clearDepth(); rd.render(g.scene, a); rd.autoClear = true; await post(name, i / 2, rd); log.push([pad, r.state, Math.round(r.turn * 57.3)]); }
    if (r.state !== 'RIDE') break;
  }
  g.input.test = null;
  await fetch(`http://127.0.0.1:8799/f?shot=${name}_meta&i=0`, { method: 'POST', body: JSON.stringify(log) });
  return log.length;
}
// the same thumb plan seen from beside the surfer (every 3rd step over the hard turn and the flip back)
export async function side(name, { mode = 'medium', seed = 7 } = {}) {
  const g = G(); await moment(mode, 'trim', seed); const r = g.rider, rd = g.renderer, c = g.camera; let k = 0;
  for (let i = 0; i < 150; i++) {
    const p0 = thumb(i / 60), a0 = Math.abs(p0), x = a0 < 0.08 ? 0 : Math.sign(p0) * Math.pow((a0 - 0.08) / 0.92, window.__curve || 1.15);
    g.input.test = x; g.step(1 / 60, 1 / 60, false); if (r.state !== 'RIDE') break;
    if (i >= 45 && i % 4 === 0) {
      const p = c.position.clone(), q = c.quaternion.clone(), rp = g.rig.position, th = r.th, asp = c.aspect;
      rd.setPixelRatio(1); rd.setSize(700, 600, false); c.aspect = 700 / 600; c.updateProjectionMatrix();
      c.position.set(rp.x + 0.8, rp.y + 1.3, rp.z + 4.2); c.lookAt(rp.x, rp.y + 0.6, rp.z);   /* (from the beach side, looking back at him on the face) */
      c.layers.enable(1); g.HIDELEGS.value = 0; g.CUT.value = 0; g.WATERY.value = -99; g.ARMCUT.value = 0; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(1); if (o.isMesh && o.material.name === 'hair') o.visible = true; });
      rd.render(g.scene, c); await post(name, k++, rd);
      c.layers.disable(1); g.CUT.value = 0.21; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(0.001); }); c.aspect = asp; c.updateProjectionMatrix(); c.position.copy(p); c.quaternion.copy(q);
    }
  }
  g.input.test = null; return k;
}
