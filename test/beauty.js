// Beauty stills for posts: step a film take (test/film.js) to the moment you want, then render clean frames (no
// callouts, no HUD) at any size from your own camera, posted to the local receiver (scratchpad bintang/recv.py :8799).
//   const B = await import('./test/beauty.js?v=' + Date.now()); await B.take('noseB', (r) => r.hang10T > 0.8, 400, [{ tag: 'hero', w: 1350, h: 1688, cam }])
import * as THREE from 'three';
let takes = {}; export const use = (film) => { takes = film.takes; };   // (the same film.js module the page loaded, with its takes)
const G = () => window.__g;
const cv = document.createElement('canvas');
export async function still(tag, w, h, pos, look, fov, opts) {
  const g = G(), r = g.renderer, c = new THREE.PerspectiveCamera(fov, w / h, 0.05, 4000);
  if (pos) { c.position.copy(pos); c.lookAt(look); } else { c.position.copy(g.camera.position); c.quaternion.copy(g.camera.quaternion); if (opts && opts.tilt) c.rotateX(opts.tilt); if (opts && opts.turn) c.rotateY(opts.turn); }   // (your own eyes, tipped down / turned a little if asked)
  c.updateMatrixWorld(); r.setPixelRatio(1); r.setSize(w, h, false);
  const hideMe = opts && opts.noSurfer, hidden = []; if (hideMe) g.surfer.traverse((o) => { if (o.isSkinnedMesh && o.visible) { o.visible = false; hidden.push(o); } });   // (a shot with nobody in it: the board and the wave only)
  if (pos) {   // from outside: the surfer drawn whole (as film.js's chase pass does: no first-person cut, head and hair back)
    if (!hideMe) c.layers.enable(1); const hl = g.HIDELEGS.value, wy = g.WATERY.value, ac = g.ARMCUT.value, cut = g.CUT.value; g.HIDELEGS.value = 0; g.WATERY.value = -99; g.ARMCUT.value = 0; g.CUT.value = 0;
    let head = null; const hair = []; g.surfer.traverse((o) => { if (o.isBone && o.name === 'head') head = o; if (o.isMesh && o.material.name === 'hair') { hair.push(o); o.visible = true; } }); const hs = head && head.scale.x; if (head) { head.scale.setScalar(1); head.updateMatrixWorld(true); }
    const mir = g.mirror; if (mir) g.flipProj(c); r.render(g.scene, c); if (mir) g.flipProj(c);
    if (head) { head.scale.setScalar(hs); head.updateMatrixWorld(true); } for (const o of hair) o.visible = false; g.HIDELEGS.value = hl; g.WATERY.value = wy; g.ARMCUT.value = ac; g.CUT.value = cut;
  } else {   // your own eyes: the world, then your arms on top (the game's arm camera)
    const a = g.armCam, mir = g.mirror; r.autoClear = false; r.clear(); if (mir) g.flipProj(c); r.render(g.scene, c); if (mir) g.flipProj(c);
    a.position.copy(c.position); a.quaternion.copy(c.quaternion); a.aspect = w / h; a.fov = fov; a.updateProjectionMatrix(); a.updateMatrixWorld(); r.clearDepth(); if (mir) g.flipProj(a); r.render(g.scene, a); if (mir) g.flipProj(a); r.autoClear = true;
  }
  for (const o of hidden) o.visible = true;
  cv.width = w; cv.height = h; cv.getContext('2d').drawImage(r.domElement, 0, 0, w, h);
  const b = await new Promise((res) => cv.toBlob(res, 'image/png'));
  await fetch(`http://127.0.0.1:8799/f?shot=beauty&i=${tag}`, { method: 'POST', body: b }); return tag;
}
// step take `name` until when(rider, frame) is true (or maxN frames), then run each shot: { tag, w, h, cam(rider, g) -> [pos, look, fov] or null for your own eyes, fov }
export async function take(name, when, maxN, shots) {
  const t = takes[name], g = G(); t.init(); let i = 0;
  for (; i < maxN; i++) { const o = t.frame(i); if (o && Array.isArray(o.chase)) { g.camera.position.copy(o.chase[0]); g.camera.quaternion.copy(o.chase[1]); } if (when(g.rider, i)) break; }
  const out = [];
  for (const s of shots) { const q = s.cam(g.rider, g); out.push(await still(s.tag, s.w, s.h, q && q[0], q && q[1], q ? q[2] : s.fov, s)); }
  return `frame ${i}: ` + out.join(', ');
}
