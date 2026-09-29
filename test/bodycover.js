// How much of your view your own body covers: renders the first-person view twice (with and without your body) at a
// small phone-landscape size and counts the pixels that differ. Used to settle the shoulders showing on the longboard's
// nose (29 Sep 2026). run(styles) rides the longboard at Pantai Kuda, walks to the nose with a given shake / lean, and
// reports the worst and average cover in the middle of the screen (the edges and bottom strip excluded: a hand there is fine)
//   const C = await import('./test/bodycover.js?v=' + Date.now()); C.run()
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
const W = 320, H = 148, FOV = 61.5;   // (a phone on its side: 2.16:1, the game's own lens for it)
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true });
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function shot() {
  const g = G(), r = g.renderer, c = g.camera, a = g.armCam;
  c.aspect = W / H; c.fov = FOV; c.updateProjectionMatrix(); c.updateMatrixWorld();
  a.position.copy(c.position); a.quaternion.copy(c.quaternion); a.aspect = W / H; a.updateProjectionMatrix(); a.updateMatrixWorld();
  r.autoClear = false; r.clear(); r.render(g.scene, c); r.clearDepth(); r.render(g.scene, a); r.autoClear = true;
  cx.drawImage(r.domElement, 0, 0, W, H); return cx.getImageData(0, 0, W, H).data;
}
export function cover() {
  const g = G(); const A = shot(); g.surfer.visible = false; const B = shot(); g.surfer.visible = true; let n = 0, mid = 0;
  for (let i = 0; i < A.length; i += 4) {
    if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) <= 30) continue;
    n++; const px = (i / 4) % W, py = Math.floor(i / 4 / W); if (!(px < W * 0.12 || px > W * 0.88 || py > H * 0.9)) mid++;
  }
  const res = { all: n / (W * H) * 100, mid: mid / (W * H) * 100 };
  if (window.__coverDump && res.mid > window.__coverDump.min && window.__coverDump.n < 8) { const d = window.__coverDump; d.n++; const idx = d.n * 1000 + Math.round((G().rider.nose || 0) * 100) * 10 + Math.min(9, Math.round(res.mid / 3)); const big = document.createElement('canvas'); big.width = W; big.height = H; big.getContext('2d').putImageData(new ImageData(A, W, H), 0, 0); big.toBlob((b) => fetch(`http://127.0.0.1:8799/f?shot=cover&i=${idx}`, { method: 'POST', body: b }), 'image/jpeg', 0.9); }
  return res;
}
export function walk(seed, s) {
  const g = G(); g.paused = true; g.renderer.setPixelRatio(1); g.renderer.setSize(W, H, false);
  g.setMode('easy'); g.useBoard('long'); g.spawnRider(); const rd = g.rider, br = brain({}), cb = carveBrain({ hi: 0.7, lo: 0.25, gain: 3.4 });
  let rs = seed * 9301 + 49297; const rnd = () => ((rs = (rs * 9301 + 49297) % 233280) / 233280); let noise = 0;
  for (let i = 0; i < 60 * 120; i++) { let o = br(rd); if (rd.state === 'RIDE' && rd.stateT > 1) o = cb(rd); g.input.test = o.steer; g.input.paddleBtn = rd.standing ? false : !!o.paddle; g.step(1 / 60, 1 / 60, false); if (rd.state === 'RIDE' && rd.stateT > 2.2) break; if (rd.state === 'WIPE' || rd.state === 'OUT') g.spawnRider(); }
  const res = { frames: 0, worstMid: 0, sumMid: 0, bad: 0, worstAll: 0 };
  for (let k = 0; k < 60 * 7 && rd.state === 'RIDE'; k++) {
    const w = rd.wave, Hh = w.cond.H, err = rd.y / Hh - 0.45 - 0.35 * Math.max(0, rd.s / Hh - 0.6), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(rd.v, 1) + err * 0.9));
    const lim = (rd.nose || 0) > 0.3 ? 0.75 : 1; let st = Math.max(-lim, Math.min(lim, wrapA(Math.asin(sn) - rd.th) * 2.5));
    if ((rd.nose || 0) >= 0.74) st = Math.max(-1, Math.min(1, st * 0.4 - 3.2 * (rd.wob || 0) - 0.5 * (rd.wobV || 0)));
    noise += ((rnd() - 0.5) * 2 * s.shake - noise) * 0.1; st = Math.max(-1, Math.min(1, st + noise + s.lean * Math.sin(k / 60 * s.f * 6.283)));
    const ahead = rd.s / Hh > 0.8; g.input.stick = ahead ? { x: st, y: 1 } : null; g.input.test = ahead ? null : st; g.input.paddleBtn = k < 60 * s.hold;
    g.step(1 / 60, 1 / 60, false);
    if (k % 3 === 0 && (rd.nose || 0) > 0.02) { const c = cover(); res.frames++; res.worstAll = Math.max(res.worstAll, c.all); res.worstMid = Math.max(res.worstMid, c.mid); res.sumMid += c.mid; if (c.mid > 0.5) res.bad++; if (c.mid > 4) (res.log ||= []).push(`t${rd.stateT.toFixed(2)} n${(rd.nose || 0).toFixed(2)} step${rd.stepDir || 0} wob${(rd.wob || 0).toFixed(2)} pk${(rd.pearlK || 0).toFixed(2)} lean${rd.lean.toFixed(2)} cov${c.mid.toFixed(1)}`); }
  }
  g.input.stick = null; g.input.test = null; g.input.paddleBtn = false; res.avgMid = res.sumMid / Math.max(1, res.frames); res.end = rd.state + ' ' + (rd.why || ''); return res;
}
export const STYLES = [{ shake: 0.1, lean: 0, f: 0.5, hold: 3.5 }, { shake: 0.3, lean: 0.25, f: 0.6, hold: 3.8 }, { shake: 0.5, lean: 0.4, f: 1.0, hold: 4 }, { shake: 0.2, lean: 0.5, f: 0.3, hold: 3.2 },
  { shake: 0.4, lean: 0.6, f: 0.8, hold: 4.2 }, { shake: 0.15, lean: 0.3, f: 1.4, hold: 3.6 }];
export function run(styles = STYLES) {
  const out = []; let worst = 0, bad = 0, frames = 0;
  styles.forEach((s, i) => { const o = walk(3 + i, s); worst = Math.max(worst, o.worstMid); bad += o.bad; frames += o.frames; out.push(`${i}: frames ${o.frames} worstMid ${o.worstMid.toFixed(1)}% avg ${o.avgMid.toFixed(2)}% bad ${o.bad} | ${o.end}`); });
  return `WORST ${worst.toFixed(1)}%  bad frames ${bad}/${frames}\n` + out.join('\n');
}
