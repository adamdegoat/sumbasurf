// frame cost (3 Oct 2026): game step and both drawing passes (waited to finish), ms a frame, after a second's warm-up
export async function run({ rides = [['short', 'snap'], ['long', 'carve'], ['fish', 'carve']], frames = 600 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = window.__g, res = {};
  for (const rep of [0, 1]) for (const [board, plan] of rides) {
    const nm = 'pf' + Math.random(); FM.addPro(nm, 'medium', 5, frames, board, plan); const t = FM.takes[nm]; t.init(); let step = 0, draw = 0, n = 0; const r = g.rider;
    for (let i = 0; i < frames; i++) { const a = performance.now(); t.frame(i); const b = performance.now(); N.draw(g); g.renderer.getContext().finish(); const c = performance.now(); if (i > 60) { step += b - a; draw += c - b; n++; } if (r.state === 'WIPE' || r.state === 'OUT') break; }
    t.done(); if (rep) res[board] = { stepMs: +(step / n).toFixed(2), drawMs: +(draw / n).toFixed(2), frames: n };
  }
  return res;
}
