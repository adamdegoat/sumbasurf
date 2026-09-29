// The surf spots (four lefts and two rights). Each one is the same coast builder with its own look (see coast() in wave.js), plus a few
// landmarks of its own. Distances are in the coast's own frame: the beach is ~185-225 m in from the break, and the
// whole coast is pushed back by dz (a longer run to the sand makes a longer ride).
import * as THREE from 'three';
import { coast, landMaterial, ENV } from './wave.js?v=184';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPOTS = {
  // beginners: a wide white-sand bay, low green points, calm turquoise over a pale reef, a village of beach huts
  easy: { name: 'Pantai Kuda', dz: 110, xEnd: 200, reefTint: [1.34, 1.3, 1.16], reefK: 0.56, look: { beachW: 48, beachRise: 2.7, stackRock: [0.42, 0.39, 0.34], sandWet: [0.62, 0.6, 0.52], sandDry: [0.33, 0.33, 0.3], land: [0.16, 0.27, 0.12], palms: 1, cliffH: 0.12, cliffGreen: 1, temple: false, mountain: [0.3, 0.38, 0.32], mountainScale: 0.55, jungle: 0.8 } },
  // the classic: limestone cliffs, the temple on the edge, golden sand (the original coast)
  medium: { name: 'Tanjung Uma', dz: 60, xEnd: 200, reefTint: [1, 1, 1], look: { rock: [0.7, 0.6, 0.46], arch: true, land: [0.46, 0.37, 0.19], plat: [0.44, 0.36, 0.19], cliffGreen: 0.35, palms: 0.5, mountain: [0.42, 0.4, 0.36] } },   // (weathered honey limestone: the pale cream read as foam from the villa; the land behind dry and golden, Sumba's dry-season savanna)
  // advanced: a black volcanic slab, basalt cliffs, black sand, a lighthouse on the point
  hard: { name: 'Batu Hitam', dz: 110, xEnd: 290, reefTint: [0.55, 0.62, 0.6], look: { sandWet: [0.1, 0.1, 0.11], sandDry: [0.1, 0.1, 0.1], land: [0.08, 0.12, 0.07], plat: [0.07, 0.11, 0.06], palms: 0.2, cliffH: 1.25, rock: [0.15, 0.15, 0.16], columns: true, cliffGreen: 0.15, temple: false, mountain: [0.18, 0.2, 0.22], mountainScale: 0.01, jungle: 0.7 } },   // (basalt in columns; its own volcano behind instead of the usual far mountain: see hitamNature)
  // the rights (mirror: the whole place is drawn the other way round, so the wave peels to your right). Watu Kanan:
  // red sandstone bluffs, golden sand, a green valley behind; a temple on the headland
  kanan: { name: 'Watu Kanan', mirror: true, dz: 80, xEnd: 220, reefTint: [1.05, 1.1, 1.0], look: { sandWet: [0.5, 0.4, 0.28], sandDry: [0.42, 0.33, 0.22], land: [0.11, 0.3, 0.1], plat: [0.11, 0.26, 0.09], palms: 0.9, cliffH: 0.75, rock: [0.64, 0.36, 0.24], sandstone: true, cliffGreen: 1.2, temple: true, mountain: [0.24, 0.32, 0.26], mountainScale: 0.8, jungle: 1.1 } },
  // Karang Hiu: a shallow coral shelf off a low grey reef-rock shore, bright white sand, windswept palms
  hiu: { name: 'Karang Hiu', mirror: true, dz: 100, xEnd: 280, reefTint: [1.15, 1.3, 1.25], reefK: 0.45, look: { sandWet: [0.64, 0.62, 0.55], sandDry: [0.4, 0.39, 0.35], land: [0.14, 0.24, 0.12], palms: 0.7, windy: true, cliffH: 0.45, rock: [0.5, 0.5, 0.47], karst: true, cliffGreen: 0.6, temple: false, mountain: [0.28, 0.33, 0.33], mountainScale: 0.7, jungle: 0.6 } },
  // Pantai Bintang (intermediate, breaks left): the night spot. Always night: a dark coast of palms and low cliffs under the
  // moon and the Milky Way, lamp boats out at sea, a fire on the beach, and plankton that glows wherever the water breaks
  bintang: { name: 'Pantai Bintang', dz: 160, xEnd: 320, reefTint: [0.45, 0.55, 0.7], reefK: 0.001, look: { sandWet: [0.34, 0.35, 0.37], sandDry: [0.5, 0.49, 0.46], land: [0.07, 0.13, 0.09], palms: 1, cliffH: 0.02, rock: [0.32, 0.32, 0.35], cliffGreen: 0.9, temple: false, stacks: false, boat: false, mountain: [0.1, 0.13, 0.18], mountainScale: 0.8, jungle: 1 } },   // (no cliffs and none of the usual offshore stacks: a low palm beach, and its own rock arch out to sea)
  // experts: a giant outer reef far off a towering coast, sea stacks, a storm
  extreme: { name: 'Gunung Laut', dz: 230, xEnd: 430, reefTint: [0.6, 0.65, 0.65], look: { stacks: false, boat: false,  sandWet: [0.18, 0.17, 0.16], sandDry: [0.12, 0.12, 0.11], land: [0.09, 0.14, 0.08], palms: 0.1, cliffH: 2.6, rock: [0.36, 0.35, 0.33], cliffGreen: 0.7, temple: false, mountain: [0.2, 0.23, 0.24], mountainScale: 1.6, jungle: 0.6 } },
};

const built = {};
// a newer landmark: built, and joined into one piece, apart from the rest with a private dice (the shared one also
// decides the sets, and three.js draws on it for every new object: a new landmark mustn't change which waves come)
function ownDice(g, build, seed = 7) {
  const shared = Math.random; let x = seed;
  Math.random = () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
  try { const h = new THREE.Group(); build(h); mergeProps(h); for (const m of [...h.children]) g.add(m); if (h.userData.floaters) (g.userData.floaters ||= []).push(...h.userData.floaters); }
  finally { Math.random = shared; }
}
// build a spot the first time you go there (the others stay unbuilt until you visit them)
export function spotGroup(scene, key) {
  if (built[key]) return built[key];
  const S = SPOTS[key], g = coast(scene, Object.assign({ dz: S.dz }, S.look));
  if (key === 'easy') coralBay(g);
  if (key === 'medium') villaFar(g);
  if (key === 'kanan') redHead(g);
  if (key === 'hard') lighthouseHead(g);
  if (key === 'hiu') palmPoint(g);
  if (key === 'bintang') ownDice(g, nightLights, 11);
  if (key === 'easy') ownDice(g, horseHead);
  if (key === 'easy') ownDice(g, kudaNature, 29);
  if (key === 'medium') { jungleLook(g, 2, [0.17, 0.2, 0.09]); ownDice(g, umaNature, 31); }
  if (key === 'hard') { jungleLook(g, 3, [0.07, 0.11, 0.06]); ownDice(g, hitamNature, 37); }
  if (key === 'kanan') { jungleLook(g, 5, [0.08, 0.25, 0.07]); ownDice(g, (h) => kananNature(h, g.userData.cliff), 41); }
  if (key === 'hiu') ownDice(g, (h) => hiuNature(h, g.userData.cliff), 43);
  if (key === 'extreme') ownDice(g, seaMountain);
  waterProps(g, key);
  if (key === 'hard') blackRock(g);
  if (key === 'extreme') theMountain(g);
  mergeProps(g);
  return (built[key] = g);
}
export const builtSpots = () => Object.values(built);

// a spot's small landmarks (huts, posts, canoes, the lighthouse...) are many little meshes: join them into one so a
// phone draws them in a single call instead of dozens
function mergeProps(g) {
  const parts = g.children.filter((m) => m.isMesh && !m.isInstancedMesh && m.userData.prop);
  if (parts.length < 2) return;
  const geos = parts.map((m) => { m.updateMatrix(); const q = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); return q; });
  const merged = mergeGeometries(geos); if (!merged) return;
  for (const m of parts) { g.remove(m); m.geometry.dispose(); }
  g.add(new THREE.Mesh(merged, landMaterial()));
}

