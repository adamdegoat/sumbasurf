// The drone light show at the villa: on demand, the sky goes to night and a swarm of lit drones rises off the water in
// front of the balcony and draws shapes over the bay, one after another: a grid, a barrel curling over, a surfer on a
// board, a sea turtle, the name, a setting sun, then a burst and they drop away. Each shape is drawn once on a small
// canvas and sampled into evenly spread points; each drone flies from its place in one shape to its place in the next
// (paired left to right, so the swarm reshapes rather than scrambles), eased, a little staggered, and twinkles while
// the shape holds. The drones are one set of glowing points (additive light), 400 of them: nothing for a phone
// to draw.
import * as THREE from 'three';

const N = 400;   // (enough dots to write the name clearly; real shows fly hundreds)
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// a shape: draw it white on a 2:1 canvas, sample N evenly spaced lit pixels -> points in u (-1..1) by v (-0.5..0.5)
function sample(draw) {
  const W = 320, H = 160, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; draw(x, W, H);
  const d = x.getImageData(0, 0, W, H).data, lit = [];
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) if (d[(j * W + i) * 4 + 3] > 128) lit.push([i, j]);
  for (let k = lit.length - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [lit[k], lit[r]] = [lit[r], lit[k]]; }
  // spread them out: accept a pixel only if it's far enough from those taken, loosening until there are N
  let rad = Math.sqrt(lit.length * 4 / N) * 0.95, out = [];
  while (out.length < N && rad > 0.5) {
    out = []; const r2 = rad * rad;
    for (const p of lit) { if (out.length >= N) break; let ok = true; for (const q of out) { const dx = p[0] - q[0], dy = p[1] - q[1]; if (dx * dx + dy * dy < r2) { ok = false; break; } } if (ok) out.push(p); }
    rad *= 0.9;
  }
  while (out.length < N) out.push(lit[Math.floor(rnd() * lit.length)] || [W / 2, H / 2]);
  return out.map(([i, j]) => [(i / W) * 2 - 1, 0.5 - j / H]);
}

