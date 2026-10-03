// The bodyboard grip (3 Oct 2026, rebuilt after his catches 'the hands stick through the board' then 'it's floating in mid
// air'): one grip for your own rider (game.js) and for friends (others.js). Built on the board's real shape (board.js
// boardSurface), not guessed angles: the whole palm rests on the deck just back from the nose's corner, and each finger
// curls joint by joint until it meets the board, so the fingers wrap the nose's rounded edge whatever its shape.
import * as THREE from 'three';

export const GRIP = {
  x: 0.13, z: 0.35, palmUp: 0.052,   // the wrist (board metres) and how high it sits over the deck with the palm flat on it
  splay: 0,   roll: 0,                // the hand turned out toward the corner, and rolled so the little finger's edge is lower (rad)
  rest: [0.08, 0.1, 0.08],            // each finger joint's curl before it meets anything (knuckle, middle, tip)
  max: [0.3, 0.35, 0.3],             // (his call 3 Oct 2026: hands simply flat on the board, fingers along the deck to the nose's edge. Wrapped over the nose they overshot the board in your view and read as fists from the side)
  lift: -0.35,                        // how far a finger will straighten back up when the board is in its way (rad)               // how far a joint will curl looking for the board
  pad: 0.002,                          // a hair of air between the finger's skin and the board
  samples: 24,                         // points checked on each finger bone's skin: how close its bone line comes to the board's surface
  tip: 0.022,                          // the fingertip past the last joint
  thumb: [-0.45, -0.25, 0.85],         // the thumb tucked in beside the first finger, over the nose's edge (board frame, x toward the middle)   (his catch 3 Oct 2026: pointing in along the deck it stuck out like an L, 'so weird')
};

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const _a = V(), _b = V(), _d = V(), _p = V(), _q1 = Q(), _q2 = Q(), _q3 = Q(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const _F = V(), _N = V(), _X = V(), _Y = V(), _Z = V();

// where the wrist goes, in board metres (dr: 0 gripping .. 1 dragging in the water beside you to stall)
export function gripTarget(side, dr, surf, out) {
  const o = Math.min(1, dr * 2.5), dn = Math.max(0, (dr - 0.4) / 0.6);
  const deck = surf.deck(side * GRIP.x, GRIP.z + 0.05) ?? 0.04;   // (under the middle of the palm)
  return out.set(side * (GRIP.x + 0.32 * o), deck + GRIP.palmUp + 0.03 * Math.sin(Math.PI * o) - 0.24 * dn, GRIP.z - 0.32 * dr);   // (dragging: out past the rail first, then down, or the hand went through the rail)
}

function setWorldBasis(bone, X, Y, Z, w) {
  _q1.setFromRotationMatrix(_m.makeBasis(X, Y, Z)); bone.parent.getWorldQuaternion(_q2); _q1.premultiply(_q2.invert());
  bone.quaternion.slerp(_q1, w); bone.updateMatrixWorld(true);
}
function aimBone(bone, child, target, w) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _d.subVectors(_b, _a).normalize();
  _q1.setFromUnitVectors(_d, target); _q1.slerp(_q2.identity(), 1 - w);
  bone.getWorldQuaternion(_q2); bone.parent.getWorldQuaternion(_q3);
  bone.quaternion.copy(_q3.invert().multiply(_q1.multiply(_q2))); bone.updateMatrixWorld(true);
}

