// The drone light show at the villa: a short story in the sky over the open sea, about a minute and a half. Night
// falls, 400 lit drones rise off the water in a turning spiral, open into a sunrise, swell into a wave that curls and
// breaks again and again, carry a surfer who rides across it and through the barrel, turn into a sea turtle swimming
// and a whale breaching in a burst of spray, spin as a globe and a tilting ring in depth, write SUMBA SURF letter by
// letter, and finish with fireworks. Everything moves all the time: each scene is a function of time for every drone,
// and between scenes they cascade across (left to right) on a swirling path while the colours sweep over.
// Lights pulse with the music's beat. Still just one set of 400 glowing points: nothing for a phone to draw.
import * as THREE from 'three';

const N = 400;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// draw on a canvas, sample n evenly spread lit pixels -> points in metres (width w, centred, y up)
function sample(draw, n, w, W = 320, H = 160) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; draw(x, W, H);
  const d = x.getImageData(0, 0, W, H).data, lit = [];
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) if (d[(j * W + i) * 4 + 3] > 128) lit.push([i, j]);
  for (let k = lit.length - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [lit[k], lit[r]] = [lit[r], lit[k]]; }
  let rad = Math.sqrt(lit.length * 4 / n) * 0.95, out = [];
  while (out.length < n && rad > 0.5) {
    out = []; const r2 = rad * rad;
    for (const p of lit) { if (out.length >= n) break; let ok = true; for (const q of out) { const dx = p[0] - q[0], dy = p[1] - q[1]; if (dx * dx + dy * dy < r2) { ok = false; break; } } if (ok) out.push(p); }
    rad *= 0.9;
  }
  while (out.length < n) out.push(lit[Math.floor(rnd() * lit.length)] || [W / 2, H / 2]);
  const k = w / W; return out.map(([i, j]) => [(i - W / 2) * k, (H / 2 - j) * k]);
}

// the shapes that are drawn rather than worked out
const SURFER = sample((x) => {
  x.save(); x.translate(160, 132); x.rotate(-0.12); x.beginPath(); x.ellipse(0, 0, 92, 11, 0, 0, TAU); x.fill(); x.restore();
  x.lineWidth = 12; x.beginPath(); x.arc(175, 30, 14, 0, TAU); x.fill();
  x.beginPath(); x.moveTo(170, 45); x.lineTo(152, 88); x.stroke();
  x.beginPath(); x.moveTo(152, 88); x.lineTo(118, 102); x.lineTo(108, 128); x.moveTo(152, 88); x.lineTo(190, 104); x.lineTo(196, 126); x.stroke();
  x.beginPath(); x.moveTo(166, 55); x.lineTo(214, 48); x.lineTo(244, 60); x.moveTo(163, 58); x.lineTo(126, 70); x.lineTo(100, 62); x.stroke();
}, 130, 42);
const TURTLE_BODY = sample((x) => { x.beginPath(); x.ellipse(160, 80, 70, 46, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(250, 80, 22, 16, 0, 0, TAU); x.fill(); x.globalCompositeOperation = 'destination-out'; x.lineWidth = 6; x.beginPath(); x.ellipse(160, 80, 40, 24, 0, 0, TAU); x.stroke(); }, 200, 56);
const FLIP = sample((x) => { x.beginPath(); x.ellipse(60, 80, 56, 16, 0, 0, TAU); x.fill(); }, 40, 56);   // one flipper, its root at the left edge
const WHALE = sample((x) => {
  x.beginPath(); x.moveTo(20, 80); x.bezierCurveTo(60, 40, 200, 30, 260, 70); x.bezierCurveTo(280, 80, 290, 95, 300, 90); x.lineTo(310, 60); x.lineTo(318, 118); x.lineTo(300, 104);
  x.bezierCurveTo(260, 112, 150, 130, 60, 118); x.bezierCurveTo(35, 112, 20, 100, 20, 80); x.fill();
  x.beginPath(); x.moveTo(110, 115); x.lineTo(90, 150); x.lineTo(140, 118); x.fill();
}, 220, 60);
const TEXT = sample((x) => { x.font = '900 62px Arial Black, Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SUMBA', 160, 46); x.fillText('SURF', 160, 116); }, N, 112);
const SUN = sample((x) => { x.beginPath(); x.arc(160, 160, 60, Math.PI, 0); x.fill(); }, 170, 125);   // (a big sun: 23 m across)