// vertex-coloured helpers on the shared land material
const tint = (geo, rgb, jit = 0.08) => { const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 1 + (Math.random() - 0.5) * jit; c[i * 3] = rgb[0] * k; c[i * 3 + 1] = rgb[1] * k; c[i * 3 + 2] = rgb[2] * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
const put = (g, geo, rgb, x, y, z, jit) => { const m = new THREE.Mesh(tint(geo, rgb, jit), landMaterial()); m.position.set(x, y, z); m.userData.prop = true; g.add(m); return m; };

function coralBay(g) {
  // the bay's two arms: low green headlands running out into the sea either side, sandy at the foot, palms on top
  const head = (x, z, rx, rz, h) => {
    const geo = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), pp = geo.attributes.position, c = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const X = pp.getX(i), Y = pp.getY(i), Z = pp.getZ(i), n = 1 + 0.12 * Math.sin(X * 7 + Z * 5) + 0.06 * Math.sin(X * 19 - Z * 13);
      pp.setXYZ(i, X * rx * n, Math.pow(Y, 0.8) * h * n, Z * rz * n);
      const k = 0.9 + Math.random() * 0.2, sandy = Y < 0.08 ? 1 : 0, rocky = Y < 0.25 && !sandy ? 1 : 0;
      const col = sandy ? [0.8, 0.76, 0.64] : rocky ? [0.42, 0.4, 0.34] : [0.14, 0.26, 0.11];
      c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, landMaterial()); m.position.set(x, -1, z); m.userData.prop = true; g.add(m);
  };
  head(-420, 120, 150, 110, 38); head(-560, 40, 120, 90, 55); head(560, 140, 160, 120, 32); head(700, 60, 130, 90, 46);

  // beach huts on short stilts under the palms: timber boxes with steep grass-thatch roofs
  const WOOD = [0.45, 0.33, 0.22], THATCH = [0.55, 0.45, 0.28];
  for (let i = 0; i < 9; i++) {
    const x = 10 + i * 17 + (Math.random() - 0.5) * 6, z = 224 + Math.random() * 5, s = 0.9 + Math.random() * 0.3;
    for (const dx of [-1.6, 1.6]) for (const dzz of [-1.4, 1.4]) put(g, new THREE.BoxGeometry(0.25, 1.4, 0.25), WOOD, x + dx * s, 2.5, z + dzz * s);
    put(g, new THREE.BoxGeometry(4 * s, 2.4 * s, 3.4 * s), WOOD, x, 3.2 + 1.2 * s, z, 0.12);
    const roof = new THREE.ConeGeometry(3.6 * s, 2.6 * s, 4); roof.rotateY(Math.PI / 4); put(g, roof, THATCH, x, 3.2 + 2.4 * s + 1.3 * s, z, 0.15);
  }
  // a timber jetty out over the shallows at the far end of the bay
  const jx = -40;
  put(g, new THREE.BoxGeometry(2.6, 0.3, 46), [0.5, 0.39, 0.27], jx, 1.6, 180, 0.1);
  for (let z = 160; z <= 202; z += 6) for (const dx of [-1.1, 1.1]) put(g, new THREE.CylinderGeometry(0.14, 0.14, 3.4, 5), [0.33, 0.25, 0.18], jx + dx, 0, z);
  // two outrigger canoes pulled up on the sand
  for (const [x, z, a] of [[60, 214, 0.2], [95, 216, -0.15]]) {
    const hull = put(g, new THREE.CylinderGeometry(0.35, 0.22, 6, 7), [0.9, 0.88, 0.82], x, 2.1, z); hull.rotation.set(0, a, Math.PI / 2); hull.scale.set(1, 1, 0.7);
    const fl = put(g, new THREE.CylinderGeometry(0.08, 0.08, 5, 5), [0.3, 0.24, 0.18], x - Math.sin(a) * 2, 1.95, z + Math.cos(a) * 2); fl.rotation.set(0, a, Math.PI / 2);
  }
}

// Tanjung Uma: your villa out on the rocky point at the end of the reef, seen from the water: the limestone finger, the
// house under its tall Sumba thatch tower, and the banyan beside it. A light stand-in for the real villa (the same place
// and shape, a fraction of the detail) shown while you surf; in the villa itself the real one is drawn instead
function villaFar(g) {
  const OX = 88, OZ = 31, Y = 26, tipZ = 37, EDGE = 0.8;   // (the villa's own numbers: see villa.js)
  const cliffTop = (xl) => { const x = OX - xl; return (58 + 12 * Math.sin(x * 0.021) + 6 * Math.sin(x * 0.067 + 1.3)) * Math.min(1, Math.max(0, (-x - 70) / 35)); };
  const cx = (z) => { const k = Math.min(1, Math.max(0, (z - 70) / 150)); return -93 + 4 * Math.sin((z - 37) * 0.03) - 60 * k * k * (3 - 2 * k); };
  const hw = (z) => 13.6 + 11 * Math.min(1, Math.max(0, (z - 60) / 120));
  const top = (x, z) => { const k = Math.min(1, Math.max(0, (z - 55) / 120)), s = k * k * (3 - 2 * k); return (Y - 0.25) * (1 - s) + Math.max(3, cliffTop(x) + 1) * s; };
  const noiseW = (z, a) => { const nk = z < 58 ? 0.3 : 1; return 1 + nk * (0.14 * Math.sin(z * 0.09 + 2) + 0.08 * Math.sin(z * 0.23 + 1) + 0.05 * Math.sin(z * 0.71) + 0.07 * Math.sin(a * 5) + 0.04 * Math.sin(a * 13)); };
  const geos = [];
  const add = (geo, rgb, x, y, z, jit = 0.1) => { if (!geo.attributes.color) tint(geo, rgb, jit); if (geo.attributes.uv) geo.deleteAttribute('uv'); geo.translate(x, y, z); geos.push(geo.index ? geo.toNonIndexed() : geo); return geo; };
  // the top of the point: grass and scrub, tucked in behind the cliff wall past its edge
  { const geo = new THREE.PlaneGeometry(130, 200, 44, 64); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) - 115, z = p.getZ(i) + 105, a = Math.atan2(z - tipZ, x - cx(z)), w = hw(z) * noiseW(z, a);
      const d = Math.hypot(Math.abs(x - cx(z)) / w, Math.max(0, tipZ - z) / w), t = top(x, z); let X = x, Z = z, y = t;
      if (d > EDGE) { const kk = (EDGE - 0.04) / d, oz = z < tipZ ? tipZ : z; X = cx(z) + (x - cx(z)) * kk; Z = oz + (z - oz) * kk; y = t - 12; }
      p.setXYZ(i, X, y, Z); const col = d < 0.7 ? [0.16, 0.27, 0.11] : [0.36, 0.34, 0.24], k = 0.9 + Math.random() * 0.2; c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals(); add(geo, null, 0, 0, 0); }
  // the cliff all round it: honey limestone in ledges, darker and wet at the waterline
  { const edgeAt = (z, side) => { let x = cx(z) + side * EDGE * hw(z); for (let it = 0; it < 2; it++) { const a = Math.atan2(z - tipZ, x - cx(z)); x = cx(z) + side * EDGE * hw(z) * noiseW(z, a); } return x; };
    const pts = []; for (let z = 200; z > tipZ; z -= 3) pts.push([edgeAt(z, 1), z]);
    for (let k = 0; k <= 14; k++) { const th = -k / 14 * Math.PI, r = EDGE * hw(tipZ) * noiseW(tipZ - 1, th); pts.push([cx(tipZ) + Math.cos(th) * r, tipZ + Math.sin(th) * r]); }
    for (let z = tipZ + 3; z <= 200; z += 3) pts.push([edgeAt(z, -1), z]);
    const R = 7, n = pts.length, pos = new Float32Array(n * (R + 1) * 3), col = new Float32Array(n * (R + 1) * 3), idx = [];
    for (let i = 0; i < n; i++) { const [x, z] = pts[i], [xa, za] = pts[Math.max(0, i - 1)], [xb, zb] = pts[Math.min(n - 1, i + 1)];
      let nx = -(zb - za), nz = xb - xa; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl; const t = top(x, z);
      for (let j = 0; j <= R; j++) { const v = j / R, y = (t - 0.05) * (1 - v) - 2.5 * v, o = j === 0 ? 0 : 0.95 + 0.55 * Math.sin(y * 0.85 + i * 0.15) + 4 * Math.pow(v, 2.4);
        const q = (i * (R + 1) + j) * 3; pos[q] = x + nx * o; pos[q + 1] = y; pos[q + 2] = z + nz * o;
        const band = 0.75 + 0.25 * Math.sin(y * 1.9 + i * 0.1), wet = y < 1.2 ? 0.5 : 1, cc = v > 0.9 ? [0.4, 0.37, 0.32] : [0.58, 0.51, 0.4];
        for (let e = 0; e < 3; e++) col[q + e] = cc[e] * band * wet * (0.9 + Math.random() * 0.2); } }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < R; j++) { const a0 = i * (R + 1) + j, b0 = a0 + R + 1; idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1); }
    const wall = new THREE.BufferGeometry(); wall.setAttribute('position', new THREE.BufferAttribute(pos, 3)); wall.setAttribute('color', new THREE.BufferAttribute(col, 3)); wall.setIndex(idx);
    const flat = wall.toNonIndexed(); flat.computeVertexNormals(); geos.push(flat); }
  // the house: timber walls with a band of glass, the wraparound balcony, and the thatch tower roof with its tall peak
  add(new THREE.BoxGeometry(17.4, 0.35, 17.4), [0.34, 0.19, 0.09], -91.3, Y - 0.17, 35.3);
  add(new THREE.BoxGeometry(14, 3.2, 14), [0.58, 0.35, 0.19], -93, Y + 1.6, 37);
  add(new THREE.BoxGeometry(14.1, 1.5, 14.1), [0.1, 0.13, 0.15], -93, Y + 1.75, 37, 0.02);
  const E = 8.4, RR = 3.3, yE = Y + 2.75, yR = Y + 4.75, yP = Y + 11.5, THATCH = [0.6, 0.48, 0.3];
  const hip = (prof, y0, y1, seg) => { const geo = new THREE.CylinderGeometry(1, 1, 1, 4, seg, false); geo.rotateY(Math.PI / 4); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) + 0.5, k = prof(t) * Math.SQRT2; p.setXYZ(i, p.getX(i) * k, y0 + (y1 - y0) * t, p.getZ(i) * k); }
    geo.computeVertexNormals(); return add(geo, THATCH, -93, 0, 37, 0.12); };
  hip((t) => E + (RR - E) * t, yE, yR, 2); hip((t) => 0.28 + (RR - 0.28) * Math.pow(1 - t, 1.7), yR - 0.05, yP, 6);
  // the banyan: a thick trunk and a wide dark canopy standing over the roof
  add(new THREE.CylinderGeometry(1.0, 1.7, 12, 8), [0.33, 0.27, 0.2], -83.5, Y + 6, 48.5, 0.2);   // (a banyan's trunk is a thick knot of roots)
  for (let k = 0; k < 13; k++) { const an = k * 2.4, r = k === 0 ? 0 : 3 + (k % 4) * 1.4, sz = 3.4 - (k % 3) * 0.4;   // a wide, low, heavy dome of leaves
    add(new THREE.IcosahedronGeometry(sz, 1).scale(1, 0.7, 1), [0.12 + (k % 3) * 0.02, 0.28 + (k % 2) * 0.03, 0.1], -83.5 + Math.cos(an) * r, Y + 12.2 + (k % 2) * 1.2 - r * 0.12, 48.5 + Math.sin(an) * r, 0.3); }
  // into the coast's frame: the villa is drawn mirrored (its sea sides face back up the reef), so flip it and turn
  // every triangle back the right way round (one mesh, the same land material as the rest of the coast)
  const merged = mergeGeometries(geos); if (!merged) return;
  merged.applyMatrix4(new THREE.Matrix4().makeTranslation(OX, 0, OZ).multiply(new THREE.Matrix4().makeScale(-1, 1, 1)));
  for (const k of ['position', 'normal', 'color']) { const a = merged.attributes[k].array; for (let i = 0; i < a.length; i += 9) for (let e = 0; e < 3; e++) { const t = a[i + 3 + e]; a[i + 3 + e] = a[i + 6 + e]; a[i + 6 + e] = t; } }
  const m = new THREE.Mesh(merged, landMaterial()); g.add(m); g.userData.farVilla = m;
}