// per hand, worked out once from the bind pose: each finger's bones, straight, and the axis each curls about (toward the palm)
const rigs = new WeakMap();
function fingers(hd, root) {
  let R = rigs.get(hd); if (R) return R;
  R = { f: [], thumb: null }; let sk = null; root.traverse((o) => { if (!sk && o.isSkinnedMesh && o.skeleton.bones.includes(hd)) sk = o.skeleton; }); if (!sk) return R;
  const sd = hd.name.slice(-2), l = sd === '_l' ? 1 : -1, bw = (b) => sk.boneInverses[sk.bones.indexOf(b)].clone().invert();
  const qOf = (m) => Q().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m)), pOf = (m) => V().setFromMatrixPosition(m);
  // the palm's real facing, from the hand's own shape at bind: across the knuckles (index to little finger) and along the
  // hand, the side the fingers and thumb curl to. (Taken as the hand bone's X before, which is across the knuckles: the
  // hand stood on its edge, fingers bending sideways, 'holding a controller', his catch 3 Oct 2026)
  const P = (nm) => { const b = hd.getObjectByName(nm + sd); return b && sk.bones.indexOf(b) >= 0 ? pOf(bw(b)) : null; };
  const h0 = pOf(bw(hd)), i1 = P('index_01'), p1 = P('pinky_01'), m1 = P('middle_01'), m3 = P('middle_03');
  const fw = m1.clone().sub(h0).normalize(), n = fw.clone().cross(i1.clone().sub(p1)).normalize(); if (m3.clone().sub(m1).dot(n) < 0) n.negate();
  const palm = n, hq = qOf(bw(hd)).invert(); R.fwdL = fw.clone().applyQuaternion(hq); R.palmL = palm.clone().applyQuaternion(hq);
  // a few points on each finger bone's own skin (in the bone's frame), so 'touching the board' means the skin, not the bone
  // line: checked along the bone alone, a finger's thickness still went into the nose's rounded corner
  const skin = new Map(); { const all = new Map(), v = V();
    root.traverse((mesh) => { if (!mesh.isSkinnedMesh || !mesh.skeleton.bones.includes(hd)) return; const K = mesh.skeleton;   // (every mesh on this skeleton: the hands may not be in the first one)
      const P = mesh.geometry.attributes.position, SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < P.count; i++) { let top = -1, tw = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > tw) { tw = w; top = SI.getComponent(i, k); } } if (tw < 0.5) continue;
        const b = K.bones[top]; if (!b || !/^(index|middle|ring|pinky)_0[123]_[lr]$/.test(b.name) || b.name.slice(-2) !== sd) continue;
        v.fromBufferAttribute(P, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(K.boneInverses[top]); (all.get(b) || all.set(b, []).get(b)).push(v.clone()); } });
    for (const [b, pts] of all) { const step = /_03_/.test(b.name) ? 1 : Math.max(1, Math.floor(pts.length / GRIP.samples)); skin.set(b, pts.filter((_, i) => i % step === 0)); } }   // (the fingertips: every point, a sample missed the little finger's tip)
  for (const nm of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
    const chain = [];
    for (let j = 1; j <= 3; j++) {
      const bn = hd.getObjectByName(nm + '_0' + j + sd); if (!bn || sk.bones.indexOf(bn) < 0) break;
      const ch = bn.children.find((c) => c.isBone), W = bw(bn), flat = qOf(bw(bn.parent)).invert().multiply(qOf(W));
      const dir = ch ? pOf(bw(ch)).sub(pOf(W)).normalize() : chain.length ? chain[chain.length - 1].dir : V(0, 1, 0);
      chain.push({ bn, ch, flat, dir, pts: skin.get(bn) || [], ax: V().crossVectors(dir, palm).normalize().applyQuaternion(qOf(W).invert()), a: GRIP.rest[j - 1] });
    }
    if (nm === 'thumb') R.thumb = chain; else R.f.push(chain);
  }
  rigs.set(hd, R); return R;
}