// each drone's own randomness
const R1 = Float32Array.from({ length: N }, rnd), R2 = Float32Array.from({ length: N }, rnd), R3 = Float32Array.from({ length: N }, rnd);
const setC = (o, r, g, b) => { o[0] = r; o[1] = g; o[2] = b; };

// the wave as a line in the sky: height H, the lip curled over by curl (0..1), its crest at uc. s runs 0..1 along it
function waveAt(s, H, curl, uc, out) {
  if (s < 0.62) { const k = s / 0.62, u = -75 + k * (uc + 75), x = (u - uc) / 30; out[0] = u; out[1] = H * Math.exp(-x * x * (x < 0 ? 0.55 : 2.5)); return; }
  const k = (s - 0.62) / 0.38, rl = H * 0.34, th = k * Math.PI * 1.25 * curl, r = rl * (1 - 0.35 * k * curl);
  out[0] = uc + r * Math.sin(th) + k * 6 * (1 - curl); out[1] = H - rl + r * Math.cos(th);
}
const faceAt = (u, H, uc) => { const x = (u - uc) / 30; return H * Math.exp(-x * x * (x < 0 ? 0.55 : 2.5)); };

const SCENES = [
  { name: 'rise', dur: 9, f(i, t, p, c) {   // a spiral climbing off the water, turning
    const k = i / N, a = i * 0.39 + t * 1.1, r = 6 + k * 26, h = clamp((t - k * 3.5) * 11, 0, 8 + k * 55);
    p[0] = Math.cos(a) * r; p[1] = h; p[2] = Math.sin(a) * r; setC(c, 1, 0.9 + 0.1 * k, 0.75 + 0.25 * k); } },
  { name: 'sunrise', dur: 9, f(i, t, p, c) {   // the sun coming up out of the sea, its rays turning, glitter on the water
    const up = smooth(t / 4) * 22 - 6;
    if (i < 170) { p[0] = SUN[i][0]; p[1] = SUN[i][1] + 17 + up; p[2] = 0; setC(c, 1, 0.45 + 0.4 * clamp((SUN[i][1] + 35) / 35, 0, 1), 0.2); }
    else if (i < 330) { const j = i - 170, ray = j % 10, a = Math.PI * (0.08 + 0.84 * ray / 9) + Math.sin(t * 0.6) * 0.08, d = 30 + (j / 10 | 0) * 2.4 + Math.sin(t * 3 + j) * 0.8; p[0] = Math.cos(a) * d; p[1] = Math.sin(a) * d + up - 14;   /* (from the sun's centre, just outside its rim) */ p[2] = 0; setC(c, 1, 0.75, 0.3); }
    else { const j = i - 330, u = (j / 70 - 0.5) * 150; p[0] = u; p[1] = 3 + Math.sin(u * 0.2 + t * 2) * 0.8; p[2] = 0; const g = 0.5 + 0.5 * Math.sin(u * 0.5 - t * 4); setC(c, 0.4 + 0.6 * g, 0.6 + 0.3 * g, 1); } } },
  { name: 'wave', dur: 14, f(i, t, p, c) {   // the wave builds, curls over and breaks, again and again, peeling to the right
    const ph = (t % 4.6) / 4.6, H = 14 + 36 * smooth(ph / 0.45), curl = smooth((ph - 0.35) / 0.4), crash = smooth((ph - 0.82) / 0.18), uc = -20 + ph * 25;
    const o = [0, 0];
    if (i < 240) { waveAt(i / 239, H, curl, uc, o); const lip = i > 150;
      p[0] = o[0]; p[1] = o[1] * (1 - crash * (lip ? 0.9 : 0.3)); p[2] = 0;
      if (lip && crash > 0) { p[0] += (R1[i] - 0.3) * 30 * crash; p[1] += R2[i] * 25 * crash * (1 - crash); }
      const w = lip ? 0.5 + 0.5 * curl : 0; setC(c, 0.2 + 0.8 * w, 0.6 + 0.4 * w, 1); }
    else { waveAt(R1[i] * 0.6, H, curl, uc, o); p[0] = o[0]; p[1] = o[1] * R2[i] * (1 - 0.3 * crash); p[2] = (R3[i] - 0.5) * 10; setC(c, 0.1, 0.35 + 0.3 * R2[i], 0.9); } } },
  { name: 'ride', dur: 13, f(i, t, p, c) {   // a surfer rides across the wave, up and down its face, into the barrel and out
    const H = 44, curl = 0.85, uc = 10 + t * 1.5, o = [0, 0];
    if (i < 270) { waveAt(i / 269, H, curl, uc, o); p[0] = o[0]; p[1] = o[1]; p[2] = 0; const lip = i > 170; setC(c, lip ? 0.7 : 0.15, lip ? 0.9 : 0.5, 1); }
    else { const j = i - 270, k = t / 13, su = -55 + 100 * k, onFace = 0.35 + 0.28 * Math.sin(t * 1.4), sv = faceAt(su, H, uc) * onFace;
      const lean = Math.cos(t * 1.4) * 0.5, x = SURFER[j][0], y = SURFER[j][1]; p[0] = su + x * Math.cos(lean) - y * Math.sin(lean); p[1] = sv + 8 + x * Math.sin(lean) + y * Math.cos(lean); p[2] = -2;
      if (y < -6.2) setC(c, 1, 1, 1); else setC(c, 1, 0.7, 0.3); } } },   // (the board white, the rider warm)
  { name: 'turtle', dur: 10, f(i, t, p, c) {   // a sea turtle swimming across, flippers beating, bubbles trailing behind
    const cu = -55 + 110 * (t / 10), cv = 40 + Math.sin(t * 1.3) * 4, tilt = Math.sin(t * 1.3) * 0.08;
    let x, y;
    if (i < 200) { x = TURTLE_BODY[i][0]; y = TURTLE_BODY[i][1]; setC(c, 0.3, 0.95 - 0.25 * Math.abs(x) / 28, 0.55); }
    else if (i < 360) { const j = i - 200, f = j / 40 | 0, fp = FLIP[j % 40], front = f < 2, side = f % 2 === 0 ? 1 : -1;
      const sweep = (front ? 0.75 : 2.35) + Math.sin(t * 3.4 + (front ? 0 : 1.3)) * 0.55, lx = (fp[0] + 28) * 0.62, ly = fp[1] * 0.6;   // (root at the shoulder, swinging fore and aft)
      const ax = Math.cos(sweep) * lx - Math.sin(sweep) * ly, ay = Math.sin(sweep) * lx + Math.cos(sweep) * ly;
      x = (front ? 6 : -7) + ax; y = side * (5.5 + Math.abs(ay));   /* (rooted at the shell's edge) */ setC(c, 0.25, 0.8, 0.5); }
    else { const j = i - 360, age = (t * 1.5 + j / 40 * 4) % 4; x = -34 - age * 6 + Math.sin(age * 3 + j) * 2; y = age * 5 + (R1[i] - 0.5) * 4; setC(c, 0.6, 0.9, 1); }
    p[0] = cu + x * Math.cos(tilt) - y * Math.sin(tilt); p[1] = cv + x * Math.sin(tilt) + y * Math.cos(tilt); p[2] = 0; } },
  { name: 'whale', dur: 9, f(i, t, p, c) {   // a whale bursting out of the sea, arcing over, and the splash as it lands
    const k = clamp((t - 0.8) / 5.5, 0, 1), cu = -35 + 70 * k, cv = 8 + 48 * Math.sin(Math.PI * k), ang = Math.atan2(48 * Math.PI * Math.cos(Math.PI * k), 70) * 0.9;
    if (i < 220) { const x = -WHALE[i][0], y = WHALE[i][1];   /* (head first: it was drawn facing left) */ p[0] = cu + x * Math.cos(ang) - y * Math.sin(ang); p[1] = cv + x * Math.sin(ang) + y * Math.cos(ang); p[2] = 0; if (t < 0.8) p[1] = -2 + t * 3; setC(c, 0.45, 0.6 + clamp(y / 60, -0.2, 0.3), 0.95); }
    else if (i < 300) { const j = i - 220, u = (j / 80 - 0.5) * 160; p[0] = u; p[1] = 4 + Math.sin(u * 0.15 + t * 2.5) * 1.2; p[2] = 0; setC(c, 0.3, 0.55, 1); }
    else { const s1 = clamp(t - 0.5, 0, 3), s2 = clamp(t - 6.4, 0, 3), sp = s2 > 0 ? s2 : s1, at = s2 > 0 ? 35 : -35, a = (R1[i] - 0.5) * 2.2, v0 = 14 + R2[i] * 16;
      p[0] = at + Math.sin(a) * v0 * sp * 0.8; p[1] = 4 + Math.cos(a) * v0 * sp - 4.9 * sp * sp; p[2] = (R3[i] - 0.5) * 10; if (p[1] < 3) p[1] = -30; setC(c, 0.85, 0.95, 1); } } },
  { name: 'globe', dur: 11, f(i, t, p, c) {   // a spinning globe of light, then it flattens into a ring that tilts and turns
    const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), phi = i * 2.39996 + t * 0.9, R = 30, m = smooth((t - 6) / 3);
    const gx = Math.cos(phi) * r * R, gy = y * R, gz = Math.sin(phi) * r * R;
    const ra = i / N * TAU + t * 1.3, tilt = 0.6 + Math.sin(t * 0.8) * 0.4, rx = Math.cos(ra) * 42, rz = Math.sin(ra) * 42;
    const ringY = rz * Math.sin(tilt), ringZ = rz * Math.cos(tilt);
    p[0] = gx + (rx - gx) * m; p[1] = 42 + gy + (ringY - gy) * m; p[2] = gz + (ringZ - gz) * m;
    const band = 0.5 + 0.5 * Math.sin(y * 9 + t * 2); setC(c, 0.2 + 0.5 * band * (1 - m) + m * 0.8, 0.7 + 0.3 * band, 1 - 0.5 * m); } },
  { name: 'name', dur: 7.5, f(i, t, p, c) {   // SUMBA SURF writes itself left to right; the drones not yet in a letter wait below, sparkling
    const x = TEXT[i][0], y = TEXT[i][1], due = 0.3 + (x + 56) / 112 * 3.2, k = smooth((t - due) / 0.7);
    const wu = x * 0.4, wv = 6 + R2[i] * 8; p[0] = wu + (x - wu) * k; p[1] = wv + (y + 40 - wv) * k; p[2] = 0;
    if (y > 0) setC(c, 1, 0.82, 0.45); else setC(c, 1, 1, 1); if (k < 1) { c[0] *= 0.7; c[1] *= 0.8; } } },
  { name: 'fireworks', dur: 9.5, fly: true, f(i, t, p, c) {   // four fireworks, one after another: up from the sea as a streak, then a burst
    const b = i % 4, s = t - b * 1.4, bu = [-45, 30, -10, 50][b], bv = [55, 62, 72, 48][b], col = [[1, 0.35, 0.3], [0.4, 0.9, 1], [1, 0.85, 0.3], [0.8, 0.45, 1]][b];
    if (s < 0) { p[0] = bu; p[1] = -30; p[2] = 0; setC(c, 0, 0, 0); return; }
    if (s < 1.1) { const k = s / 1.1; p[0] = bu + (R1[i] - 0.5) * 1.5; p[1] = bv * (1 - (1 - k) * (1 - k)) - R2[i] * 6 * (1 - k); p[2] = 0; setC(c, 1, 0.8, 0.5); return; }
    const e = s - 1.1, th = R1[i] * TAU, ph = Math.acos(2 * R2[i] - 1), sp = 18 * (1 - Math.exp(-e * 2.2));
    p[0] = bu + Math.sin(ph) * Math.cos(th) * sp; p[1] = bv + Math.cos(ph) * sp - 2.2 * e * e; p[2] = Math.sin(ph) * Math.sin(th) * sp;
    const fade = Math.max(0, 1 - e / 3.2); setC(c, col[0] * fade, col[1] * fade, col[2] * fade); } },
];

