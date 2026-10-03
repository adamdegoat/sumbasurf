// Free surf heat check (3 Oct 2026, check only): the game's own frame loop runs; a second animation callback queued after
// the game's measures how long the game's frame took on the main thread (from the frame's start to now), plus draw calls,
// triangles and memory growth. Friends are fed in as copies of you, moved sideways, the way the network delivers them.
const G = () => window.__g;
function feed(n, dx = 5) { const g = G(), a = g.freeSnap && g.freeSnap(); if (!a) return; for (let i = 0; i < n; i++) { const b = a.slice(); if (typeof b[1] === 'number') b[1] += dx * (i + 1); g.freePeer('f' + i, b, 'F' + i, performance.now()); } }
export function measure(secs = 6, { friends = 0, every } = {}) {
  return new Promise((res) => {
    const g = G(), R = g.renderer, costs = [], h0 = performance.memory ? performance.memory.usedJSHeapSize : 0, t0 = performance.now(); let calls = 0, tris = 0, n = 0;
    const f = (ts) => {
      const cost = performance.now() - ts; if (n > 3) costs.push(cost); n++;
      calls = Math.max(calls, R.info.render.calls); tris = Math.max(tris, R.info.render.triangles);
      if (friends) feed(friends); if (every) every();
      if (performance.now() - t0 < secs * 1000) requestAnimationFrame(f);
      else { costs.sort((a, b) => a - b); const avg = costs.reduce((a, b) => a + b, 0) / Math.max(1, costs.length);
        res({ frames: costs.length, avgMs: +avg.toFixed(2), p95Ms: +(costs[Math.floor(costs.length * 0.95)] || 0).toFixed(2), maxMs: +(costs[costs.length - 1] || 0).toFixed(2), calls, ktris: Math.round(tris / 1000), heapMBperMin: performance.memory ? +((performance.memory.usedJSHeapSize - h0) / 1e6 / secs * 60).toFixed(1) : null, state: g.strand ? (g.strand.deck ? 'deck' : g.strand.hut ? 'hut' : 'foot') : g.rider ? g.rider.state : '?' }); }
    };
    requestAnimationFrame(f);
  });
}
// friends in view, updated at the network's pace (every 80 ms, as freeroom sends), at these distances ahead of you
export function friendsAhead(ds) {
  const g = G(), V = g.camera.position.constructor, fw = new V(); let last = 0;
  return () => { const now = performance.now(); if (now - last < 80) return; last = now; const a = g.freeSnap(); if (!a) return; g.camera.getWorldDirection(fw); fw.y = 0; fw.normalize();
    ds.forEach((d, i) => { const b = a.slice(); b[1] = g.camera.position.x + fw.x * d + (i % 2 ? 2 : -2); b[3] = g.camera.position.z + fw.z * d; g.freePeer('f' + i, b, 'F' + i, now); }); };
}
// the median of k runs (each secs long) of measure
export async function median(k, secs, opts) { const rs = []; for (let i = 0; i < k; i++) rs.push(await measure(secs, opts)); const md = (key) => { const v = rs.map((r) => r[key]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; }; return { avgMs: md('avgMs'), p95Ms: md('p95Ms'), maxMs: md('maxMs'), heapMBperMin: md('heapMBperMin'), frames: rs.map((r) => r.frames).join('/') }; }
