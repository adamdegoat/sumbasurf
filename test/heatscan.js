// Heat scan (2 Oct 2026): every mode and situation, run by the game's own frame loop for a few seconds (a bot surfs where
// there are waves), with the per-part timers in an instrumented game.js (globalThis.__PF, __PFN, __GPU). Check only.
//   const H = await import('./test/heatscan.js?v=' + Date.now()); await H.scan(cases)
const G = () => window.__g;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let brainF = null;
async function bot() { if (!brainF) brainF = (await import('./sim2.js')).brain({}); return brainF; }
// friends: copies of you, moved sideways, fed in as if they came over the network
function feedFriends(n, dx = 6) { const g = G(), a = g.freeSnap && g.freeSnap(); if (!a) return; for (let i = 0; i < n; i++) { const b = a.slice(); if (typeof b[1] === 'number') b[1] += dx * (i + 1); g.freePeer('f' + i, b, 'F' + i, performance.now()); } }
export async function measure(label, secs = 5, opts = {}) {
  const g = G(), br = opts.ride ? await bot() : null;
  for (const k in __PF) delete __PF[k]; globalThis.__PFN = 0; __GPU.ms = 0; __GPU.n = 0;
  const h0 = performance.memory ? performance.memory.usedJSHeapSize : 0, t0 = performance.now(); let maxDt = 0, last = t0, frames = 0;
  await new Promise((res) => { const f = () => { const now = performance.now(); maxDt = Math.max(maxDt, now - last); last = now; frames++;
      const r = g.rider; if (br && r) { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }
      if (opts.friends) feedFriends(opts.friends); if (opts.each) opts.each();
      if (now - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  g.input.test = null; g.input.paddleBtn = false;
  const N = Math.max(1, __PFN), out = { frames: N, fps: +(N / secs).toFixed(0), heapMBperMin: performance.memory ? +((performance.memory.usedJSHeapSize - h0) / 1e6 / secs * 60).toFixed(1) : null, gpuMs: __GPU.n ? +(__GPU.ms / __GPU.n).toFixed(2) : null, calls: g.renderer.info.render.calls, state: g.rider ? g.rider.state : g.strand ? 'onFoot' : g.mode };
  const parts = Object.entries(__PF).map(([k, v]) => [k, v / N]).filter(([, v]) => v > 0.03).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of parts) out[k] = +v.toFixed(2);
  return out;
}
// the same, frames driven by hand (the panel hidden pauses the game's own loop): the game step, then the friends / boat /
// Party Point work, then both drawing passes, timing the graphics chip with its own timer
export async function manual(label, frames = 360, opts = {}) {
  const g = G(), br = opts.ride ? await bot() : null, R = g.renderer, gl = R.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), qs = []; let gpu = 0, gn = 0;
  for (const k in __PF) delete __PF[k]; g.paused = true;
  const h0 = performance.memory ? performance.memory.usedJSHeapSize : 0, t0 = performance.now(); let tStep = 0, tDraw = 0;
  for (let i = 0; i < frames; i++) {
    const r = g.rider; if (br && r) { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }
    if (opts.friends) feedFriends(opts.friends); if (opts.each) opts.each(i);
    const a = performance.now(); g.step(1 / 60, 1 / 60, false); globalThis.__extras(1 / 60); const b = performance.now();
    const q = ext && gl.createQuery(); if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    const c = g.camera, A = g.armCam; A.position.copy(c.position); A.quaternion.copy(c.quaternion); A.aspect = c.aspect; A.fov = c.fov + (62 - c.fov) * (r && r.standing ? 1 : 0); A.updateProjectionMatrix();
    R.autoClear = false; R.clear(); R.render(g.scene, c); R.clearDepth(); R.render(g.scene, A); R.autoClear = true;
    if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(q); } tDraw += performance.now() - b; tStep += b - a;
    for (let j = qs.length - 1; j >= 0; j--) if (gl.getQueryParameter(qs[j], gl.QUERY_RESULT_AVAILABLE)) { gpu += gl.getQueryParameter(qs[j], gl.QUERY_RESULT) / 1e6; gn++; gl.deleteQuery(qs[j]); qs.splice(j, 1); }
    if (i % 30 === 0) await sleep(0);
  }
  await sleep(100); for (const q of qs) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { gpu += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gn++; } gl.deleteQuery(q); }
  g.input.test = null; g.input.paddleBtn = false; g.paused = false;
  const out = { logicMs: +(tStep / frames).toFixed(2), drawCpuMs: +(tDraw / frames).toFixed(2), gpuMs: gn ? +(gpu / gn).toFixed(2) : null, calls: R.info.render.calls, ktris: Math.round(R.info.render.triangles / 1000),
    allocMBperMin: performance.memory ? +((performance.memory.usedJSHeapSize - h0) / 1e6 / (frames / 60) * 60).toFixed(0) : null, state: g.rider ? g.rider.state : g.strand ? 'onFoot' : g.mode };
  const parts = Object.entries(__PF).map(([k, v]) => [k, v / frames]).filter(([, v]) => v > 0.04).sort((x, y) => y[1] - x[1]);
  for (const [k, v] of parts) out['  ' + k] = +v.toFixed(2);
  return out;
}
