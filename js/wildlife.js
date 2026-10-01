// Life in the water off the villa: a pod of dolphins porpoising across the bay now and then, sea turtles coming up to
// breathe by the rocks under the balcony, and out the back a humpback whale that blows, rolls and dives. And about
// every two minutes, a show (see SHOWS): a note goes up, and five seconds later it happens in front of the balcony:
// the humpback breaching two or three times, slapping its tail, a mother and her calf breaching together, the dolphins
// leaping and spinning in close under the cliff, manta rays by the rocks (one jumps), a sea eagle taking a fish, or
// a school of flying fish skimming across the bay.
// Everything is in the world frame (the waves' frame), low-poly and instanced, and only runs while the villa is shown.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './surf.js?v=197';

const clean = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };   // (every piece the same attributes, or they won't merge)
// colour a geometry: dark on top, pale underneath (countershading, like the real animals)
const shade = (g, top, belly, split = 0) => { g.computeVertexNormals(); const n = g.attributes.normal, p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (n.getY(i) - split) * 1.6 + 0.5)), j = 0.94 + Math.random() * 0.12;
    for (let e = 0; e < 3; e++) c[i * 3 + e] = (belly[e] + (top[e] - belly[e]) * k) * j; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };

function dolphinGeo() {   // ~2.3 m, nose along +z
  const body = new THREE.SphereGeometry(1, 14, 8); const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const t = z < 0 ? 1 + z * 0.72 : 1 - Math.max(0, z - 0.55) * 1.3;   // taper to the tail and the beak
    p.setXYZ(i, x * 0.3 * Math.max(0.12, t), y * 0.3 * Math.max(0.12, t) + (z > 0.7 ? -0.04 : 0), z * 1.15); }
  const fin = new THREE.BufferGeometry(); fin.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.2, 0.15, 0, 0.2, -0.3, 0, 0.55, -0.35, 0, 0.2, -0.3, 0, 0.2, 0.15, 0, 0.55, -0.35], 3));
  const fl = new THREE.BufferGeometry(); fl.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -1.05, -0.45, 0, -1.4, -0.3, 0, -1.2, 0, 0, -1.05, 0.3, 0, -1.2, 0.45, 0, -1.4, 0, 0, -1.05, -0.3, 0, -1.2, -0.45, 0, -1.4, 0, 0, -1.05, 0.45, 0, -1.4, 0.3, 0, -1.2], 3));
  const g = mergeGeometries([clean(body), clean(fin), clean(fl)]); return shade(g, [0.3, 0.33, 0.37], [0.78, 0.8, 0.82]); }

function turtleGeo() {   // ~1 m green turtle
  const shell = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(0.85, 0.38, 1);
  const plast = new THREE.CircleGeometry(0.5, 12); plast.rotateX(Math.PI / 2); plast.scale(0.85, 1, 1);
  const head = new THREE.SphereGeometry(0.13, 8, 6); head.scale(1, 0.85, 1.3); head.translate(0, 0.03, 0.62);
  const fl = []; for (const [x, z, a, s] of [[0.42, 0.25, 0.7, 1], [-0.42, 0.25, -0.7, 1], [0.3, -0.38, 0.9, 0.55], [-0.3, -0.38, -0.9, 0.55]]) { const f = new THREE.BoxGeometry(0.5 * s, 0.03, 0.18 * s); f.rotateY(a); f.translate(x, 0, z); fl.push(clean(f)); }
  const g = mergeGeometries([clean(shell), clean(plast), clean(head), ...fl]); return shade(g, [0.33, 0.28, 0.16], [0.7, 0.65, 0.45]); }

