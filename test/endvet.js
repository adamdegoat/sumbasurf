// Wave-ending vet: a barrel-riding test surfer rides each spot's wave out; a camera on the shoulder (down the line, beach
// side, looking back at the curl) films the last 6 s of the ride AND 5 s after it ends, so you see whether the wave
// really closes (lip throwing down the line, whitewater) or just shrinks away. Frames + wave numbers go to :8799.
//   const E = await import('./test/endvet.js'); await E.film('medium')
import { moment } from './shots.js';
const G = () => window.__g;
export async function film(mode = 'medium', seed = 7) {
  const g = G(), name = 'ev_' + (window.__evTag || '') + mode;
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, rd = g.renderer, c = g.camera, ring = [], info = [], pov = []; let after = -1, w0 = r.wave, fix = null;
  for (let i = 0; i < 60 * 70; i++) {
    const w = r.wave || w0, H = w.cond.H, sH = r.s / H, yH = r.y / H;
    if (after < 0) {
      const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
      const steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3)), stall = !r.inBarrel && sH > -0.2;
      g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
    } else { g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; }
    g.step(1 / 60, 1 / 60, false);
    if (after < 0 && r.state !== 'RIDE') { after = 0; fix = {}; }
    if (after >= 0) after++;
    if (i % 6 === 0) {
      const p = c.position.clone(), q = c.quaternion.clone(), asp = c.aspect, H2 = w0.cond.H;
      rd.setPixelRatio(1); rd.setSize(640, 400, false); c.aspect = 1.6; c.updateProjectionMatrix();
      // wide from the beach side on the surfer, frozen where the ride ended (so you watch the wave finish, not the camera move)
      if (after >= 0 && !fix.rp) fix.rp = g.rig.position.clone(); const rp = after >= 0 ? fix.rp : g.rig.position;
      c.position.set(rp.x - 10, 2 + 1.2 * H2, rp.z + 5 * H2 + 14); c.lookAt(rp.x + 6, 0.5 * H2, rp.z - 2);
      c.layers.enable(1); g.HIDELEGS.value = 0; g.CUT.value = 0; g.WATERY.value = -99; g.ARMCUT.value = 0; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(1); });
      if (g.mirror) g.flipProj(c); rd.render(g.scene, c); if (g.mirror) g.flipProj(c);
      ring.push(rd.domElement.toDataURL('image/jpeg', 0.75)); if (ring.length > 60 + 50) ring.shift();
      c.layers.disable(1); g.CUT.value = 0.21; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(0.001); }); c.aspect = asp; c.updateProjectionMatrix(); c.position.copy(p); c.quaternion.copy(q);
      info.push({ t: +(i / 60).toFixed(1), after: after >= 0 ? +(after / 60).toFixed(1) : null, endK: +(w0.endK ?? 1).toFixed(2), fade: +(w0.fade ?? 1).toFixed(2), by: w0.endBy, closing: w0.closing ? +(w0.closeT).toFixed(1) : 0, peel: +(w0.peelRate || 0).toFixed(1), alive: g.waves ? g.waves.includes(w0) : null, st: r.state, foam: +(parseFloat(document.getElementById('foam')?.style.opacity || [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '5')?.style.opacity || 0)).toFixed(2), score: g.rider.ride ? Math.round(g.rider.ride.score || 0) : 0 });
      if (info.length > 110) info.shift();
      rd.setPixelRatio(1); rd.setSize(640, 296, false); const aa = g.armCam; c.aspect = aa.aspect = 640 / 296; c.updateProjectionMatrix(); aa.updateProjectionMatrix();
      rd.autoClear = false; rd.clear(); if (g.mirror) g.flipProj(c); rd.render(g.scene, c); if (g.mirror) g.flipProj(c); aa.position.copy(c.position); aa.quaternion.copy(c.quaternion); rd.clearDepth(); if (g.mirror) g.flipProj(aa); rd.render(g.scene, aa); if (g.mirror) g.flipProj(aa); rd.autoClear = true;
      pov.push(rd.domElement.toDataURL('image/jpeg', 0.75)); if (pov.length > 110) pov.shift(); c.aspect = asp; c.updateProjectionMatrix();
    }
    if (after > 60 * 5) break;
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  await fetch(`http://127.0.0.1:8799/b?shot=${name}`, { method: 'POST', body: JSON.stringify(ring.map((u, k) => [k, u])) });
  await fetch(`http://127.0.0.1:8799/b?shot=${name}_pov`, { method: 'POST', body: JSON.stringify(pov.map((u, k) => [k, u])) });
  await fetch(`http://127.0.0.1:8799/f?shot=${name}_meta&i=0`, { method: 'POST', body: JSON.stringify({ why: r.why, info }) });
  return mode + ': ' + r.why;
}