// hd: the hand bone; side: +1 / -1 which rail; w: 0..1 how much; board: the board's mesh; root: the body (for its skeleton);
// surf: boardSurface(board type)
export function gripHand(hd, side, w, board, root, surf) {
  if (w < 0.01) return; board.updateMatrixWorld(); const M = board.matrixWorld; _inv.copy(M).invert();
  // the hand: palm down along the deck toward the corner
  _F.set(side * Math.sin(GRIP.splay), 0, Math.cos(GRIP.splay)).transformDirection(M);
  _N.set(side * Math.sin(GRIP.roll), -Math.cos(GRIP.roll), 0).transformDirection(M);
  const R = fingers(hd, root); if (!R.fwdL) return;
  // turn the hand so its own along-the-hand points along _F and its palm faces _N (down): both frames built the same way
  _N.addScaledVector(_F, -_N.dot(_F)).normalize(); _Z.crossVectors(_F, _N);
  _m.makeBasis(_F, _N, _Z); _q3.setFromRotationMatrix(_m);
  _X.copy(R.fwdL); _Y.copy(R.palmL).addScaledVector(_X, -R.palmL.dot(_X)).normalize(); _a.crossVectors(_X, _Y);
  _m.makeBasis(_X, _Y, _a); _q1.setFromRotationMatrix(_m).invert(); _q3.multiply(_q1);   // (world = target frame x hand frame^-1)
  hd.parent.getWorldQuaternion(_q2); _q3.premultiply(_q2.invert()); hd.quaternion.slerp(_q3, w); hd.updateMatrixWorld(true);
  // a finger point is 'in' when it, or a finger's thickness toward the board from it, is inside the board
  const into = (wp) => { _p.copy(wp).applyMatrix4(_inv); const r = GRIP.pad, c = -Math.sign(_p.x) * r; return surf.inside(_p.x, _p.y, _p.z) || surf.inside(_p.x, _p.y - r, _p.z) || surf.inside(_p.x, _p.y, _p.z - r) || surf.inside(_p.x + c, _p.y, _p.z) || surf.inside(_p.x + c * 0.7, _p.y, _p.z - r * 0.7) || surf.inside(_p.x, _p.y - r * 0.7, _p.z - r * 0.7); };   // (toward the middle too: at the corner the fingers go down the rounded outline's side)
  const end = (J) => { if (J.ch) return J.ch.getWorldPosition(_b); J.bn.getWorldPosition(_b); return _b.add(_d.set(0, 1, 0).transformDirection(J.bn.matrixWorld).multiplyScalar(GRIP.tip)); };
  const set = (J, a) => { J.bn.quaternion.copy(J.flat).multiply(_q1.setFromAxisAngle(J.ax, a)); J.bn.updateMatrixWorld(true); };
  // the hand hardly moves on the board from frame to frame: while it stays put (2 mm) and the fingers have settled, they're
  // just put back where they were found (searching every frame cost ~1.4 ms a frame on a Mac, measured 3 Oct 2026)
  hd.getWorldPosition(_a).applyMatrix4(_inv);
  const still = R.at && R.at.distanceTo(_a) < 0.002 && R.settled; if (!R.at) R.at = V(); R.at.copy(_a);
  let moved = false;
  for (const chain of R.f) {
    if (still) { for (const J of chain) set(J, J.a); if (w < 1) for (const J of chain) { _q2.copy(J.bn.quaternion); J.bn.quaternion.copy(J.flat).slerp(_q2, w); J.bn.updateMatrixWorld(true); } continue; }
    for (let j = 0; j < chain.length; j++) set(chain[j], GRIP.rest[j]);
    for (let j = 0; j < chain.length; j++) {
      const J = chain[j], lo = GRIP.lift, hi = GRIP.max[j];   // (lo: blocked even at rest, a finger lifts a little, as the little finger does over the deck)
      // the rest of the finger, still at rest, must stay out too (checking only this joint's end, the knuckle curled the
      // finger straight down and the next joints went on into the nose)
      const hit = () => { for (let k = j; k < chain.length; k++) { const C = chain[k]; if (C.pts.length) { for (const q of C.pts) if (into(_a.copy(q).applyMatrix4(C.bn.matrixWorld))) return true; } else if (into(end(C))) return true; } return false; };
      // from last frame's angle: back off while it's in the board, else curl on (a little a frame) until it would be
      let a = Math.min(hi, Math.max(lo, J.a ?? GRIP.rest[j])); set(J, a);
      if (hit()) { while (a > lo && hit()) { a = Math.max(lo, a - 0.1); set(J, a); } }
      else { for (let k = 0; k < 4 && a < hi; k++) { const n = Math.min(hi, a + 0.1); set(J, n); if (hit()) { set(J, a); break; } a = n; } }
      if (Math.abs(a - (J.a ?? -9)) > 1e-3) moved = true; J.a = a;
    }
    if (w < 1) for (const J of chain) { _q2.copy(J.bn.quaternion); J.bn.quaternion.copy(J.flat).slerp(_q2, w); J.bn.updateMatrixWorld(true); }
  }
  if (!still) R.settled = !moved;
  // the thumb from straight, laid along the top of the nose pointing in toward the other hand
  if (R.thumb && R.thumb.length === 3) { const [t1, t2, t3] = R.thumb; for (const J of R.thumb) set(J, 0);
    _d.set(side * GRIP.thumb[0], GRIP.thumb[1], GRIP.thumb[2]).normalize().transformDirection(M); const t = _p.copy(_d); aimBone(t1.bn, t2.bn, t, 0.85 * w); aimBone(t2.bn, t3.bn, t, 0.85 * w); }
}