// a headland running out from the shore at the end of the reef, down the line where you look while you ride: a long
// finger of rock with sheer layered sides and a flat green top. o: x (its spine), tipZ/baseZ (sea end, shore end), w
// (half-width at the shore), h0/h1 (height at the tip / at the shore), rock, grass
function headland(g, o) {
  const U = 64, V = 22;
  const W = (u) => o.w * (0.3 + 0.7 * Math.sqrt(Math.min(1, u / 0.25))) * (1 + 0.12 * Math.sin(u * 17 + 1) + 0.07 * Math.sin(u * 41));   // a rounded nose, the sides wandering in and out
  const H = (u) => (o.h0 + (o.h1 - o.h0) * Math.min(1, u * 1.6)) * (0.55 + 0.45 * Math.sqrt(Math.min(1, u / 0.12))) + 3.5 * Math.sin(u * 11 + 2) + 1.6 * Math.sin(u * 29);   // a ragged skyline, lower at the sea end
  const pos = [], col = [], idx = [];
  // each slice across the headland, from the sea end in: the waterline, up the left cliff in ledges, across the top,
  // down the right. The walls step in and out (strata), cut by gullies, and lean back a little toward the top
  for (let i = 0; i <= U; i++) { const u = i / U, z = o.tipZ + (o.baseZ - o.tipZ) * u, w = W(u), h = H(u);
    for (let j = 0; j <= V; j++) { const v = j / V, side = v < 0.3 ? -1 : v > 0.7 ? 1 : 0; let x, y;
      if (side) { const t = side < 0 ? v / 0.3 : (1 - v) / 0.3; y = -2 + (h + 2) * t;
        const ledge = 1.6 * Math.sin(y * 0.75 + u * 3) + 0.9 * Math.sin(y * 1.9 - u * 7) + 1.4 * Math.max(0, Math.sin(z * 0.23 + y * 0.05));   // strata and gullies
        x = side * (w * (1.25 - 0.25 * t) + ledge + 5 * Math.pow(1 - t, 3) * Math.min(1, u / 0.12)); }                                // (and a rubble apron at the foot, tucked in at the nose)
      else { const t = (v - 0.3) / 0.4; x = -w + 2 * w * t; y = h + 1.2 * Math.sin(x * 0.25 + z * 0.1) - 2.5 * Math.pow(Math.abs(t - 0.5) * 2, 3); }
      const k = 0.88 + Math.random() * 0.24;
      let c;
      if (side) { const band = 0.72 + 0.28 * Math.sin(y * 1.3 + Math.sin(z * 0.07) * 2.5), wet = y < 1.2 ? 0.5 : 1, scrub = y > h - 3 && Math.random() < 0.45;
        c = scrub ? [0.16 * k, 0.26 * k, 0.1 * k] : o.rock.map((q) => q * band * wet * k); }
      else { const bare = Math.random() < 0.18; c = (bare ? o.rock.map((q) => q * 0.85) : o.grass).map((q) => q * k); }
      pos.push(o.x + x, y, z); col.push(c[0], c[1], c[2]); } }
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) { const a0 = i * (V + 1) + j, b0 = a0 + V + 1; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
  // the sea end: the rounded nose closed with rock
  const c0 = pos.length / 3; pos.push(o.x, H(0) * 0.25, o.tipZ - 3); col.push(o.rock[0] * 0.75, o.rock[1] * 0.75, o.rock[2] * 0.75);
  for (let j = 0; j < V; j++) idx.push(c0, j + 1, j, c0, j, j + 1);   // (both faces: seen from either side it's solid rock, never a see-through gap)
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  const flat = geo.toNonIndexed(); flat.computeVertexNormals();   // (faceted, like broken rock)
  const m = new THREE.Mesh(flat, landMaterial()); m.userData.prop = true; g.add(m);
  // fallen blocks along its foot, and bushes along the top
  for (let k = 0; k < 26; k++) { const u = Math.random() * 0.9, side = Math.random() < 0.5 ? -1 : 1, r = 1.5 + Math.random() * 3.5, z = o.tipZ + (o.baseZ - o.tipZ) * u;
    put(g, new THREE.DodecahedronGeometry(r, 0), o.rock.map((q) => q * 0.7), o.x + side * (W(u) * 1.25 + 4 + Math.random() * 5), r * 0.25 - 0.5, z, 0.25); }
  for (let k = 0; k < 30; k++) { const u = 0.05 + Math.random() * 0.9, t = Math.random() * 2 - 1, r = 1.8 + Math.random() * 2.2, z = o.tipZ + (o.baseZ - o.tipZ) * u;
    put(g, new THREE.IcosahedronGeometry(r, 0).scale(1.3, 0.7, 1), [0.13, 0.25, 0.09], o.x + t * W(u) * 0.95, H(u) + r * 0.3, z, 0.3); }
  return (u) => ({ y: H(u), z: o.tipZ + (o.baseZ - o.tipZ) * u });
}
// a Balinese temple: a stepped stone terrace, a split gate (candi bentar) in front, and a tall meru tower of stacked
// black thatch roofs, the one shape you can pick out from far out at sea
function temple(g, x, y, z, tiers = 7) {
  const stone = [0.5, 0.44, 0.38], thatch = [0.11, 0.09, 0.08];
  put(g, new THREE.BoxGeometry(14, 1.6, 14), stone, x, y + 0.8, z, 0.1); put(g, new THREE.BoxGeometry(9, 1.4, 9), stone, x, y + 2.3, z, 0.1);
  put(g, new THREE.BoxGeometry(3.6, 3.4, 3.6), stone, x, y + 4.7, z, 0.1);
  for (let k = 0; k < tiers; k++) { const rr = 5.2 - k * (3.6 / tiers), roof = new THREE.ConeGeometry(rr, 1.3, 4); roof.rotateY(Math.PI / 4); put(g, roof, thatch, x, y + 7 + k * 1.45, z, 0.1);
    put(g, new THREE.BoxGeometry(1.2, 0.3, 1.2), [0.3, 0.24, 0.18], x, y + 7.8 + k * 1.45, z, 0.1); }
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) put(g, new THREE.BoxGeometry(2.8 - k * 0.5, 1.9, 2.8 - k * 0.5), stone, x + s * 2.6, y + 0.95 + k * 1.9, z - 11, 0.1);
}
// Watu Kanan: a red sandstone headland at the end of the reef with a temple on its tip, lit by the late sun
function redHead(g) {
  const at = headland(g, { x: 300, tipZ: 100, baseZ: 250, w: 28, h0: 26, h1: 44, rock: [0.6, 0.25, 0.14], grass: [0.16, 0.27, 0.1] });
  const t = at(0.2); temple(g, 300, t.y - 0.5, t.z);
}

