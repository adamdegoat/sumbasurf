// Film pumping: first person at the phone's shape (size locked, so a viewport change can't reshape frames) and a
// camera beside the surfer. Frames go to the local receiver (:8799).
//   const P = await import('./test/pumpfilm.js'); P.pov('pumpclip')   P.side('pside')
import { moment } from './shots.js';
import { brain } from './sim2.js';
const G = () => window.__g;
const post = async (name, i, rd) => { const b = await (await fetch(rd.domElement.toDataURL('image/jpeg', 0.85))).blob(); await fetch(`http://127.0.0.1:8799/f?shot=${name}&i=${i}`, { method: 'POST', body: b }); };

export async function pov(name, { steps = 330, holdFrom = 90, mode = 'medium', seed = 7 } = {}) {
  const g = G(); await moment(mode, 'trim', seed);
  const fov0 = g.camera.fov, afov = g.armCam.fov, asp = g.camera.aspect, r = g.rider, b = brain({ pumpOn: false }), rd = g.renderer, log = [];
  let lastN = r.pumpN, flash = 0;
  const fix = () => { rd.setPixelRatio(1.5); rd.setSize(844, 390, false); for (const c of [g.camera, g.armCam]) c.aspect = asp; g.camera.fov = fov0; g.armCam.fov = afov; g.camera.updateProjectionMatrix(); g.armCam.updateProjectionMatrix(); };
  for (let i = 0; i < steps; i++) {
    const hold = i >= holdFrom; g.input.test = null; g.input.stick = { x: b(r).steer, y: 0 }; g.input.paddleBtn = hold; g.step(1 / 60, 1 / 60, false);
    if (r.pumpN !== lastN) { flash = 0.3; lastN = r.pumpN; } flash = Math.max(0, flash - 1 / 60);
    if (i % 2 === 0) {
      fix(); rd.autoClear = false; rd.clear(); rd.render(g.scene, g.camera); const a = g.armCam; a.position.copy(g.camera.position); a.quaternion.copy(g.camera.quaternion); rd.clearDepth(); rd.render(g.scene, a); rd.autoClear = true;
      await post(name, i / 2, rd); log.push([Math.round(r.v * 3.6), flash > 0 ? 1 : 0, hold ? 1 : 0, r.state]);
    }
  }
  g.input.paddleBtn = false; g.input.stick = null;
  await fetch('http://127.0.0.1:8799/f?shot=meta&i=0', { method: 'POST', body: JSON.stringify(log) });
  return log.length;
}

// beside the surfer (his front, the wave behind him), every 3rd step through two strokes
export async function side(name, { mode = 'medium', seed = 7 } = {}) {
  const g = G(); await moment(mode, 'trim', seed);
  const r = g.rider, b = brain({ pumpOn: false }), rd = g.renderer, c = g.camera; let k = 0;
  for (let i = 0; i < 100; i++) {
    g.input.test = null; g.input.stick = { x: b(r).steer, y: 0 }; g.input.paddleBtn = i >= 10; g.step(1 / 60, 1 / 60, false);
    if (i >= 10 && i % 3 === 0) {
      const p = c.position.clone(), q = c.quaternion.clone(), rp = g.rig.position, th = r.th;
      rd.setPixelRatio(1); rd.setSize(900, 700, false); const asp = c.aspect; c.aspect = 900 / 700; c.updateProjectionMatrix();
      c.position.set(rp.x + Math.sin(th) * 2.4 + Math.cos(th) * 0.5, rp.y + 0.8, rp.z - Math.cos(th) * 2.4 + Math.sin(th) * 0.5); c.lookAt(rp.x, rp.y + 0.7, rp.z);
      c.layers.enable(1); g.HIDELEGS.value = 0; g.CUT.value = 0; g.WATERY.value = -99; g.ARMCUT.value = 0; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(1); if (o.isMesh && o.material.name === 'hair') o.visible = true; });
      rd.render(g.scene, c); await post(name, k++, rd);
      c.layers.disable(1); g.CUT.value = 0.21; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(0.001); }); c.aspect = asp; c.updateProjectionMatrix(); c.position.copy(p); c.quaternion.copy(q);
    }
  }
  g.input.paddleBtn = false; g.input.stick = null; return k;
}