export function droneShow(scene) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), tw = new Float32Array(N);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 600 }, uFade: { value: 0 } },
    vertexShader: 'attribute vec3 color; attribute float aTw; varying vec3 vC; varying float vT; uniform float uScale; void main(){ vC = color; vT = aTw; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = clamp(3.4 * uScale / -mv.z, 2.5, 30.); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; varying float vT; uniform float uFade; void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; float core = smoothstep(.42, .0, d), halo = exp(-d * d * 5.) * .5; gl_FragColor = vec4(vC * (core * 1.5 + halo) * vT * uFade, 1.); }',
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5; scene.add(pts);
  // the show's own frame: C its middle at the water, R its left-to-right, D straight away from you; drones in metres
  const S = { on: false, t: 0, scene: -1, sceneT: 0, C: new THREE.Vector3(), R: new THREE.Vector3(), D: new THREE.Vector3(), night: 0, done: false };
  const from = new Float32Array(N * 3), cFrom = new Float32Array(N * 3), slot = new Int32Array(N), tp = [0, 0, 0], tc = [0, 0, 0], lp = new Float32Array(N * 3);
  const SC = 1.45;   // (the whole show a size bigger: at 130 m out it read small from the balcony)
  const toWorld = (u, v, w, out, k) => { u *= SC; v *= SC; w *= SC; out[k] = S.C.x + S.R.x * u + S.D.x * w; out[k + 1] = S.C.y + v; out[k + 2] = S.C.z + S.R.z * u + S.D.z * w; };
  const TRANS = 2.4;
  function begin(n) {
    S.scene = n; S.sceneT = 0; from.set(lp); cFrom.set(col);
    // pair each drone with the place in the new scene nearest its left-to-right order, so the swarm reshapes, not scrambles
    const sc = SCENES[n], start = [];
    for (let j = 0; j < N; j++) { sc.f(j, 0, tp, tc); start.push([tp[0], j]); }
    start.sort((a, b) => a[0] - b[0]);
    const mine = [...Array(N).keys()].sort((a, b) => lp[a * 3] - lp[b * 3]);
    mine.forEach((i, k) => (slot[i] = start[k][1]));
  }
  return {
    get on() { return S.on; }, get night() { return S.night; }, get done() { return S.done; },
    get state() { return { t: S.t, scene: S.scene >= 0 ? SCENES[S.scene].name : '-', sceneT: S.sceneT, on: S.on }; },
    // centre: the middle of the show at the water's height; right: its left-to-right direction (flat)
    start(center, right) {
      S.C.copy(center); S.R.copy(right).setY(0).normalize(); S.D.set(-S.R.z, 0, S.R.x); S.on = true; S.t = 0; S.scene = -1; S.done = false; pts.visible = true;
      for (let i = 0; i < N; i++) { const u = (i / (N - 1) - 0.5) * 150; lp[i * 3] = u; lp[i * 3 + 1] = 0.5; lp[i * 3 + 2] = 0; toWorld(u, 0.5, 0, pos, i * 3); col[i * 3] = 1; col[i * 3 + 1] = 0.9; col[i * 3 + 2] = 0.8; tw[i] = 0.5; }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
    stop() { S.on = false; S.done = true; },
    update(dt, pxPerRad, beat = 0) {
      mat.uniforms.uScale.value = pxPerRad;
      S.night += ((S.on ? 1 : 0) - S.night) * Math.min(1, dt * 0.9);   // the sky goes to night over a few seconds (and back after)
      mat.uniforms.uFade.value = S.on ? Math.min(1, S.t / 1.5) : Math.max(0, mat.uniforms.uFade.value - dt * 0.8);
      if (!S.on) { if (mat.uniforms.uFade.value <= 0) pts.visible = false; return; }
      S.t += dt; S.sceneT += dt;
      if (S.t < 2.5) return;   // (a moment dark and quiet before they lift)
      if (S.scene < 0) begin(0);
      else if (S.sceneT > SCENES[S.scene].dur) { if (S.scene + 1 < SCENES.length) begin(S.scene + 1); else { S.on = false; S.done = true; return; } }
      const sc = SCENES[S.scene], t = S.sceneT, pulse = 1 + 0.35 * beat;
      for (let i = 0; i < N; i++) {
        sc.f(slot[i], t, tp, tc);
        const i3 = i * 3;
        // the change-over: a cascade from left to right, each drone on a curving path, colours sweeping across with it
        const k = sc.fly ? 1 : smooth((t - ((from[i3] + 80) / 160) * 1.0 - R1[i] * 0.25) / TRANS);
        if (k < 1) { const sw = Math.sin(Math.PI * k) * (8 + R2[i] * 8); lp[i3] = from[i3] + (tp[0] - from[i3]) * k; lp[i3 + 1] = from[i3 + 1] + (tp[1] - from[i3 + 1]) * k + sw; lp[i3 + 2] = from[i3 + 2] + (tp[2] - from[i3 + 2]) * k + sw * (R3[i] - 0.5);
          for (let a = 0; a < 3; a++) col[i3 + a] = cFrom[i3 + a] + (tc[a] - cFrom[i3 + a]) * k; }
        else { lp[i3] = tp[0]; lp[i3 + 1] = tp[1]; lp[i3 + 2] = tp[2]; col[i3] = tc[0]; col[i3 + 1] = tc[1]; col[i3 + 2] = tc[2]; }
        lp[i3 + 1] += Math.sin(S.t * 1.3 + i * 0.7) * 0.12;   // (hovering: they never hold dead still)
        toWorld(lp[i3], lp[i3 + 1], lp[i3 + 2], pos, i3);
        tw[i] = (0.82 + 0.18 * Math.sin(S.t * 3.1 + i * 1.7)) * pulse;
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.aTw.needsUpdate = true;
    },
  };
}