// Batu Hitam: a black basalt headland at the end of the reef, down the line, with a white lighthouse on its tip
function lighthouseHead(g) {
  const at = headland(g, { x: 345, tipZ: 105, baseZ: 255, w: 30, h0: 24, h1: 42, rock: [0.14, 0.14, 0.15], grass: [0.11, 0.18, 0.08] }), t = at(0.14), ly = t.y - 0.5, lx = 345, lz = t.z;
  for (let k = 0; k < 7; k++) put(g, new THREE.CylinderGeometry(2.3 - k * 0.14, 2.4 - k * 0.14, 3.6, 16), k % 2 ? [0.72, 0.16, 0.12] : [0.92, 0.91, 0.88], lx, ly + 1.8 + k * 3.6, lz, 0.03);
  put(g, new THREE.CylinderGeometry(1.7, 1.7, 2.4, 12), [0.12, 0.14, 0.15], lx, ly + 26.8, lz, 0.02);
  put(g, new THREE.ConeGeometry(2.1, 2.2, 12), [0.62, 0.12, 0.1], lx, ly + 29.1, lz, 0.02);
  put(g, new THREE.BoxGeometry(7, 3.2, 5), [0.9, 0.89, 0.86], lx + 7, ly + 1.6, lz + 6, 0.04);   // the keeper's cottage
}
// a coconut palm leaning out over the water: a slender curving trunk and a crown of drooping fronds
function palm(g, x, y, z, h, lean, dir) {
  const trunk = new THREE.CylinderGeometry(0.22, 0.38, h, 6, 8); const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const yy = (p.getY(i) + h / 2) / h; p.setX(i, p.getX(i) + lean * h * yy * yy); }
  trunk.rotateY(dir); trunk.computeVertexNormals(); put(g, trunk, [0.4, 0.34, 0.25], x, y + h / 2, z, 0.1);
  const tx = x + Math.cos(-dir) * lean * h, tz = z + Math.sin(-dir) * lean * h, ty = y + h;
  for (let k = 0; k < 8; k++) { const f = new THREE.ConeGeometry(0.55, 4.4, 4); f.scale(1, 1, 0.25); f.translate(0, -2.2, 0); f.rotateZ(1.25 + (k % 2) * 0.3); f.rotateY(k * 0.8); put(g, f, [0.16, 0.3, 0.1], tx, ty, tz, 0.2); }
}
// Karang Hiu: a low point of grey reef rock at the end of the reef, bright sand in its lee, palms leaning out over it
function palmPoint(g) {
  const at = headland(g, { x: 335, tipZ: 110, baseZ: 250, w: 26, h0: 6, h1: 12, rock: [0.42, 0.42, 0.4], grass: [0.5, 0.47, 0.38] });
  for (let k = 0; k < 13; k++) { const u = 0.06 + k * 0.07, t = at(u), side = k % 2 ? 1 : -1; palm(g, 335 + side * (8 + (k % 3) * 5), t.y - 0.5, t.z, 15 + (k % 4) * 2.5, 0.34 + (k % 3) * 0.07, Math.PI / 2 + side * 0.15); }   // (all bent out to sea by the wind)
}

