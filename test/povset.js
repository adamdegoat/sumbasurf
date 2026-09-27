// first-person frames through a ride, at the phone's shape: what the player actually sees of their own arms
import { moment } from './shots.js';
import { carveBrain } from './sim2.js';
const G = () => window.__g;
async function snap(name, i) {
  const g = G(), r = g.renderer; r.setPixelRatio(1.5);
  r.autoClear = false; r.clear(); r.render(g.scene, g.camera); const a = g.armCam; a.position.copy(g.camera.position); a.quaternion.copy(g.camera.quaternion); r.clearDepth(); r.render(g.scene, a); r.autoClear = true;
  const b = await (await fetch(r.domElement.toDataURL('image/jpeg', 0.88))).blob();
  await fetch(`http://127.0.0.1:8799/f?shot=${name}&i=${i}`, { method: 'POST', body: b });
}
export async function ride(name, mode = 'medium', seed = 7, n = 12, gap = 0.6) {
  const g = G(); const m = await moment(mode, 'trim', seed); if (!m.includes(': ok')) return m;
  const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  const br = carveBrain(); let i = 0;
  try {
    for (let k = 0; k < n; k++) {
      for (let f = 0; f < gap * 60; f++) { const r = g.rider; if (r.state !== 'RIDE') break; const o = br(r); g.input.test = o.steer; g.input.paddleBtn = !!o.pump; g.step(1 / 60, 1 / 60, false); }
      if (g.rider.state !== 'RIDE') break;
      await snap(name, i++);
    }
  } finally { Math.random = rnd0; g.input.test = null; g.input.paddleBtn = false; }
  return m + ' frames ' + i;
}