function whaleGeo() {   // a humpback, ~14 m, nose along +z: long white pectoral fins, knobbly head, broad flukes
  const prof = [[0.01, -7], [0.3, -6.4], [0.75, -4.5], [1.35, -2], [1.7, 0.5], [1.75, 2.5], [1.5, 4.5], [1.1, 6.1], [0.5, 6.9], [0.01, 7.1]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(prof, 16); body.rotateX(Math.PI / 2); body.scale(1, 0.85, 1);
  { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (y < 0) p.setY(i, y * 1.08 + (z > 3 ? 0.15 : 0)); } }   // (a fuller throat)
  const hump = new THREE.ConeGeometry(0.35, 0.6, 6); hump.translate(0, 1.55, -2.6);
  const pec = (side) => { const f = new THREE.BoxGeometry(0.9, 0.12, 4.6); const p = f.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setX(i, p.getX(i) * (1 - (z + 2.3) / 4.6 * 0.6)); }
    f.translate(0, 0, -2.3); f.rotateY(-side * 0.6); f.rotateZ(side * 0.3); f.translate(side * 1.45, -0.7, 3.4); return clean(f); };   // (angled out and back from the flanks)
  const fluke = new THREE.BufferGeometry(); fluke.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -6.8, -2.4, 0, -8.2, -1.2, 0, -7.4, 0, 0, -6.8, 1.2, 0, -7.4, 2.4, 0, -8.2, 0, 0, -6.8, -1.2, 0, -7.4, -2.4, 0, -8.2, 0, 0, -6.8, 2.4, 0, -8.2, 1.2, 0, -7.4,
    -2.4, 0, -8.2, 0, 0, -7.7, -1.2, 0, -7.4, 1.2, 0, -7.4, 0, 0, -7.7, 2.4, 0, -8.2, -1.2, 0, -7.4, 0, 0, -7.7, -2.4, 0, -8.2, 2.4, 0, -8.2, 0, 0, -7.7, 1.2, 0, -7.4], 3));
  const g = mergeGeometries([clean(body), clean(hump), pec(1), pec(-1), clean(fluke)]); shade(g, [0.22, 0.23, 0.26], [0.9, 0.9, 0.88], -0.25);
  const c = g.attributes.color, p = g.attributes.position;   // (the pectoral fins are white all over)
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) > 1.8 && p.getZ(i) < 3.6 && p.getZ(i) > -1.5) { c.setXYZ(i, 0.9, 0.9, 0.88); }
  return g; }

function mantaGeo() {   // a manta ray, 4 m across, nose along +z, flat: black on top, white underneath (wings flap: see mantas)
  const top = [0.1, 0.11, 0.13], belly = [0.88, 0.88, 0.85], P = [], C = [];
  const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) C.push(...col); };
  const nose = [0, 0.05, 0.9], back = [0, 0.05, -0.7], ceph = (s) => [s * 0.35, 0.02, 1.15];
  for (const s of [-1, 1]) { const tip = [s * 2, 0, -0.1], root = [s * 0.35, 0.08, 0.2];
    for (const [y, col, flip] of [[0, top, s > 0], [-0.06, belly, s < 0]]) { const d = (v) => [v[0], v[1] + y, v[2]];
      if (flip) { tri(d(nose), d(tip), d(root), col); tri(d(root), d(tip), d(back), col); } else { tri(d(nose), d(root), d(tip), col); tri(d(root), d(back), d(tip), col); } }
    tri(nose, ceph(s), [s * 0.2, 0.02, 0.85], top); tri(nose, [s * 0.2, 0.02, 0.85], ceph(s), top); }   // (the horn-like head fins)
  tri([0, 0.03, -0.7], [0.04, 0.03, -2.4], [-0.04, 0.03, -2.4], top); tri([0, 0.03, -0.7], [-0.04, 0.03, -2.4], [0.04, 0.03, -2.4], top);   // (the whip tail)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); return g; }
function flyfishGeo() {   // a flying fish, 0.35 m, its big pectoral fins spread like wings: a dark blue back (what you see from up on the cliff), silver underneath
  const P = [], C = [], tri = (a, b, c, col) => { P.push(...a, ...b, ...c, ...a, ...c, ...b); for (let i = 0; i < 6; i++) C.push(...col); };
  const back = [0.04, 0.08, 0.2], side = [0.75, 0.8, 0.86], fin = [0.12, 0.16, 0.24];
  tri([0, 0.03, 0.18], [0.03, 0, -0.1], [-0.03, 0, -0.1], back); tri([0, -0.03, 0.18], [-0.03, 0, -0.1], [0.03, 0, -0.1], side);
  for (const s of [-1, 1]) tri([s * 0.02, 0.01, 0.1], [s * 0.26, 0.02, -0.02], [s * 0.02, 0.01, -0.08], fin);   // (the "wings")
  tri([0, 0, -0.1], [0, 0.07, -0.2], [0, -0.07, -0.2], back);   // (the forked tail)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); return g; }
// a white-bellied sea eagle, 2.1 m wingspan, facing +z: brown wings, white head, body and tail (wings are separate
// pieces so they can beat)
function eagleParts(mat) {
  const col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const bird = new THREE.Group(), white = [0.92, 0.92, 0.9], brown = [0.28, 0.22, 0.17];
  const body = new THREE.SphereGeometry(0.2, 8, 6); body.scale(0.8, 0.8, 2.2); bird.add(new THREE.Mesh(col(body, white), mat));
  const head = new THREE.SphereGeometry(0.12, 8, 6); head.translate(0, 0.05, 0.48); bird.add(new THREE.Mesh(col(head, white), mat));
  const bill = new THREE.ConeGeometry(0.04, 0.12, 5); bill.rotateX(Math.PI / 2); bill.translate(0, 0.03, 0.62); bird.add(new THREE.Mesh(col(bill, [0.55, 0.55, 0.5]), mat));
  const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.35, 0.18, 0, -0.75, -0.18, 0, -0.75, 0, 0, -0.35, -0.18, 0, -0.75, 0.18, 0, -0.75], 3)); tail.computeVertexNormals(); bird.add(new THREE.Mesh(col(tail, white), mat));
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.BufferGeometry(); w.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.18, s * 1.05, 0, 0.05, 0, 0, -0.22,  0, 0, 0.18, 0, 0, -0.22, s * 1.05, 0, 0.05,  s * 1.05, 0, 0.05, s * 1.05, 0, -0.3, 0, 0, -0.22,  s * 1.05, 0, 0.05, 0, 0, -0.22, s * 1.05, 0, -0.3], 3));
    w.computeVertexNormals(); const m = new THREE.Mesh(col(w, brown), mat); m.userData.side = s; bird.add(m); wings.push(m); }
  const fish = new THREE.Mesh(col(new THREE.BoxGeometry(0.06, 0.08, 0.4), [0.75, 0.78, 0.82]), mat); fish.position.set(0, -0.28, 0.05); fish.visible = false; bird.add(fish);
  return { bird, wings, fish };
}