// a Sumba clan house (uma mbatangu): a timber house on stilts under a wide thatch hip, with the tall thatch tower
// rising out of its middle (the ancestors' loft), the shape every Sumba village is known by
function uma(g, x, y, z, s = 1, ry = 0) {
  const WOOD = [0.42, 0.3, 0.2], THATCH = [0.58, 0.47, 0.3];
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) put(g, new THREE.BoxGeometry(0.3 * s, 1.8 * s, 0.3 * s), [0.3, 0.22, 0.15], x + dx * 2.6 * s, y + 0.9 * s, z + dz * 2.6 * s);
  put(g, new THREE.BoxGeometry(6 * s, 2.2 * s, 6 * s), WOOD, x, y + 2.9 * s, z, 0.12);
  const hip = (prof, y0, y1, seg) => { const geo = new THREE.CylinderGeometry(1, 1, 1, 4, seg, false); geo.rotateY(Math.PI / 4 + ry); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) + 0.5, k = prof(t) * Math.SQRT2; p.setXYZ(i, p.getX(i) * k, y0 + (y1 - y0) * t, p.getZ(i) * k); }
    geo.computeVertexNormals(); return put(g, geo, THATCH, x, y, z, 0.14); };
  hip((t) => (4.4 + (1.5 - 4.4) * t) * s, 3.6 * s, 5.2 * s, 2);                                   // (the wide eaves)
  hip((t) => (0.15 + 1.45 * Math.pow(1 - t, 1.6)) * s, 5.1 * s, 13 * s, 6);                         // (the tower, drawn up to a point)
}
// a Sumba stone tomb: a great flat slab on four short legs, in front of the houses
function tomb(g, x, y, z, ry = 0) {
  const stone = [0.52, 0.5, 0.45];
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) put(g, new THREE.BoxGeometry(0.5, 1.1, 0.5), stone, x + dx * 1.3, y + 0.55, z + dz * 0.8, 0.1);
  const slab = new THREE.BoxGeometry(3.6, 0.45, 2.4); slab.rotateY(ry); put(g, slab, stone, x, y + 1.3, z, 0.12);
}
// a Sumba horse (small, sturdy): body, neck, head, legs and tail, as one piece. grazing: head down to the grass;
// rider: someone on its back
function horse(g, x, y, z, ry, coat, grazing = false, rider = null) {
  const mane = [0.08, 0.06, 0.05], P = [];
  P.push(part(new THREE.CylinderGeometry(0.34, 0.36, 1.5, 8).scale(1, 1, 0.85), coat, 0, 1.2, 0, 0, Math.PI / 2));            // (the barrel of the body, along x)
  const nk = new THREE.CylinderGeometry(0.16, 0.26, 0.85, 6); nk.rotateZ(grazing ? 2.3 : -0.6); P.push(part(nk, coat, grazing ? 0.95 : 0.85, grazing ? 0.95 : 1.62, 0));
  const hd = new THREE.BoxGeometry(0.55, 0.22, 0.24); hd.rotateZ(grazing ? -1.2 : -0.35); P.push(part(hd, coat, grazing ? 1.25 : 1.25, grazing ? 0.5 : 1.92, 0));
  for (const [lx, lz] of [[0.55, 0.18], [0.55, -0.18], [-0.55, 0.18], [-0.55, -0.18]]) P.push(part(new THREE.CylinderGeometry(0.07, 0.06, 1.0, 5), coat, lx, 0.5, lz));
  P.push(part(new THREE.CylinderGeometry(0.03, 0.09, 0.8, 5), mane, -0.85, 0.95, 0, 0, -0.35));   // (the tail)
  if (rider) { P.push(part(new THREE.CylinderGeometry(0.17, 0.19, 0.7, 6), rider, 0, 1.95, 0), part(new THREE.SphereGeometry(0.13, 6, 4), [0.35, 0.24, 0.17], 0.02, 2.42, 0),
    part(new THREE.CylinderGeometry(0.07, 0.07, 0.75, 5), [0.2, 0.2, 0.22], 0.12, 1.45, 0.3, 0, 0.3), part(new THREE.CylinderGeometry(0.07, 0.07, 0.75, 5), [0.2, 0.2, 0.22], 0.12, 1.45, -0.3, 0, 0.3)); }
  const geo = mergeGeometries(P); geo.rotateY(ry); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, landMaterial()); m.position.set(x, y, z); m.userData.prop = true; g.add(m);
}
// Pantai Kuda, the horse beach: a low green headland at the end of the bay with a Sumba village on it (the tall
// thatch towers of the clan houses, stone tombs in front), and the village's horses on the sand and the grass below
function horseHead(g) {
  const at = headland(g, { x: 330, tipZ: 115, baseZ: 250, w: 30, h0: 9, h1: 16, rock: [0.52, 0.47, 0.36], grass: [0.2, 0.33, 0.12] });
  [[0.22, -9], [0.3, 9], [0.4, -6], [0.48, 10], [0.58, -3]].forEach(([u, dx], k) => { const t = at(u); uma(g, 330 + dx, t.y - 0.6, t.z, 0.95 + (k % 3) * 0.12, k * 0.3); });
  { const t = at(0.14); tomb(g, 326, t.y - 0.3, t.z, 0.2); tomb(g, 336, t.y - 0.3, t.z + 4, -0.3); }
  const sandY = (x, z) => (z - 185) / 40 * 2.2 - 0.2 + Math.sin(x * 0.05) * 0.2;   // (the beach's own slope: see coast())
  const COATS = [[0.33, 0.19, 0.1], [0.12, 0.09, 0.07], [0.78, 0.74, 0.66], [0.45, 0.3, 0.16], [0.24, 0.15, 0.09]];
  const herd = [[232, 207, 0.3, 0, 1], [240, 210, -2.6, 1, 0], [251, 205, 2.9, 2, 0], [262, 209, 0.9, 3, 1], [276, 212, -0.4, 4, 0], [200, 204, 3.0, 1, 0, [0.85, 0.2, 0.15]], [214, 203, 2.8, 2, 0, [0.95, 0.9, 0.8]]];
  for (const [x, z, ry, c, graze, rider] of herd) horse(g, x, sandY(x, z) - 0.05, z, ry, COATS[c], !!graze, rider || null);
  for (const [u, dx, ry, c] of [[0.66, -12, 1.2, 0], [0.72, 6, -0.7, 2], [0.8, -4, 2.2, 4]]) { const t = at(u); horse(g, 330 + dx, t.y - 0.4, t.z, ry, COATS[c], true); }   // (and a few grazing up top)
}
// Gunung Laut, the mountain in the sea: a great island peak standing out of the ocean down the line past the end of
// the reef, a jagged summit up in the storm, black rocks round its foot
function seaMountain(g) {
  const cx = 760, cz = -40, R = 150, Hm = 260, geo = new THREE.ConeGeometry(R, Hm, 28, 14, true), p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), t = (y + Hm / 2) / Hm;
    const n = 1 + 0.16 * Math.sin(a * 5 + t * 4) + 0.09 * Math.sin(a * 11 - t * 9) + 0.05 * Math.sin(a * 23 + t * 17), rr = n * (1 - 0.25 * Math.pow(t, 0.6));   // (ribs and gullies down its flanks; the lower slopes spread out)
    p.setXYZ(i, x * rr, y + Hm / 2 - 6 + (18 * Math.sin(a * 3) + 22 * Math.sin(a * 7 + 1) * Math.pow(t, 3)) * t, z * rr);   // (a broken, jagged summit, not a clean point)
    const k = 0.85 + Math.random() * 0.3, col = t < 0.05 ? [0.13, 0.13, 0.14] : t < 0.55 && Math.sin(a * 7 + t * 20) > -0.2 ? [0.1, 0.17, 0.09] : [0.24, 0.24, 0.25];   // (black rock at the waterline, jungle on the lower flanks, bare grey rock above)
    c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); const flat = geo.toNonIndexed(); flat.computeVertexNormals();
  const m = new THREE.Mesh(flat, landMaterial()); m.position.set(cx, 0, cz); m.userData.prop = true; g.add(m);
  // broken black rocks round its foot
  for (let k = 0; k < 16; k++) { const an = k * 0.39 + 1.6, r = R * (0.95 + (k % 4) * 0.06); put(g, new THREE.DodecahedronGeometry(6 + (k % 3) * 4, 0).scale(1, 0.8 + (k % 2) * 0.6, 1), [0.14, 0.14, 0.15], cx + Math.cos(an) * r, -1, cz + Math.sin(an) * r, 0.25); }
}

// things in the water down the line, where you look while you ride: each built as one piece, and the ones that float
// ride up and over the swells (g.userData.floaters: the game moves them each frame)
const part = (geo, rgb, x, y, z, ry = 0, rz = 0, jit = 0.06) => { tint(geo, rgb, jit); if (geo.attributes.uv) geo.deleteAttribute('uv'); if (rz) geo.rotateZ(rz); if (ry) geo.rotateY(ry); geo.translate(x, y, z); return geo.index ? geo.toNonIndexed() : geo; };
function floater(g, parts, x, z, ry, dy = 0, rock = 0.04, sc = 1) {
  const geo = mergeGeometries(parts); geo.scale(sc, sc, sc); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, landMaterial()); m.position.set(x, dy, z); m.rotation.y = ry; g.add(m);
  (g.userData.floaters ||= []).push({ m, x, z, dy, rock, ph: Math.random() * 6.3 }); return m;
}
// a jukung: slim white hull with a painted stripe and beaked ends, bamboo outriggers either side, a short mast
function jukungParts(stripe, sail) {
  const P = [part(new THREE.CylinderGeometry(0.42, 0.25, 7, 8, 1).scale(1, 1, 0.75), [0.95, 0.94, 0.9], 0, 0, 0, 0, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.44, 0.27, 6.4, 8, 1, true).scale(1, 1, 0.77), stripe, 0, 0.12, 0, 0, Math.PI / 2)];
  for (const e of [-1, 1]) P.push(part(new THREE.ConeGeometry(0.28, 1.2, 6), [0.82, 0.23, 0.16], e * 4, 0.25, 0, 0, -e * Math.PI / 2));
  for (const zs of [-1, 1]) { P.push(part(new THREE.CylinderGeometry(0.1, 0.1, 5.5, 5), [0.23, 0.19, 0.15], 0, -0.15, zs * 2.6, 0, Math.PI / 2));
    for (const xs of [-1.4, 1.4]) P.push(part(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 4).rotateX(Math.PI / 2), [0.36, 0.29, 0.21], xs, 0.35, zs * 1.3)); }
  P.push(part(new THREE.CylinderGeometry(0.05, 0.06, 4.2, 4), [0.36, 0.29, 0.21], 0, 2.3, 0));
  // the sail: a tall triangle of bright cloth on a raked spar, the thing you actually pick out from far across the water
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0.06, 2.8, 1.0, 0.06, 0.2, 4.3, 0.06,  0, 0.6, -0.06, 0.2, 4.3, -0.06, 2.8, 1.0, -0.06], 3));
  sg.computeVertexNormals(); P.push(part(sg, sail, 0.1, 0, 0));   // (normals: every part must carry the same attributes to merge)
  return P;
}
function waterProps(g, key) {
  if (key === 'easy') {   // Pantai Kuda: the village's fishing boats anchored out the back beside the lineup, where the swells pass unbroken
    const boats = [[40, -232, 0.4, [0.12, 0.36, 0.66], [0.9, 0.24, 0.12]], [72, -246, 1.2, [0.14, 0.5, 0.24], [0.95, 0.72, 0.1]], [18, -258, -0.3, [0.74, 0.14, 0.1], [0.94, 0.9, 0.84]]];
    for (const [x, z, ry, c, sl] of boats) floater(g, jukungParts(c, sl), x, z, ry, 0.35, 0.04, 1.6);
  }
  if (key === 'hard') {   // Batu Hitam: black basalt rocks standing up out of the sea off the headland, the swell washing round them
    for (const [x, z, h, r] of [[318, 88, 7, 3.2], [300, 122, 4, 2.4], [334, 66, 5, 2.8], [292, 140, 2.5, 1.8], [326, 104, 3, 2]]) {
      const geo = new THREE.DodecahedronGeometry(1, 1); const pp = geo.attributes.position;
      for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); pp.setXYZ(i, pp.getX(i) * r * (1 - 0.35 * Math.max(0, y)), (y + 0.35) * h, pp.getZ(i) * r * (1 - 0.35 * Math.max(0, y))); }
      geo.computeVertexNormals(); put(g, geo, [0.13, 0.13, 0.14], x, -1.5, z, 0.3); }
  }
  if (key === 'hiu') {   // Karang Hiu: coral heads breaking the surface off the point, and a red and white marker buoy out the back of the reef
    for (let k = 0; k < 9; k++) { const x = 292 + (k * 37) % 34, z = 62 + (k * 23) % 42, r = 1.2 + (k % 3) * 0.7;
      put(g, new THREE.DodecahedronGeometry(r, 0).scale(1.4, 0.45, 1.1), k % 2 ? [0.33, 0.28, 0.2] : [0.26, 0.3, 0.22], x, -0.25, z, 0.3); }
    floater(g, [part(new THREE.CylinderGeometry(0.55, 0.6, 1.1, 10), [0.8, 0.12, 0.1], 0, 0.2, 0), part(new THREE.CylinderGeometry(0.4, 0.55, 0.9, 10), [0.95, 0.95, 0.93], 0, 1.2, 0),
      part(new THREE.ConeGeometry(0.4, 0.8, 10), [0.8, 0.12, 0.1], 0, 2.05, 0), part(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4), [0.2, 0.2, 0.2], 0, 3, 0)], 30, -190, 0, 0.3, 0.08, 1.8);
  }
  if (key === 'extreme') {   // Gunung Laut: the rescue ski waiting out the back, beyond the lineup, its sled on the back
    floater(g, [part(new THREE.BoxGeometry(3.2, 0.55, 1.15), [0.82, 0.14, 0.1], 0, 0.1, 0), part(new THREE.ConeGeometry(0.58, 1.1, 4).rotateY(Math.PI / 4).scale(1, 1, 0.9), [0.82, 0.14, 0.1], 2.1, 0.1, 0, 0, -Math.PI / 2),
      part(new THREE.BoxGeometry(1.3, 0.3, 0.5), [0.1, 0.1, 0.1], -0.3, 0.52, 0), part(new THREE.BoxGeometry(0.1, 0.45, 0.8), [0.15, 0.15, 0.15], 0.6, 0.6, 0),
      part(new THREE.BoxGeometry(2.3, 0.14, 1.3), [0.95, 0.8, 0.12], -2.7, -0.05, 0)], 45, -335, 0.6, 0.35, 0.07, 1.5);
  }
}

