// Bodyboard grip check (3 Oct 2026, his catch: 'the hands stick through the board'): every skin vertex of the hands (the
// hand and finger bones, skinned exactly as drawn) is tested against the real board mesh: a ray straight up from it,
// crossing the board an odd number of times, means the point is inside the board. Reports how many are inside and how
// deep (the distance up to the deck), and how high the palm sits over the deck.
import * as THREE from 'three';
const G = () => window.__g;
function boardMeshIn(root) { let best = null; root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox, L = b.max.z - b.min.z; if (L > 0.9 && L < 1.2 && b.max.x - b.min.x > 0.4) best = o; } }); return best; }
export function handPoints(person) {
  const out = { l: [], r: [] }, v = new THREE.Vector3();
  person.updateMatrixWorld(true);
  person.traverse((m) => {
    if (!m.isSkinnedMesh) return;
    const bones = m.skeleton.bones, side = bones.map((b) => { let o = b; while (o) { if (/^hand_[lr]$/.test(o.name)) return o.name.slice(-1); o = o.parent; } return null; });
    const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, n = si.count;
    for (let i = 0; i < n; i++) {
      let s = null, wsum = 0, top = -1, tw = 0; for (let k = 0; k < 4; k++) { const b = si.getComponent(i, k), w = sw.getComponent(i, k); if (side[b]) { wsum += w; s = side[b]; } if (w > tw) { tw = w; top = b; } }
      if (wsum < 0.6) continue;
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); const c = v.clone(); c.bone = bones[top].name; out[s].push(c);
    }
  });
  return out;
}
const rc = new THREE.Raycaster(), UP = new THREE.Vector3(0, 1, 0), DN = new THREE.Vector3(0, -1, 0);
export function measure(person, board, shift) {   // (shift: rig-local metres every point is moved first, e.g. [0,-0.008,-0.008]: how much margin there is)
  board = board || boardMeshIn(G().rig); const mat = board.material, side0 = mat.side; mat.side = THREE.DoubleSide; board.updateMatrixWorld(true);
  const P = handPoints(person), res = {}; if (shift) { const d = new THREE.Vector3(...shift).transformDirection(G().rig.matrixWorld).multiplyScalar(Math.hypot(...shift)); for (const s of ['l', 'r']) for (const p of P[s]) p.add(d); }
  for (const s of ['l', 'r']) {
    let inside = 0, deep = 0, minUp = 9, palm = 0, palmOver = 0, palmGap = 9, tipGap = 9; const n = P[s].length, by = {};
    for (const p of P[s]) {
      rc.set(p, UP); const h = rc.intersectObject(board, false);
      if (h.length % 2 === 1) { inside++; deep = Math.max(deep, h[0].distance); by[p.bone] = Math.max(by[p.bone] || 0, +(h[0].distance * 100).toFixed(1)); }
      rc.set(p, DN); const d = rc.intersectObject(board, false); if (d.length && !(h.length % 2)) minUp = Math.min(minUp, d[0].distance);
      if (p.bone === 'hand_' + s) { palm++; if (d.length && !(h.length % 2)) { palmOver++; palmGap = Math.min(palmGap, d[0].distance); } }
      if (/^(index|middle|ring|pinky)_03/.test(p.bone)) { const q = G().rig.worldToLocal(p.clone()); tipGap = Math.min(tipGap, Math.hypot(Math.max(0, q.z - 0.535), Math.max(0, q.y - 0.045))); }
    }
    res[s] = { pts: n, inside, deepCm: +(deep * 100).toFixed(1), lowestOverDeckCm: minUp < 9 ? +(minUp * 100).toFixed(1) : null, palmOnBoard: palm ? +(palmOver / palm).toFixed(2) : null, palmGapCm: palmGap < 9 ? +(palmGap * 100).toFixed(1) : null, by };   // (palmOnBoard: share of the palm with the board under it; palmGapCm: its lowest point's height over the deck)
  }
  mat.side = side0; return res;
}
export { boardMeshIn };
