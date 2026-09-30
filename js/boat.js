// The boat on the free-surf beach (his idea 30 Sep 2026): a wide wooden platform boat anchored in the channel between
// the two peaks, where nothing breaks. Paddle up to its ladder, climb on and walk round the deck to watch your friends
// ride past; room for all 6. Two painted hulls under a teak deck, a thatched shade roof over the front half, rope rails
// round the sides, a swim ladder off the back, a rack of boards, a cooler and a couple of beanbags.
// Built in its own frame: x across (port -, starboard +), z along (bow -, stern +), y up from the waterline.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DECK_Y = 1.05;                  // the deck's top above the waterline
export const DECK = { x0: -2.75, x1: 2.75, z0: -5.6, z1: 5.3 };   // where you can walk on it (inside the rails)
export const LADDER = { x: 0, z: 6.9 };      // just off the back, in the water: where you climb on and drop back in
export const HALF = { x: 3.5, z: 7.2 };
// what you walk round on deck (x0, x1, z0, z1): the shade posts, the board rack, the cooler, the beanbags, the rope coil
export const BLOCKS = [[-3.1, -2.7, -5.5, -5.1], [2.7, 3.1, -5.5, -5.1], [-3.1, -2.7, -0.8, -0.4], [2.7, 3.1, -0.8, -0.4], [2.5, 3.2, 2.2, 4.6], [1.85, 2.75, -4.7, -4.1],
  [-2.2, -1.0, -4.0, -2.8], [0.9, 2.1, -2.8, -1.6], [0.8, 1.6, -5.6, -4.8]];      // its footprint in the water (the hulls and the step): paddlers go round it

const mats = new Map();
const mat = (c, glow) => { const k = c + '/' + (glow || 0); let m = mats.get(k); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, emissive: glow || 0 }); mats.set(k, m); } return m; };
function box(g, w, h, d, c, x, y, z, ry = 0, rx = 0, rz = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; }
function cyl(g, r0, r1, h, c, x, y, z, rx = 0, rz = 0, n = 7) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), mat(c)); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; }
// a rope (or anything thin) from a to b
function line(g, a, b, r, c) {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 5), mat(c));
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m); return m;
}
// a hull: a long box pinched to a raked bow, painted above the waterline, dark antifouling below
function hull(g, x) {
  const geo = new THREE.BoxGeometry(1.3, 1.5, 13, 1, 1, 8), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i), k = Math.max(0, (-z - 3.5) / 3);   // (the front 3 m narrow to a point and lift)
    p.setX(i, p.getX(i) * (1 - 0.85 * k * k)); if (y < 0) p.setY(i, y + 0.6 * k * k); if (z > 6) p.setX(i, p.getX(i) * 0.92); }
  geo.computeVertexNormals();
  const top = new THREE.Mesh(geo, mat(0xe9e4d6)); top.position.set(x, 0.2, -0.3); g.add(top);
  const low = new THREE.Mesh(geo, mat(0x1f4d5c)); low.scale.set(1.02, 0.45, 1.004); low.position.set(x, -0.3, -0.3); g.add(low);   // (a band of teal round the waterline)
  box(g, 1.34, 0.08, 9.5, 0xc0572e, x, 0.62, 0.4);   // (a painted stripe along the top)
}