// Pantai Kuda, the beginner's bay, made more of itself in nature (29 Sep 2026, his call: natural, no people or man-made
// things): soft rounded green hills rolling up behind the beach (every other spot has cliffs or rock), and coconut
// palms crowding the tips of the bay's two green arms, leaning out over the water
function kudaNature(g) {
  const hill = (x, z, rx, rz, h, depth = 0) => {
    const geo = new THREE.SphereGeometry(1, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2), pp = geo.attributes.position, c = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const X = pp.getX(i), Y = pp.getY(i), Z = pp.getZ(i), n = 1 + 0.07 * Math.sin(X * 5 + Z * 4) + 0.04 * Math.sin(X * 13 - Z * 11);
      pp.setXYZ(i, X * rx * n, Math.pow(Y, 0.7) * h * n, Z * rz * n);
      // trees all over them, a speckle of lighter and darker crowns; darker low down in the folds, lighter up top in the
      // sun; and the further hills paler and bluer in the sea air (depth: 0 near, 1 far)
      const tree = 0.78 + 0.34 * Math.abs(Math.sin(X * 91 + Z * 57) * Math.sin(X * 37 - Z * 73)) + (Math.random() - 0.5) * 0.12, t = Y, fold = 0.72 + 0.28 * t;
      const r0 = (0.14 + 0.08 * t) * tree * fold, g0 = (0.3 + 0.14 * t) * tree * fold, b0 = (0.1 + 0.04 * t) * tree * fold, a = depth * 0.55;
      c[i * 3] = r0 + (0.52 - r0) * a; c[i * 3 + 1] = g0 + (0.62 - g0) * a; c[i * 3 + 2] = b0 + (0.66 - b0) * a; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, landMaterial()); m.position.set(x, -2, z); m.userData.prop = true; g.add(m); };
  for (const [x, z, rx, rz, h, d] of [[-250, 380, 150, 90, 62, 0.1], [-60, 420, 170, 100, 78, 0.35], [140, 395, 150, 95, 58, 0.15], [330, 430, 180, 110, 84, 0.4], [520, 390, 140, 90, 55, 0.12], [-420, 440, 160, 100, 70, 0.45],
    [60, 560, 260, 120, 118, 0.85], [-330, 590, 240, 110, 104, 0.9], [420, 580, 250, 120, 110, 0.88]]) hill(x, z, rx, rz, h, d);   // (a second, higher range further back, hazed blue)
  // palms crowding each arm's tip, leaning out to sea
  for (const [cx, cz, dir, y0] of [[-470, 55, 0, 25], [610, 70, Math.PI, 21]]) for (let k = 0; k < 11; k++) {   // (y0: the grass on each arm there)
    const a = k * 2.4, r = 6 + (k % 4) * 7; palm(g, cx + Math.cos(a) * r, y0 + (k % 3), cz + Math.sin(a) * r * 0.6, 14 + (k % 5) * 2, 0.18 + (k % 3) * 0.07, dir + (k % 2 ? 0.4 : -0.4)); }
}

