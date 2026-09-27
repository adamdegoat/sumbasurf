// before/after pose sheet: the same moments, the whole body from outside (single pass) and first person
import { moment, outside, inside } from './shots.js';
const G = () => window.__g;
async function one(name, i, pov) {
  const g = G(), r = g.renderer; g.paused = true; r.setPixelRatio(1);
  if (pov) { r.autoClear = false; r.clear(); r.render(g.scene, g.camera); const a = g.armCam; a.position.copy(g.camera.position); a.quaternion.copy(g.camera.quaternion); r.clearDepth(); r.render(g.scene, a); r.autoClear = true; } else r.render(g.scene, g.camera);
  const b = await (await fetch(r.domElement.toDataURL('image/jpeg', 0.9))).blob();
  await fetch(`http://127.0.0.1:8799/f?shot=${name}&i=${i}`, { method: 'POST', body: b });
}
export async function sheet(name) {
  const g = G(); let i = 0; const out = [];
  const full = () => { g.HIDELEGS.value = 0; g.WATERY.value = -99; g.ARMCUT.value = 0; g.surfer.traverse((o) => { if (o.isMesh && o.material.name === 'hair') o.visible = true; }); };
  for (const [what, seed] of [['pop', 7], ['trim', 7], ['carve', 7], ['stall', 7], ['paddle', 7]]) {
    out.push(await moment('medium', what, seed));
    inside(); await one(name, i++, true);
    outside(1, 2.3, 0.6); full(); await one(name, i++);
    const c = g.camera, rp = g.rig.position, th = g.rider.th; c.position.set(rp.x + Math.cos(th) * 2.4 + Math.sin(th) * 0.6, rp.y + 0.9, rp.z + Math.sin(th) * 2.4 - Math.cos(th) * 0.6); c.lookAt(rp.x, rp.y + 0.55, rp.z); full(); await one(name, i++);
    inside();
  }
  return out;
}