export function makeBoat() {
  const g = new THREE.Group();
  hull(g, -2.3); hull(g, 2.3);
  // the deck: teak planks along the boat, each a touch different, on beams across the hulls
  for (let i = 0; i < 12; i++) { const x = -2.97 + i * 0.54, c = [0x9a6b43, 0x8d6039, 0xa5744a][i % 3];
    box(g, 0.5, 0.1, 11.4, c, x, DECK_Y - 0.05, -0.15); }
  for (const z of [-5.2, -1.8, 1.6, 4.9]) box(g, 6.4, 0.18, 0.3, 0x5a3d25, 0, DECK_Y - 0.19, z);
  box(g, 6.6, 0.16, 0.16, 0x6e4a2c, 0, DECK_Y + 0.02, -5.9); box(g, 6.6, 0.16, 0.16, 0x6e4a2c, 0, DECK_Y + 0.02, 5.6);   // (edge trims)
  box(g, 0.16, 0.16, 11.6, 0x6e4a2c, -3.25, DECK_Y + 0.02, -0.15); box(g, 0.16, 0.16, 11.6, 0x6e4a2c, 3.25, DECK_Y + 0.02, -0.15);
  // the shade: four bamboo posts and a thatched roof over the front half, a ridge along it
  const bamboo = 0xc9a86a, thatch = 0x8b6b3c;
  for (const [x, z] of [[-2.9, -5.3], [2.9, -5.3], [-2.9, -0.6], [2.9, -0.6]]) cyl(g, 0.07, 0.08, 2.35, bamboo, x, DECK_Y + 1.17, z);
  for (const s of [-1, 1]) { const r = box(g, 3.5, 0.14, 5.6, thatch, s * 1.55, DECK_Y + 2.62, -2.95, 0, 0, -s * 0.28);
    box(g, 3.6, 0.06, 5.7, 0x6f532e, s * 1.55, DECK_Y + 2.53, -2.95, 0, 0, -s * 0.28).material = mat(0x6f532e, 0x3b2b17); }   // (the underside: lit a little by the light off the water, or it drew as a black slab)
  box(g, 0.22, 0.2, 5.8, 0x5c4424, 0, DECK_Y + 3.07, -2.95);
  // rope rails: posts round the sides and the front, open at the back where the ladder is
  const post = 0x6e4a2c, rope = 0xd9c9a3;
  const posts = [[-3.2, 5.2], [-3.2, 2.6], [-3.2, 0], [-3.2, -2.6], [-3.2, -5.8], [0, -5.85], [3.2, -5.8], [3.2, -2.6], [3.2, 0], [3.2, 2.6], [3.2, 5.2]];
  for (const [x, z] of posts) cyl(g, 0.05, 0.05, 0.9, post, x, DECK_Y + 0.45, z);
  for (let i = 0; i < posts.length - 1; i++) for (const h of [0.48, 0.88]) line(g, new THREE.Vector3(posts[i][0], DECK_Y + h, posts[i][1]), new THREE.Vector3(posts[i + 1][0], DECK_Y + h, posts[i + 1][1]), 0.025, rope);
  // the swim step and ladder off the back
  box(g, 2.2, 0.08, 0.7, 0x8d6039, 0, 0.35, 6.05);
  for (const s of [-1, 1]) line(g, new THREE.Vector3(s * 0.35, DECK_Y + 0.7, 5.5), new THREE.Vector3(s * 0.35, -0.6, 6.5), 0.03, 0xb8bcbf);
  for (let k = 0; k < 4; k++) { const t = k / 3, y = DECK_Y - 0.1 - t * 1.45, z = 5.6 + t * 0.85; line(g, new THREE.Vector3(-0.35, y, z), new THREE.Vector3(0.35, y, z), 0.025, 0xb8bcbf); }
  // a board rack on the starboard side (away from the break, so it never stands in the view), three boards in it
  box(g, 0.14, 0.9, 2.2, 0x5a3d25, 2.85, DECK_Y + 0.45, 3.4);
  [[0xf2efe6, 3.8], [0x3f8fb0, 3.4], [0xe0a13a, 3.0]].forEach(([c, z]) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.55, 3, 8), mat(c)); b.scale.set(1, 1, 0.22); b.position.set(2.62, DECK_Y + 1.0, z); b.rotation.set(0, Math.PI / 2, 0.12); g.add(b); });
  // a cooler and two beanbags under the shade, a coil of rope at the bow
  box(g, 0.8, 0.5, 0.5, 0x2f7fa8, 2.3, DECK_Y + 0.25, -4.4); box(g, 0.84, 0.08, 0.54, 0xf2efe6, 2.3, DECK_Y + 0.53, -4.4);
  for (const [x, z, c] of [[-1.6, -3.4, 0xd4643c], [1.5, -2.2, 0x3e7a6a]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 7), mat(c)); b.scale.set(1, 0.55, 1); b.position.set(x, DECK_Y + 0.28, z); g.add(b); }
  cyl(g, 0.38, 0.38, 0.14, rope, 1.2, DECK_Y + 0.07, -5.2, 0, 0, 10);
  // the anchor line off the bow, down into the water
  line(g, new THREE.Vector3(0, DECK_Y + 0.1, -5.9), new THREE.Vector3(0, -3, -11), 0.03, rope);
  // a little flag on a pole at the stern corner
  cyl(g, 0.03, 0.03, 2.6, 0xdedede, 3.1, DECK_Y + 1.3, 5.3);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshLambertMaterial({ color: 0xffc23a, side: THREE.DoubleSide })); flag.position.set(3.1, DECK_Y + 2.35, 4.9); flag.rotation.y = Math.PI / 2; g.add(flag);
  g.userData.flag = flag;
  return merged(g, flag);
}
// (heat check 30 Sep 2026: built as 85 pieces it cost 85 draws a frame whenever it was in view, more than the rest of the
// scene; joined into one mesh per material it's about 12, looking the same. The flag stays apart: it waves)
function merged(g, keep) {
  g.updateMatrixWorld(true); const byMat = new Map();
  for (const o of [...g.children]) { if (o === keep || !o.isMesh) continue;
    const geo = o.geometry.index ? o.geometry.clone() : o.geometry.clone(); geo.applyMatrix4(o.matrix);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    (byMat.get(o.material) || byMat.set(o.material, []).get(o.material)).push(geo); g.remove(o); }
  for (const [m, list] of byMat) { const geo = mergeGeometries(list, false); if (geo) g.add(new THREE.Mesh(geo, m)); }
  return g;
}
