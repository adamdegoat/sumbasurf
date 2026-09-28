// Heat check: how much work each part of a session costs. Wraps the page's animation frames to time the JavaScript in
// them, counts what the renderer draws each frame, and (in the pane on his Mac) the scratchpad samp.sh reads how busy
// the graphics chip is at the same time.
//   const H = await import('./test/heat.js?v=' + Date.now()); H.install(); ...; await H.measure('menu', 8)
const G = () => window.__g;
const S = { busy: 0, frames: 0, calls: 0, tris: 0, renders: 0 };
let on = false;
export function install() {
  if (on) return; on = true;
  const raf0 = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf0((t) => { const a = performance.now(); try { cb(t); } finally { S.busy += performance.now() - a; } });
  const r = G().renderer, render0 = r.render.bind(r);
  r.info.autoReset = false;
  r.render = (scene, cam) => { const c0 = r.info.render.calls, t0 = r.info.render.triangles; render0(scene, cam); S.calls += r.info.render.calls - c0; S.tris += r.info.render.triangles - t0; S.renders++; };
  const count = () => { S.frames++; raf0(count); }; raf0(count);
}
// over `secs` seconds: rAF callbacks a second, drawn frames a second (renders counts both passes), JS ms per callback,
// draw calls and triangles per render pass
export async function measure(tag, secs = 6) {
  const s0 = { ...S }, t0 = performance.now();
  await new Promise((r) => setTimeout(r, secs * 1000));
  const dt = (performance.now() - t0) / 1000, f = S.frames - s0.frames, n = S.renders - s0.renders;
  return { tag, rafPerSec: +(f / dt).toFixed(0), rendersPerSec: +(n / dt).toFixed(0), jsMsPerFrame: +((S.busy - s0.busy) / Math.max(1, f)).toFixed(1),
    callsPerRender: Math.round((S.calls - s0.calls) / Math.max(1, n)), trisPerRender: Math.round((S.tris - s0.tris) / Math.max(1, n)), pr: G().renderer.getPixelRatio() };
}
// a scripted surfer playing live (the game running normally, not stepped): catches waves and carves them
let auto = null;
export async function autopilot(onOff = true) {
  const { brain, carveBrain } = await import('./sim2.js'); const g = G();
  if (!onOff) { auto = null; g.input.test = null; g.input.paddleBtn = false; return 'off'; }
  const br = brain({}), cb = carveBrain({ hi: 0.8, lo: 0.16, gain: 3.4 }); auto = true;
  const step = () => { if (!auto) return; const r = g.rider; if (r) { let o = br(r); if (r.state === 'RIDE' && r.stateT > 1) { o = cb(r); o.pump = r.wave && r.v < r.wave.cond.speed * 0.85; }
    g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; } requestAnimationFrame(step); };
  requestAnimationFrame(step); return 'on';
}
export const state = () => { const r = G().rider; return r ? r.state + (r.inBarrel ? ' barrel' : '') : G().mode; };