// white water: splashes, spray and the whale's blow, as soft round points (two sizes)
function splashes(scene, size, n, mistK) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3).fill(-999), vel = new Float32Array(n * 3), life = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.9, color: 0xf4f8fa }));
  pts.frustumCulled = false; scene.add(pts); let k = 0;
  return { pts, emit(x, y, z, vx, vy, vz, spread, count, up = 1) { for (let i = 0; i < count; i++) { k = (k + 1) % n; pos[k * 3] = x + (Math.random() - 0.5) * spread; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z + (Math.random() - 0.5) * spread;
      vel[k * 3] = vx + (Math.random() - 0.5) * spread * 2; vel[k * 3 + 1] = vy * up * (0.5 + Math.random() * 0.8); vel[k * 3 + 2] = vz + (Math.random() - 0.5) * spread * 2; life[k] = 1.2 + Math.random() * (mistK ? 2.5 : 1); } },
    update(dt) { for (let i = 0; i < n; i++) { if (life[i] <= 0) continue; life[i] -= dt; if (life[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
      vel[i * 3 + 1] -= (mistK ? 2.2 : 9.8) * dt; if (mistK) { vel[i * 3] *= 1 - dt * 0.8; vel[i * 3 + 2] *= 1 - dt * 0.8; }
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; if (!mistK && pos[i * 3 + 1] < -0.3) life[i] = 0; }
      geo.attributes.position.needsUpdate = true; } };
}

// the foam a big splash leaves on the sea: a soft, broken white patch that spreads and fades
function bursts(group, n) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 40, x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r, s = 3 + Math.random() * 9;
    const gr = c.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - s, y - s, s * 2, s * 2); }
  const tex = new THREE.CanvasTexture(cv), plane = new THREE.PlaneGeometry(2, 2); plane.rotateX(-Math.PI / 2);
  const B = Array.from({ length: n }, () => { const r = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })); r.visible = false; group.add(r); return { r, t: 99 }; });
  let k = 0;
  return { fire(x, z, h, rad) { const b = B[k = (k + 1) % n]; Object.assign(b, { t: 0, rad }); b.r.position.set(x, 0.2, z); b.r.rotation.y = Math.random() * 6; b.r.visible = true; },
    update(dt) { for (const b of B) { if (b.t > 10) continue; b.t += dt; const rr = b.rad * (0.8 + b.t * 0.35); b.r.scale.set(rr, 1, rr); b.r.material.opacity = Math.min(1, b.t * 3) * Math.max(0, 1 - b.t / 10); if (b.t > 10) b.r.visible = false; } } };
}