// Tanjung Uma, made more of itself in nature (29 Sep 2026, his call: natural, no people or man-made things): Sumba in
// the dry season. Bare golden grass hills roll up behind the beach with a lone tree here and there (Pantai Kuda's are
// soft and green), a higher range further back hazed blue; the forest along the beach thinned and dried to olive
function umaNature(g) {
  const hills = [], trees = [];
  const hill = (x, z, rx, rz, h, depth) => {
    const geo = new THREE.SphereGeometry(1, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2), pp = geo.attributes.position, c = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const X = pp.getX(i), Y = pp.getY(i), Z = pp.getZ(i), n = 1 + 0.06 * Math.sin(X * 4 + Z * 5) + 0.035 * Math.sin(X * 11 - Z * 13);
      pp.setXYZ(i, X * rx * n, Math.pow(Y, 0.8) * h * n, Z * rz * n);
      // dry grass: gold on the sunny tops, a browner olive down in the folds and gullies where it stays greener; the
      // far range paler and bluer in the sea air (depth: 0 near, 1 far)
      const grass = 0.9 + 0.12 * Math.sin(X * 23 + Z * 17) * Math.sin(X * 7 - Z * 29) + (Math.random() - 0.5) * 0.08, t = Y, gully = Math.max(0, Math.sin(X * 9 + Z * 3) - 0.6) * (1 - t);
      const scrub = Math.min(1, Math.max(0, Math.sin(X * 13 + Z * 4 + x) * Math.sin(Z * 11 - X * 6 + z) * 2.5 - 0.3)) + gully;   // (dark patches of dry scrub and thicket, so it reads as grass, not sand)
      const r0 = (0.36 + 0.14 * t - 0.2 * scrub) * grass, g0 = (0.25 + 0.09 * t - 0.07 * scrub) * grass, b0 = (0.07 + 0.03 * t - 0.02 * scrub) * grass, a = depth * 0.5;
      c[i * 3] = r0 + (0.56 - r0) * a; c[i * 3 + 1] = g0 + (0.6 - g0) * a; c[i * 3 + 2] = b0 + (0.64 - b0) * a; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals(); geo.translate(x, -2, z); hills.push(geo);
    // a few lone trees standing out on the near slopes: a dark rounded crown on a short trunk
    if (depth < 0.5) for (let k = 0; k < 7; k++) { const a = Math.random() * Math.PI * 2, d = 0.25 + Math.random() * 0.6, X = Math.cos(a) * d, Z = -Math.abs(Math.sin(a)) * d;   // (on the sea side, where you see them)
      const y = Math.pow(Math.sqrt(Math.max(0, 1 - X * X - Z * Z)), 0.8) * h * 0.94 - 5, s = 4 + Math.random() * 3, tx = x + X * rx, tz = z + Z * rz;   // (sunk a little: the dome is coarser than the true curve)
      const cr = new THREE.IcosahedronGeometry(s, 1).scale(1.5, 0.65, 1.3); tint(cr, [0.1, 0.13, 0.05], 0.25); cr.translate(tx, y + s * 1.3, tz); trees.push(cr);   // (a wide flat crown, as the savanna trees grow)
      const tr = new THREE.CylinderGeometry(0.6, 0.9, s * 1.6, 5); tint(tr, [0.2, 0.16, 0.12], 0.1); tr.translate(tx, y + s * 0.5, tz); trees.push(tr); } };
  for (const [x, z, rx, rz, h, d] of [[-160, 360, 150, 80, 48, 0.1], [40, 390, 170, 90, 64, 0.2], [230, 370, 150, 85, 50, 0.12], [420, 400, 170, 95, 60, 0.25], [590, 370, 130, 80, 44, 0.15],
    [140, 540, 280, 120, 120, 0.85], [-250, 560, 240, 110, 100, 0.9], [480, 560, 250, 120, 108, 0.88]]) hill(x, z, rx, rz, h, d);
  for (const list of [hills, trees]) { const geo = mergeGeometries(list.map((q) => { if (q.attributes.uv) q.deleteAttribute('uv'); return q.index ? q.toNonIndexed() : q; })); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, landMaterial()); m.userData.prop = true; g.add(m); }
}
// the forest along the back of the beach, thinned (keep: crowns kept of every 5) and recoloured: Tanjung Uma's dried
// to a dusty olive with bare golden ground between, Batu Hitam's dark wind-beaten scrub. Keeps crowns of the one the
// coast built, so the shared dice are untouched
function jungleLook(g, keep, rgb) {
  const j = g.userData.jungle, e = g.userData.edge; if (!j) return;
  const m = new THREE.Matrix4(); let n = 0;
  for (let i = 0; i < j.count; i++) if (i % 5 < keep) { j.getMatrixAt(i, m); j.setMatrixAt(n++, m); }
  j.count = n; j.instanceMatrix.needsUpdate = true;
  const geo = j.geometry.clone(), c = geo.attributes.color;
  for (let i = 0; i < c.count; i++) { const k = c.getY(i) / 0.2; c.setXYZ(i, rgb[0] * k, rgb[1] * k, rgb[2] * k); }   // (the coast's crowns are green 0.09/0.2/0.08 times their light)
  j.geometry = geo; if (e) e.geometry = geo;   // (and the scrub along the cliff tops)
}
// Batu Hitam, made more of itself in nature (29 Sep 2026, his call): a raw volcanic coast. Its own volcano stands
// behind the bay, a steep dark cone streaked with old lava, green only low on its flanks (a cloud on its summit was tried:
// solid lumps of land read as a flying saucer, not cloud)
function hitamNature(g) {
  const X = 90, Z = 760, R = 430, Hc = 290, rc = 36, geos = [];
  { const geo = new THREE.CylinderGeometry(1, 1, 1, 64, 14, true), pp = geo.attributes.position, c = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const t = pp.getY(i) + 0.5, a = Math.atan2(pp.getZ(i), pp.getX(i)), gul = Math.sin(a * 23 + Math.sin(a * 7) * 2), n = 1 + 0.05 * gul * t + 0.04 * Math.sin(a * 5 + 1);
      const r = (rc + (R - rc) * Math.pow(1 - t, 2.1)) * n;   // (a concave cone: steep near the top, spreading wide at the foot)
      pp.setXYZ(i, Math.cos(a) * r, t * Hc - 8 - (t > 0.97 ? 10 * (t - 0.97) / 0.03 : 0), Math.sin(a) * r);   // (a shallow crater at the top)
      const green = Math.max(0, 1 - t / 0.28), lava = Math.max(0, gul - 0.4) * t * 0.5, k = 0.85 + 0.25 * Math.random();
      const rr = (0.09 + 0.02 * lava) * (1 - lava * 0.5), gg = 0.09 * (1 - lava * 0.6), bb = 0.1 * (1 - lava * 0.6);
      c[i * 3] = (rr + (0.07 - rr) * green) * k; c[i * 3 + 1] = (gg + (0.13 - gg) * green) * k; c[i * 3 + 2] = (bb + (0.06 - bb) * green) * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.deleteAttribute('uv'); geo.translate(X, 0, Z); geos.push(geo.toNonIndexed()); }
  const geo = mergeGeometries(geos); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, landMaterial()); m.userData.prop = true; g.add(m);
}

