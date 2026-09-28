// Pantai Bintang look test: stills and short clips of the night spot at 1920x1080 from free cameras, posted to the
// local receiver (scratchpad bintang/recv.py on :8799, frames land in bintang/<tag>/).
//   const N = await import('./test/night.js?v=' + Date.now()); await N.go(); await N.set4('s3')
const G = () => window.__g;
const W = 1920, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export async function go(mode = 'bintang') { await wait(6000); G().start(mode); await wait(5000); }
export async function run(s) { const g = G(); g.paused = false; await wait(s * 1000); g.paused = true; }
// a still from a free camera (the game paused)
export async function shot(i, pos, look, fov = 55, tag = 'still') {
  const g = G(), r = g.renderer, c = g.camera; g.paused = true; r.setPixelRatio(1); r.setSize(W, H, false);
  c.aspect = W / H; c.fov = fov; c.position.set(...pos); c.lookAt(...look); c.updateProjectionMatrix(); c.updateMatrixWorld();
  r.render(g.scene, c); cv.getContext('2d').drawImage(r.domElement, 0, 0, W, H);
  const b = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));
  await fetch(`http://127.0.0.1:8799/f?shot=${tag}&i=${i}`, { method: 'POST', body: b }); return 'ok';
}
// the wave that has just started breaking in front of the lineup
export async function brk() { for (let k = 0; k < 80; k++) { const w = G().waves.find((w) => w.peelX > 10 && w.peelX < 60 && w.zW < 25); if (w) return w; await run(0.4); } return null; }
export async function set4(tag) {
  const w = await brk(); if (!w) return 'no wave'; const px = w.peelX, z = w.zW;
  await shot(1, [px + 38, 2.2, z + 30], [px - 6, 3.5, z], 55, tag); await shot(2, [px + 22, 4.5, z + 9], [px - 25, 3, z + 1], 60, tag);
  await shot(3, [px + 45, 1.6, z + 55], [px + 75, 9, z - 120], 60, tag); await shot(4, [px - 10, 1.2, z + 14], [px - 40, 3.5, z - 2], 62, tag);
  return [px | 0, z | 0];
}
// a clip: the game stepped at a fixed 30 fps (perfectly smooth) with the camera following the breaking wave
export async function clip(tag, n, cam) {
  const g = G(), w = await brk(); if (!w) return 'no wave'; g.paused = true;
  for (let i = 0; i < n; i++) { g.step(1 / 30, 1 / 30, false); const [pos, look, fov] = cam(w, i / n, i); await shot(i, pos, look, fov, tag); }
  return 'done ' + n;
}