export function wildlife(scene, { point }) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const small = splashes(group, 0.45, 500, false), big = splashes(group, 3.2, 900, false), huge = splashes(group, 6.5, 400, false), mist = splashes(group, 2.6, 260, true), foam = bursts(group, 4);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  let T = 0, waves = [];
  const sea = (x, z) => (waves.length ? heightAt(waves, x, z) : 0);

  // ---- dolphins: a pod of 6 comes through every minute or so, porpoising in long low arcs, now and then a high leap
  const DN = 6, dol = new THREE.InstancedMesh(dolphinGeo(), mat, DN); dol.frustumCulled = false; group.add(dol);
  const pod = { on: false, next: 8, t: 0 }, D = Array.from({ length: DN }, (_, i) => ({ off: [(i % 3 - 1) * 3.5 + Math.random(), -(i / 3 | 0) * 5 - Math.random() * 2], ph: Math.random() * 6, amp: 1, above: false }));
  function podStart() {   // across the bay in front of the balcony, 60-140 m out, one way or the other
    const dir = Math.random() < 0.5 ? 1 : -1, zc = point.z - 50 - Math.random() * 50;
    Object.assign(pod, { on: true, t: 0, dur: 30, x0: dir > 0 ? point.x - 170 : point.x - 5, z0: zc, dx: dir * 5.5, dz: (Math.random() - 0.5) * 1.5 }); }
  // ---- turtles: two, grazing on the reef by the rocks and coming up to breathe
  const TN = 2, tur = new THREE.InstancedMesh(turtleGeo(), mat, TN); tur.frustumCulled = false; group.add(tur);
  const TU = Array.from({ length: TN }, (_, i) => ({ x: point.x - 18 - i * 9, z: point.z - 8 + i * 14, h: Math.random() * 6, t: Math.random() * 20, up: 0, sw: Math.random() * 6 }));
  // ---- the humpback (and, in one show, her calf). On its own it just comes up to blow and roll, and dives; the big
  // moves (breaching, tail slapping) are shows. plan: [[at s, move], ...] a show gives it to play through
  const whaleGeom = whaleGeo(), whale = new THREE.Mesh(whaleGeom, mat), calf = new THREE.Mesh(whaleGeom, mat);
  for (const m of [whale, calf]) { m.frustumCulled = false; m.visible = false; group.add(m); }
  const W = { m: whale, k: 1, st: 'away', t: 0, next: 20, n: 0, x: 0, z: 0, yaw: 0, plan: null, clock: 0 }, C = { m: calf, k: 0.42, st: 'away', t: 0, plan: null, clock: 0, x: 0, z: 0, yaw: 0 };
  let notify = null, sound = null;   // (sound(kind, x, z): the game plays it, late by the distance)
  const outBack = (A) => { A.x = 100 + Math.random() * 70; A.z = -55 - Math.random() * 40; A.yaw = Math.PI / 2 + (Math.random() - 0.5) * 0.8; };   // (out the back, clear of the swells still coming in: ~180-220 m from the balcony)
  const start = (A, kind) => { Object.assign(A, { st: kind, t: 0, blown: false, hit: false, slap: 0 }); A.m.visible = true; };
  function whaleEvent() {   // (on its own: up to breathe, and now and then a dive)
    if (W.st === 'away') outBack(W);
    W.n++; start(W, W.n % 3 === 0 ? 'dive' : 'roll');
  }
  // one step of a whale's move; true when it's done (A.k: its size, 1 the mother, less for the calf)
  const TIP = new THREE.Vector3();
  function stepWhale(A, dt) {
    A.t += dt; const t = A.t, k = A.k, fx = Math.sin(A.yaw), fz = Math.cos(A.yaw), n = (c) => Math.max(4, Math.round(c * k * k)); let cy = -3 * k, pitch = 0, roll = 0, dur = 6;
    if (A.st === 'roll') {   // up to breathe: the blow, then the long back rolls over, the little dorsal, and under
      dur = 7; const u = t / dur; cy = (-2.2 + 1.6 * Math.sin(Math.PI * u)) * k; pitch = 0.3 * Math.cos(Math.PI * u); A.x += fx * 2.2 * dt; A.z += fz * 2.2 * dt;
      if (!A.blown && t > 1.2) { A.blown = true; mist.emit(A.x + fx * 5 * k, 0.5, A.z + fz * 5 * k, 0, 7 * k, 0, 0.6, n(90)); if (sound) sound('blow', A.x, A.z); } }
    else if (A.st === 'dive') {   // the tail comes up out of the water and slides under
      dur = 6; const u = t / dur; A.x += fx * 1.8 * dt; A.z += fz * 1.8 * dt; pitch = -0.15 - 1.15 * Math.min(1, u * 1.6); cy = (-1.2 - 4 * u) * k;
      if (!A.blown && t > 0.3) { A.blown = true; mist.emit(A.x + fx * 5 * k, 0.5, A.z + fz * 5 * k, 0, 7 * k, 0, 0.6, n(70)); }
      if (u > 0.55 && !A.hit) { A.hit = true; big.emit(A.x - fx * 6 * k, 0.5, A.z - fz * 6 * k, 0, 4, 0, 1.5 * k, n(60)); } }
    else if (A.st === 'lobtail') {   // head down, the tail up out of the water, slammed down on the surface again and again
      dur = 17; const inn = Math.min(1, t / 1.8, (dur - t) / 1.8), ph = Math.max(0, t - 1.8) * 2 * Math.PI / 2.6, lift = Math.max(0, Math.sin(ph));
      cy = (-10 + 5.6 * inn) * k; pitch = -(0.55 + 0.85 * lift) * inn; roll = 0.35 * Math.sin(ph * 0.5);   // (the tail stock and flukes 3 m up at the top of the swing, down flat on the water at the bottom)
      const down = Math.sin(ph) <= 0 && A.slap > 0 && t < dur - 2.5; A.slap = Math.sin(ph);
      if (down) { A.m.updateMatrixWorld(); TIP.set(0, 0, -7.6).applyMatrix4(A.m.matrixWorld);   // (the flukes hit the water: a boom and a wall of spray)
        big.emit(TIP.x, 0.3, TIP.z, 0, 9, 0, 2.5, 220); huge.emit(TIP.x, 0.5, TIP.z, 0, 7, 0, 2.5, 60); foam.fire(TIP.x, TIP.z, 5, 4); if (sound) sound('slap', TIP.x, TIP.z); } }
    else {   // the breach: straight up out of the sea, twisting, and over onto its side
      dur = 8; if (t < 1.5) { const u = t / 1.5; cy = (-10 + 14 * (1 - (1 - u) * (1 - u))) * k; pitch = 1.3; roll = 1.4 * u; }
      else if (t < 2.7) { const u = (t - 1.5) / 1.2; cy = (4 - 5 * u * u) * k; pitch = 1.3 - 1.25 * u; roll = 1.4 + 0.6 * u; A.x += fx * 3 * k * dt; A.z += fz * 3 * k * dt; }
      else { const u = (t - 2.7) / 5.3; cy = (-1 - 5 * u) * k; pitch = 0.05; roll = 2; }
      if (t > 0.9 && !A.blown) { A.blown = true; big.emit(A.x, 0.3, A.z, 0, 9 * k, 0, 3 * k, n(160)); huge.emit(A.x, 0.5, A.z, 0, 6 * k, 0, 3 * k, n(50)); foam.fire(A.x, A.z, 6, 5 * k); }   // (bursting out)
      if (t > 2.6 && !A.hit) { A.hit = true; big.emit(A.x + fx * 2 * k, 0.3, A.z + fz * 2 * k, 0, 16 * k, 0, 6 * k, n(400)); big.emit(A.x, 0.3, A.z, 0, 7 * k, 0, 10 * k, n(300)); huge.emit(A.x + fx * 3 * k, 0.5, A.z + fz * 3 * k, 0, 13 * k, 0, 5 * k, n(160)); huge.emit(A.x, 0.5, A.z, 0, 6 * k, 0, 9 * k, n(120)); foam.fire(A.x + fx * 3 * k, A.z + fz * 3 * k, 14, 11 * k); if (sound) sound(k < 1 ? 'slap' : 'crash', A.x, A.z); } }   // (the crash)
    e.set(-pitch, A.yaw, roll); q.setFromEuler(e); A.m.quaternion.copy(q); A.m.position.set(A.x, cy, A.z); A.m.scale.setScalar(k);
    if (t > dur) { A.m.visible = false; return true; }
    return false;
  }
  // a whale with a plan (a show) plays it through, move by move at its times
  function planWhale(A, dt) {
    A.clock += dt;
    if (A.st !== 'idle' && A.st !== 'away' && stepWhale(A, dt)) A.st = 'idle';
    if (A.st === 'idle' && A.plan.length && A.clock >= A.plan[0][0]) start(A, A.plan.shift()[1]);
    if (A.st === 'idle' && !A.plan.length) { A.plan = null; A.st = 'away'; if (A === W) W.next = 20 + Math.random() * 20; }
  }

  // ---- manta rays: three gliding past the rocks under the balcony, wingtips breaking the surface; one jumps
  const mantaG = mantaGeo(), mantaMat = Object.assign(mat.clone(), { side: THREE.DoubleSide }), MANTA = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(mantaG, mantaMat); m.frustumCulled = false; m.visible = false; group.add(m); return { m }; });
  // ---- flying fish: a school launching in bursts and gliding a few metres over the water
  const FN = 42, ffish = new THREE.InstancedMesh(flyfishGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.3, side: THREE.DoubleSide }), FN);
  ffish.frustumCulled = false; ffish.visible = false; group.add(ffish); const FF = Array.from({ length: FN }, () => ({}));
  // ---- the sea eagle
  const EG = eagleParts(mat); EG.bird.visible = false; EG.bird.scale.setScalar(1.8); group.add(EG.bird);   // (on the big side, so it reads from the balcony)

  // ---- the shows: a note, five seconds, then the show, about every two minutes (never the same one twice running)
  const SHOWS = {
    breach: 'A humpback is about to breach out the back. Tap ZOOM!',
    lobtail: 'The humpback is slapping its tail out the back. Tap ZOOM!',
    calf: 'A mother humpback and her calf, out the back. Tap ZOOM!',
    dolphins: 'Dolphins coming in under the cliff. Look down!',
    mantas: 'Manta rays by the rocks below the balcony!',
    eagle: 'A sea eagle is hunting in front of the villa!',
    flyfish: 'Flying fish skipping across the bay. Tap ZOOM!',
  };
  const SH = { next: 25, wait: 0, kind: null, on: null, t: 0, last: null };
  function showStart(kind) {
    SH.on = kind; SH.t = 0;
    if (kind === 'breach' || kind === 'lobtail' || kind === 'calf') {
      outBack(W); W.x = 115 + Math.random() * 40; W.z = -40 - Math.random() * 25; W.st = 'idle'; W.m.visible = false; W.clock = 0;   // (a little nearer than usual)
      W.plan = kind === 'breach' ? [[0, 'breach'], [11, 'breach']].concat(Math.random() < 0.6 ? [[22, 'breach']] : []) : kind === 'lobtail' ? [[0, 'lobtail']] : [[0, 'breach'], [13, 'roll']];
      if (kind === 'calf') { Object.assign(C, { x: W.x + Math.cos(W.yaw) * 14, z: W.z - Math.sin(W.yaw) * 14, yaw: W.yaw, st: 'idle', clock: 0, plan: [[4.5, 'breach'], [13.5, 'roll']] }); }
    } else if (kind === 'dolphins') {   // in close, 20-35 m out from the foot of the cliff, leaping high and spinning
      const dir = Math.random() < 0.5 ? 1 : -1; Object.assign(pod, { on: true, show: true, t: 0, dur: 32, x0: dir > 0 ? point.x - 120 : point.x + 20, z0: point.z - 22 - Math.random() * 12, dx: dir * 4.5, dz: 0 });
    } else if (kind === 'mantas') {
      const dir = Math.random() < 0.5 ? 1 : -1;
      MANTA.forEach((M, i) => Object.assign(M, { x: point.x - 28 - dir * (40 + i * 7), z: point.z - 16 - i * 4 + Math.random() * 3, dx: dir * 3, ph: Math.random() * 6, jump: i === 1 ? 9 + Math.random() * 3 : null, jt: -1 }));
      MANTA.forEach((M) => { M.m.visible = true; });
    } else if (kind === 'eagle') {
      Object.assign(EG, { t: 0, cx: point.x - 22, cz: point.z - 28, a: Math.random() * 6, grabbed: false }); EG.bird.visible = true; EG.fish.visible = false;   // (circling just off the balcony, a little above you)
    } else if (kind === 'flyfish') {
      const cx = point.x - 32, cz = point.z - 34, hd = Math.random() * 6.3;   // (40-odd metres off the balcony)
      FF.forEach((f, i) => Object.assign(f, { at: (i / 7 | 0) * 2.2 + Math.random() * 0.6, x0: cx + (Math.random() - 0.5) * 30, z0: cz + (Math.random() - 0.5) * 30, hd: hd + (Math.random() - 0.5) * 0.4, len: 30 + Math.random() * 25, dur: 2.8 + Math.random() * 1.6, h: 1 + Math.random() * 0.9, st: 0 }));
      ffish.visible = true;
    }
  }
  function showStep(dt) {
    SH.t += dt; const t = SH.t, k = SH.on;
    if (k === 'breach' || k === 'lobtail' || k === 'calf') { if (!W.plan && (!C.plan || k !== 'calf')) return true; }
    else if (k === 'dolphins') { if (!pod.on) { pod.show = false; return true; } }
    else if (k === 'mantas') {
      let done = true;
      MANTA.forEach((M, i) => { M.x += M.dx * dt; M.ph += dt * 2 * Math.PI / 3.2; const s = sea(M.x, M.z), flap = Math.sin(M.ph);
        let y = s + 0.05, pitch = 0, roll = 0.18 * Math.sin(M.ph * 0.5);
        if (M.jump != null && t > M.jump && M.jt < 0) { M.jt = 0; small.emit(M.x, s, M.z, M.dx * 0.3, 4, 0, 1, 25); }
        if (M.jt >= 0 && M.jt < 1.6) { M.jt += dt; const u = M.jt / 1.6; y = s + 3.2 * Math.sin(Math.PI * u); pitch = 0.9 - 1.6 * u; roll = 0.3;   // (out of the water, nose up, over and flat onto its belly)
          if (M.jt >= 1.6) { big.emit(M.x, s, M.z, 0, 7, 0, 2, 160); foam.fire(M.x, M.z, 4, 3); if (sound) sound('slap', M.x, M.z); } }
        else if (flap > 0.93 && Math.random() < dt * 3) small.emit(M.x + (Math.random() < 0.5 ? 1.8 : -1.8), s, M.z, 0, 1.5, 0, 0.2, 4);   // (a wingtip flicking water)
        e.set(-pitch, Math.atan2(M.dx, 0), roll); q.setFromEuler(e); M.m.quaternion.copy(q); M.m.position.set(M.x, y, M.z); M.m.scale.set(1 + 0.08 * flap, 1, 1);
        if (Math.abs(M.x - point.x + 28) < 70) done = false; });
      if (done || t > 45) { MANTA.forEach((M) => { M.m.visible = false; }); return true; }
    } else if (k === 'eagle') {
      const B = EG.bird, W1 = EG.wings; let pitch = 0, bank = 0, beat = 0.15, yaw;
      if (t < 9) { EG.a += dt * 0.45; B.position.set(EG.cx + Math.cos(EG.a) * 15, 33 + Math.sin(t * 0.7) * 1.5, EG.cz + Math.sin(EG.a) * 15); yaw = -EG.a; bank = -0.35; beat = Math.sin(t * 0.8) > 0.7 ? 0.9 : 0.1;   // (circling, watching the water)
        if (t + dt >= 9) { EG.from = B.position.clone(); EG.to = new THREE.Vector3(EG.cx + (Math.random() - 0.5) * 6, 0, EG.cz + 8); } }
      else if (t < 11.4) { const u = (t - 9) / 2.4; B.position.lerpVectors(EG.from, EG.to, u).setY(EG.from.y + (sea(EG.to.x, EG.to.z) + 0.3 - EG.from.y) * u * u); yaw = Math.atan2(EG.to.x - EG.from.x, EG.to.z - EG.from.z); pitch = 0.9 * Math.min(1, u * 2) - 1.2 * Math.max(0, u - 0.8) * 5; beat = 0; }   // (the stoop, feet swung forward at the end)
      else { if (!EG.grabbed) { EG.grabbed = true; EG.fish.visible = true; small.emit(B.position.x, sea(B.position.x, B.position.z), B.position.z, 0, 3.5, 0, 0.6, 30); }   // (the strike)
        const u = t - 11.4; yaw = Math.atan2(EG.to.x - EG.from.x, EG.to.z - EG.from.z) + 0.9; B.position.x += Math.sin(yaw) * 9 * dt; B.position.z += Math.cos(yaw) * 9 * dt; B.position.y += (1 + u * 0.9) * dt; pitch = -0.25; beat = 1; }   // (off low with the fish, climbing away)
      e.set(pitch, yaw, bank); q.setFromEuler(e); B.quaternion.copy(q);
      const fl = Math.sin(t * 7) * beat; for (const w of W1) w.rotation.z = w.userData.side * (0.12 + fl * 0.55) - (beat === 0 && t > 9 ? w.userData.side * 0.5 : 0);
      if (t > 22) { B.visible = false; return true; }
    } else if (k === 'flyfish') {
      let alive = false;
      FF.forEach((f, i) => { let y = -5, x = f.x0, z = f.z0;
        if (t >= f.at) { const u = (t - f.at) / f.dur;
          if (u < 1) { alive = true; x = f.x0 + Math.sin(f.hd) * f.len * u; z = f.z0 + Math.cos(f.hd) * f.len * u; y = sea(x, z) + f.h * Math.min(1, u * 6) * (1 - Math.pow(u, 6)) + 0.1;
            if (f.st === 0) { f.st = 1; small.emit(x, sea(x, z), z, 0, 1.5, 0, 0.1, 3); } }
          else if (f.st === 1) { f.st = 2; x = f.x0 + Math.sin(f.hd) * f.len; z = f.z0 + Math.cos(f.hd) * f.len; small.emit(x, sea(x, z), z, 0, 1.6, 0, 0.15, 4); } }
        else alive = true;
        e.set(0, f.hd, Math.sin(t * 9 + i) * 0.15); q.setFromEuler(e); ffish.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc.setScalar(3))); });   // (big for a flying fish, so the school reads from up here)
      ffish.instanceMatrix.needsUpdate = true;
      if (!alive) { ffish.visible = false; return true; }
    }
    return t > 60;
  }

  function update(dt, wv) {
    if (!group.visible) return; T += dt; waves = wv || [];
    small.update(dt); big.update(dt); huge.update(dt); mist.update(dt); foam.update(dt);
    // dolphins
    if (!pod.on && (pod.next -= dt) <= 0 && SH.on !== 'dolphins' && !SH.kind) podStart();
    if (pod.on) { pod.t += dt; const px = pod.x0 + pod.dx * pod.t, pz = pod.z0 + pod.dz * pod.t;
      D.forEach((d, i) => { d.ph += dt * 2 * Math.PI / 1.7; if (d.ph > Math.PI * 2) { d.ph -= Math.PI * 2; const high = Math.random() < (pod.show ? 0.45 : 0.15); d.amp = high ? (pod.show ? 3 : 2.6) : 0.9 + Math.random() * 0.4; d.spin = pod.show && high && Math.random() < 0.5; }
        const s = Math.sin(d.ph), y = (d.amp * 0.9) * s - 0.55, vy = d.amp * 0.9 * Math.cos(d.ph) * 2 * Math.PI / 1.7, x = px + d.off[1] * Math.sign(pod.dx), z = pz + d.off[0] + Math.sin(T * 0.3 + i) * 1.5;
        const surf = sea(x, z), above = y > 0.1;
        if (above !== d.above) { small.emit(x, surf, z, pod.dx * 0.3, 3.5, 0, 0.5, above ? 8 : 16); d.above = above; }
        e.set(-Math.atan2(vy, Math.abs(pod.dx)), Math.atan2(pod.dx, pod.dz), d.spin && above ? d.ph * 2 : 0); q.setFromEuler(e);   // (a spinner: twice round in the air)
        dol.setMatrixAt(i, m4.compose(v.set(x, surf + y, z), q, sc.set(1, 1, 1))); });
      dol.instanceMatrix.needsUpdate = true; dol.visible = true;
      if (pod.t > pod.dur) { pod.on = false; pod.show = false; pod.next = 45 + Math.random() * 50; dol.visible = false; } }
    // turtles: ~25 s gliding below, ~7 s at the top breathing, head up
    TU.forEach((t, i) => { t.t += dt; t.sw += dt * 1.6; const cyc = t.t % 32, up = cyc > 25 ? Math.min(1, (cyc - 25) * 1.5, (32 - cyc) * 1.5) : 0;
      t.x += Math.sin(t.t * 0.08 + i) * dt * 0.4; t.z += Math.cos(t.t * 0.06 + i * 2) * dt * 0.4;
      if (up > 0.95 && !t.breathed) { small.emit(t.x, sea(t.x, t.z), t.z + 0.5, 0, 1.2, 0, 0.2, 5); t.breathed = true; } if (up < 0.1) t.breathed = false;
      e.set(-0.12 + 0.1 * Math.sin(t.sw), t.t * 0.05 + i * 2, 0.05 * Math.sin(t.sw * 0.5)); q.setFromEuler(e);
      tur.setMatrixAt(i, m4.compose(v.set(t.x, sea(t.x, t.z) - 1.3 + up * 1.22, t.z), q, sc.set(1, 1, 1))); });
    tur.instanceMatrix.needsUpdate = true;
    // the whale: on its own, blowing and rolling; with a show's plan, the show's moves
    if (W.plan) planWhale(W, dt);
    else if (W.st === 'away' || W.st === 'wait') { if ((W.next -= dt) <= 0 && !SH.kind) whaleEvent(); }
    else if (stepWhale(W, dt)) { W.st = 'wait'; W.next = 14 + Math.random() * 16; if (W.n % 4 === 0) { W.st = 'away'; W.next = 40 + Math.random() * 40; } }
    if (C.plan) planWhale(C, dt);
    // the shows
    if (SH.on) { if (showStep(dt)) { SH.on = null; SH.next = 110 + Math.random() * 30; } }
    else if (SH.kind) { if ((SH.wait -= dt) <= 0) { showStart(SH.kind); SH.last = SH.kind; SH.kind = null; } }
    else if ((SH.next -= dt) <= 0) { const ks = Object.keys(SHOWS).filter((k) => k !== SH.last); SH.kind = ks[Math.random() * ks.length | 0]; SH.wait = 5; if (notify) notify(SHOWS[SH.kind]); }
  }
  // show(kind): put one on now (the note, then five seconds); tests use it
  return { group, update, whale: W, pod, shows: SH, show(kind) { SH.kind = kind; SH.wait = 5; SH.on = null; if (notify) notify(SHOWS[kind]); },
    splash(x, z) { small.emit(x, 0.2, z, 0, 3.2, 0, 0.5, 22); }, set notify(f) { notify = f; }, set sound(f) { sound = f; } };   // (splash: a bird hitting the water)
}
