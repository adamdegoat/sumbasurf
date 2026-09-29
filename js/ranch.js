// The Sumba Ranch (the Surf Ranch till 29 Sep 2026): a huge wave pool in open country. A long concrete basin with a machine running on a rail along the
// deep wall (it pulls the wave along the pool, so it sits right at the breaking point), light towers, palms along the
// deck, a clubhouse and a small grandstand. The water and the wave are the same as the ocean's, clipped to the pool.
import * as THREE from 'three';

// the pool, in the same world coordinates the waves use: waves run toward +z (the shallow end) and peel toward +x
export const POOL = { x0: -90, x1: 470, z0: -45, z1: 250, deck: 1.6 };   // (the machine wall is ~37 m in front of where you wait)

export function ranch(scene) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const mats = new Map(), lam = (c) => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
  const box = (w, h, d, c, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); parent.add(m); return m; };
  const P = POOL, D = P.deck, DW = 12;
  const slab = (x0, x1, z0, z1, c, top) => box(x1 - x0, 0.6, z1 - z0, c, (x0 + x1) / 2, top - 0.3, (z0 + z1) / 2);

  // the deck: a band of pale concrete all round the pool, then lawn out to the horizon, then dry grass
  const DECK = 0xd3cec4, LAWN = 0x6f9a4c, DRY = 0xa9a06a;
  slab(P.x0 - DW, P.x1 + DW, P.z0 - DW, P.z0, DECK, D); slab(P.x0 - DW, P.x1 + DW, P.z1, P.z1 + DW, DECK, D);
  slab(P.x0 - DW, P.x0, P.z0, P.z1, DECK, D); slab(P.x1, P.x1 + DW, P.z0, P.z1, DECK, D);
  const L = 160;   // lawn ring
  slab(P.x0 - DW - L, P.x1 + DW + L, P.z0 - DW - L, P.z0 - DW, LAWN, D - 0.05); slab(P.x0 - DW - L, P.x1 + DW + L, P.z1 + DW, P.z1 + DW + L, LAWN, D - 0.05);
  slab(P.x0 - DW - L, P.x0 - DW, P.z0 - DW, P.z1 + DW, LAWN, D - 0.05); slab(P.x1 + DW, P.x1 + DW + L, P.z0 - DW, P.z1 + DW, LAWN, D - 0.05);
  { const R = 1500, a = P.x0 - DW - L, b = P.x1 + DW + L, c = P.z0 - DW - L, d = P.z1 + DW + L;   // dry country beyond
    slab(-R, R, -R, c, DRY, D - 0.1); slab(-R, R, d, R, DRY, D - 0.1); slab(-R, a, c, d, DRY, D - 0.1); slab(b, R, c, d, DRY, D - 0.1); }

  // the pool walls (inside faces show above the water) with a dark waterline band
  const WALL = 0xbfb9ae, LINE = 0x5f6b6a, H = D + 4;
  const wall = (x0, x1, z0, z1) => { box(Math.max(1, x1 - x0), H, Math.max(1, z1 - z0), WALL, (x0 + x1) / 2, D - H / 2, (z0 + z1) / 2); };
  wall(P.x0 - 1, P.x1 + 1, P.z0 - 1, P.z0); wall(P.x0 - 1, P.x1 + 1, P.z1, P.z1 + 1); wall(P.x0 - 1, P.x0, P.z0, P.z1); wall(P.x1, P.x1 + 1, P.z0, P.z1);
  box(P.x1 - P.x0, 0.35, 0.05, LINE, (P.x0 + P.x1) / 2, 0.1, P.z0 + 0.03); box(P.x1 - P.x0, 0.35, 0.05, LINE, (P.x0 + P.x1) / 2, 0.1, P.z1 - 0.03);
  box(0.05, 0.35, P.z1 - P.z0, LINE, P.x0 + 0.03, 0.1, (P.z0 + P.z1) / 2); box(0.05, 0.35, P.z1 - P.z0, LINE, P.x1 - 0.03, 0.1, (P.z0 + P.z1) / 2);

  // the wave machine: a wall of generator chambers along the deep end, right in front of you while you wait. Each
  // chamber is a tall housing with a light panel facing the pool; the lights show the machine working (they pulse
  // when you order a wave, then sweep along the wall with the breaking point as it makes the wave).
  const CH = 5, NC = Math.floor((P.x1 - P.x0) / CH), cz = P.z0 - 2.2;
  const hou = new THREE.InstancedMesh(new THREE.BoxGeometry(CH - 0.35, 7, 4.2), lam(0x3c4a57), NC);
  const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(CH - 0.2, 0.5, 4.6), lam(0xe9e6de), NC);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(CH - 1.2, 1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), NC);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < NC; i++) { const x = P.x0 + CH / 2 + i * CH;
    hou.setMatrixAt(i, mm.makeTranslation(x, D + 1.5, cz)); cap.setMatrixAt(i, mm.makeTranslation(x, D + 5.25, cz));
    lights.setMatrixAt(i, mm.makeTranslation(x, D + 3.4, P.z0 - 0.02)); lights.setColorAt(i, new THREE.Color(0x1b4d5c)); }
  g.add(hou, cap, lights);
  box(P.x1 - P.x0, 1.2, 0.3, 0x2b3640, (P.x0 + P.x1) / 2, D + 1.4, P.z0 - 0.05);   // the wall face below the lights
  // big lettering on the machine roof you can read from the pool: a painted band
  // the shallow end: a sandy beach the waves run up onto, so you can see which way they're going
  { const bw = 28, geo = new THREE.PlaneGeometry(P.x1 - P.x0, bw, 40, 6); geo.rotateX(-Math.PI / 2);
    const pp = geo.attributes.position, c = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const t = (pp.getZ(i) + bw / 2) / bw; pp.setY(i, -0.9 + 2.6 * t); const k = 0.92 + Math.random() * 0.1, dry = Math.min(1, t * 1.6);
      c[i * 3] = (0.62 + 0.24 * dry) * k; c[i * 3 + 1] = (0.56 + 0.24 * dry) * k; c[i * 3 + 2] = (0.44 + 0.22 * dry) * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    const beach = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); beach.position.set((P.x0 + P.x1) / 2, 0, P.z1 - bw / 2); g.add(beach); }

  // light towers along both long sides
  const tower = (x, z) => { box(0.7, 24, 0.7, 0x8e959a, x, D + 12, z); box(4, 1.4, 1, 0xe9e7df, x, D + 24.5, z); };
  for (let x = P.x0 + 20; x < P.x1; x += 75) { tower(x, P.z0 - DW + 2); tower(x, P.z1 + DW - 2); }

  // palms along the far deck and round the clubhouse (instanced: one trunk and one crown shape, many copies)
  {
    const trunkG = new THREE.CylinderGeometry(0.18, 0.3, 9, 6, 4); trunkG.translate(0, 4.5, 0);
    { const p = trunkG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.012 * y * y); } }   // a gentle lean
    const crown = []; const leaf = (a) => { const c = Math.cos(a), s = Math.sin(a); const tip = [c * 3.6, -1.1, s * 3.6], sd = [-s * 0.45, 0, c * 0.45];
      crown.push(0, 0, 0, tip[0] * 0.5 + sd[0], 0.35, tip[2] * 0.5 + sd[2], ...tip, 0, 0, 0, ...tip, tip[0] * 0.5 - sd[0], 0.35, tip[2] * 0.5 - sd[2]); };
    for (let i = 0; i < 9; i++) leaf(i / 9 * Math.PI * 2 + (i % 2) * 0.2);
    const crownG = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(crown), 3)); crownG.computeVertexNormals(); crownG.translate(1.0, 9, 0);
    const spots = [];
    for (let x = P.x0 + 5; x < P.x1; x += 28) spots.push([x + (Math.random() - 0.5) * 6, P.z1 + DW + 6 + Math.random() * 8]);
    for (let x = P.x0 + 30; x < P.x1; x += 55) spots.push([x + (Math.random() - 0.5) * 8, P.z0 - DW - 10 - Math.random() * 10]);
    for (let i = 0; i < 10; i++) spots.push([P.x0 - DW - 20 - Math.random() * 60, P.z0 - DW - 60 + Math.random() * 120]);
    const trunks = new THREE.InstancedMesh(trunkG, lam(0x7a6650), spots.length);
    const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshLambertMaterial({ color: 0x3f6b2e, side: THREE.DoubleSide }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    spots.forEach(([x, z], i) => { const s = 0.85 + Math.random() * 0.4; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28); sc.setScalar(s); pos.set(x, D - 0.05, z); m.compose(pos, q, sc); trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m); });
    g.add(trunks, crowns);
  }

  // the clubhouse at the start end: long, low and white with a glass front and a deep roof, and a grandstand along the
  // deep side where people watch the waves come down the pool
  { const cx = P.x0 - 45, cz = P.z0 - 45;
    box(48, 7, 18, 0xf0eee8, cx, D + 3.5, cz); box(48.2, 3.2, 0.3, 0x2c4655, cx, D + 3.6, cz + 9.05);
    box(54, 0.7, 24, 0xe2ded5, cx, D + 7.35, cz + 1.5); box(2, 7, 2, 0xf0eee8, cx - 26, D + 3.5, cz + 12); box(2, 7, 2, 0xf0eee8, cx + 26, D + 3.5, cz + 12);
    for (let i = 0; i < 6; i++) box(90, 0.8, 2.2, 0x9aa2a8, 60, D + 0.4 + i * 0.8, P.z0 - DW - 16 - i * 2.2);   // stepped seating
    box(92, 0.4, 16, 0xf3f1ec, 60, D + 9, P.z0 - DW - 21); for (const x of [16, 104]) box(0.6, 8, 0.6, 0x8e959a, x, D + 5, P.z0 - DW - 27);   // shade canopy
  }

  // a long, low mountain range far off across the flat country, hazy blue (overlapping flattened ridges, not domes)
  { const hm = [new THREE.MeshBasicMaterial({ color: 0xa9bcc6 }), new THREE.MeshBasicMaterial({ color: 0x9db2bd }), new THREE.MeshBasicMaterial({ color: 0xb7c7cd })];
    const ridge = (cx, cz, a, len, h, k) => { const m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 5, 1), hm[k % 3]); m.scale.set(len, h, len * 0.35); m.position.set(cx, D - 4 + h / 2, cz); m.rotation.y = a; g.add(m); };
    for (let i = 0; i < 26; i++) { const a = -0.9 + i * 0.075 + (Math.random() - 0.5) * 0.04, r = 1250 + Math.random() * 120;   // along the north and east horizon
      ridge(190 + Math.sin(a) * r, 90 - Math.cos(a) * r, a + Math.PI / 2, 90 + Math.random() * 110, 55 + Math.random() * 75, i); } }

  // white coping round the pool edge (reads as a pool, not a lake, from down in the water)
  const COP = 0xf4f2ec, cw = 0.6;
  box(P.x1 - P.x0 + 2 * cw, 0.25, cw, COP, (P.x0 + P.x1) / 2, D + 0.12, P.z0 - cw / 2); box(P.x1 - P.x0 + 2 * cw, 0.25, cw, COP, (P.x0 + P.x1) / 2, D + 0.12, P.z1 + cw / 2);
  box(cw, 0.25, P.z1 - P.z0, COP, P.x0 - cw / 2, D + 0.12, (P.z0 + P.z1) / 2); box(cw, 0.25, P.z1 - P.z0, COP, P.x1 + cw / 2, D + 0.12, (P.z0 + P.z1) / 2);

  // ---- which way is which (29 Sep 2026): the pool's name over the machine right in front of where you wait, a band of
  // arrows along the machine roof pointing the way the wave runs (+x), a line of buoys between you and the machine
  // showing the line the wave comes along, and distance boards on the beach deck counting up the way you ride
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const panel = (w, h, t, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  const FONT = (px) => `900 ${px}px "Barlow Condensed", "Helvetica Neue", Arial, sans-serif`;
  const WAIT_X = 4;   // (you wait about here: see spawnRider)
  // the name, big, over the machine in front of you
  panel(46, 5.2, tex(1840, 208, (c, w, h) => { c.fillStyle = '#f2b705'; c.fillRect(0, 0, w, h); c.fillStyle = '#15110c'; c.font = FONT(150); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SUMBA RANCH', w / 2, h / 2 + 10); }), WAIT_X, D + 8.4, P.z0 - 1.2);
  for (const x of [WAIT_X - 21, WAIT_X + 21]) box(0.5, 3, 0.5, 0x2b3640, x, D + 6.3, P.z0 - 1.4);   // (its legs on the machine roof)
  // arrows along the roof, pointing down the pool the way you ride
  { const t = tex(1024, 128, (c, w, h) => { c.fillStyle = '#15110c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffc978'; for (let i = 0; i < 8; i++) { const x0 = i * 128 + 30; c.beginPath(); c.moveTo(x0, 18); c.lineTo(x0 + 44, 18); c.lineTo(x0 + 88, 64); c.lineTo(x0 + 44, 110); c.lineTo(x0, 110); c.lineTo(x0 + 44, 64); c.closePath(); c.fill(); } });
    t.wrapS = THREE.RepeatWrapping; const len = P.x1 - (WAIT_X + 26) - 10; t.repeat.set(len / 16, 1);
    panel(len, 2, t, WAIT_X + 26 + len / 2, D + 6.6, P.z0 - 0.6); }
  // the buoys: orange floats with a white band, 12 m out from the machine, every 12 m along the pool (they ride up and
  // over each wave: the game moves them, see ranchBuoys)
  const buoyX = []; for (let x = P.x0 + 14; x < P.x1 - 8; x += 12) buoyX.push(x);
  const BZ = P.z0 + 22;   // (between you and the machine: you never ride through them)
  const buoyG = new THREE.SphereGeometry(0.55, 12, 8); buoyG.scale(1, 0.8, 1);
  const buoys = new THREE.InstancedMesh(buoyG, lam(0xf06a22), buoyX.length), bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.57, 0.57, 0.16, 12), lam(0xf6f2ea), buoyX.length);
  buoys.frustumCulled = false; bands.frustumCulled = false; g.add(buoys, bands);   // (moved every frame: their bounds would be stale)
  // distance boards along the beach deck, facing the pool: 50 m, 100 m ... from where you wait
  const board = (label, x) => { const t = tex(512, 224, (c, w, h) => { c.fillStyle = '#ffc978'; c.fillRect(0, 0, w, h); c.strokeStyle = '#15110c'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14); c.fillStyle = '#15110c'; c.font = FONT(150); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2 + 8); });
    const pn = panel(13, 5.7, t, x, D + 8.5, P.z1 + 3, -Math.PI * 0.72); for (const s of [-1, 1]) box(0.45, 11.4, 0.45, 0x3b3f42, x + s * 5.6 * Math.cos(Math.PI * 0.28), D + 5.7, P.z1 + 3.2 + s * 5.6 * Math.sin(Math.PI * 0.28)); };   // (big enough to read from out in the pool)   // (turned toward you as you ride down the pool, not edge-on)
  for (let d = 50; WAIT_X + d < P.x1 - 20; d += 50) board(d + ' m', WAIT_X + d);
  // flags on poles along the beach deck, and umbrellas and loungers in groups (where the people watch from)
  { const n = Math.floor((P.x1 - P.x0) / 22), poleI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 5), lam(0xd8d4cc), n);
    const fg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, -1.4, 0, 2.2, -0.7, 0]), 3)); fg.computeVertexNormals();
    const flagI = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), n), cols = [0xffc978, 0x1f6f6a, 0xff8e6e, 0xf6f2ea];
    for (let i = 0; i < n; i++) { const x = P.x0 + 11 + i * 22; poleI.setMatrixAt(i, mm.makeTranslation(x, D + 3, P.z1 + 10.5)); flagI.setMatrixAt(i, mm.makeTranslation(x, D + 6, P.z1 + 10.5)); flagI.setColorAt(i, new THREE.Color(cols[i % 4])); }
    g.add(poleI, flagI); }
  const seats = [];   // (where people sit or stand to watch: the game puts them there, see ranchPeople)
  { const U = [], canopyG = new THREE.ConeGeometry(1.7, 0.7, 10, 1, true); canopyG.translate(0, 2.55, 0);
    const groups = [60, 118, 176, 234, 292, 350, 408];
    for (const gx of groups) for (let k = 0; k < 2; k++) U.push([gx + k * 7 + (Math.random() - 0.5) * 2, P.z1 + 4.2 + (Math.random() - 0.5) * 1.2]);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), lam(0xe8e4dc), U.length), can = new THREE.InstancedMesh(canopyG, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), U.length);
    const lounge = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.3, 1.9), lam(0xf4f1ea), U.length * 2), cc = [0xf06a22, 0x1f6f6a, 0xffc978, 0xf6f2ea, 0xc8423a];
    U.forEach(([x, z], i) => { pole.setMatrixAt(i, mm.makeTranslation(x, D + 1.3, z)); can.setMatrixAt(i, mm.makeTranslation(x, D, z)); can.setColorAt(i, new THREE.Color(cc[i % cc.length]));
      for (const s of [-1, 1]) lounge.setMatrixAt(i * 2 + (s > 0), mm.makeTranslation(x + s * 0.9, D + 0.35, z + 1.4)); seats.push([x + 1.6, P.z1 + 1.4]); });
    g.add(pole, can, lounge); }
  // a snack kiosk and a board rack at the start end, by where you paddle out from
  { const kx = P.x0 - 7, kz = P.z0 + 22; box(4.5, 2.6, 3.2, 0xf4f1ea, kx, D + 1.3, kz); box(5.2, 0.25, 4, 0xf06a22, kx, D + 2.75, kz + 0.2);
    for (let i = 0; i < 5; i++) box(0.6, 0.06, 0.8, i % 2 ? 0xf6f2ea : 0xf06a22, kx + 2.3, D + 2.55 - i * 0.02, kz - 1.6 + i * 0.8);
    const rx = P.x0 - 7, rz = P.z0 + 38; box(0.15, 2.4, 3.6, 0x6b4a2a, rx - 0.6, D + 1.2, rz); box(0.15, 2.4, 3.6, 0x6b4a2a, rx + 0.6, D + 1.2, rz);
    const bc = [0xf6f2ea, 0xffc978, 0x9fd3d0, 0xf06a22, 0xf6f2ea]; for (let i = 0; i < 5; i++) { const b = box(1.1, 2.2, 0.08, bc[i], rx, D + 1.3, rz - 1.4 + i * 0.7); b.rotation.z = 0.08; }
    seats.push([P.x0 - 5, P.z0 + 30], [P.x0 - 4.5, P.z0 + 44], [P.x0 - 6, P.z0 + 52]); }
  // the far end, where rides finish: a low stand people watch from
  { const fx = P.x1 + 7; for (let i = 0; i < 4; i++) box(2.2, 0.7, 60, 0x9aa2a8, fx + i * 2.2, D + 0.35 + i * 0.7, P.z0 + 150); seats.push([P.x1 + 5, P.z0 + 136], [P.x1 + 5, P.z0 + 144], [P.x1 + 5, P.z0 + 158], [P.x1 + 5, P.z0 + 166]); }
  // the big stand along the beach side, halfway down the pool: rows of people you can see from out on the water
  const SX0 = 110, SX1 = 370, SZ = P.z1 + 16, ROWS = 6;
  for (let i = 0; i < ROWS; i++) box(SX1 - SX0, 0.8, 2.3, i % 2 ? 0x8f979c : 0x9aa2a8, (SX0 + SX1) / 2, D + 0.4 + i * 0.8, SZ + i * 2.3);
  box(SX1 - SX0 + 4, 0.5, ROWS * 2.3 + 3, 0xf3f1ec, (SX0 + SX1) / 2, D + ROWS * 0.8 + 6.5, SZ + ROWS * 1.15); for (let x = SX0; x <= SX1; x += 26) box(0.5, 6.5, 0.5, 0x8e959a, x, D + ROWS * 0.8 + 3.2, SZ + ROWS * 2.3);   // (a shade roof)
  panel(60, 5, tex(1536, 128, (c, w, h) => { c.fillStyle = '#15110c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffc978'; c.font = FONT(104); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SUMBA RANCH', w / 2, h / 2 + 6); }), (SX0 + SX1) / 2, D + ROWS * 0.8 + 8.2, SZ - 1.6, Math.PI);   // (its name along the roof edge)
  // where the crowd stands behind the front row (the game draws them cheaply, as cut-outs of the same people):
  // [x, z, yaw] facing the water
  const back = [];
  for (const gx of [60, 118, 176, 234, 292, 350, 408]) for (let k = 0; k < 9; k++) back.push([gx - 6 + k * 2.2 + (Math.random() - 0.5) * 0.8, P.z1 + 7 + (k % 3) * 1.3 + Math.random() * 0.6, Math.PI]);
  for (let r = 0; r < ROWS; r++) for (let x = SX0 + 1; x < SX1 - 1; x += 1.25) if (Math.random() < 0.62) back.push([x + (Math.random() - 0.5) * 0.4, SZ + r * 2.3 + 0.3, Math.PI, 0.8 * (r + 1)]);   // (the big stand: seated rows seen from the pool)
  for (let r = 0; r < 4; r++) for (let k = 0; k < 16; k++) if (Math.random() < 0.8) back.push([P.x1 + 7 + r * 2.2 + 1, P.z0 + 124 + k * 3.4 + Math.random(), -Math.PI / 2, 0.7 * (r + 1)]);
  for (let k = 0; k < 7; k++) back.push([P.x0 - 4 - (k % 2) * 1.5, P.z0 + 28 + k * 3.2 + Math.random(), Math.PI / 2]);
  return { group: g, lights, NC, CH, buoys, bands, buoyX, BZ, seats, back };
}