const SHAPES = [
  { name: 'grid', hold: 3.5, col: () => [1, 0.97, 0.9], draw: (x, W, H) => { for (let i = 0; i < 25; i++) for (let j = 0; j < 16; j++) x.fillRect(22 + i * 11, 14 + j * 8.4, 3, 3); /* (one square per drone) */ } },
  { name: 'barrel', hold: 5, col: (u, v) => [0.25 + 0.5 * (v + 0.5), 0.75 + 0.2 * (v + 0.5), 1], draw: (x, W, H) => {
    x.lineWidth = 14; x.beginPath(); x.moveTo(20, 140); x.lineTo(150, 140);   // the flat water, then up the face and over: the curl
    x.bezierCurveTo(215, 140, 250, 95, 245, 55); x.bezierCurveTo(240, 20, 190, 12, 165, 38); x.bezierCurveTo(150, 55, 165, 80, 190, 72); x.stroke();
    x.lineWidth = 8; x.beginPath(); x.moveTo(250, 60); x.bezierCurveTo(275, 80, 290, 115, 300, 140); x.stroke(); } },
  { name: 'surfer', hold: 5, col: (u, v) => (v < -0.28 ? [1, 1, 1] : [1, 0.72, 0.32]), draw: (x, W, H) => {
    x.save(); x.translate(160, 132); x.rotate(-0.12); x.beginPath(); x.ellipse(0, 0, 92, 10, 0, 0, Math.PI * 2); x.fill(); x.restore();   // the board
    x.lineWidth = 11; x.beginPath(); x.arc(175, 30, 13, 0, Math.PI * 2); x.fill();                                                   // head
    x.beginPath(); x.moveTo(170, 45); x.lineTo(152, 88); x.stroke();                                                                    // back, crouched forward
    x.beginPath(); x.moveTo(152, 88); x.lineTo(118, 102); x.lineTo(108, 128); x.moveTo(152, 88); x.lineTo(190, 104); x.lineTo(196, 126); x.stroke();   // legs, knees bent
    x.beginPath(); x.moveTo(166, 55); x.lineTo(214, 48); x.lineTo(244, 60); x.moveTo(163, 58); x.lineTo(126, 70); x.lineTo(100, 62); x.stroke(); } },   // arms out
  { name: 'turtle', hold: 5, col: (u, v) => [0.35, 0.95 - 0.2 * Math.abs(u), 0.55], draw: (x, W, H) => {
    x.beginPath(); x.ellipse(160, 80, 70, 46, 0, 0, Math.PI * 2); x.fill();                                    // shell
    x.beginPath(); x.ellipse(250, 80, 22, 16, 0, 0, Math.PI * 2); x.fill();                                    // head
    for (const [cx, cy, a] of [[200, 30, -0.9], [200, 130, 0.9], [105, 40, 0.7], [105, 120, -0.7]]) { x.beginPath(); x.ellipse(cx, cy, 40, 13, a, 0, Math.PI * 2); x.fill(); }   // flippers
    x.globalCompositeOperation = 'destination-out'; x.lineWidth = 5; x.beginPath(); x.ellipse(160, 80, 40, 24, 0, 0, Math.PI * 2); x.stroke(); } },   // the shell's pattern
  { name: 'name', hold: 5.5, col: (u, v) => (v > 0 ? [1, 0.86, 0.5] : [1, 1, 1]), draw: (x, W, H) => {
    x.font = '900 62px Arial Black, Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SUMBA', 160, 46); x.fillText('SURF', 160, 116); } },
  { name: 'sun', hold: 5, col: (u, v) => (v < -0.25 ? [0.3, 0.7, 1] : [1, 0.45 + 0.4 * (v + 0.5), 0.2]), draw: (x, W, H) => {
    x.beginPath(); x.arc(160, 100, 48, Math.PI, 0); x.fill();                                                          // the sun going down
    x.lineWidth = 8; for (let k = 0; k < 7; k++) { const a = Math.PI + (k + 0.5) * Math.PI / 7; x.beginPath(); x.moveTo(160 + Math.cos(a) * 62, 100 + Math.sin(a) * 62); x.lineTo(160 + Math.cos(a) * 92, 100 + Math.sin(a) * 92); x.stroke(); }
    x.lineWidth = 6; for (const [y, w] of [[118, 130], [134, 95], [148, 60]]) { x.beginPath(); x.moveTo(160 - w, y); x.lineTo(160 + w, y); x.stroke(); } } },   // its light on the sea
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
  const shapes = SHAPES.map((s) => { const p = sample(s.draw).sort((a, b) => a[0] - b[0]); return { ...s, p, c: p.map(([u, v]) => s.col(u, v)) }; });
  const from = new Float32Array(N * 3), to = new Float32Array(N * 3), cFrom = new Float32Array(N * 3), cTo = new Float32Array(N * 3), delay = new Float32Array(N), vel = new Float32Array(N * 3), depth = new Float32Array(N);
  for (let i = 0; i < N; i++) { delay[i] = rnd() * 0.8; depth[i] = (rnd() - 0.5) * 4; }
  const S = { on: false, t: 0, step: -1, stepT: 0, C: new THREE.Vector3(), R: new THREE.Vector3(), U: new THREE.Vector3(0, 1, 0), size: 60, sea: 0, night: 0, done: false };
  const place = (u, v, i, out, k) => { out[k] = S.C.x + S.R.x * u * S.size; out[k + 1] = S.C.y + v * S.size * 1.0; out[k + 2] = S.C.z + S.R.z * u * S.size; out[k] += -S.R.z * depth[i]; out[k + 2] += S.R.x * depth[i]; };
  const TRANS = 3.2;
  function goTo(step) {
    S.step = step; S.stepT = 0; from.set(pos); cFrom.set(col);
    const sh = shapes[step];
    // pair drones to places left to right (the swarm is kept sorted that way), so they don't criss-cross
    const order = [...Array(N).keys()].sort((a, b) => (pos[a * 3] - S.C.x) * S.R.x + (pos[a * 3 + 2] - S.C.z) * S.R.z - ((pos[b * 3] - S.C.x) * S.R.x + (pos[b * 3 + 2] - S.C.z) * S.R.z));
    order.forEach((i, k) => { place(sh.p[k][0], sh.p[k][1], i, to, i * 3); cTo[i * 3] = sh.c[k][0]; cTo[i * 3 + 1] = sh.c[k][1]; cTo[i * 3 + 2] = sh.c[k][2]; });
  }
  return {
    get on() { return S.on; }, get night() { return S.night; },
    // center: the middle of the show in the sky; right: its left-to-right direction (flat); sea: the water's height
    start(center, right, sea, size = 60) {
      S.C.copy(center); S.R.copy(right).setY(0).normalize(); S.sea = sea; S.size = size; S.on = true; S.t = 0; S.step = -1; S.done = false; pts.visible = true;
      // they start on the water in a long line under the show, lights on
      for (let i = 0; i < N; i++) { const u = (i / (N - 1)) * 2 - 1; place(u * 1.1, 0, i, pos, i * 3); pos[i * 3 + 1] = sea + 0.5; col[i * 3] = 1; col[i * 3 + 1] = 0.95; col[i * 3 + 2] = 0.85; tw[i] = 0.6; vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0; }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
    stop() { S.on = false; S.done = true; },
    update(dt, pxPerRad) {
      mat.uniforms.uScale.value = pxPerRad;
      S.night += ((S.on ? 1 : 0) - S.night) * Math.min(1, dt * 0.9);   // the sky goes to night over a few seconds (and back after)
      mat.uniforms.uFade.value = S.on ? Math.min(1, S.t / 1.5) : Math.max(0, mat.uniforms.uFade.value - dt * 0.8);
      if (!S.on) { if (mat.uniforms.uFade.value <= 0) pts.visible = false; else { for (let i = 0; i < N; i++) { vel[i * 3 + 1] -= 9.8 * dt * 0.3; for (let a = 0; a < 3; a++) pos[i * 3 + a] += vel[i * 3 + a] * dt; } g.attributes.position.needsUpdate = true; } return; }
      S.t += dt; S.stepT += dt;
      const warm = 3;   // (a moment dark and quiet before they lift)
      if (S.t < warm) return;
      if (S.step < 0) goTo(0);
      else if (S.step < shapes.length && S.stepT > TRANS + 0.8 + shapes[S.step].hold) { if (S.step + 1 < shapes.length) goTo(S.step + 1); else { S.step = shapes.length; S.stepT = 0; for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, b = (rnd() - 0.3) * Math.PI, sp = 8 + rnd() * 16; vel[i * 3] = Math.cos(a) * Math.cos(b) * sp; vel[i * 3 + 1] = Math.sin(b) * sp + 4; vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp; const h = rnd(); col[i * 3] = 0.6 + 0.4 * Math.sin(h * 6.3); col[i * 3 + 1] = 0.6 + 0.4 * Math.sin(h * 6.3 + 2.1); col[i * 3 + 2] = 0.6 + 0.4 * Math.sin(h * 6.3 + 4.2); } } }
      if (S.step < shapes.length) {
        for (let i = 0; i < N; i++) {
          const k = smooth((S.stepT - delay[i]) / TRANS), i3 = i * 3;
          for (let a = 0; a < 3; a++) { pos[i3 + a] = from[i3 + a] + (to[i3 + a] - from[i3 + a]) * k; col[i3 + a] = cFrom[i3 + a] + (cTo[i3 + a] - cFrom[i3 + a]) * k; }
          pos[i3 + 1] += Math.sin(S.t * 1.3 + i * 0.7) * 0.15;   // (hovering: they never hold dead still)
          tw[i] = k < 1 ? 0.75 + 0.25 * k : 0.85 + 0.15 * Math.sin(S.t * 3.1 + i * 1.7);
        }
      } else {
        // the finale: a burst, sparkling, then they fade and drop away to the water
        for (let i = 0; i < N; i++) { const i3 = i * 3; for (let a = 0; a < 3; a++) { vel[i3 + a] *= Math.exp(-dt * 1.4); pos[i3 + a] += vel[i3 + a] * dt; } vel[i3 + 1] -= 2.5 * dt; tw[i] = (0.5 + 0.5 * Math.sin(S.t * 14 + i * 3.3)) * Math.max(0, 1 - S.stepT / 5); }
        if (S.stepT > 5.5) { S.on = false; S.done = true; }
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.aTw.needsUpdate = true;
    },
    get done() { return S.done; }, get state() { return { t: S.t, step: S.step, stepT: S.stepT, on: S.on }; },
  };
}