// Watu Kanan, made more of itself in nature (29 Sep 2026, his call): a waterfall pours off the red cliffs from the
// green valley above into the sea, and worn blocks of red sandstone lie along the foot of the cliffs
function kananNature(g, C) {
  if (!C) return;   // (C: the coast's cliff face, to set things against)
  // fallen blocks of red sandstone strewn along the foot of the cliffs, worn round by the sea (sandstone pillars were
  // tried here first: at this distance they read as posts, not rock)
  const geos = [];
  for (let k = 0; k < 34; k++) { const x = -110 - Math.random() * 520, r = 1.2 + Math.random() * 3.2, geo = new THREE.DodecahedronGeometry(1, 1), pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) { const n = 1 + 0.18 * Math.sin(pp.getX(i) * 5 + k) * Math.sin(pp.getZ(i) * 4 + k); pp.setXYZ(i, pp.getX(i) * n * 1.35, pp.getY(i) * n * 0.75, pp.getZ(i) * n); }
    const st = Math.random(); tint(geo, st > 0.75 ? [0.78, 0.5, 0.36] : st < 0.25 ? [0.5, 0.26, 0.17] : [0.64, 0.36, 0.24], 0.12); geo.deleteAttribute('uv'); geo.rotateY(Math.random() * 6);
    geo.scale(r, r, r); geo.translate(x, r * 0.35, C.z(x, 0) - 3 - Math.random() * 12); geos.push(geo.toNonIndexed()); }
  // a white pool of churned water at the foot of the fall
  const FX = -205, FW = 8, top = C.top(FX) - 1.5;
  { const pool = new THREE.CircleGeometry(1, 16); pool.rotateX(-Math.PI / 2); pool.scale(FW * 0.9, 1, 4); tint(pool, [0.86, 0.9, 0.92], 0.05); pool.deleteAttribute('uv'); pool.translate(FX, 0.35, C.z(FX, 0) - 3.5); geos.push(pool.toNonIndexed()); }
  const merged = mergeGeometries(geos); merged.computeVertexNormals();
  const pm = new THREE.Mesh(merged, landMaterial()); pm.userData.prop = true; g.add(pm);
  // the fall itself: a sheet of white water hugging the rock face, streaks of foam racing down it (drawn in its own
  // see-through material, on the game's clock)
  const fall = new THREE.PlaneGeometry(1, 1, 4, 30), fp = fall.attributes.position;
  for (let i = 0; i < fp.count; i++) { const u = fp.getX(i) + 0.5, v = fp.getY(i) + 0.5, y = top * v, w = FW * (0.75 + 0.25 * v + 0.35 * (1 - v) * (1 - v)), x = FX + (u - 0.5) * w;   // (spreading a little as it falls)
    fp.setXYZ(i, x, y, C.z(x, y) - 1.4 - 1.2 * (1 - v) * (1 - v)); }
  { const ix = fall.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } }   // (face the sea)
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: ENV.uTime }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uTime; varying vec2 vU;
      void main(){ float e = smoothstep(0., .18, vU.x) * smoothstep(1., .82, vU.x);
        float s = fract(vU.y * 5. + uTime * 1.3 + sin(vU.x * 23.) * .35), s2 = fract(vU.y * 9. + uTime * 2.1 + sin(vU.x * 41. + 2.) * .4);
        float f = .55 + .3 * smoothstep(.5, .9, s) + .2 * smoothstep(.6, .95, s2);
        gl_FragColor = vec4(mix(vec3(.7, .77, .8), vec3(.9, .92, .92), f), e * (.45 + .35 * f) * smoothstep(0., .04, vU.y + .02)); }` });
  const fm = new THREE.Mesh(fall, mat); fm.renderOrder = 2; g.add(fm);
}

// Karang Hiu, made more of itself in nature (29 Sep 2026, his call): a shore of raw reef rock. Jagged grey blocks of
// old coral lie along the waterline, sharp-edged and pitted, dark where the sea wets them (the wind that bends every
// palm the same way is in the coast's look: windy)
function hiuNature(g, C) {
  if (!C) return;
  const geos = [];
  for (let k = 0; k < 60; k++) { const x = -420 + Math.random() * 760, r = 0.8 + Math.random() * 2.6, geo = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(), pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) { const n = 0.75 + 0.5 * Math.abs(Math.sin(pp.getX(i) * 7 + k) * Math.cos(pp.getZ(i) * 5 - k)); pp.setXYZ(i, pp.getX(i) * n * 1.5, pp.getY(i) * n * 0.6, pp.getZ(i) * n); }
    const c = new Float32Array(pp.count * 3); for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), kk = (y < -0.1 ? 0.45 : 0.85 + Math.random() * 0.2); c[i * 3] = 0.5 * kk; c[i * 3 + 1] = 0.5 * kk; c[i * 3 + 2] = 0.47 * kk; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.deleteAttribute('uv'); geo.rotateY(Math.random() * 6); geo.scale(r, r, r);
    const z = x < -70 ? C.z(x, 0) - 2 - Math.random() * 8 : 186 + Math.random() * 6; geo.translate(x, r * 0.15, z); geo.computeVertexNormals(); geos.push(geo); }   // (along the cliff foot, then scattered at the water's edge down the beach)
  const merged = mergeGeometries(geos); merged.computeVertexNormals();
  const m = new THREE.Mesh(merged, landMaterial()); m.userData.prop = true; g.add(m);
}

function blackRock(g) {
  // (its lighthouse stands on the headland down the line: see lighthouseHead)
  // black lava boulders strewn along the waterline and the foot of the cliffs
  const rock = new THREE.DodecahedronGeometry(1, 0); tint(rock, [0.16, 0.16, 0.17], 0.25);
  const N = 140, rocks = new THREE.InstancedMesh(rock, landMaterial(), N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) { const x = -260 + Math.random() * 640, z = 184 + Math.random() * 16, r = 0.8 + Math.random() * 2.6;
    q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)); rocks.setMatrixAt(i, m.compose(p.set(x, 0.3 + r * 0.3, z), q, s.set(r * 1.3, r * 0.8, r))); }
  g.add(rocks);
}

function theMountain(g) {
  // sea stacks: towers of dark rock standing in the sea either side of the reef, capped with scrub
  const stack = (x, z, h, r) => {
    const geo = new THREE.CylinderGeometry(r * 0.75, r, h, 9, 8); const pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), a = Math.atan2(pp.getZ(i), pp.getX(i)), n = 1 + 0.18 * Math.sin(a * 3 + y * 0.08) + 0.1 * Math.sin(y * 0.3 + a * 7);
      pp.setX(i, pp.getX(i) * n); pp.setZ(i, pp.getZ(i) * n); }
    geo.computeVertexNormals(); put(g, geo, [0.2, 0.2, 0.21], x, h / 2 - 2, z, 0.3);
    const cap = new THREE.SphereGeometry(r * 0.8, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.35, 1); put(g, cap, [0.1, 0.17, 0.09], x, h - 2, z, 0.3);
  };
  stack(-330, -120, 95, 22); stack(-290, -40, 60, 14); stack(-380, 40, 130, 30); stack(590, 90, 70, 16);   // (beyond the end of the reef, clear of the waves)
}

// Pantai Bintang's lights in the dark: a driftwood fire on the beach with its glow on the sand, and the lamp boats out
// at sea (the bagan: fishermen's platforms with bright lamps that draw the squid up at night), strung along the horizon
function glowTex(stops) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) gr.addColorStop(o, col); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
}
// Pantai Bintang's landmark: a great rock arch standing alone out to sea, right where the moon sits as you wait in the
// lineup, so the moon hangs in its opening; plankton glows where the swell breaks round its feet
function moonArch(g, halo) {
  const X = 92, Z = -470, R = 30, T = 11;   // (the coast sits 160 m back: this keeps the arch 310 m out from the lineup)
  const geo = new THREE.TorusGeometry(R, T, 12, 48, Math.PI), pp = geo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), a = Math.atan2(y, x), n = 1 + 0.14 * Math.sin(a * 5 + 1.3) + 0.08 * Math.sin(a * 13 + z * 0.2) + 0.05 * Math.sin(x * 0.9 + z * 0.7);
    const cx = x / Math.max(1e-3, Math.hypot(x, y)) * R, cy = y / Math.max(1e-3, Math.hypot(x, y)) * R;   // (the rock swells and pinches round its centre line)
    pp.setXYZ(i, cx + (x - cx) * n, cy + (y - cy) * n * (y > R * 0.7 ? 0.8 : 1), z * n * 1.25); }
  geo.computeVertexNormals();
  const legs = [-R, R].map((lx) => { const c = new THREE.CylinderGeometry(T * 1.0, T * 1.6, 30, 14, 4), cp = c.attributes.position;
    for (let i = 0; i < cp.count; i++) { const y = cp.getY(i), a = Math.atan2(cp.getZ(i), cp.getX(i)), k = 1 + 0.12 * Math.sin(a * 3 + lx) + 0.06 * Math.sin(a * 7 + y * 0.08); cp.setXYZ(i, cp.getX(i) * k, y, cp.getZ(i) * k * 1.25); }
    c.computeVertexNormals(); c.translate(lx, -15, 0); return c; });
  for (const q of [geo, ...legs]) { q.translate(X, 26, Z); put(g, q, [0.2, 0.2, 0.23], 0, 0, 0, 0.25); }
  // a low rock at its foot, and the glow where the swell washes round them
  put(g, new THREE.DodecahedronGeometry(1, 1).scale(16, 7, 11), [0.18, 0.18, 0.2], X + 62, 0, Z + 18, 0.3);
  const ring = []; for (const [cx, cz, rr] of [[X - R, Z, T * 1.6], [X + R, Z, T * 1.6], [X + 62, Z + 18, 16]]) for (let k = 0; k < 110; k++) { const a = Math.random() * Math.PI * 2, r2 = rr * (0.95 + Math.random() * 0.6); ring.push([cx + Math.cos(a) * r2, 0.4, cz + Math.sin(a) * r2 * 1.2]); }   // (a loose, uneven wash of light round each rock, not a neat ring)
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(ring.flat(), 3));
  const rm = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0x3fc8ff, size: 7, map: halo, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  rm.frustumCulled = false; g.add(rm);
  rm.onBeforeRender = () => { rm.material.opacity = 0.2 + 0.14 * Math.sin(performance.now() / 1000 * 0.8); };   // (the swell surging round the rocks and draining)
}
function nightLights(g) {
  const halo = glowTex([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,255,255,.8)'], [0.4, 'rgba(255,255,255,.18)'], [1, 'rgba(255,255,255,0)']]);
  moonArch(g, halo);
  const glow = (pts, color, size, opacity = 1) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    const m = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: halo, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.frustumCulled = false; g.add(m); return m; };
  // the lamp boats: a dark hull, a frame of poles, and a row of lamps hanging over the water (with their light on the sea under them)
  const lamps = [], sea = [];
  for (let i = 0; i < 7; i++) {
    const x = -420 + i * 150 + (Math.random() - 0.5) * 60, z = -520 - Math.random() * 260, n = 3 + Math.floor(Math.random() * 3);
    put(g, new THREE.BoxGeometry(9, 1.2, 2.2), [0.05, 0.05, 0.06], x, 0.4, z, 0.05);
    for (let k = 0; k < n; k++) { const lx = x - 4 + 8 * k / Math.max(1, n - 1); lamps.push([lx, 3.2 + Math.random() * 0.4, z]); sea.push([lx, 0.3, z + 1]); }
  }
  glow(lamps, 0xfff4d6, 8); glow(lamps, 0xffe2a8, 30, 0.35); glow(sea, 0xffd79a, 40, 0.2);
  // the fire on the beach: a hot core, its flames, and a wide warm glow over the sand
  const fx = 40, fz = 214;
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, log = put(g, new THREE.CylinderGeometry(0.12, 0.14, 1.6, 5), [0.12, 0.08, 0.05], fx + Math.cos(a) * 0.3, 1.9, fz + Math.sin(a) * 0.3); log.rotation.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); }
  glow([[fx, 2.3, fz]], 0xffb050, 2.6); glow([[fx, 2.9, fz]], 0xff7a1e, 5, 0.8); glow([[fx, 2.2, fz]], 0xff8a2a, 26, 0.3);
  // paper lanterns let go from the beach, drifting up and out over the bay (each on its own slow loop: up for about two
  // minutes, swaying, fading out high up, then another from the sand)
  { const N = 26, P = new Float32Array(N * 3), L = Array.from({ length: N }, (_, i) => ({ x: -80 + Math.random() * 260, z: 205 + Math.random() * 20, ph: i / N, sp: 0.85 + Math.random() * 0.3, sw: Math.random() * 6.3 }));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const lan = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa24a, size: 2.4, map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    lan.frustumCulled = false; g.add(lan);
    lan.onBeforeRender = () => { const t = performance.now() / 1000;
      for (let i = 0; i < N; i++) { const l = L[i], k = (t / 130 * l.sp + l.ph) % 1, e = k * k;
        P[i * 3] = l.x + Math.sin(t * 0.3 + l.sw) * 3 + k * 40; P[i * 3 + 1] = 3 + k * 150 + Math.sin(t * 0.7 + l.sw) * 0.6; P[i * 3 + 2] = l.z - e * 420; }
      geo.attributes.position.needsUpdate = true; lan.material.opacity = 0.9; };
  }
  // a few houses back in the palms with a warm window each
  glow([[-60, 9, 238], [-20, 11, 246], [120, 10, 240], [165, 14, 252]], 0xffc070, 2.2, 0.9);
}
