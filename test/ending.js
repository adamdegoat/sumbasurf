// How a ride ends at each spot: a barrel-riding test surfer rides the wave out; a wide camera from the beach side
// keeps the last few seconds (every 6th step) and uploads them when the ride is over, plus what the wave was doing.
//   const E = await import('./test/ending.js'); await E.film('medium')
import { moment } from './shots.js';
const G = () => window.__g;
export async function film(mode = 'medium', seed = 7, name = null) {
  const g = G(); name = name || 'end_' + mode; window.RANCH_KIND = 'medium';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, rd = g.renderer, c = g.camera, ring = [], info = [];
  for (let i = 0; i < 60 * 60; i++) {
    const w = r.wave, H = w ? w.cond.H : 1, sH = r.s / H, yH = r.y / H;
    // the challenge tool's barrel line: stall into the tube, stay low in it, pump when deep
    const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, (w ? w.cond.speed : 5) / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    const steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3)), stall = !r.inBarrel && sH > -0.2;
    g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
    g.step(1 / 60, 1 / 60, false);
    const done = r.state !== 'RIDE';
    if (i % 6 === 0 || done) {
      const p = c.position.clone(), q = c.quaternion.clone(), rp = g.rig.position, asp = c.aspect;
      rd.setPixelRatio(1); rd.setSize(640, 400, false); c.aspect = 1.6; c.updateProjectionMatrix();
      c.position.set(rp.x - 6, rp.y + 9, rp.z + 30); c.lookAt(rp.x + 4, rp.y + 2, rp.z - 4);
      c.layers.enable(1); g.HIDELEGS.value = 0; g.CUT.value = 0; g.WATERY.value = -99; g.ARMCUT.value = 0; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(1); });
      if (g.mirror) g.flipProj(c); rd.render(g.scene, c); if (g.mirror) g.flipProj(c);
      ring.push(rd.domElement.toDataURL('image/jpeg', 0.8)); if (ring.length > 30) ring.shift();
      c.layers.disable(1); g.CUT.value = 0.21; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(0.001); }); c.aspect = asp; c.updateProjectionMatrix(); c.position.copy(p); c.quaternion.copy(q);
      if (w) { info.push({ t: +(i / 60).toFixed(1), endK: +(w.endK ?? 1).toFixed(2), fade: +(w.fade ?? 1).toFixed(2), by: w.endBy, inBarrel: r.inBarrel ? 1 : 0, sH: +sH.toFixed(2) }); if (info.length > 30) info.shift(); }
    }
    if (done) break;
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  const why = r.why, frames = ring.map((u, k) => [k, u]);
  await fetch(`http://127.0.0.1:8799/b?shot=${name}`, { method: 'POST', body: JSON.stringify(frames) });
  await fetch(`http://127.0.0.1:8799/f?shot=${name}_meta&i=0`, { method: 'POST', body: JSON.stringify({ why, info }) });
  return mode + ': ' + why;
}
