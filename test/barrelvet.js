// In the barrel: (1) what you see (first person, arms on top) a few moments in, and how smoothly the view moves as you
// go in; (2) try a full cutback inside the tube and see what happens.
//   const B = await import('./test/barrelvet.js'); await B.look('medium'); await B.cutback('medium')
import { moment } from './shots.js';
const G = () => window.__g;
const post = async (name, i, rd) => { const b = await (await fetch(rd.domElement.toDataURL('image/jpeg', 0.8))).blob(); await fetch(`http://127.0.0.1:8799/f?shot=${name}&i=${i}`, { method: 'POST', body: b }); };
const draw = (g) => { const rd = g.renderer, c = g.camera, aa = g.armCam; rd.setPixelRatio(1); rd.setSize(844, 390, false);
  c.aspect = aa.aspect = 844 / 390; { const hf = (g.hfov ?? 55) * Math.PI / 180; c.fov = 2 * Math.atan(Math.tan(hf) / Math.min(c.aspect, 2)) * 180 / Math.PI; } c.updateProjectionMatrix();   /* (the lens the game gives a phone held sideways) */ aa.updateProjectionMatrix(); rd.autoClear = false; rd.clear(); if (g.mirror) g.flipProj(c); rd.render(g.scene, c); if (g.mirror) g.flipProj(c);
  aa.position.copy(c.position); aa.quaternion.copy(c.quaternion); rd.clearDepth(); if (g.mirror) g.flipProj(aa); rd.render(g.scene, aa); if (g.mirror) g.flipProj(aa); rd.autoClear = true; };
export async function look(mode = 'medium', seed = 7, tag = '', cut = 0) {
  const g = G(), c = g.camera; const ok = await moment(mode, 'stall', seed); const r = g.rider;
  const log = []; let lq = c.quaternion.clone(), k = 0, inAt = -1;
  for (let i = 0; i < 60 * 8; i++) {
    const w = r.wave, H = w ? w.cond.H : 1, sH = r.s / H, yH = r.y / H;
    const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, (w ? w.cond.speed : 5) / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    const steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3)), stall = !r.inBarrel && sH > -0.2;
    g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
    if (cut && inAt >= 0 && i - inAt > 60) { g.input.test = cut; g.input.stick = null; g.input.paddleBtn = false; }   // (a full cutback, 1 s into the tube)
    g.step(1 / 60, 1 / 60, false); if (r.state !== 'RIDE') break;
    if (inAt < 0 && r.inBarrel) inAt = i;
    log.push({ i, inB: r.inBarrel ? 1 : 0, rot: +(lq.angleTo(c.quaternion) * 57.3 * 60).toFixed(1), fov: +c.fov.toFixed(1) }); lq.copy(c.quaternion);
    if (!cut && inAt >= 0 && (i - inAt) % 30 === 0 && k < 6) { draw(g); await post(`bl_${tag}${mode}`, k++, g.renderer); }
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  await fetch(`http://127.0.0.1:8799/f?shot=bl_${tag}${mode}_meta&i=0`, { method: 'POST', body: JSON.stringify({ ok, inAt, log }) });
  return `${mode}: in barrel at ${inAt}${cut ? `, cutback at ${inAt + 60}, ended at ${log.length ? log[log.length - 1].i : -1}` : ''}, ended ${r.state} ${r.why || ''}`;
}
export async function cutback(mode = 'medium', seed = 7) {
  const g = G(); await moment(mode, 'barrel', seed); const r = g.rider; if (!r.inBarrel) return mode + ': not in barrel';
  let t = 0; const th0 = r.th;
  for (let i = 0; i < 60 * 4; i++) { g.input.test = 1; g.input.stick = null; g.step(1 / 60, 1 / 60, false); t += 1 / 60; if (r.state !== 'RIDE') break; }
  g.input.test = null;
  return `${mode}: turned ${Math.round(Math.abs(r.th - th0) * 57.3)} deg, after ${t.toFixed(1)} s: ${r.state} ${r.why || ''}`;
}
