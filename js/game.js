// Bali surf: session loop, controls, camera, surfer model, HUD, automatic quality.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { Wave, CONDITIONS, RANCH_CONDITIONS, skyDome, ocean, setWeather, WeatherFX, ENV } from './wave.js?v=165';
import { Rider, Profile, waterAt, heightAt, RIDE, setBoard, PUMP_STROKE, PUMP_PERIOD } from './surf.js?v=154';
import { makeBoard, BOARD_LENGTH, BOARD_WIDTH } from './board.js?v=16';
import { SurfAudio } from './audio.js?v=17';
import { ranch, POOL } from './ranch.js?v=4';
import { SPOTS, spotGroup, builtSpots } from './spots.js?v=90';
import { villa, VILLA } from './villa.js?v=129';
import { makeBirds } from './birds.js?v=1';
import { friends } from './friends.js?v=28';
import { lifeLib } from './life.js?v=1';
import { WATER_PEOPLE, waterPerson, straddle as straddleP } from './surfers.js?v=3';
import { crew } from './crew.js?v=48';
import { wildlife } from './wildlife.js?v=52';
import { droneShow } from './show.js?v=11';

const Q = new URLSearchParams(location.search);
// ---------- renderer with hidden automatic quality (drops sharpness if the phone struggles, raises it back if not)
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const MAX_PR = Math.min(devicePixelRatio, 1.6);
let pr = Math.min(devicePixelRatio, 1.3);
renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.getElementById('view').appendChild(renderer.domElement);
const scene = new THREE.Scene();
// (performance) three.js works out every object's place in the world before each draw, hidden ones included, and the
// arms pass did it all a second time. Here: hidden areas (the villa, the pool, props not in use) are skipped until
// they're shown (their place is worked out the moment they are, and getWorldPosition always works it out on the spot),
// and the arms pass reuses the first pass's answers.
const BASE_UMW = THREE.Object3D.prototype.updateMatrixWorld;
{ const upd = (o, force) => {
    if (o.matrixAutoUpdate) o.updateMatrix();
    if (o.matrixWorldNeedsUpdate || force) { if (o.parent === null) o.matrixWorld.copy(o.matrix); else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); o.matrixWorldNeedsUpdate = false; force = true; }
    const ch = o.children;
    for (let i = 0; i < ch.length; i++) { const c = ch[i];
      if (!(c.visible || o !== scene || c.isLight || c.isCamera)) { c.matrixWorldNeedsUpdate = true; continue; }
      if (c.updateMatrixWorld !== BASE_UMW) c.updateMatrixWorld(force); else upd(c, force); }   // (skinned bodies and cameras do their own extra work here: let them)   // (only whole hidden areas hanging off the scene itself: a character can keep its skeleton under a hidden node, and skipping that bent the body out of shape)
  };
  const orig = scene.updateMatrixWorld.bind(scene);
  scene.updateMatrixWorld = (force) => (globalThis.__slowMat ? orig(force) : upd(scene, true));   // (everything visible is still worked out every frame: some bodies are posed by hand and count on it)
}
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.08, 2000);
// POV: a wide, GoPro-like view (about 100 degrees across); the outside wipeout shot uses a normal ~80
let hfovHalf = 50;
const fitFov = () => { if (!innerWidth || !innerHeight) return; camera.aspect = innerWidth / innerHeight; camera.fov = Math.min(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfovHalf)) / Math.min(camera.aspect, 2.0))), camera.aspect < 1 ? 78 : 180); camera.updateProjectionMatrix(); };   // (held upright the wave behind the turn-your-phone screen is framed like a photo, not stretched 140 degrees tall)
const setHfov = (h) => { if (h !== hfovHalf) { hfovHalf = h; fitFov(); } };
fitFov();
skyDome(scene); ocean(scene);
spotGroup(scene, 'medium');   // Temple Point: the coast behind the menu (the other spots are built the first time you go)
const ranchW = ranch(scene);
const fx = new WeatherFX(scene);
const audio = new SurfAudio();
fx.onFlash = () => audio.thunder(Math.random());
addEventListener('visibilitychange', () => { audio.pause(document.hidden); audio.quiet(!document.body.classList.contains('playing')); });
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3a4a48, 1.3); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff0dd, 2.0); scene.add(sunLight); scene.add(sunLight.target);
hemi.layers.enableAll(); sunLight.layers.enableAll();
// your own body is drawn in a second pass through a normal lens (like the arms in first-person games): the ultra-wide
// POV lens stretches anything this close to the eyes into a giant blob. Layer 1 = your body; the world is layer 0.
const armCam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 30); armCam.layers.set(1);
let armK = 0;   // 0 = same lens as the world (lying/sitting: your hands are on the board and must line up with it), 1 = normal lens
// fit the screen whenever it changes: rotation, the browser bar sliding away, split screen (iOS doesn't always send 'resize')
let lastW = 0, lastH = 0;
const fit = () => { const w = innerWidth, h = innerHeight; if (!w || !h || (w === lastW && h === lastH)) return; lastW = w; lastH = h; renderer.setSize(w, h); fitFov(); };   // (a hidden window reports 0 x 0: keep the last size, not a broken camera)
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 250)); visualViewport?.addEventListener('resize', fit);
// iPhone Safari ignores user-scalable=no: stop pinch-zoom, double-tap zoom and the rubber-band page drag ourselves
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (!(e.target.closest && e.target.closest('.pnBox'))) e.preventDefault(); }, { passive: false });   // (except inside the patch notes, which scroll)
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
// in the Safari browser (not opened from the home screen icon), tell them how to get full screen
// on a computer (a mouse, no touch screen): the menu shows a QR code to play on the phone instead, and the keys
const DESK = matchMedia('(hover: hover) and (pointer: fine)').matches && !('ontouchstart' in window) && !navigator.maxTouchPoints;   // (a computer: keyboard and mouse)
// SumbaSurf is a phone game: on a computer it shows a card with a QR code to open it on the phone instead. (Still
// playable here for the owner's own Mac, marked with ?me=1, for testing on this machine, and with ?desk=1.)
{ let own = /[?&]me=(1|claude)\b/.test(location.search); try { own = own || !!localStorage.getItem('sumbasurf.me'); } catch (e) {}
  if (DESK && !own && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]desk=1\b/.test(location.search)) document.body.classList.add('phoneonly');
  else if (DESK) document.body.classList.add('desk'); }
if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) document.getElementById('homeTip').hidden = false;
fit();

// ---------- surfer on a board
const rig = new THREE.Group(); scene.add(rig);           // board frame: +z along the board, +y out of the deck
let board = makeBoard(); rig.add(board);
// your board: the shortboard unless you've picked another (remembered on this phone). A longer board sits further forward
// under you, so the nose reaches out ahead of your feet as on the real thing
let boardType = 'short', boardTail = -0.9;
// your stance: goofy (right foot forward) or regular (left foot forward). Every break here is a left, so goofy rides
// facing the wave (frontside) and regular rides with your back to it (backside): a different, slightly harder ride
let MIRROR = false;   // a right-hand spot (see setSpot)
let stance = 'goofy'; try { if (localStorage.getItem('sumbasurf.stance') === 'regular') stance = 'regular'; } catch (e) {}
const stanceName = () => (stance === 'regular' ? 'Regular' : 'Goofy');
const BOARD_INFO = {
  // name, how it feels, what it's best for, and 1-5 ratings (paddling, speed, turning, stability, airs)
  short: ['Shortboard', "6'2\" thruster. The high-performance board: sharp, snappy turns, snaps off the lip and airs. It's small, so it paddles slowly and you have to take off late and steep, and it loses speed if you stop pumping.", 'Tanjung Uma, Batu Hitam, the Ranch', [2, 4, 5, 2, 5]],
  fish: ['Fish', "5'8\" wide twin fin with a swallow tail. Loose and fast: planes easily, paddles well and flies down the line on soft or slow waves with little pumping. Turns are skatey and the tail drifts early; on steep, heavy waves it's twitchy and loses grip.", 'Pantai Kuda, the Ranch', [4, 5, 4, 3, 4]],
  long: ['Longboard', "9'2\" single fin. Smooth and relaxed: paddles fast and catches waves early, rock steady, glides forever. Turns are slow, wide arcs, like steering a boat, and it can't do snaps or airs. Clumsy in steep barrels.", 'Pantai Kuda (learning)', [5, 3, 1, 5, 0]],
  gun: ['Gun', "9'6\" big-wave board with a pointed nose and pin tail. Paddles into giant waves early, before they get too steep, and holds its line at high speed with lots of grip. Stiff, long turns; sluggish on small waves.", 'Gunung Laut', [5, 4, 2, 5, 2]],
};
// the board picker in the menu: each board's outline in its own colours, the one you're riding lit up
const BOARD_SVG = {
  short: ['M20 17 C20 11 40 8 62 8 C84 8 98 13 102 17 C98 21 84 26 62 26 C40 26 20 23 20 17Z', '#f4f1ea', '#e8715a'],
  fish: ['M22 9 L28 17 L22 25 C40 29 70 28 86 24 C94 21 97 18 97 17 C97 16 94 13 86 10 C70 6 40 5 22 9Z', '#e0b23a', '#1f8a8a'],
  long: ['M4 17 C4 11 22 8 60 8 C100 8 116 12 116 17 C116 22 100 26 60 26 C22 26 4 23 4 17Z', '#efe4c8', '#2f5d8a'],
  gun: ['M3 17 C18 12 48 9 70 9 C94 9 110 14 118 17 C110 20 94 25 70 25 C48 25 18 22 3 17Z', '#c8322a', '#f4f1ea'] };
function boardPicker() {
  const box = document.getElementById('boards'); if (!box || box.childElementCount) return;
  for (const t of ['short', 'fish', 'long', 'gun']) { const [d, fill, rail] = BOARD_SVG[t], b = document.createElement('button'); b.dataset.board = t;
    b.innerHTML = `<svg viewBox="0 0 120 34"><path d="${d}" fill="${fill}" stroke="${rail}" stroke-width="2.5"/><path d="M${t === 'gun' ? 8 : 26} 17 H${t === 'long' ? 112 : 96}" stroke="${rail}" stroke-width="1" opacity=".6"/></svg><span>${BOARD_INFO[t][0]}</span><small>${BOARD_INFO[t][2]}</small>`;
    const pick = (e) => { e.preventDefault(); e.stopPropagation(); useBoard(t); }; b.addEventListener('click', pick); b.addEventListener('touchend', pick, { passive: false }); box.appendChild(b); }
  for (const b of box.children) b.classList.toggle('on', b.dataset.board === boardType); document.getElementById('boardName').textContent = BOARD_INFO[boardType][0];
}
// the stance picker, next to Your villa on the start screen
function stancePicker() {
  const box = document.getElementById('stances'); if (!box || box.childElementCount) return;
  for (const [k, label, tip] of [['goofy', 'Goofy', 'Right foot forward: you face the waves'], ['regular', 'Regular', 'Left foot forward: your back to the waves']]) {
    const b = document.createElement('button'); b.dataset.stance = k; b.title = tip;
    b.innerHTML = `<svg viewBox="0 0 40 20"><ellipse cx="${k === 'goofy' ? 28 : 12}" cy="10" rx="5" ry="3.4" fill="currentColor"/><ellipse cx="${k === 'goofy' ? 12 : 28}" cy="10" rx="5" ry="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span>${label}</span>`;
    const pick = (e) => { e.preventDefault(); e.stopPropagation(); useStance(k); }; b.addEventListener('click', pick); b.addEventListener('touchend', pick, { passive: false }); box.appendChild(b); }
  useStance(stance);
}
function useStance(k) {
  stance = k; try { localStorage.setItem('sumbasurf.stance', k); } catch (e) {}
  for (const b of document.querySelectorAll('[data-stance]')) b.classList.toggle('on', b.dataset.stance === k);
  applyStance();
}
// the body's stance on the board as the physics sees it: at a mirrored (right-hand) spot, the other way round
const physStance = () => (MIRROR ? (stance === 'goofy' ? 'regular' : 'goofy') : stance);
function applyStance() { stanceQ.setFromAxisAngle(WORLD_UP, physStance() === 'regular' ? -Math.PI / 2 : Math.PI / 2); if (rider) rider.backside = physStance() === 'regular'; }   // (on a left, regular is backside; on a right, goofy)
setTimeout(stancePicker, 0);
function useBoard(t) {
  boardType = t; try { localStorage.setItem('sumbasurf.board', t); } catch (e) {}
  rig.remove(board); board.geometry.dispose(); board = makeBoard(t); board.position.z = Math.max(0, (BOARD_LENGTH(t) - 1.88) * 0.33); board.scale.x = MIRROR ? -1 : 1; rig.add(board);   // (at a mirrored spot, mirrored back: the logo reads right)
  boardTail = board.position.z - BOARD_LENGTH(t) / 2 + 0.04; setBoard(t);
  for (const b of document.querySelectorAll('[data-board]')) b.classList.toggle('on', b.dataset.board === t);
  document.getElementById('boardName').textContent = BOARD_INFO[t][0]; if (document.body.classList.contains('playing') && mode !== 'villa') ui.cond.textContent = modeName(mode) + '  \u00b7  ' + BOARD_INFO[t][0] + '  \u00b7  ' + stanceName();

}
try { const t = localStorage.getItem('sumbasurf.board'); if (t && t !== 'short') setTimeout(() => useBoard(t), 0); } catch (e) {}
setTimeout(boardPicker, 0);
// a jukung (Balinese outrigger fishing boat) anchored in the channel up-reef of the peak, bobbing on the swell, and a
// few frigate birds wheeling high over the lineup
const jukung = (() => {
  const g = new THREE.Group(), m = (geo, c) => new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c }));
  const hull = m(new THREE.CylinderGeometry(0.42, 0.25, 7, 8, 1), 0xf2efe6); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.75); g.add(hull);
  const stripe = m(new THREE.CylinderGeometry(0.44, 0.27, 6.4, 8, 1, true), 0x2f6fa8); stripe.rotation.z = Math.PI / 2; stripe.scale.set(1, 1, 0.77); stripe.position.y = 0.12; g.add(stripe);
  for (const e of [-1, 1]) { const beak = m(new THREE.ConeGeometry(0.28, 1.2, 6), 0xd23b2a); beak.rotation.z = -e * Math.PI / 2; beak.position.set(e * 4, 0.25, 0); g.add(beak); }
  for (const zs of [-1, 1]) {
    const float = m(new THREE.CylinderGeometry(0.1, 0.1, 5.5, 5), 0x3a3026); float.rotation.z = Math.PI / 2; float.position.set(0, -0.15, zs * 2.6); g.add(float);
    for (const xs of [-1.4, 1.4]) { const arm = m(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 4), 0x5b4a36); arm.rotation.x = Math.PI / 2; arm.position.set(xs, 0.35, zs * 1.3); g.add(arm); }
  }
  const mast = m(new THREE.CylinderGeometry(0.04, 0.05, 3, 4), 0x5b4a36); mast.position.y = 1.7; g.add(mast);
  // a furled-back triangular sail in bright bands, and a painted eye on each side of the prow
  { const sg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.5, 0, 0, 3.4, 0, 2.4, 0.7, 0]), 3)); sg.computeVertexNormals();
    const sail = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ color: 0xe84a2e, side: THREE.DoubleSide })); sail.position.set(0.05, 0.4, 0); g.add(sail);
    const band = m(new THREE.BoxGeometry(0.02, 0.35, 1.9), 0xf3c522); band.position.set(0.9, 1.5, 0); band.rotation.set(0, Math.PI / 2, -0.62); g.add(band);
    for (const zs of [-1, 1]) { const eye = m(new THREE.CircleGeometry(0.13, 10), 0xfafafa); eye.position.set(3.35, 0.28, zs * 0.3); eye.rotation.y = zs * Math.PI / 2 + (zs < 0 ? Math.PI : 0); g.add(eye); } }
  g.position.set(-70, 0, -120); g.rotation.y = 0.35; g.scale.setScalar(1.2); scene.add(g); return g;   // anchored out the back, where the swells pass unbroken: you see it while you wait
})();
const birds = (() => {
  // a frigate bird: long narrow wings bent at the wrist (the classic 'W' seen from below), forked tail
  const V = [0, 0, 0.55,  -0.5, 0.12, 0.05,  0, 0, -0.1,    -0.5, 0.12, 0.05,  -1.25, -0.05, -0.25,  -0.35, 0.05, -0.12,
             0, 0, 0.55,   0.5, 0.12, 0.05,  0, 0, -0.1,     0.5, 0.12, 0.05,   1.25, -0.05, -0.25,   0.35, 0.05, -0.12,
             0, 0, -0.1,   -0.12, 0, -0.55,  0, 0, -0.35,     0, 0, -0.1,        0.12, 0, -0.55,       0, 0, -0.35];
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(V), 3));
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a1d22, side: THREE.DoubleSide }), list = [];
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(geo, mat); b.userData = { r: 25 + Math.random() * 30, h: 35 + Math.random() * 25, a: Math.random() * 6.3, w: 0.12 + Math.random() * 0.08, cx: -20 + Math.random() * 60, cz: 20 + Math.random() * 40 }; scene.add(b); list.push(b); }
  return list;
})();
const locals = [], _lq = new THREE.Quaternion(), _le = new THREE.Euler(0, 0, 0, 'YXZ');
function updateLocals(dt) {
  for (const L of locals) {
    L.grp.visible = !!rider && !isRanch(); if (!L.grp.visible) continue;
    const y = heightAt(waves, L.x, L.z);
    L.grp.position.set(L.x + Math.sin(T * 0.2 + L.ph) * 0.6, y + 0.05, L.z);
    L.grp.quaternion.setFromEuler(_le.set(-0.25 + Math.sin(T * 1.3 + L.ph) * 0.05, Math.PI + Math.sin(T * 0.15 + L.ph) * 0.3, Math.sin(T * 1.1 + L.ph) * 0.04));   // facing the sets, nose up (sitting on the tail)
    if (L.P) { L.P.reset(); L.grp.updateWorldMatrix(true, false); straddleP(L.P, L.grp); }   // a real person (see loadLocals): legs down either side of the board, hands on the deck
    else { L.mx.update(dt); straddleFor(L.B, L.grp, L.body); }
  }
}
function updateScenery(dt) {
  if (jukung.visible = !!rider && !isRanch() && mode !== 'extreme') { const y = heightAt(waves, jukung.position.x, jukung.position.z); jukung.position.y += (y - 0.05 - jukung.position.y) * Math.min(1, dt * 3); jukung.rotation.x = Math.sin(T * 0.9) * 0.04; jukung.rotation.z = Math.sin(T * 0.7 + 1) * 0.03; }   // (no fishing boat out in The Mountain's storm)
  for (const sg of builtSpots()) if (sg.visible && sg.userData.floaters) for (const f of sg.userData.floaters) {   // each spot's boats and buoys riding the swells
    const y = heightAt(waves, f.x, f.z + sg.position.z); f.m.position.y += (y + f.dy + Math.sin(T * 1.2 + f.ph) * 0.12 - f.m.position.y) * Math.min(1, dt * 6);   // (and a gentle bob on the small sea even where no swell is passing)
    f.m.rotation.x = Math.sin(T * 0.9 + f.ph) * f.rock; f.m.rotation.z = Math.sin(T * 1.1 + f.ph * 1.7) * f.rock; }
  for (const b of birds) { const u = b.userData; u.a += u.w * dt; b.position.set(u.cx + Math.cos(u.a) * u.r, u.h + Math.sin(T * 0.3 + u.r) * 2, u.cz + Math.sin(u.a) * u.r); b.rotation.set(0, -u.a, Math.sin(T * 0.8 + u.r) * 0.25);
    const flap = Math.sin(T * 7 + u.r) * (Math.sin(T * 0.4 + u.r) > 0.6 ? 0.5 : 0.05); b.scale.set(1.8, 1.8 + flap, 1.8); }
}
// the leash: from the tail of the board to your back ankle, hanging in a loose curve (a thin dark line: 7 mm cord)
const LEASH_N = 14, leash = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(LEASH_N * 3), 3)),
  new THREE.LineBasicMaterial({ color: 0x1b1f24 }));
leash.frustumCulled = false; scene.add(leash);
const _la = new THREE.Vector3(), _lb = new THREE.Vector3(), _lc = new THREE.Vector3();
function updateLeash() {
  if (!surfer || !bones.foot_l || !rig.visible || !surfer.visible) { leash.visible = false; return; }   // (hidden while you tumble: you ARE the camera)
  leash.visible = true;
  rig.localToWorld(_la.set(0, 0.05, boardTail));                                         // the plug near the tail
  const fl = bones.foot_l.getWorldPosition(_lb), fr = bones.foot_r.getWorldPosition(_lc);
  const ankle = fl.distanceToSquared(_la) < fr.distanceToSquared(_la) ? fl : fr;         // whichever foot is at the back
  const d = _la.distanceTo(ankle), sag = Math.max(0, 1.8 - d) * 0.35, p = leash.geometry.attributes.position;
  for (let i = 0; i < LEASH_N; i++) { const t = i / (LEASH_N - 1);
    p.setXYZ(i, _la.x + (ankle.x - _la.x) * t, _la.y + (ankle.y - _la.y) * t - sag * 4 * t * (1 - t), _la.z + (ankle.z - _la.z) * t); }
  p.needsUpdate = true;
}
let surfer = null, mixer = null, clips = {}, curClip = null;
// first-person cutaway: your own head, neck, chest and shoulders (a column from your eyes down, this wide) aren't drawn (your neck, shoulders
// and upper arms are right at the camera and would fill the screen); hands, forearms, legs and the board stay
const CUT = { value: 0.21 };   // just the neck and head (at 42 cm it cut your arms off at the elbow: floating hands)
// which skeleton bones are "arm" (upper arm down to the fingertips): the cutaway never removes those, so you always see
// whole arms, while your chest, shoulders and neck near the camera are hidden (they were showing as a stretched skin fin)
const FADE = { value: new THREE.Vector3(0.32, 0.64, 0.25) };   // your own body right at the lens fades out between x and y metres (not a hard cut); inside faces nearer than z aren't drawn
const ARMBONE = { value: new Float32Array(96) }, LEGBONE = { value: new Float32Array(96) }, HIDELEGS = { value: 0 }, ARMTH = { value: 0.12 }, ARMCUT = { value: 0 }, WATERY = { value: -99 };
function cutaway(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = CUT; sh.uniforms.uFade = FADE; sh.uniforms.uArmBone = ARMBONE; sh.uniforms.uNear = { value: m.userData.near || 0 }; sh.uniforms.uArmCut = ARMCUT; sh.uniforms.uWaterY = WATERY; sh.uniforms.uLegBone = LEGBONE; sh.uniforms.uHideLegs = HIDELEGS; sh.uniforms.uArmTh = ARMTH;
    sh.uniforms.uCap = { value: new THREE.Color(m.userData.cap || 0x7a4e36).convertSRGBToLinear() };
    sh.vertexShader = 'varying vec3 vCutW; varying float vArm; varying float vLeg; uniform float uArmBone[96]; uniform float uLegBone[96];\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
vCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#ifdef USE_SKINNING
vArm = skinWeight.x * uArmBone[int(skinIndex.x)] + skinWeight.y * uArmBone[int(skinIndex.y)] + skinWeight.z * uArmBone[int(skinIndex.z)] + skinWeight.w * uArmBone[int(skinIndex.w)];
vLeg = skinWeight.x * uLegBone[int(skinIndex.x)] + skinWeight.y * uLegBone[int(skinIndex.y)] + skinWeight.z * uLegBone[int(skinIndex.z)] + skinWeight.w * uLegBone[int(skinIndex.w)];
#else
vArm = 0.; vLeg = 0.;
#endif`);
    sh.fragmentShader = 'uniform float uCut, uNear, uArmCut, uWaterY, uHideLegs, uArmTh; uniform vec3 uCap, uFade;\nvarying vec3 vCutW; varying float vArm; varying float vLeg;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  vec3 cq = vCutW - cameraPosition; float cy = clamp(cq.y, -0.75, 0.);
  float armK = smoothstep(.3, .6, vArm), nearA = mix(smoothstep(mix(uFade.x, uFade.x * .5, armK) + uNear, mix(uFade.y, uFade.y * .55, armK) + uNear, length(cq)), 1., smoothstep(.7, .95, vArm));   // (forearm and hand always solid, the upper arm only fades right at the lens, the shoulder further out)   // (forearm and hand always solid: faded, the arm showed the sea through it as a band at the elbow)   // (the shorts fade further out: seen through a fading arm they showed as a teal ring)
  if (vArm < uArmTh && (length(cq - vec3(0., cy, 0.)) < uCut * 1.9 || length(cq) < uCut * 2.2)) discard;   // body near the eyes (any skin belonging to an arm or shoulder is kept whole: cutting it left holes)
  if (uHideLegs > .5 && (vLeg > .35 || uNear > 0.)) discard;   // (and the shorts with them: seen through the crease of a bent elbow they showed as a teal band)   // your own legs aren't drawn in your view (knees coming up at the lens read as a glitch): arms and board only
  if (vCutW.y < uWaterY) discard;   // lying or sitting on the board: hands and legs under the surface are hidden by the water (the body is drawn after the world, so it would show on top)
  if (vArm >= 0.12 && length(cq) < uArmCut) discard;   // (>= 0.12: the shoulder skin is only part arm-weighted)   // the upper arm is right at the lens: only forearms and hands show, like helmet-cam footage
  if (!gl_FrontFacing && length(cq) < uFade.z) discard;   // (right at the lens a cut arm's inside is never capped: seen from inside, the cap filled the view as a black blob)
  if (!gl_FrontFacing) { gl_FragColor = vec4(uCap, smoothstep(uFade.z, uFade.z + .2, length(cq))); gl_FragDepth = gl_FragColor.a < .98 ? .99999 : gl_FragCoord.z; return; }   // (fading in away from the lens: up close a solid cap filled the view as a dark blob)   // a cut shows solid skin/cloth, never the hollow inside (that was the 'fin')
  if (length(cq) < uCut * 0.6 + uNear) discard;   // (uNear > 0 on the shorts: sliced close to the lens they showed as teal hooks)   // anything right in the lens (arms are never cut: a cut shows the hollow inside of the arm as a 'fin')`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a *= nearA; gl_FragDepth = nearA < .98 ? .99999 : gl_FragCoord.z;');   // (your own arm swinging past the lens in a hard turn fades, never a sliced sleeve or a dark cap)
  };
  m.side = THREE.DoubleSide;   // (inside faces are drawn as a solid cap colour, so a cut looks closed)
  m.transparent = true;   // (for the fade at the lens; everything else is drawn solid, alpha 1)
  m.customProgramCacheKey = () => 'cutaway26' + (m.userData.near || 0);
  m.needsUpdate = true;
}
const hairMeshes = [];   // your own hair: with your head shrunk away for your own eyes it collapsed into a dark sheet from your neck to the lens, which filled the screen in hard turns. Only drawn when you're seen from outside
const ready = new Promise((res, rej) => new GLTFLoader().load('surfer.glb?v=3', (g) => {
  surfer = g.scene; rig.add(surfer);
  surfer.traverse((o) => o.layers.set(1));
  surfer.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (o.material.name === 'hair') { o.material.side = THREE.DoubleSide; hairMeshes.push(o); } else { if (/short/i.test(o.material.name + o.name)) { o.material.userData.near = 0.45; o.material.userData.cap = 0x0f3b3f; } cutaway(o.material); } } });
  surfer.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.bones.forEach((b, i) => { if (i < 96 && /^(lowerarm|hand|thumb|index|middle|ring|pinky)/.test(b.name)) ARMBONE.value[i] = 1; if (i < 96 && /^upperarm/.test(b.name)) ARMBONE.value[i] = 0.6; if (i < 96 && /^clavicle/.test(b.name)) ARMBONE.value[i] = 0.1; }); });
  surfer.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.bones.forEach((b, i) => { if (i < 96 && /^(thigh|calf|foot|ball)/.test(b.name)) LEGBONE.value[i] = 1; }); });
  mixer = new THREE.AnimationMixer(surfer);
  for (const c of g.animations) { c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale')); clips[c.name] = mixer.clipAction(c); }
  // two locals sitting in the lineup either side of you, waiting for a set like you (same body, their own board)
  const sit = g.animations.find((c) => c.name === 'sit');
  for (const [x, z, ph] of [[-13, -15, 0], [17, -7, 2.1]]) {
    const body = cloneSkinned(g.scene), grp = new THREE.Group(), brd = makeBoard();
    // (drawn in the world like anything else, not through your body's own lens on top of everything; own plain materials, no cutaway)
    body.traverse((o) => { o.layers.set(0); if (o.isMesh) { o.frustumCulled = false; o.material = o.material.clone(); o.material.side = THREE.FrontSide; } });
    body.position.set(0, -0.36, -0.25); grp.add(brd, body); scene.add(grp);
    const mx = new THREE.AnimationMixer(body); if (sit) { const a = mx.clipAction(sit); a.play(); a.time = ph; }
    locals.push({ grp, mx, x, z, ph, body, B: {} });
  }
  res();
}, undefined, (err) => { ui.load.textContent = 'Could not load the surfer. Check your connection and reload.'; rej(err); }));
function play(name, { fade = 0.25, once = false, speed = 1, weight = 1 } = {}) {
  const a = clips[name]; if (!a) return;
  a.timeScale = speed; a.weight = weight;
  if (curClip === a) return;
  if (curClip === clips.crouch && clips.stand) clips.stand.fadeOut(fade);   // the stance blend's second layer must not linger into other poses
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = true;
  if (curClip) a.crossFadeFrom(curClip, fade, false);
  a.play(); curClip = a;
}

// ---------- the surf: a reef with the peak at x=0, z=0. Waves come in from the sea one swell period apart.
// Each wave breaks at the peak when it gets there and peels off to the right. You sit in the lineup and pick your own.
let mode = null, rider = null, waves = [], session = { waves: 0, total: 0, best: 0, scores: [], barrels: 0 }, nextBreak = 0, setLeft = 0, setPos = 0;
let REEF = { xEnd: 190, zBeach: 150 }; const PROFILES = new Map(), PROFILES_W = new Map();   // room for the bigger swells to run (the sand starts ~185 m in)
const OCEAN_REEF = REEF, RANCH_REEF = { xEnd: POOL.x1 - 60, zBeach: POOL.z1 - 20 };
const POOL_PLANES = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -POOL.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), POOL.x1), new THREE.Plane(new THREE.Vector3(0, 0, 1), -POOL.z0), new THREE.Plane(new THREE.Vector3(0, 0, -1), POOL.z1)];
renderer.localClippingEnabled = true;
let ranchKind = 'medium';   // the wave you last ordered at the Surf Ranch
const isRanch = () => mode === 'ranch';
const modeName = (m) => m === 'villa' ? 'Your villa' : m === 'ranch' ? 'Surf Ranch' : m === 'random' ? 'Random' : SPOTS[m] ? SPOTS[m].name : CONDITIONS[m].name;
// which world you're in: the Bali coast, or the wave pool (same water and waves, clipped to the pool, no reef under it)
function setSpot(m) {
  const r = m === 'ranch', key = SPOTS[m] ? m : 'medium', S = SPOTS[key];
  for (const g of builtSpots()) g.visible = false;
  if (!r) { const sg = spotGroup(scene, key); sg.visible = true; if (sg.userData.farVilla) sg.userData.farVilla.visible = m !== 'villa'; }   // (at the villa itself the real house is drawn, not the stand-in seen from the water)
  ranchW.group.visible = r;
  if (villaW) villaW.group.visible = m === 'villa'; if (crewW) crewW.group.visible = m === 'villa'; if (wildW) wildW.group.visible = m === 'villa'; if (friendsW) { friendsW.group.visible = m === 'villa'; if (m !== 'villa') friendsW.hide(); }
  { const warm = m === 'villa', W = ENV.weather || {}; hemi.color.set(warm ? 0xfff0dc : W.hemi || 0xcfe6ff); hemi.groundColor.set(warm ? 0x5a4030 : W.hemiGround || 0x3a4a48); sunLight.color.set(warm ? 0xffdcb0 : W.light || 0xfff0dd); }   // (a spot's own light on the land: its weather can warm it or grey it)   // (the villa in warm evening light, reflected off the wood; the surf spots keep their clear daylight)
  ENV.uReefEnd.value = 190 + S.dz; ENV.uReefTint.value.setRGB(...S.reefTint); ENV.uReefK.value = S.reefK || 0.38;
  if (r) ENV.uPool.value.set(POOL.x0, POOL.x1, POOL.z0, POOL.z1); else ENV.uPool.value.set(-1e6, 1e6, -1e6, 1e6);
  ENV.uReef.value = r ? 0 : 1;
  REEF = r ? RANCH_REEF : { xEnd: S.xEnd || OCEAN_REEF.xEnd, zBeach: OCEAN_REEF.zBeach + S.dz };   // (each spot's beach is further back or closer in)
  // a right-hand spot: the same world and physics as a left, the finished picture flipped left to right (so the wave
  // peels to your right); the stance you chose is kept as you see it, which means the body inside is the other way round
  const was = MIRROR; MIRROR = !!S.mirror && !r && m !== 'villa'; board.scale.x = MIRROR ? -1 : 1; applyStance();   // (the board mirrored back, so its logo reads right in the flipped picture)
  if (MIRROR !== was) renderer.state.reset();   // (the triangle facing flips with it: have the renderer set it afresh)
}
function condFor(m) { return m === 'villa' ? 'medium' : m === 'ranch' ? ranchKind : m === 'random' ? ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] : m; }
function addWave(tBreak) {
  const cond = mode === 'ranch' ? RANCH_CONDITIONS[ranchKind] : CONDITIONS[condFor(mode)];   // (the pool has its own machine waves)
  const w = new Wave(scene, cond);
  if (!PROFILES.has(cond)) { PROFILES.set(cond, new Profile(w)); PROFILES_W.set(cond, new Profile(w.whiteView())); }   // (and its closed-out copy)      // the surface shape is the same for every wave of a size: share its cache
  if (isRanch()) for (const k of ['mist', 'spit', 'veil', 'spray']) if (w[k]) { w[k].material.clippingPlanes = POOL_PLANES; w[k].material.needsUpdate = true; }   // (spray and mist stay inside the pool, not drifting over the deck)
  w.tBreak = tBreak; w.prof = PROFILES.get(cond); w.profW = PROFILES_W.get(cond); w.xEnd = REEF.xEnd; w.zBeach = REEF.zBeach; w.seed = Math.random() * 100;
  waves.push(w);
  return w;
}
function updateWaves(dt) {
  for (const pr of PROFILES.values()) pr.warm(24);
  for (const pr of PROFILES_W.values()) pr.warm(12);
  // keep the next wave lined up out to sea; a swell period apart, give or take
  // swell arrives in sets: 3-4 waves one period apart, the bigger ones in the middle, then a lull (shortened for play)
  while (!isRanch() && nextBreak - T < 150 / 6) {   // (the Surf Ranch only makes a wave when you order one)
    const w = addWave(nextBreak);
    if (setLeft <= 0) { setLeft = 3 + (Math.random() < 0.5 ? 1 : 0); setPos = 0; }
    const n = setPos / Math.max(1, setLeft + setPos - 1);
    w.size = 0.82 + 0.28 * Math.sin(Math.PI * Math.min(1, n + 0.15)) + (Math.random() - 0.5) * 0.08;
    setPos++; setLeft--;
    nextBreak += setLeft > 0 ? w.cond.period * (0.9 + Math.random() * 0.2) : w.cond.period * (1.2 + Math.random() * 0.4);   // lull: long enough to paddle back and breathe, short enough not to bore
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i], C = w.cond, t = T - w.tBreak;
    // the break doesn't peel at one steady speed: sections race ahead and slow down (more so in heavy surf), so a tube
    // opens and pinches and you have to keep adjusting. Integrated so it stays smooth.
    const sg = C.wobble;   // (each spot's own: see CONDITIONS)
    let rate = C.peel * (1 + sg * (0.6 * Math.sin(t * 0.55 + w.seed) + 0.4 * Math.sin(t * 1.3 + w.seed * 2.1)));
    // sections: every few seconds a stretch ahead of the curl throws all at once, so the break races ahead for about a
    // second (the curl jumps 1.5-2 wave heights down the line), then eases while it recovers. You race it, or pull in.
    if (t > 0) {
      if (w.secT === undefined) w.secT = 3 + Math.random() * 4;
      // set up in the pocket (standing, just ahead of the curl, low on the face, not racing away) and the next section
      // throws right over you soon: real barrels mostly come to you like this, rather than after a long wait
      if (C.assist !== false && rider && rider.wave === w && rider.state === 'RIDE' && !rider.inBarrel && rider.s > 0.2 * C.H && rider.s < 2.2 * C.H && rider.y < 0.6 * C.H && !(w.secK > 0) && w.secT > 0.6) { w.secT = 0.6; w.secSoft = true; }   // (a softer section: it covers you rather than racing past)
      // a long time in the tube and the barrel breathes out: the spit blows you out onto the open face (if you're sitting
      // too deep by then, the foam ball gets you first). Real barrels last a few seconds; a perfectly even tube went on for
      // half a minute. A barrel spits after 4.5-6.5 s
      if (rider && rider.wave === w && rider.inBarrel) {
        if (!rider.spitAt) rider.spitAt = 4.5 + Math.random() * 2;
        if ((rider.ride.tubeT || 0) > rider.spitAt) { rider.spitAt += 3; if (rider.s > -1.5 * C.H || (C.tube || 0) >= 0.8) { rider.spitOut = 1.8; if (w.spitT !== undefined) w.spitT = 0.25; } }   // (at the heavy spots the spit only blows you out if you're near the mouth; the friendly tubes forgive a deeper line)   // (and again every 3 s if you hang on in there)
      } else if (rider && rider.wave === w && !(rider.ride.tubeT > 0)) rider.spitAt = 0;
      if (w.secK === undefined || w.secK <= 0) { w.secT -= dt; if (w.secT <= 0) { w.secK = 1.1; w.secA = w.secSoft ? C.softA : 1; w.secSoft = false; w.secT = 5 + Math.random() * 5; if (w.spitT !== undefined) w.spitT = 0.25; } }   // (a heavy wave's section throws hard over you: race it or it closes on you)
      else { w.secK -= dt; const ph = 1 - w.secK / 1.1, A = C.burst; rate *= ph < 0.75 ? 1 + A * (w.secA || 1) * Math.sin(Math.PI * ph / 0.75) : 1 - 0.4 * (w.secA || 1); }
    }
    // the end near the sand: the rest of the wave closes out, the whole section left throws at once (the break races down
    // the line, faster and faster) and everything behind it is whitewater; you kick out before it or it takes you
    if (w.closing) w.closeT += dt;   // (see Wave.closeMask: the lip comes down along the whole section left, the break itself doesn't race off down the line)
    w.px = (w.px === undefined ? C.peel * t : w.px + rate * dt);
    w.peelRate = rate;   // the physics uses the peel speed right now (not the average), so the wave's push matches what you see
    // where this wave breaks: like a real reef, not every wave on the same spot. Each breaks a few metres up or down the
    // reef from the usual peak, and the bigger waves of a set a little further out (the pool's machine waves never vary)
    if (w.pkX === undefined) { const pool = isRanch(); w.pkX = pool ? 0 : (Math.random() * 2 - 1) * 7; w.pkZ = pool ? 0 : Math.max(-3, Math.min(2, -2.5 * ((w.size || 1) - 0.95) / 0.2 + (Math.random() * 2 - 1) * 0.8)); }   // (in and out only a little: more made the bigger waves break right on the lineup)
    w.place(w.pkX + w.px, w.pkZ + C.speed * t);
    // the natural end of a wave: over the last stretch of reef it runs into deeper water, and near the sand it hits
    // the shallows; either way it backs off and shrinks away (the barrel softening and closing) instead of stopping dead
    const reefK = Math.min(1, Math.max(0, (REEF.xEnd - w.peelX) / 38)), beachK = Math.min(1, Math.max(0, (REEF.zBeach - w.zW) / 45));
    w.endK = Math.min(reefK, beachK); w.endBy = beachK < reefK ? 'beach' : 'reef';
    if (!w.closing && !isRanch() && w.endBy === 'beach' && beachK < 0.55) { w.closing = true; w.closeT = 0; }   // (a little further in than the old racing break started: its lip reaches you sooner, so rides last as long as they did)
    if (w.endK < 0.88 && !w.spat) { w.spat = true; if (w.spitT !== undefined) w.spitT = 0.3; if (rider && rider.wave === w && rider.inBarrel) rider.spitOut = 1.8; }   // (the spit: see the rider's judge)
    w.fade = (w.size || 1) * (w.closing ? 1 - 0.97 * smooth01((w.closeT - 1.5) / 5.5) : reefK) * Math.min(1, Math.max(0.15, 1 + (w.zW + 160) / 60));   // (closed out, it keeps its height while it breaks, then the whitewater shrinks as it rolls on into the shallows)
    if (isRanch()) w.fade = Math.min(1, Math.max(0.02, (w.zW - POOL.z0) / 22)) * w.endK;   // the pool wave rises out of the machine wall   // far out it's a small swell; past the end of the reef it backs off
    // (performance) a wave far from you (not yours, 120 m+ off) moves its spray and mist 30 times a second instead of 60:
    // at that distance nobody can tell, and it was the biggest single cost left in a frame
    w.update(dt, !globalThis.__slowMat && !(rider && rider.wave === w) && Math.hypot(w.peelX - camera.position.x, w.zW - camera.position.z) > 120);
    if (w.zW > REEF.zBeach + 40 || w.peelX > REEF.xEnd + 45 || w.closeT > 7.5) { w.dispose(scene); waves.splice(i, 1); }
  }
}
// the next wave that hasn't reached you yet, and how many seconds until its face gets to you
function incoming() {
  let best = null, tBest = 1e9;
  for (const w of waves) {
    const zl = rider.z - w.zW; if (zl < -2) continue;                 // already past you
    const t = (zl - 6) / w.cond.speed; if (t < tBest) { tBest = t; best = w; }
  }
  return { w: best, t: tBest };
}
function spawnRider() {
  if (surfer) endWipe(); rig.visible = true; board.visible = true; for (const b of birds) b.visible = !isRanch();
  pumpC = 0; pumpA = 0; stanceW = 0; lastState = ''; endT = -1; snapCam = true;
  rider = rider || new Rider();
  track.clear();
  rider.backside = physStance() === 'regular';   // (on a left regular is backside; at a mirrored right, goofy)
  // in the lineup: just outside and a little down the line from the peak, sitting up facing the sets
  rider.reset(2 + Math.random() * 4, -7 - Math.random() * 3, -Math.PI / 2);
  // don't drop a wave on your head as you arrive
  // don't drop a wave on your head as you arrive: hold back every wave that hasn't reached you yet
  { const inc = incoming(); if (inc.t < 7) { const shift = 7 - inc.t;
      for (const w of waves) if (rider.z - w.zW >= -2) { w.tBreak += shift; if (w.px !== undefined) w.px -= w.cond.peel * shift; }   // (its break point too, or it breaks down the reef)
      nextBreak += shift; } }
  ui.msg.style.display = 'none';
}

// ---------- the Surf Ranch: you order each wave. The machine starts it at the deep end a few seconds out, it runs down
// the pool past you, and you can order the next one once it has gone by.
const ranchWaiting = () => isRanch() && rider && !rider.standing && rider.state === 'LIE' && !waves.some((w) => w.zW < rider.z + 4);
function ranchSend(kind) {
  if (!ranchWaiting()) return;
  ranchKind = kind; audio.machine();
  // the wave leaves the machine wall 1.5 s after you order it (the lights pulse first), then runs down the pool to you
  const C = RANCH_CONDITIONS[kind], zStart = POOL.z0 + 1;
  const w = addWave(T + 1.5 - zStart / C.speed); w.size = 1; w.ranchT0 = T;   // (every pool wave is the full size: no sets)
}
for (const b of document.querySelectorAll('#ranch button')) {
  const go = (e) => { e.preventDefault(); e.stopPropagation(); ranchSend(b.dataset.wave); };
  b.addEventListener('touchstart', go, { passive: false }); b.addEventListener('click', go);
}
// the machine rides its rail at the breaking point of the wave it's pulling; with no wave it waits at the start
function updateRanch(dt) {
  if (!isRanch()) return;
  const w = waves[waves.length - 1], L = ranchW.lights;
  // the machine's lights: dim teal when idle, all pulsing while it charges (the 1.5 s after you order), then a bright
  // band sweeping along the wall with the breaking point as the wave is made
  const charging = w && T - w.ranchT0 < 1.5, pulse = 0.5 + 0.5 * Math.sin(T * 14);
  for (let i = 0; i < ranchW.NC; i++) {
    const x = POOL.x0 + ranchW.CH / 2 + i * ranchW.CH;
    let k = 0;
    if (charging) k = 0.35 + 0.5 * pulse;
    else if (w && w.zW < POOL.z0 + 60) { const d = x - w.peelX; k = d < 6 && d > -30 ? (1 - Math.max(0, -d) / 30) : 0; }   // lit where the wave is leaving the wall
    _rc.setRGB(0.1 + 0.9 * k, 0.3 + 0.62 * k, 0.36 + 0.5 * k); L.setColorAt(i, _rc);
  }
  L.instanceColor.needsUpdate = true;
  document.body.classList.toggle('ranch-wait', !!ranchWaiting());
  // the pool walls: you can't paddle through them
  if (rider) { const m = 3; rider.x = Math.min(POOL.x1 - m, Math.max(POOL.x0 + m, rider.x)); rider.z = Math.min(POOL.z1 - m, Math.max(POOL.z0 + m, rider.z)); }
}
const _rc = new THREE.Color();

// ---------- controls: PADDLE/PUMP (hold, left) and a thumb pad (right half). Keyboard for testing.
const input = { paddle: false, steer: 0 };
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (/^(Space|Arrow)/.test(e.code) && ui.start.style.display === 'none') { e.preventDefault(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); } });   // (in play, Space and the arrows are the controls: never 'press' a button left focused, never scroll)
addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());   // (switching apps mid-press)
const ui = {
  paddle: document.getElementById('paddle'), stall: document.getElementById('stall'), pad: document.getElementById('pad'), touch: document.getElementById('touch'), knob: document.querySelector('#touch b'),
  speed: document.getElementById('speed'), score: document.getElementById('score'), cond: document.getElementById('cond'),
  msg: document.getElementById('msg'), msgT: document.getElementById('msg-t'), msgN: document.getElementById('msg-n'), msgS: document.getElementById('msg-s'), msgJ: document.getElementById('msg-j'),
  tube: document.getElementById('tube'), hint: document.getElementById('hint'), load: document.getElementById('load'), start: document.getElementById('start'), sess: document.getElementById('sess'),
};
// the same tips in keyboard words, on a computer
const DESK_WORDS = [['Slide your thumb left and right to carve, like a steering wheel', 'Carve with the arrow keys (or A and D), like a steering wheel'], ['Let go and the board just glides straight', 'Let go of the keys and the board just glides straight'],
  ['PUMP and steer', 'Hold Space and steer'], ['hold PUMP', 'hold Space'], ['Hold PUMP', 'Hold Space'], ['tap PUMP', 'tap Space'], ['Tap PUMP', 'Tap Space'], ['STALL', 'Down'], ['Paddle now!', 'Paddle now! (Space)'], ['Paddle hard!', 'Paddle hard! (hold Space)'], ['Keep paddling!', 'Keep paddling! (Space)'],
  ['Wave coming: turn to face', 'Wave coming: use the arrow keys to face']];
const deskHint = (h) => { for (const [a, b] of DESK_WORDS) if (h.includes(a)) h = h.replace(a, b); return h; };
const hold = (el, on, off) => {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); on(e); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); if (e.targetTouches.length === 0) off(e); }, { passive: false });
  el.addEventListener('touchcancel', (e) => { e.preventDefault(); if (e.targetTouches.length === 0) off(e); }, { passive: false });
  el.addEventListener('mousedown', on); addEventListener('mouseup', off);
};
if (DESK) ui.stall.innerHTML = 'STALL<small>DOWN</small>';
hold(ui.paddle, () => { audio.wake(); input.paddleBtn = true; ui.paddle.classList.add('down'); }, () => { input.paddleBtn = false; ui.paddle.classList.remove('down'); });
hold(ui.stall, () => { audio.wake(); input.stallBtn = true; ui.stall.classList.add('down'); }, () => { input.stallBtn = false; ui.stall.classList.remove('down'); });
// thumb: touch anywhere on the right half and drag; the spot you first touch is the centre.
// Left/right turns the board left/right, like leaning on a real board: lying, it points you where you paddle; standing, it carves.
let padTouch = null, padX = 0, padY = 0, lastPadTouch = undefined, lastKnob = '', steerF = 0, stickY = 0, lastStickMode = null;
const PAD_R = 80;                                                   // thumb travel (px) for a full lean
const padMove = (x, y) => { if (!padTouch) return; padX = Math.max(-1, Math.min(1, (x - padTouch.x0) / PAD_R)); padY = Math.max(-1, Math.min(1, (y - padTouch.y0) / PAD_R)); };
ui.pad.addEventListener('touchstart', (e) => { e.preventDefault(); audio.wake(); if (padTouch) return; const t = e.changedTouches[0]; padTouch = { id: t.identifier, x0: t.clientX, y0: t.clientY }; padX = padY = 0; }, { passive: false });
ui.pad.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (padTouch && t.identifier === padTouch.id) padMove(t.clientX, t.clientY); }, { passive: false });
const padEnd = (e) => { e.preventDefault(); for (const t of e.changedTouches) if (padTouch && t.identifier === padTouch.id) padTouch = null; };
ui.pad.addEventListener('touchend', padEnd, { passive: false }); ui.pad.addEventListener('touchcancel', padEnd, { passive: false });
ui.pad.addEventListener('mousedown', (e) => { padTouch = { id: 'm', x0: e.clientX, y0: e.clientY }; padX = padY = 0; });
addEventListener('mousemove', (e) => { if (padTouch && padTouch.id === 'm') padMove(e.clientX, e.clientY); });
addEventListener('mouseup', () => { if (padTouch && padTouch.id === 'm') padTouch = null; });
function readInput(dt) {
  if (!padTouch) { padX *= Math.max(0, 1 - dt * 10); padY *= Math.max(0, 1 - dt * 10); }   // let go and the board runs straight
  const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  // thumb feel: a small dead zone (a resting thumb wobbles), fine control near the centre, full lean at the edge,
  // and a light filter so the board answers smoothly instead of twitching with every pixel
  const shape = (v) => { const a = Math.abs(v); return a < 0.08 ? 0 : Math.sign(v) * Math.pow((a - 0.08) / 0.92, 1.15); };   // (a gentler curve: half the pad asks for a real, gentle turn)
  const ky = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  const sx = input.stick ? input.stick.x : (kx || shape(padX)) * (MIRROR ? -1 : 1), sy = input.stick ? input.stick.y : ky || shape(padY);   // (a mirrored spot: your thumb steers what you see)
  steerF += (sx - steerF) * Math.min(1, dt * 14);
  stickY += (sy - stickY) * Math.min(1, dt * 14);
  input.steer = input.test != null ? input.test : steerF;   // input.test: scripted steering for automated checks
  input.up = input.test != null ? 0 : stickY;              // thumb up (-) / down (+): where on the face you want to be
  input.paddle = !!input.paddleBtn || keys.has('Space');
  const riding = !!(rider && rider.standing && (rider.state === 'RIDE' || rider.state === 'POP'));
  if (riding !== lastStickMode) { document.body.classList.toggle('riding', riding); lastStickMode = riding; }
  if (padTouch !== lastPadTouch) {
    ui.touch.classList.toggle('live', !!padTouch);
    if (padTouch) { ui.touch.style.left = padTouch.x0 + 'px'; ui.touch.style.top = padTouch.y0 + 'px'; }
    lastPadTouch = padTouch;
  }
  const kt = `translate(${Math.round(padX * PAD_R)}px,0px)`; if (kt !== lastKnob) { ui.knob.style.transform = kt; lastKnob = kt; }
  return { paddle: input.paddle, pump: input.paddle, steer: input.steer, up: input.up };    // same button: paddle lying down, pump once standing; steer + = turn right
}

// Riding, "steer and pedals" (his pick), seamless like a simulator: no modes, no hidden steering.
//   right thumb slider = lean the board left / right, as far and as long as you like (the camera is behind you, so
//                        left/right always match the screen; keep turning and you carve round into a cutback)
//   left thumb PUMP    = speed    STALL = brake (back foot + trailing hand dragged in the face, the barrel catches you)
function surfSteer(sx, stall) {
  return { steer: sx, stall: stall ? 1 : 0 };
}

// your best ride per level, kept on this phone (quietly does nothing if storage is blocked)
// (best5: the stricter judge of 28 Sep 2026 started everyone's bests afresh; the old best4 scores aren't comparable)
const bestFor = (m) => { try { return +localStorage.getItem('balisurf.best5.' + m) || 0; } catch (e) { return 0; } };
const saveBest = (m, v) => { try { localStorage.setItem('balisurf.best5.' + m, String(v)); } catch (e) {} showBests(); };
function showBests() {
  for (const b of document.querySelectorAll('[data-mode]')) {
    let el = b.querySelector('.best'); const v = bestFor(b.dataset.mode);
    if (!el) { el = document.createElement('em'); el.className = 'best'; b.appendChild(el); }
    el.innerHTML = v ? `<b>${v.toFixed(1)}</b>best wave` : '';
  }
}
showBests();
// ---------- challenges: three per spot, each suited to that wave. Nothing unlocks: they're just there to try hard at.
// Kept on this phone. On the menu each spot shows three dots (lit when done); arriving at a spot the three show for a few
// seconds; finishing one shows a banner where the move callouts go; the score screen says how many of the three are done
const CHAL = {
  easy: [['Ride one wave for 20 seconds', (c) => c.t >= 20], ['Land 3 snaps on one wave', (c) => c.snaps >= 3], ['Ride one all the way to the end', (c) => c.end]],
  medium: [['Get barrelled for 8 seconds', (c) => c.tube >= 8], ['2 cutbacks on one wave', (c) => c.cutbacks >= 2], ['Score 7.5 or more on a wave', (c) => c.final && c.score >= 7.5]],
  hard: [['Make the drop and ride 15 seconds', (c) => c.t >= 15], ['Hit 65 km/h', (c) => c.top >= 65], ['Come out of a 5 second barrel', (c) => c.out && c.tube >= 5]],
  extreme: [['Ride the giant for 20 seconds', (c) => c.t >= 20], ['An 8 second barrel inside the giant', (c) => c.tube >= 8], ['Hit 90 km/h', (c) => c.top >= 90]],
  kanan: [['Get barrelled for 10 seconds', (c) => c.tube >= 10], ['Snap, cutback and barrel on one wave', (c) => c.snaps >= 1 && c.cutbacks >= 1 && c.out], ['A heat score of 13', (c) => c.final && c.heat >= 13]],
  hiu: [['Hit 65 km/h', (c) => c.top >= 65], ['Ride one wave for 20 seconds', (c) => c.t >= 20], ['A 5 second barrel on the longboard', (c) => c.board === 'long' && c.tube >= 5]],
  ranch: [['6 turns on one wave', (c) => c.turns >= 6], ['Get barrelled for 10 seconds', (c) => c.tube >= 10], ['Ride all three wave settings in one visit', (c) => c.kinds >= 3]],
};
const chalDone = (() => { try { return JSON.parse(localStorage.getItem('sumbasurf.chal') || '{}') || {}; } catch (e) { return {}; } })();
const chalHas = (m, i) => !!(chalDone[m] && chalDone[m][i]);
const chalCount = (m) => (CHAL[m] || []).filter((_, i) => chalHas(m, i)).length;
function chalDots() {
  for (const b of document.querySelectorAll('[data-mode]')) {
    const m = b.dataset.mode; if (!CHAL[m]) continue;
    let el = b.querySelector('.chd'); if (!el) { el = document.createElement('i'); el.className = 'chd'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<b></b><b></b><b></b>'; b.appendChild(el); }
    [...el.children].forEach((d, i) => d.classList.toggle('on', chalHas(m, i)));
  }
}
chalDots();
const chalBox = document.getElementById('chal'), chalBan = document.getElementById('chalDone');
const TICK = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.8 8.3l2.2 2.2 4.2-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RING = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
let chalHideT = null;
// arriving at a spot: its three challenges, for a few seconds, then out of the way
function chalIntro(m) {
  const L = CHAL[m]; if (!L || !chalBox) return;
  chalBox.innerHTML = `<b>${modeName(m)} challenges</b>` + L.map(([t], i) => `<div class="${chalHas(m, i) ? 'ok' : ''}">${chalHas(m, i) ? TICK : RING}<span>${t}</span></div>`).join('');
  chalBox.classList.add('on'); clearTimeout(chalHideT); chalHideT = setTimeout(() => chalBox.classList.remove('on'), 4500);   // (was 6.5 s: it sat over the surf too long)
}
function chalHide() { if (chalBox) chalBox.classList.remove('on'); clearTimeout(chalHideT); }
let chalBanT = null;
function chalWin(text) {
  if (!chalBan) return;
  chalBan.innerHTML = `<small>Challenge done</small>${text}`; chalBan.classList.remove('on'); void chalBan.offsetWidth; chalBan.classList.add('on');
  clearTimeout(chalBanT); chalBanT = setTimeout(() => chalBan.classList.remove('on'), 2600);
  audio.tone(784, 0.07, 0.35); audio.tone(1047, 0.07, 0.5, { delay: 0.12 });   // (a small two-note chime)
}
// the ride so far (and, at the end, its score and your heat), checked against the spot's three
let chalRide = null, chalTube = 0, chalKinds = new Set();
function chalCheck(final, heat = 0) {
  const L = CHAL[mode]; if (!L || !rider) return;
  if (chalRide !== rider.ride) { chalRide = rider.ride; chalTube = 0; }
  const r = rider.ride; if (rider.inBarrel) chalTube = Math.max(chalTube, r.tubeT);
  const names = r.moves.map((x) => x.name);
  const c = { final, t: r.t, top: r.top, snaps: r.snaps, cutbacks: r.cutbacks, turns: r.turns, tube: chalTube, out: names.includes('BARREL'), end: !!r.end, score: r.score || 0, heat, board: boardType, kinds: chalKinds.size };
  L.forEach(([text, ok], i) => { if (chalHas(mode, i) || !ok(c)) return;
    (chalDone[mode] ||= [])[i] = 1; try { localStorage.setItem('sumbasurf.chal', JSON.stringify(chalDone)); } catch (e) {}
    chalWin(text); chalDots(); });
}
// the spots only select (the one you'll surf lights up and is remembered); START SURFING takes you there
let spotSel = 'easy'; try { const v = localStorage.getItem('sumbasurf.spot'); if (v && document.querySelector(`[data-mode="${v}"]`)) spotSel = v; } catch (e) {}
const spotLabel = (m) => m === 'ranch' ? 'Surf Ranch' : (SPOTS[m] && SPOTS[m].name) || m;
function selSpot(m) { spotSel = m; try { localStorage.setItem('sumbasurf.spot', m); } catch (e) {}
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('sel', b.dataset.mode === m);
  document.getElementById('goSpot').textContent = spotLabel(m); }
// a tap that counts even if the finger slides a little (the page blocks touch scrolling, and on a phone that made a tap
// with any movement in it vanish: spots needed pressing two or three times)
function onTap(el, fn) {
  let t0 = null;
  el.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; t0 = { x: t.clientX, y: t.clientY }; }, { passive: true });
  el.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; if (t0 && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) < 28) { e.preventDefault(); fn(e); } t0 = null; }, { passive: false });
  el.addEventListener('click', fn);   // (mouse and keyboard; after a handled touch the browser sends no click)
}
for (const b of document.querySelectorAll('[data-mode]')) onTap(b, () => selSpot(b.dataset.mode));
selSpot(spotSel);
onTap(document.getElementById('goSurf'), () => start(spotSel));
for (const b of document.querySelectorAll('[data-board]')) b.addEventListener('click', () => useBoard(b.dataset.board));
let starting = false;
// back to the level select: stop the game behind the menu (you pick a level again to restart)
function toMenu() {
  starting = false; chalHide(); if (drone.on) droneSet(false); showOff(true); glareTick(false); audio.quiet(true);
  // clear the session: the menu gets its slow drifting wave behind it again (and nothing of the old ride keeps running)
  if (surfer) endWipe(); rider = null; rig.visible = false; endT = -1;
  for (const w of waves) w.dispose(scene); waves = [];
  setWeather('medium'); setSpot('medium'); ui.cond.textContent = '';
  underK = 0; underWas = false; clearLens(); underEl.style.opacity = 0; underEl.style.display = 'none'; hudSpeed(-1); hudScore(-1, 0); hudCallOff(true); setText(ui.hint, '');
  input.paddleBtn = false; input.stallBtn = false; input.stick = null; padTouch = null; padX = padY = 0;
  keys.clear(); steerF = stickY = 0; ui.paddle.classList.remove('down'); ui.stall.classList.remove('down');
  document.body.classList.remove('playing', 'riding', 'ranch-wait', 'villa', 'reef'); ui.msg.style.display = 'none'; walker = null; vPick(null); setHfov(50);
  ui.start.style.display = ''; showBests();
}
document.getElementById('menu').addEventListener('touchstart', (e) => { e.preventDefault(); toMenu(); }, { passive: false });
document.getElementById('menu').addEventListener('click', toMenu);
// someone's playing: a note to the owner's Telegram (through /api/ping on Cloudflare), once per visit: 'new player' the
// first time a phone or computer plays, 'back again' on a later day. Never for the owner's own devices (open the game
// once with ?me=1 to mark one), never from localhost or GitHub Pages. Nothing personal is sent: which spot, that's all.
let helloSent = false;
try { const me = (location.search.match(/[?&]me=(1|0|claude)\b/) || [])[1]; if (me === '0') localStorage.removeItem('sumbasurf.me'); else if (me) localStorage.setItem('sumbasurf.me', me); } catch (e) {}   // (?me=claude: the owner's assistant testing the live site: still sends, marked as such)
function hello(where) {
  if (helloSent || !/(^|\.)sumbasurf\.app$|\.pages\.dev$/.test(location.hostname)) return; helloSent = true;
  let kind = 'new', who = '';
  try { const me = localStorage.getItem('sumbasurf.me'); if (me === '1') return; if (me === 'claude') { who = 'claude'; kind = 'test'; throw 0; } const last = localStorage.getItem('sumbasurf.seen');
    kind = last ? 'back' : 'new'; localStorage.setItem('sumbasurf.seen', new Date().toISOString().slice(0, 10)); } catch (e) {}   // (every visit is an alert, not once a day; the server still lets one device through only once every few minutes)
  fetch('/api/ping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, where, who }), keepalive: true }).catch(() => {});
}
async function start(m) {
  if (starting) return; starting = true; if (window.__g) window.__g.paused = false;
  hello(m === 'ranch' ? 'Surf Ranch' : (SPOTS[m] && SPOTS[m].name) || m);
  showOff(true); mode = m; setWeather(m); setSpot(m); audio.start(); audio.quiet(false); audio.musicStart(MUSIC); document.body.classList.toggle('reef', m !== 'ranch');
  // fullscreen + landscape lock must be asked for inside the tap, before any waiting (Android); iOS ignores both safely
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch (e) {}
  ui.load.textContent = surfer ? '' : 'Loading...'; document.getElementById('goSurf').classList.toggle('wait', !surfer);
  try { await ready; } catch (e) { starting = false; return; }
  ui.load.textContent = ''; document.getElementById('goSurf').classList.remove('wait');
  ui.start.style.display = 'none'; document.body.classList.add('playing');
  session = { waves: 0, total: 0, best: 0, scores: [], barrels: 0 };
  chalKinds = new Set(); chalIntro(m);   // (this spot's three challenges, shown for a few seconds as you arrive)
  setLeft = 0; setPos = 0;
  for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 15;   // a calm start: time to look around and find the set
  updateWaves(0); spawnRider(); warmShaders();
  ui.cond.textContent = modeName(mode) + '  \u00b7  ' + BOARD_INFO[boardType][0] + '  \u00b7  ' + stanceName();   // (the spot, the board you're on, your stance)
}
// build the shader for everything that could show up in a session (the boat, the locals, spray, what's still hidden), now at the tap,
// not in a stall mid-paddle the first time each thing comes into view
function warmShaders() {
  if (warmShaders.done) return; warmShaders.done = true;
  const shown = []; scene.traverse((o) => { if (!o.visible) { o.visible = true; shown.push(o); } });
  try { renderer.compile(scene, camera); } finally { for (const o of shown) o.visible = false; }
}
if (Q.get('mode')) setTimeout(() => start(Q.get('mode')), 0);   // (a link straight to a spot: once the whole game has loaded, not halfway through)

// ---------- camera: a chase camera over your shoulder, looking where you're going; tight and low in the barrel
const lookDir = new THREE.Vector3(), _cv = new THREE.Vector3(), _lk = new THREE.Vector3(), _want = new THREE.Vector3(), _look = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 2, 10), camLook = new THREE.Vector3(), pose = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3() };
let camYaw = 0, lookYaw = 0, lookBackK = 0, wipeCut = false;
const cam = { a: 0, r: 3, y: 1.3, va: 0, vr: 0, vy: 0, vl: new THREE.Vector3() };
const camOff = new THREE.Vector3(0, 1.3, 3), lookOff = new THREE.Vector3(), _anc = new THREE.Vector3(), anchorS = new THREE.Vector3(), anchorV = new THREE.Vector3();
// the pop-up's own clock: every bit of the stand-up animation was timed for a 0.35 s pop; this stretches it to the
// physics' pop time, so the body and your view take as long to get up as the rider really does
const popClock = () => rider.stateT * 0.35 / (RIDE.popTime || 0.35);
const smooth01 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const _wq2 = {};
// how high the wave reaches at a point for sight-line purposes, including a lip overhanging in front of the face
const _sq = {};
function solidAt(x, z) {
  const q = waterAt(waves, x, z, _sq);
  if (!q.w) return q.y;
  const sl = q.w.prof.slice(q.s);
  if (q.zl > sl.topZ - 0.5 && q.zl < Math.max(sl.lipZ, sl.topZ) + 0.6) return Math.max(q.y, sl.top * (q.w.fade || 1));
  return q.y;
}
let camStandK = 0, tubeK = 0; const CAM = { back: 4.8, h: 1.4, lookY: 1.1, lead: 1.3, level: true };   // riding camera: distance, height, aim height, look-ahead; level = no lift over the crest while riding
const _wT = new THREE.Vector3(), _lT = new THREE.Vector3();
// ---------- first-person view (his call: the game is played from the surfer's eyes)
// Eyes at the head, looking where you're going and a little down so the board's nose and the wave ahead are in view.
// A real surfer's head is steady: the eye point is smoothed, the horizon stays level with only a slight lean into turns,
// and the view swings smoothly (never snaps) as you turn. Your own head is hidden so the camera never sees inside it.
const POVCAM = { fwd: 0.1, up: 0.14, pitch: -0.5, drop: 0.08 };   // eye point ahead of/above the head bone, head pitch riding, extra pitch at the take-off
const _pq2 = new THREE.Quaternion(), popEye0 = new THREE.Vector3(), lastEye = new THREE.Vector3(), eyeCarry = new THREE.Vector3(); let lastEyeSt = ''; let tubeLook = 0, roofOff = 0, curtOff = 0, wallOff = 0;
const pov = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: -0.2, roll: 0, ready: false }, _eye = new THREE.Vector3(), _pe = new THREE.Euler(0, 0, 0, 'YXZ');
function povCamera(dt) {
  if (!bones.head && surfer) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const standing = rider.standing, st = rider.state;
  // the eye point: just in front of the head, where the eyes are
  if (bones.head) bones.head.getWorldPosition(_eye); else _eye.copy(pose.pos).y += standing ? 1.4 : 0.35;
  const moving = rider.v > (standing ? 2 : 0.6);
  // standing, you look down the line: where you're going along the wave (your motion with most of the wave's own run at
  // the beach taken out), not where you're drifting over the sea bed, which on a big wave is mostly toward the beach and
  // in the barrel pointed your eyes at the lip's curtain instead of down the tube to the exit
  const waveRun = standing && rider.wave && rider.state === 'RIDE' ? 0.55 * rider.wave.cond.speed * Math.min(1, rider.stateT / 1.2) : 0;   // (eased in after the drop: no swing as you stand up)
  const travel = moving ? Math.atan2(rider.vz - waveRun, rider.vx) : rider.th;
  // look mostly where you're travelling, partly where the board points (you see the nose swing in a turn/drift)
  const dh = Math.atan2(Math.sin(rider.th - travel), Math.cos(rider.th - travel));
  const popIn = st === 'POP' ? smooth01(popClock() / 0.2) : 1;   // (the catch: the view eases into the pop over 0.2 s; it used to lurch and tip in the first frame)
  let yawT = travel + dh * (standing ? 0.8 - 0.4 * popIn : 0.8);   // (a little toward where the board points: you see the nose swing in a turn)
  // in the barrel look down the tube toward the exit (along the line), not out through the open side at the beach
  tubeLook += ((standing && (rider.inBarrel || (rider.ride && rider.ride.tubeT > 0)) ? 1 : 0) - tubeLook) * Math.min(1, dt * 1.5);   // (held through a wobble at the tube's edge: tubeT only clears after 0.4 s out)
  const tubeEase = smooth01(tubeLook);   // (eases in and out: no kick as you enter)
  // (no automatic turn in the barrel: the view swinging on its own as you went in felt like losing control; your view
  // follows your line as always, and the tube wraps around it)   // (more of the board heading: in a snap the board stays in view instead of swinging out of shot)
  // popping up, the head drives forward over the board (the eye ahead of the shoulders, which stay out of view), easing back as you rise
  const popFwd = st === 'POP' ? 0.15 : st === 'RIDE' ? 0.15 * Math.max(0, 1 - rider.stateT / 0.8) : 0;
  const sK = standing ? (st === 'POP' ? Math.min(1, popClock() / 0.25) : 1) : 0;   // (lying -> standing eye point blended over the start of the pop, not switched in a frame)
  const ef = -0.05 + (POVCAM.fwd + popFwd + 0.05) * sK, eu = 0.2 + (POVCAM.up - 0.2) * sK;   // lying: eyes at the head, a bit up, so your paddling hands pass below them
  _eye.x += Math.cos(yawT) * ef; _eye.z += Math.sin(yawT) * ef; _eye.y += eu;   // camera just in front of the face, like a surfer's mouth-mounted camera
  // smooth the eye's position relative to the board (not in the world, or at speed it would trail behind your head)
  _eye.sub(rig.position);
  // eyes never lower than this above the board; during the pop it rises with you instead of snapping up in one frame
  const popT = st === 'POP' ? Math.min(1, popClock() / 0.4) : standing ? 1 : 0, eyeFloor = 0.25 + 0.35 * popT * popT * (3 - 2 * popT);
  if (_eye.y < eyeFloor) _eye.y = eyeFloor;
  // pop-up: the clip throws the head out over the rail; a real pop keeps your head over the stringer, eyes on the
  // board between your hands, so the camera stays over the middle of the board while you come up
  if (st === 'POP' || (st === 'RIDE' && rider.stateT < 0.4)) {
    const k = st === 'POP' ? 0.8 * popIn : 0.8 * (1 - rider.stateT / 0.4);
    _pq2.copy(rig.quaternion).invert(); _eye.applyQuaternion(_pq2); _eye.x *= 1 - k; _eye.applyQuaternion(rig.quaternion);
  }
  // the pop swaps the lying pose for the crouch in one frame (the head jumps ~20 cm): the eye goes from where it was
  // lying to the new head over the same 0.2 s instead
  if (st === 'POP' && popIn < 1) _eye.lerpVectors(popEye0, _eye, popIn); else if (!standing) popEye0.copy(_eye);
  // and as you finish standing (pop -> ride) the body's pose hands over and the head steps ~5 cm: carry that step away over ~0.2 s
  if (st === 'RIDE' && lastEyeSt === 'POP') eyeCarry.subVectors(lastEye, _eye);
  if (st === 'RIDE' && rider.stateT < 0.4) _eye.addScaledVector(eyeCarry, Math.exp(-rider.stateT * 14)); else eyeCarry.set(0, 0, 0);
  lastEye.copy(_eye); lastEyeSt = st;
  if (!pov.ready || snapCam) { pov.pos.copy(_eye); pov.vel.set(0, 0, 0); pov.yaw = yawT; pov.ready = true; }
  else {
    // (a plain exponential follow: stays glued to your head through the pop-up, just takes the jitter off; the old
    // spring was so over-damped it closed only ~2% of the gap a frame and left the camera inside your chest)
    const k = st === 'POP' ? 8 + 50 * Math.min(1, popClock() / 0.35) : st === 'RIDE' && rider.stateT < 0.5 ? 16 + 42 * (1 - rider.stateT / 0.5) : 16;   // (eases into the pop instead of snapping to the new eye height in one frame)
    pov.pos.lerp(_eye, 1 - Math.exp(-k * dt));
    const dy = Math.atan2(Math.sin(yawT - pov.yaw), Math.cos(yawT - pov.yaw)), maxY = 3.2 * dt;
    pov.yaw += Math.max(-maxY, Math.min(maxY, dy * Math.min(1, dt * 7)));
  }
  snapCam = false;
  // head pitch: riding, look down the line and at the nose; lying, look ahead over the nose; at the drop, look down the face
  const dropK = st === 'POP' ? 4 * popIn : st === 'RIDE' ? 4 * Math.max(0, 1 - rider.stateT / 0.5) : 0;   // the pop: eyes down on the board between your hands, then back up to the line
  let pitchLook = -9, pitchT = standing ? POVCAM.pitch - POVCAM.drop * dropK : sitting ? -0.53 : -0.4;   // sitting: tipped down enough to see your knees and hands on the board   // take-off: look down at the board and the face; lying: down enough to see your arms paddling
  // sitting or lying facing out to sea: look up at a wave that's coming (a 15 m wave's crest is well above the horizon)
  if (!standing) {
    const inc = incoming();
    if (inc.w && inc.t < 14 && inc.t > -1 && Math.sin(rider.th) < 0.3) {
      const dist = Math.max(4, inc.t * inc.w.cond.speed + 6), up = Math.atan2(inc.w.cond.H * 0.9 - 0.8, dist);
      pitchLook = Math.max(pitchLook, up - 0.3);
    }
  }
  if (pitchLook > pitchT) pitchT = pitchLook;
  if (!standing && isRanch()) pitchT = Math.max(pitchT, -0.2);   // at the Surf Ranch, eyes up on the machine wall where your wave comes from
  pitchT += 0.14 * tubeEase;   // (in the barrel your eyes lift ~8 deg, so you see the tube arching over you)   // (a slight, slow lift of the eyes toward the lip overhead)   // and up a little: the lip over your head
  pov.pitch += (pitchT - pov.pitch) * Math.min(1, dt * (st === 'POP' ? 4 + 20 * Math.min(1, popClock() / 0.3) : st === 'RIDE' ? 5 + 19 * Math.max(0, 1 - rider.stateT / 0.4) : 5));   // (and out of it without a kink: the rates hand over gradually when you're up)   // (the pop: eyes snap down to the board between your hands)
  pov.roll += ((standing ? -rider.lean * 0.2 : 0) - pov.roll) * Math.min(1, dt * 6);   // you feel the lean: the horizon tips as you lay into a carve (less than the board: people hold their head nearer level)
  // three.js cameras look down -z: turn our heading (angle in x/z) into a yaw about y
  _pe.set(pov.pitch - (rider.standing ? 0.055 * pumpA : 0), -pov.yaw - Math.PI / 2, pov.roll);   // (each pump stroke: the head nods down ~3 deg as you compress, like real POV footage)
  camera.quaternion.setFromEuler(_pe);
  camera.position.copy(pov.pos).add(rig.position);
  // feel the water: small quick bumps through the board (chop under you), stronger with speed and chop, and a
  // rattle when the tail slides; tiny, so it reads as texture, never as shake
  if (standing && st === 'RIDE') {
    const chop = ENV.weather ? ENV.weather.chop : 1, sp = Math.min(1, rider.v / 9), rattle = Math.min(1, (rider.slide || 0) * 2.5 + rider.skid);
    const t = T, n1 = Math.sin(t * 11.3) * 0.6 + Math.sin(t * 17.9 + 1.3) * 0.4, n2 = Math.sin(t * 23.7 + 0.7) * 0.5 + Math.sin(t * 31.1 + 2.1) * 0.5;
    const amp = ((0.006 + 0.006 * chop) * sp + 0.008 * rattle) * Math.min(1, rider.stateT / 0.5);   // (faded in as you get up: switched on at full it kicked the view the moment the pop finished)
    camera.position.y += n1 * amp; camera.rotateX(n2 * amp * 0.6); camera.rotateZ(n1 * amp * 0.4);
  }
  // inside a barrel your eyes stay under its roof (the lip's underside), never poking out through the top of the tube
  if (standing && rider.wave && rider.wave.prof) {
    const w = rider.wave, s = camera.position.x - w.peelX, zl = camera.position.z - w.zW - w.bend(s), cy = w.prof.ceiling(s, zl) * (w.fade || 1);
    const need = Math.max(0, camera.position.y - Math.max(cy - 0.4, rig.position.y + 0.6));
    roofOff += (need - roofOff) * Math.min(1, dt * 12); camera.position.y -= roofOff;   // (eased: snapping under the roof in one frame read as a glitch)
  } else roofOff *= Math.max(0, 1 - dt * 12);
  // ...and never out past the lip hanging down in front of you at the mouth of the tube (you'd see the wave from outside)
  if (standing && rider.wave && rider.wave.prof) {
    const w = rider.wave, f = w.fade || 1, s = camera.position.x - w.peelX, zl = camera.position.z - w.zW - w.bend(s);
    const cz = w.prof.curtainZ(s, camera.position.y / f), inside = rider.zl < w.prof.curtainZ(rider.s, rider.y / f);   // (you're under the lip, not out in front of it)
    const need = cz === Infinity || !inside ? 0 : Math.max(0, zl - (cz - 0.5));
    curtOff += (need - curtOff) * Math.min(1, dt * 14);
  } else curtOff *= Math.max(0, 1 - dt * 8);
  camera.position.z -= curtOff;
  // ...and never into the wall of the wave behind you: leaning into a steep face (in the tube it's near vertical), your
  // eye could sink into the water and you'd see the wave from inside it. Keep it a hand's width out from the face
  if (standing && rider.wave && rider.wave.prof && !rider.air) {
    const w = rider.wave, f = w.fade || 1, s = camera.position.x - w.peelX, zl = camera.position.z - w.zW - w.bend(s), y = camera.position.y / f;
    const sl = w.prof.slice(s), topY = sl.F[sl.F.length - 1][1];
    const fz = y < topY && y > 0.05 ? w.prof.frontZAt(s, y) : -Infinity;   // where the face is at your eye's height
    const need = Math.max(0, fz + 0.35 - zl);
    wallOff += (need - wallOff) * Math.min(1, dt * 14);
  } else wallOff *= Math.max(0, 1 - dt * 8);
  camera.position.z += wallOff;
  // the eyes are always above your own board (never ask the water height here: under a lip or in the barrel the
  // 'surface' overhead is the lip, and pushing above it would lift you out of the tube)
  const minY = rig.position.y + (st === 'RIDE' ? 0.5 : 0.22); if (camera.position.y < minY) camera.position.y = minY;
}

// underwater: the screen goes murky green-blue (the water surface can't be seen from below, so this is the whole look)
const underEl = document.createElement('div');
underEl.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:5;opacity:0;background:radial-gradient(ellipse at 50% 0%,rgba(150,225,220,.75),rgba(30,110,125,.9) 45%,rgba(6,40,55,.985))';
document.body.appendChild(underEl);
// under the whitewater: swirling churned foam and bubbles racing up past you (plain CSS: cheap, and drawn over the tint)
// (the churn is one soft, seamless picture of foam made once here and slid across the screen: sliding is done by the
// graphics chip for free. It used to be blurred gradients re-painted every frame at full phone resolution, which froze
// wipeouts for up to 2 s on a phone-speed test)
function churnTile(bright) {
  const c = document.createElement('canvas'), N = 256; c.width = c.height = N; const x = c.getContext('2d');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 16; i++) {
    const cx = rnd() * N, cy = rnd() * N, rx = 34 + rnd() * 70, ry = 22 + rnd() * 50, a = Math.min(0.9, (0.14 + rnd() * 0.2) * bright);   // (big and faint: reads as churned water, not clouds)
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {   // (drawn wrapped round the edges: the tile repeats without seams)
      x.save(); x.translate(cx + ox, cy + oy); x.scale(1, ry / rx);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, `rgba(238,250,250,${a})`); gr.addColorStop(0.45, `rgba(232,246,246,${a * 0.55})`); gr.addColorStop(1, 'rgba(230,245,245,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(0, 0, rx, 0, Math.PI * 2); x.fill(); x.restore();
    }
  }
  return c.toDataURL('image/png');
}
{ const st = document.createElement('style');
  st.textContent = `@keyframes bub{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:.9}100%{transform:translate(var(--dx),-115vh) scale(1.15);opacity:.2}}
  @keyframes churn{from{transform:translate3d(0,0,0)}to{transform:translate3d(-256px,-256px,0)}}
  .bub{position:absolute;bottom:-6vh;border-radius:50%;border:1.5px solid rgba(235,250,250,.75);background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.7),rgba(255,255,255,.08) 55%,transparent 70%);animation:bub linear infinite}
  .churn{position:absolute;left:0;top:0;right:-256px;bottom:-256px;opacity:.55;animation:churn 2.6s linear infinite;will-change:transform;
    background-image:url(${churnTile(1)});background-size:256px 256px}
  .churn.bright{background-image:url(${churnTile(1.5)})}`;
  document.head.appendChild(st);
  const ch = document.createElement('div'); ch.className = 'churn'; underEl.appendChild(ch);
  for (let i = 0; i < 46; i++) { const b = document.createElement('div'); b.className = 'bub'; const sz = 4 + Math.random() * Math.random() * 26;
    b.style.cssText = `left:${Math.random() * 100}%;width:${sz}px;height:${sz}px;--dx:${(Math.random() - .5) * 120}px;animation-duration:${0.9 + Math.random() * 1.6}s;animation-delay:${-Math.random() * 2.5}s`;
    underEl.appendChild(b); } }
// the moment you're pounded: churning white water over everything, which gives way to the underwater murk (drawn over it)
const foamEl = document.createElement('div');
foamEl.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:5;opacity:0;display:none;background:radial-gradient(ellipse at 50% 40%,rgba(250,253,252,.97),rgba(222,240,240,.94) 55%,rgba(170,212,214,.92))';
{ for (const [dur, op, rev] of [[1.1, 0.8, false], [0.8, 0.65, true]]) { const c = document.createElement('div'); c.className = 'churn bright'; c.style.cssText = `animation-duration:${dur}s;opacity:${op}${rev ? ';animation-direction:reverse' : ''}`; foamEl.appendChild(c); } }   // (two layers drifting opposite ways: churning, not sliding)
document.body.appendChild(foamEl);
let foamK = 0, foamIn = 0, foamWas = false;
function setFoam(k) { foamK = k; foamEl.style.opacity = k.toFixed(3); foamEl.style.display = k > 0.01 ? '' : 'none'; }
let underK = 0, underWas = false;
function setUnder(k, dt) { underK += (k - underK) * Math.min(1, dt * (k > underK ? 14 : 5)); underEl.style.opacity = underK.toFixed(3); underEl.style.display = underK > 0.01 ? '' : 'none';   // (hidden = the bubbles stop animating)
  if (k > 0.5) { underWas = true; clearLens(); } else if (k === 0 && underWas) { underWas = false; splashLens(12, 1.3); } }   // (coming up: water streaming off the lens)
// water on the lens, like a GoPro: coming out of the barrel, blown out by the spit, surfacing after a wipeout, whitewater
// over your head. Drops land, hang, and some run down and off. Plain CSS moved by the browser's compositor: nothing for
// the 3D to pay for, even on a phone
const lensEl = document.createElement('div');
lensEl.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:6';
document.body.appendChild(lensEl);
{ const st = document.createElement('style');
  // (a bright glint up top, light caught in its lower half and a darker upper edge, no hard ring, which read as bubbles;
  // blurring what's behind each drop looked best but halved the frame rate: not worth it)
  st.textContent = `.ldrop{position:absolute;opacity:0;border-radius:52% 48% 46% 54%/58% 55% 45% 42%;will-change:transform,opacity;
    background:radial-gradient(circle at 36% 24%,rgba(255,255,255,.85) 0 4%,rgba(255,255,255,0) 13%),radial-gradient(ellipse at 50% 70%,rgba(255,255,255,.16),rgba(255,255,255,.05) 60%),linear-gradient(rgba(255,255,255,0) 40%,rgba(0,28,38,.12));
    box-shadow:inset 0 -4px 7px rgba(255,255,255,.3),inset 0 3px 6px rgba(0,22,32,.22),0 1px 2px rgba(0,20,30,.12)}`;
  document.head.appendChild(st); }
const lensDrops = []; let lensI = 0;
for (let i = 0; i < 14; i++) { const el = document.createElement('div'); el.className = 'ldrop'; lensEl.appendChild(el); lensDrops.push({ el, anim: null }); }
function splashLens(n, big = 1) {
  if (Q.has('nolens')) return;
  const w = innerWidth, h = innerHeight, k = Math.min(1.4, h / 400);
  // (riding fast, the drops get dragged: most of them run, further, stretching into streaks)
  const fast = !globalThis.__fxOff && rider && rider.standing ? Math.min(1, Math.max(0, (rider.v - 7) / 6)) : 0;
  for (let i = 0; i < n; i++) {
    const d = lensDrops[lensI++ % lensDrops.length]; if (d.anim) d.anim.cancel();
    const sz = (10 + Math.random() * Math.random() * 55 * big) * k, run = Math.random() < 0.45 + 0.4 * fast, life = (1300 + Math.random() * 2200) * (1 - 0.35 * fast), fall = run ? h * (0.12 + Math.random() * 0.35) * (1 + fast) : sz * 0.3, drift = (Math.random() - 0.5) * 60 * fast;
    const rr = () => 38 + Math.random() * 24 | 0;   // (each drop its own lumpy shape: perfect circles read as bubbles)
    Object.assign(d.el.style, { borderRadius: `${rr()}% ${rr()}% ${rr()}% ${rr()}%/${rr()}% ${rr()}% ${rr()}% ${rr()}%`, width: sz * (0.8 + Math.random() * 0.4) + 'px', height: sz * (0.8 + Math.random() * 0.4) + 'px', left: Math.random() * w + 'px', top: Math.random() * h * 0.85 + 'px' });
    d.anim = d.el.animate([
      { transform: 'translateY(0) scale(.5)', opacity: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 0.95, offset: 0.05 },
      { transform: `translateY(${fall * 0.25}px) scale(1)`, opacity: 0.85, offset: 0.5 },
      { transform: `translate(${drift}px, ${fall}px) scale(${run ? `${0.75 - 0.2 * fast},${1.3 + 0.8 * fast}` : '.85'})`, opacity: 0 }],
      { duration: life, delay: Math.random() * 150, easing: 'ease-in', fill: 'both' });
  }
}
// the sun on the lens: a soft warm glare where the sun is, when you look toward it (screen-blended, so it only lightens)
const glareEl = document.createElement('div');
glareEl.style.cssText = 'position:fixed;left:0;top:0;width:70vmax;height:70vmax;margin:-35vmax 0 0 -35vmax;pointer-events:none;z-index:5;opacity:0;mix-blend-mode:screen;background:radial-gradient(circle,rgba(255,240,210,.55),rgba(255,214,160,.18) 30%,rgba(255,200,140,0) 62%);will-change:transform,opacity';
document.body.appendChild(glareEl);
const _gv = new THREE.Vector3(), _gf = new THREE.Vector3();
function glareTick(on) {
  if (!on || globalThis.__fxOff) { if (glareEl.style.opacity !== '0') glareEl.style.opacity = '0'; return; }
  const sun = ENV.uSun.value; camera.getWorldDirection(_gf); const face = _gf.dot(sun);
  if (face < 0.3) { if (glareEl.style.opacity !== '0') glareEl.style.opacity = '0'; return; }
  _gv.copy(camera.position).addScaledVector(sun, 500).project(camera);
  if (MIRROR) _gv.x = -_gv.x;
  glareEl.style.transform = `translate(${((_gv.x + 1) / 2 * innerWidth).toFixed(0)}px,${((1 - _gv.y) / 2 * innerHeight).toFixed(0)}px)`;
  glareEl.style.opacity = (ENV.uSunVis.value * Math.pow((face - 0.3) / 0.7, 2) * 0.8).toFixed(3);
}
function clearLens() { for (const d of lensDrops) if (d.anim) { d.anim.cancel(); d.anim = null; } }
let lensBarrelT = 0, lensSpit = 0, lensWashed = false;
function lensTick(dt) {
  const st = rider.state;
  if (rider.inBarrel && st === 'RIDE') lensBarrelT += dt;
  else { if (lensBarrelT > 0.6 && st === 'RIDE') splashLens(8); lensBarrelT = 0; }   // (out of the tube, through its spray)
  if ((rider.spitOut || 0) > lensSpit + 0.5) splashLens(11, 1.2); lensSpit = rider.spitOut || 0;   // (the spit blows you out)
  if (rider.washed && !lensWashed && st === 'LIE') splashLens(9); lensWashed = !!rider.washed;   // (whitewater over your head)
}
// wiping out, in first person: thrown, rolled under the whitewater (the view tumbles, but damped so it doesn't make
// you sick), then you surface, the view levels out and you look for your board
const _wiq = new THREE.Quaternion(), _wm = new THREE.Matrix4();
function povWipe(dt) {
  if (bones.head) bones.head.getWorldPosition(_eye); else surfer.getWorldPosition(_eye);
  if (!W.cam) { W.cam = camera.position.clone(); W.q = camera.quaternion.clone(); W.up = false; }
  surfer.visible = false;   // you ARE the camera: your own body tumbling past the lens only looks broken
  if (W.t < 1.4) W.cam.lerp(_eye, Math.min(1, dt * 30)); else { W.cam.x += (_eye.x - W.cam.x) * Math.min(1, dt * 4); W.cam.z += (_eye.z - W.cam.z) * Math.min(1, dt * 4); W.cam.y += (Math.min(_eye.y, heightAt(waves, W.cam.x, W.cam.z) + 0.3) - W.cam.y) * Math.min(1, dt * 3); }
  const water = heightAt(waves, W.cam.x, W.cam.z);
  if (W.t < 1.4) {
    // roll with your body, at 40% of its spin
    _dq.setFromEuler(_e.set(W.rw.z * 0.35 * dt, W.rw.y * 0.3 * dt, W.rw.x * 0.4 * dt)); W.q.multiply(_dq);   // head over heels: the body's forward roll pitches the view
  } else {
    // surfaced: head up, looking for your board
    // (looking level toward it: your eyes are at the water line, the horizon stays put)
    _wm.lookAt(W.cam, _cv.set(rig.position.x, W.cam.y - 0.15, rig.position.z), WORLD_UP); _wiq.setFromRotationMatrix(_wm);
    W.q.slerp(_wiq, Math.min(1, dt * 2.5));
    W.cam.y += Math.max(0, water + 0.25 - W.cam.y) * Math.min(1, dt * 5);   // float up to the surface, don't pop
  }
  camera.position.copy(W.cam); camera.quaternion.copy(W.q);
  const depth = water - W.cam.y;
  // what it looks like to get pounded: white water fills everything as you go over, then you're held down in the murk
  // until you come up (the murk stays fully on while you tumble: at half strength, or flicking on and off as your eye
  // crossed the water line, you saw the wave's shape from underneath and behind, which looked like the game breaking)
  setFoam(W.t < 0.08 ? W.t / 0.08 * 0.95 : W.t < 0.5 ? 0.95 : Math.max(0, 0.95 * (1 - (W.t - 0.5) / 0.35)));
  const held = W.t > 0.25 && !W.up && (W.t < 1.35 || depth > 0.02);
  setUnder(held ? 0.97 : depth > 0.02 ? Math.min(1, 0.55 + depth * 0.6) : 0, dt);
  if (depth <= 0.02 && W.t > 1.35 && !W.up) { W.up = true; audio.burst(0.22, 700, 0.35); audio.splash(0.4); }   // the gasp as you break the surface
}

function updateCamera(dt) {
  const p = pose.pos, st = rider.state;
  if (bones.head) bones.head.scale.setScalar(0.001);   // hide your own head from your own eyes
  setHfov(55 + 7 * smooth01(tubeLook));   // (and the lens opens up a little in there, like a GoPro: more of the roof and the lip)
  tubeK = 0;
  if (st === 'WIPE' && W.on && surfer) { glareTick(false); povWipe(dt); return; }
  setUnder(0, dt);
  povCamera(dt); glareTick(true);
  // whitewater rolling over you (a close-out washing through, a broken wave passing you in the lineup): your eyes are in
  // the foam, so you see churning white, not the flat inside of the wave's surface
  { const inW = heightAt(waves, camera.position.x, camera.position.z) - camera.position.y;
    // (and a thin mist of the foam ball's spray hanging in the tube when you're sitting too deep: see railSpray)
    const deepHaze = rider.inBarrel && rider.wave ? 0.3 * smooth01((-rider.s - 1.4 * rider.wave.cond.H) / (1.2 * rider.wave.cond.H)) : 0;
    foamIn += ((inW > 0 ? Math.min(1, 0.45 + inW * 1.5) : deepHaze) - foamIn) * Math.min(1, dt * (inW > 0 ? 25 : 5));
    if (foamIn > 0.01 || foamK) setFoam(foamIn > 0.01 ? foamIn : 0);
    if (inW > 0) foamWas = true; else if (foamWas && foamIn < 0.4) { foamWas = false; splashLens(8, 1); } }   // (out of it: water running off the lens)
  // flying, or sliding sideways up the face into the lip, the body turns away from where you look and your front
  // shoulder swings right up to the lens (you saw the inside of your own upper arm as a brown blob): the upper arm near
  // the lens is left out then, only forearm and hand show, as they already do lying on the board
  { const slip = Math.abs(Math.atan2(Math.sin(rider.th - Math.atan2(rider.vz, rider.vx)), Math.cos(rider.th - Math.atan2(rider.vz, rider.vx))));
    const want = rider.standing && (rider.air || (rider.v > 3 && slip > 0.35)) ? 1 : 0;
    armCutK += (want - armCutK) * Math.min(1, dt * (want ? 12 : 3));
    // the pop-up: your eyes are down between your shoulders and the arms fold up past the lens (a big blurry arm flashed
    // across the view, and cutting only the upper arm left stumps): the arms go out of view while you push up, the
    // way your hands on the rails are below the frame, and rise back into view from below as you stand
    popCutK += ((rider.state === 'POP' ? 1 : 0) - popCutK) * Math.min(1, dt * (rider.state === 'POP' ? 40 : 20));
    ARMCUT.value = armCutNow(); }
}
let armCutK = 0, popCutK = 0;
const armCutNow = () => Math.max(0.34 * armCutK, 0.9 * popCutK);

// ---------- surfer pose on the board
const WORLD_UP = new THREE.Vector3(0, 1, 0), INTO_WAVE = new THREE.Vector3(0, 0, -1), tmpM = new THREE.Matrix4(), xAxis = new THREE.Vector3(), bodyUp = new THREE.Vector3(), bodyFwd = new THREE.Vector3(), bodyX = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0), _up = new THREE.Vector3(), _tq = new THREE.Quaternion(), _yq = new THREE.Quaternion(), bodyQ = new THREE.Quaternion(), stanceQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), invQ = new THREE.Quaternion();
// the rider's world orientation (bodyQ, plus side-on stance) expressed in the board's frame
if (stance === 'regular') stanceQ.setFromAxisAngle(WORLD_UP, -Math.PI / 2);   // (turned the other way round on the board: left foot to the nose)
const setStance = () => { invQ.copy(rig.quaternion).invert(); surfer.quaternion.copy(invQ).multiply(bodyQ).multiply(stanceQ); };
// body moves between poses (sitting -> lying -> popping up) glide over ~0.15 s instead of jumping in one frame: the
// camera rides on your head, so a jump was a jolt in the view (sit to paddle dropped 57 cm, paddle to pop rose 44 cm)
const _gp = new THREE.Vector3();
function glideTo(x, y, z, dt) {
  _gp.set(x, y, z);
  if (snapCam || surfer.position.distanceTo(_gp) > 1.5) surfer.position.copy(_gp); else surfer.position.lerp(_gp, 1 - Math.exp(-dt * 18));
}
let bobK = 1;
function updateRig(dt, t) {
  if (rider.state === 'WIPE' && W.on) { wipeout(dt); return; }
  rider.pose(pose);
  const standing = rider.standing;
  // standing, the board rides on its rail (partway between the face and level) and rolls into the carve
  if (standing) {
    pose.up.lerp(WORLD_UP, 0.45).normalize();
    // each pump stroke swoops the board a little, rail to rail and nose swinging, like the small S a real pump makes
    // (only what you see: your line and the physics are untouched). One stroke one way, the next the other way.
    const pw = rider.pumping ? Math.sin(Math.PI * rider.pumpT / PUMP_STROKE) : 0, ps = rider.pumpN % 2 ? 1 : -1;
    const roll = rider.lean * 0.8 + ps * 0.12 * pw;                     // the board on its rail: the lean you're carving with
    pose.fwd.applyAxisAngle(WORLD_UP, ps * 0.07 * pw);
    pose.up.applyAxisAngle(pose.fwd, roll);   // (+lean turns right, toward +z; rolling up toward +z puts the right rail in the water)
  }
  pose.up.addScaledVector(pose.fwd, -pose.up.dot(pose.fwd)).normalize();
  xAxis.crossVectors(pose.up, pose.fwd).normalize();
  const up = _up.crossVectors(pose.fwd, xAxis).normalize();
  tmpM.makeBasis(xAxis, up, pose.fwd);
  _tq.setFromRotationMatrix(tmpM);
  // the water surface kinks where the face bends; ease the board's tilt so it rides over those instead of snapping
  // the sitting tilt eases in and out too; smoothing runs on its own copy so extra tilts never pile up
  const sitK = rider.state === 'LIE' && !rider.paddling || rider.state === 'OUT' ? 1 : 0;
  sitTilt += (sitK - sitTilt) * Math.min(1, dt * 4);
  _tq.multiply(_yq.setFromAxisAngle(_xAxis, -0.4 * sitTilt));   // ~23 deg: your weight on the tail lifts the nose clear of the water
  if (snapCam) rigQ.copy(_tq);
  else { const ang = rigQ.angleTo(_tq); rigQ.rotateTowards(_tq, Math.min(ang * Math.min(1, dt * (rider.state === 'POP' ? 9 : rider.state === 'RIDE' && rider.stateT < 0.4 ? 9 + 17.5 * rider.stateT : 16)), 6 * dt)); }   // eased, and never faster than ~340 deg/s
  rig.quaternion.copy(rigQ);
  rig.position.copy(pose.pos);
  rig.position.y += 0.1 * sitTilt;                                     // the rider's weight sinks the tail
  if (standing || (rider.state === 'WIPE' && rider.stateT < 0.1)) {
    // the rider stands on the deck, leaning into the turn and a little toward the wave
    barrelK += ((rider.inBarrel ? 1 : 0) - barrelK) * Math.min(1, dt * 2.5);
    airK += ((rider.air ? 1 : 0) - airK) * Math.min(1, dt * 8);   // in the air: knees up into a tuck, then they take the landing   // eased: going in or out of the tube never snaps the body (or your eyes with it)
    const lean = 0.15 + 0.12 * barrelK;
    // stand over the board but closer to upright than the deck (legs absorb the tilt), leaning into the wave
    bodyUp.copy(pose.up).lerp(WORLD_UP, 0.4).addScaledVector(INTO_WAVE, Math.tan(lean * 0.6)).normalize();
    bodyFwd.set(pose.fwd.x, 0, pose.fwd.z).normalize();
    bodyUp.addScaledVector(bodyFwd, -bodyUp.dot(bodyFwd)).normalize();
    bodyX.crossVectors(bodyUp, bodyFwd);
    tmpM.makeBasis(bodyX, bodyUp, bodyFwd);
    bodyQ.setFromRotationMatrix(tmpM);
  }
  // bob on the water while lying
  bobK += ((standing ? 0 : 1) - bobK) * Math.min(1, dt * 6);   // (the bob dies away as you stand: cut in one frame it jolted the view at the catch)
  rig.position.y += Math.sin(t * 1.6) * 0.04 * bobK;
  if (!surfer) return;
  const st = rider.state;
  sitting = false;
  surfer.rotation.set(0, 0, 0);   // (position: every state below sets it; lying/sitting/popping glide from the last pose)
  if (st === 'LIE' || st === 'OUT') {
    if (rider.paddling && st === 'LIE') { play('paddle', { speed: 0.7 + rider.v / 3 }); glideTo(0, -0.93, -0.5, dt); }   // chest mid-board, feet at the tail
    else {
      // sitting astride: weight over the tail sinks it, nose tips up ~14 deg, legs hang in the water either side
      play('sit'); glideTo(0, -0.36, -0.25, dt);
      sitting = true;
    }
  } else if (st === 'POP') {
    // pop-up: from flat on the board, hands push, feet swing under, straight into the crouch (no jump)
    const u = Math.min(1, popClock() / 0.35), e = u * u * (3 - 2 * u);
    if (curClip !== clips.crouch) { play('crouch', { fade: 0.18 }); clips.stand.reset().play(); }
    clips.crouch.weight = 0.8; clips.stand.weight = 0.2;
    setStance();
    if (e < 1) surfer.quaternion.slerp(_yq.identity(), 1 - e);          // rotate up from lying along the board to standing side-on
    glideTo(0, -0.45 * (1 - e) - 0.04, -0.1, dt);
  } else if (st === 'RIDE') {
    // crouch: deeper at speed and in the barrel; pumping compresses the legs, letting go extends them
    pumpC += ((input.paddle ? 1 : 0) - pumpC) * Math.min(1, dt * 7);
    // pumping is a rhythm, not a held squat: compress onto the board on the way down, spring up light, ~1.4 times a second
    { const pe = rider.pumping ? 0.5 - 0.5 * Math.cos(2 * Math.PI * rider.pumpT / PUMP_STROKE) : 0; pumpA += (pe - pumpA) * Math.min(1, dt * 20); }   // (each stroke of the physics, not a clock of its own: what you see is what pushes you)   // (smooth down and up each stroke: back to back they make one continuous bob)
    // knees: deeper at speed, in the barrel and when pumping; they compress under the load of a hard turn and extend out of it
    const deep = Math.min(0.7, (0.14 + 0.06 * Math.min(1, rider.v / 10) + (0.31 - 0.06 * Math.min(1, rider.v / 10)) * barrelK) + 0.25 * pumpA + 0.2 * airK + 0.25 * gLoad + 0.22 * Math.min(1, Math.abs(rider.lean) / RIDE.leanMax) + 0.2 * (rider.stalling || 0));   // (the crouch clip is a full squat: trim is a light knee bend, hips well above the knees)
    if (curClip !== clips.crouch) { play('crouch', { fade: 0.3 }); clips.stand.reset().play(); }
    // rising out of the pop-up's deep squat over half a second (not snapping up: that jerks your eyes up 16 cm in a frame)
    const up_ = Math.min(1, rider.stateT / 0.6), rise = up_ * up_ * (3 - 2 * up_);
    clips.crouch.weight = 0.8 + (deep - 0.8) * rise; clips.stand.weight = 1 - clips.crouch.weight;
    setStance();
    surfer.position.set(0, -0.04 * clips.crouch.weight, -0.1);       // hips drop a little as the feet spread
  } else if (st === 'WIPE') {
    setStance(); surfer.position.set(0, 0, -0.1);
    wipeout(dt);
  }
}

// ---------- rail spray: water thrown off the board's edge when you carve, skid or pop up; a big burst when you wipe out
const SPRAY_N = 2200;
const railSpray = (() => {
  const pos = new Float32Array(SPRAY_N * 3), vel = new Float32Array(SPRAY_N * 3), life = new Float32Array(SPRAY_N).fill(-1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(cv);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf6f1ea, size: 0.11, map: tex, transparent: true, opacity: 0.8, depthWrite: false }));   // (bigger, soft drops: at 7 cm they read as specks)
  pts.frustumCulled = false; scene.add(pts);
  let next = 0, acc = 0, fanAcc = 0, fanHit = false, ballAcc = 0, ballLens = 0;
  const emit = (p, v, n, spread) => {
    for (let k = 0; k < n; k++) {
      const i = next; next = (next + 1) % SPRAY_N;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      vel[i * 3] = v.x + (Math.random() - .5) * spread; vel[i * 3 + 1] = v.y + Math.random() * spread; vel[i * 3 + 2] = v.z + (Math.random() - .5) * spread;
      life[i] = 0.5 + Math.random() * 0.6;
    }
  };
  const _p = new THREE.Vector3(), _v = new THREE.Vector3();
  return {
    burst(p, n = 120, up = 3) { emit(p, _v.set(0, up, 0), n, 3.5); },
    stream(p, v, n = 1, spread = 0.8) { emit(p, v, n, spread); },
    update(dt) {
      // how much water the rail is throwing: carving load, skidding, and a little at speed
      // (spray keeps much of the board's own speed: thrown from a standstill, or backwards, it was left behind the instant
      // it appeared and you never saw it; now it flies out beside you and falls away over a second)
      if (rider && rider.standing) {
        const load = Math.min(1.3, Math.abs(rider.turn) * rider.v / 14 + rider.skid * 1.2 + (rider.state === 'POP' ? 0.5 : 0) + Math.max(0, rider.v - 6) * 0.03);
        const out = Math.sign(rider.lean) || 1, sideX = Math.sin(rider.th) * out, sideZ = -Math.cos(rider.th) * out;   // toward the outside of the turn
        acc += load * 1150 * dt;
        if (acc >= 1) {
          const n = Math.floor(acc); acc -= n;
          // a curtain off the rail from mid-board to the tail: out to the side of the turn, up, carried along with you
          const curtain = Math.min(1, Math.abs(rider.turn) * rider.v / 10 + rider.skid);   // (a straight glide throws a little off the tail; a carve throws a sheet sideways)
          for (let k = 0; k < n; k++) {
            _p.copy(rig.position).addScaledVector(pose.fwd, 0.1 - Math.random() * 0.85).addScaledVector(pose.up, 0.04);
            const keep = 0.55 + Math.random() * 0.3;
            _v.set(rider.vx * keep, 0, rider.vz * keep)
              .add(_cv.set(sideX, 0, sideZ).multiplyScalar(curtain * (1.5 + Math.random() * 3)))
              .addScaledVector(pose.up, 0.8 + load * 1.6 + Math.random() * 0.6).add(_cv.set(0, 0.5 + curtain * (1 + Math.random() * 1.8), 0));
            emit(_p, _v, 1, 0.6);
          }
        }
        // drifting: the tail sprays a big fan to the outside of the slide; a snap or cutback throws a sheet of spray up
        const snapK = rider.trick && rider.trick.name.endsWith('SNAP') && rider.trick.t < 0.3 ? 1 : 0;
        const cutK = rider.trick && rider.trick.name.endsWith('CUTBACK') && rider.trick.t < 0.3 ? 1 : 0;
        const hitK = Math.max(snapK, cutK);
        if (hitK && !fanHit) { fanHit = true; splashLens(5, 0.8); }   // (you ride through your own spray: a few drops on the lens)
        if (!hitK) fanHit = false;
        const slideK = Math.max(rider.skid, Math.min(1, ((rider.slide || 0) - 0.12) * 2.2));   // tail hanging out ~7 deg+ starts to spray
        if (slideK > 0.05 || hitK) {
          fanAcc += (Math.max(slideK, 0.3 * hitK) + 2.2 * hitK) * rider.v * 55 * dt;
          while (fanAcc >= 1) {
            fanAcc--;
            _p.copy(rig.position).addScaledVector(pose.fwd, -0.7 + Math.random() * 0.5);
            const keep = 0.6 + Math.random() * 0.3;
            _v.set(rider.vx * keep, 0, rider.vz * keep).add(_cv.set(sideX, 0, sideZ).multiplyScalar(2.5 + Math.random() * 3.5 * Math.max(rider.skid, hitK)))
              .add(_cv.set(0, 1.6 + Math.random() * 2.4 + 1.5 * hitK, 0));
            emit(_p, _v, 1, 0.9);
          }
        } else fanAcc = 0;
      // the foam ball behind you in the tube: sit too deep and its spray blows past you from behind, thicker the deeper you
      // are (surf.js catches you from ~2 wave heights behind the curl: you can't see behind you, but you can feel this)
      if (rider.inBarrel && rider.wave) {
        const H = rider.wave.cond.H, deepK = smooth01((-rider.s - 1.4 * H) / (1.2 * H));
        if (deepK > 0) {
          ballAcc += deepK * 700 * dt;
          const fx = Math.cos(rider.th), fz = Math.sin(rider.th);
          while (ballAcc >= 1) { ballAcc--;
            const side = (Math.random() - 0.5) * 2.2, up = 0.7 + Math.random() * 1.2, back = 0.6 + Math.random() * 2.2;   // (around your head, where you'd feel it)
            _p.set(rig.position.x - fx * back - fz * side, rig.position.y + up, rig.position.z - fz * back + fx * side);
            const fast = rider.v + 4 + Math.random() * 5 * deepK;
            emit(_p, _v.set(fx * fast, 0.4 + Math.random(), fz * fast), 1, 0.8);
          }
          ballLens -= dt; if (ballLens <= 0 && deepK > 0.35) { ballLens = 1.1 - 0.7 * deepK; splashLens(2 + Math.round(3 * deepK), 0.6); }
        } else ballAcc = 0;
      }
      } else acc = 0;
      for (let i = 0; i < SPRAY_N; i++) {
        if (life[i] <= 0) { if (life[i] > -1) { pos[i * 3 + 1] = -50; life[i] = -1; } continue; }
        life[i] -= dt;
        vel[i * 3 + 1] -= 9.8 * dt;
        const k = Math.exp(-dt * 1.2);
        vel[i * 3] *= k; vel[i * 3 + 2] *= k;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
})();

// ---------- first-person water: what you see around the board as you surf (all looks, none of it touches the ride).
//  (the foam specks rushing past on the water ahead were taken out: on a phone they read as white dots everywhere)
//  - sheets: big soft clouds of spray thrown off the rail in a carve, and a burst that fills the view for a moment in
//    a snap or cutback; fine spray blowing back off the lip over you when you're up near it
//  - drops: water beading on the deck and running back toward the tail at speed; a spurt over the nose off the chop
// __fxOff = true turns them all off (for measuring what they cost)
const surfFx = (() => {
  const soft = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  // sheets (big soft spray)
  const SN = 280, sp = new Float32Array(SN * 3), sv = new Float32Array(SN * 3), sl = new Float32Array(SN).fill(-1);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const spts = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xf4f7f6, size: 0.34, map: soft, transparent: true, opacity: 0.42, depthWrite: false }));
  spts.frustumCulled = false; scene.add(spts); for (let i = 0; i < SN; i++) sp[i * 3 + 1] = -99;
  // drops on the deck (in the board's own frame, so they ride with it)
  const DN = 48, dp = new Float32Array(DN * 3), dsp = new Float32Array(DN);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dpts = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xf2fbff, size: 0.045, map: soft, transparent: true, opacity: 0.95, depthWrite: false }));
  dpts.frustumCulled = false; for (let i = 0; i < DN; i++) dp[i * 3 + 1] = -99;
  let sNext = 0, sAcc = 0, mAcc = 0, lastTrick = null, frame = 0, spurtT = 2;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const sheet = (p, v, spread) => { const i = sNext; sNext = (sNext + 1) % SN; sp[i * 3] = p.x; sp[i * 3 + 1] = p.y; sp[i * 3 + 2] = p.z; sv[i * 3] = v.x + (Math.random() - .5) * spread; sv[i * 3 + 1] = v.y + Math.random() * spread; sv[i * 3 + 2] = v.z + (Math.random() - .5) * spread; sl[i] = 0.55 + Math.random() * 0.5; };
  return {
    attach() { if (dpts.parent !== board) board.add(dpts); },
    update(dt) {
      frame++;
      const on = !globalThis.__fxOff && rider && rider.standing && rider.y > -1 && rider.state === 'RIDE';
      if (on) {
        const v = rider.v, fx = Math.cos(rider.th), fz = Math.sin(rider.th), vx = rider.vx, vz = rider.vz;
        // spray sheets off the rail in a carve (to the outside of the turn, up and carried along with you)
        const curtain = Math.min(1, Math.abs(rider.turn) * v / 10 + rider.skid), out = Math.sign(rider.lean) || 1, sx = Math.sin(rider.th) * out, sz = -Math.cos(rider.th) * out;
        if (v > 5) sAcc += curtain * curtain * 80 * dt;
        while (sAcc >= 1) { sAcc--; _a.copy(rig.position).addScaledVector(pose.fwd, -0.2 - Math.random() * 0.6).addScaledVector(pose.up, 0.05);
          const keep = 0.55 + Math.random() * 0.3; _b.set(vx * keep + sx * (2.5 + Math.random() * 3.5) * curtain, 1.8 + Math.random() * 2.4 * curtain, vz * keep + sz * (2.5 + Math.random() * 3.5) * curtain); sheet(_a, _b, 1.2); }
        // a snap or cutback throws a wall of it up in front of you for a moment
        if (rider.trick && rider.trick !== lastTrick && /SNAP|CUTBACK/.test(rider.trick.name)) {
          for (let k = 0; k < 70; k++) { _a.copy(rig.position).addScaledVector(pose.fwd, -0.3 + Math.random() * 0.8).addScaledVector(pose.up, 0.1);
            _b.set(vx * 0.8 + sx * (3 + Math.random() * 4) + fx * 1.5, 3 + Math.random() * 4, vz * 0.8 + sz * (3 + Math.random() * 4) + fz * 1.5); sheet(_a, _b, 2); } }
        lastTrick = rider.trick;
        // up near the lip: fine spray blowing back off it over you (the offshore wind)
        const w = rider.wave;
        if (w && !rider.inBarrel && rider.s > -1.2 * w.cond.H && rider.s < 2.5 * w.cond.H && rider.y > 0.45 * w.cond.H) {
          const wind = ENV.weather && ENV.weather.wind !== undefined ? ENV.weather.wind : 1; mAcc += 30 * wind * dt;
          while (mAcc >= 1) { mAcc--; const L2 = w.lipAt(rider.s + (Math.random() - 0.3) * 8); _a.set(L2[0], L2[1] * (w.fade || 1) + 0.3, L2[2]);
            _b.set((Math.random() - 0.5) * 0.8, 1.2 + Math.random(), w.cond.speed - (3 + Math.random() * 4) * wind); sheet(_a, _b, 0.8); } }
        // drops on the deck, blown back toward the tail at speed; a spurt over the nose now and then off the chop
        const run = 0.4 + v * 0.14, nose = board.position.z + BOARD_LENGTH(boardType) / 2 - 0.25, tail = boardTail + 0.1;
        for (let i = 0; i < DN; i++) { if (dp[i * 3 + 1] < -9 || dp[i * 3 + 2] < tail) { if (v > 5 && Math.random() < dt * 6) { dp[i * 3] = (Math.random() - 0.5) * 0.34; dp[i * 3 + 1] = 0.045; dp[i * 3 + 2] = nose - Math.random() * 0.5; dsp[i] = run * (0.6 + Math.random() * 0.8); } else { dp[i * 3 + 1] = -99; continue; } }
          dp[i * 3 + 2] -= dsp[i] * dt; dp[i * 3] += Math.sin(frame * 0.3 + i) * 0.02 * dt; }
        dg.attributes.position.needsUpdate = true;
        if (v > 8 && (spurtT -= dt) <= 0) { spurtT = 1 + Math.random() * 2.5; _a.copy(rig.position).addScaledVector(pose.fwd, nose); _b.set(vx * 0.9, 2.2, vz * 0.9); railSpray.stream(_a, _b, 12, 1.2); if (Math.random() < 0.25) splashLens(2, 0.5); }
      } else if (dpts.visible) { for (let i = 0; i < DN; i++) dp[i * 3 + 1] = -99; dg.attributes.position.needsUpdate = true; }
      // age everything
      for (let i = 0; i < SN; i++) { if (sl[i] <= 0) { if (sl[i] > -1) { sp[i * 3 + 1] = -99; sl[i] = -1; } continue; } sl[i] -= dt; sv[i * 3 + 1] -= 9.8 * dt; const k = Math.exp(-dt * 1.6); sv[i * 3] *= k; sv[i * 3 + 2] *= k;
        sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt; }
      sg.attributes.position.needsUpdate = true;
    },
  };
})();

// ---------- wake: a trail of white water behind the board that sits on the surface, drifts with the wave and fades
const WAKE_N = 900;
const wake = (() => {
  const pos = new Float32Array(WAKE_N * 3), a = new Float32Array(WAKE_N), life = new Float32Array(WAKE_N), sz = new Float32Array(WAKE_N);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1)); g.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 1 }, uMax: { value: 8 } },
    vertexShader: 'attribute float aA; attribute float aS; varying float vA; uniform float uScale; uniform float uMax; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = min(aS * uScale / -mv.z, uMax); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d, d) * 4.; if (r > 1.) discard; gl_FragColor = vec4(vec3(.96, .95, .93), vA * (1. - r) * .7); }',
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  let next = 0, acc = 0, frame = 0;
  for (let i = 0; i < WAKE_N; i++) pos[i * 3 + 1] = -99;
  const _p = new THREE.Vector3();
  return {
    update(dt) {
      m.uniforms.uScale.value = renderer.domElement.height * 0.9; m.uniforms.uMax.value = 7 * renderer.getPixelRatio();   // flecks, never blobs
      if (rider && rider.standing && rider.y > -1) {
        // lay foam at the fins as fast as the board moves, a little wider when carving
        acc += (40 + rider.v * 9) * dt;
        while (acc >= 1) {
          acc--; const i = next; next = (next + 1) % WAKE_N;
          _p.copy(rig.position).addScaledVector(pose.fwd, -0.7 - Math.random() * 0.2);
          const side = (Math.random() - .5) * (0.25 + Math.abs(rider.turn) * 0.25);
          pos[i * 3] = _p.x - Math.sin(rider.th) * side; pos[i * 3 + 1] = _p.y; pos[i * 3 + 2] = _p.z + Math.cos(rider.th) * side;
          life[i] = 0.6 + Math.random() * 0.4; sz[i] = 0.06 + Math.random() * 0.06 + rider.skid * 0.08;
        }
      }
      // age, drift shoreward with the wave's water, stay on the surface (heights refreshed every other frame)
      frame++;
      for (let i = 0; i < WAKE_N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt / 2.2; a[i] = Math.max(0, life[i]); sz[i] *= 1 + dt * 0.5;
        if (life[i] <= 0) { pos[i * 3 + 1] = -99; continue; }
        pos[i * 3 + 2] += 1.2 * dt;
        if ((i + frame) % 2 === 0) pos[i * 3 + 1] = heightAt(waves, pos[i * 3], pos[i * 3 + 2]) + 0.03;
      }
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true; g.attributes.aS.needsUpdate = true;
    },
  };
})();

// ---------- your track: the churned white line your board leaves on the water. Laid at the fins every 30 cm as a ribbon
// that lies on the surface, spreads and breaks up as it ages, drifts in with the wave, and fades over five seconds (a
// cut or a slide leaves a wider scar). One mesh of a few hundred points: nothing for a phone
const TRACK_N = 320;
const track = (() => {
  const P = Array.from({ length: TRACK_N }, () => ({ x: 0, y: -99, z: 0, t: -99, w: 0, dx: 1, dz: 0 }));
  const pos = new Float32Array(TRACK_N * 2 * 3), uv = new Float32Array(TRACK_N * 2 * 2), al = new Float32Array(TRACK_N * 2), idx = [];
  for (let i = 0; i < TRACK_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: 'attribute float aA; varying float vA; varying vec2 vUv; void main(){ vA = aA; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying float vA; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ float across = abs(vUv.y - .5) * 2.;                               // 0 on the line, 1 at its edges
        float lace = n(vec2(vUv.x * 1.3, vUv.y * 5.)) * .6 + n(vec2(vUv.x * 4.1, vUv.y * 11.)) * .4;
        float a = vA * smoothstep(1., .25, across) * smoothstep(.28 + (1. - vA) * .35, .62, lace);   // breaking up into lace as it ages
        if (a < .01) discard; gl_FragColor = vec4(vec3(.95, .96, .95), a * .85); }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh);
  let head = -1, last = null, dist = 0, T0 = 0, frame = 0;
  return {
    clear() { for (const q of P) q.t = -99; head = -1; last = null; },
    update(dt) {
      T0 += dt; frame++;
      const on = rider && rider.standing && (rider.state === 'RIDE' || rider.state === 'POP') && rider.y > -1;
      if (on) {
        const fx = rig.position.x - pose.fwd.x * 0.75, fz = rig.position.z - pose.fwd.z * 0.75;
        const fy = rig.position.y;
        if (!last) { last = { x: fx, y: fy, z: fz }; dist = 1; }
        dist += Math.hypot(fx - last.x, fy - last.y, fz - last.z);   // (spaced along the path itself: climbing a steep face, points 30 cm apart across the water would be metres apart up it, and the flat strip between them would cut into the curved face)
        if (dist >= 0.3) { dist = 0; head = (head + 1) % TRACK_N; const q = P[head], pq = P[(head - 1 + TRACK_N) % TRACK_N], L = Math.hypot(fx - last.x, fz - last.z) || 1;
          Object.assign(q, { x: fx, z: fz, y: heightAt(waves, fx, fz) + 0.04, yl: undefined, yr: undefined, t: T0, w: 0.36 + Math.min(0.55, Math.abs(rider.turn) * 0.2 + rider.skid * 0.6 + (rider.slide || 0) * 0.5), dx: L > 0.08 ? (fx - last.x) / L : pq.dx, dz: L > 0.08 ? (fz - last.z) / L : pq.dz });   // (straight up the face the step across the water is tiny: keep the last heading, not a jittering one)
          last.x = fx; last.y = fy; last.z = fz; }
      } else last = null;
      // build the ribbon from the newest point back (a gap where a ride ended: two rides never join up)
      for (let k = 0; k < TRACK_N; k++) {
        const i = (head - k + TRACK_N) % TRACK_N, q = P[i], age = T0 - q.t, o = k * 2;
        let a = q.t < 0 ? 0 : Math.max(0, 1 - age / 5);
        const nq = P[(i - 1 + TRACK_N) % TRACK_N]; if (k < TRACK_N - 1 && (nq.t < 0 || Math.abs(q.t - nq.t) > 0.6)) a = 0;   // (the next point back belongs to another ride)
        if (k === 0) a *= 0.2;
        const w = a > 0 ? q.w * (1 + Math.min(age, 5) * 0.5) : 0, sx = -q.dz * w, sz = q.dx * w;   // (faded out: no width, so nothing is drawn there at all)
        if (a > 0) { q.z += 1.1 * dt; if (q.yl === undefined || q.hot || (i + frame) % 3 === 0) { const y0 = q.y; q.y = heightAt(waves, q.x, q.z) + 0.04; q.hot = Math.abs(q.y - y0) > 0.02; q.yl = heightAt(waves, q.x + sx, q.z + sz) + 0.04; q.yr = heightAt(waves, q.x - sx, q.z - sz) + 0.04; } }   // (each edge sits on the water where it is: up a steep face, one edge level with the middle would be buried in the wave and the line drawn as a saw. A point the moving face is lifting ('hot') is re-seated every frame, not every third: out of step with its neighbours, every third one sank into the face and the line showed as rungs)
        pos[o * 3] = q.x + sx; pos[o * 3 + 1] = a > 0 ? q.yl : q.y; pos[o * 3 + 2] = q.z + sz; pos[o * 3 + 3] = q.x - sx; pos[o * 3 + 4] = a > 0 ? q.yr : q.y; pos[o * 3 + 5] = q.z - sz;
        uv[o * 2] = q.t * 3; uv[o * 2 + 1] = 0; uv[o * 2 + 2] = q.t * 3; uv[o * 2 + 3] = 1; al[o] = al[o + 1] = a;
      }
      g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    },
  };
})();

// ---------- wipeout: the rider is thrown off, goes under, comes back up; the board tumbles away on its own
const W = { on: false, bv: new THREE.Vector3(), bw: new THREE.Vector3(), rv: new THREE.Vector3(), rw: new THREE.Vector3(), under: 0 };
const _e = new THREE.Euler(), _dq = new THREE.Quaternion();
function startWipe() {
  W.on = true; W.t = 0; W.under = 0; W.cam = null;
  const v = rider.v, lip = /lip|falls|closed|whitewater|broke/i.test(rider.why);
  // body: carried by its own speed, pitched forward; the lip throws you down toward the flats
  surfer.getWorldPosition(W.bp = new THREE.Vector3()); surfer.getWorldQuaternion(W.bq = new THREE.Quaternion());
  scene.attach(surfer);
  W.rv.copy(pose.fwd).multiplyScalar(v * 0.75).add(new THREE.Vector3(0, lip ? -1 : 2.2, lip ? 3.5 : 1.2));
  W.rw.set((Math.random() - .5) * 3, (Math.random() - .5) * 2, lip ? -6 : -3.5);
  // board: skips off along its line, spinning
  W.bv.copy(pose.fwd).multiplyScalar(v * 0.9).add(new THREE.Vector3(0, 1 + Math.random(), lip ? 2 : 0.5));
  W.bw.set(Math.random() * 6 - 3, Math.random() * 8 - 4, Math.random() * 10 - 5);
  play('fall', { once: true, fade: 0.08 });
  audio.splash(0.6); W.hit = false; railSpray.burst(rig.position, 90, 2.5);
}
function wipeout(dt) {
  if (!W.on) startWipe();
  W.t += dt;
  for (const [obj, vel, spin, isBody] of [[surfer, W.rv, W.rw, true], [rig, W.bv, W.bw, false]]) {
    const p = obj.position, water = heightAt(waves, p.x, p.z);
    const depth = water - p.y;
    if (depth > 0) {
      // in the water: heavy drag, the broken wave drags you shoreward, buoyancy brings you back up
      vel.multiplyScalar(Math.exp(-dt * (isBody ? 3.5 : 2.5)));
      vel.z += (isBody ? 2.5 : 3.5) * dt; vel.x += 1.2 * dt;
      vel.y += (isBody ? (W.t < 1.4 ? -2 : 6) : 14) * Math.min(1, depth + 0.3) * dt;
      spin.multiplyScalar(Math.exp(-dt * (isBody ? 2 : 3)));
      if (isBody) { W.under += dt; if (!W.hit) { W.hit = true; audio.splash(1.2); railSpray.burst(p, 160, 3.5); } }
    } else vel.y -= 9.8 * dt;
    p.addScaledVector(vel, dt);
    _dq.setFromEuler(_e.set(spin.x * dt, spin.y * dt, spin.z * dt)); obj.quaternion.premultiply(_dq);
    if (isBody && W.t > 1.4) {
      // back at the surface: head up, treading water
      p.y += (water - 1.35 - p.y) * Math.min(1, dt * 3);
      _dq.setFromEuler(_e.set(0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z), 0)); obj.quaternion.slerp(_dq, Math.min(1, dt * 3));
      vel.multiplyScalar(Math.exp(-6.3 * dt)); spin.set(0, 0, 0);
    }
    if (!isBody && depth > -0.05 && W.t > 1.2) { p.y += (water + 0.03 - p.y) * Math.min(1, dt * 4); _dq.setFromEuler(_e.set(0, obj.rotation.y, 0)); obj.quaternion.slerp(_dq, dt * 2); }
  }
  if (W.t > 1.4) play('tread', { fade: 0.4 });
}
function endWipe() { if (surfer) surfer.visible = true; if (!W.on) return; W.on = false; rig.add(surfer); surfer.position.set(0, 0, 0); surfer.quaternion.identity(); }

// ---------- surf stance on top of the clips: feet wide along the board, arms out for balance
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
const bones = {}, _rq = new THREE.Quaternion(), _bf = new THREE.Vector3(), _bs = new THREE.Vector3();
function aimBone(bone, child, target, w) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _d.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_d, target); _q.slerp(_wq.identity(), 1 - w);          // world-space turn toward the target, partly
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}
// paddling: alternating crawl strokes. Each arm reaches far forward over the water, digs in and pulls back under the
// board, comes out by the hip and swings forward elbow-high; the other arm half a stroke behind. (The stock clip is a
// breaststroke that keeps both hands under the board, where your own eyes can never see them.)
let paddlePh = 0, paddleW = 0; const _pf = new THREE.Vector3(), _pr = new THREE.Vector3(), _ps = new THREE.Vector3(), _ppo = new THREE.Vector3(), _ps2 = new THREE.Vector3();
function paddleArms(dt) {
  const want = rider.state === 'LIE' && rider.paddling ? 1 : 0;
  paddleW += (want - paddleW) * Math.min(1, dt * 6);
  if (paddleW < 0.02 || rider.standing) return;
  if (!bones.upperarm_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  surfer.updateMatrixWorld(true);
  paddlePh += dt * Math.PI * 2 * 0.75;                              // each arm ~1.3 s a stroke: a pull every ~0.67 s
  _pf.set(Math.cos(rider.th), 0, Math.sin(rider.th)); _pr.set(-_pf.z, 0, _pf.x);
  for (const [sd, off] of [['l', 0], ['r', Math.PI]]) {
    const ua = bones['upperarm_' + sd], la = bones['lowerarm_' + sd], hd = bones['hand_' + sd];
    if (!ua || !la || !hd) continue;
    ua.getWorldPosition(_ps); const side = Math.sign(_ps.sub(rig.position).dot(_pr)) || 1;
    // the hand's path, like a real crawl stroke seen in paddling POV footage: it goes in the water ahead of your shoulder
    // just outside the rail, pulls back under the surface to your hip, then comes out and swings forward over the
    // water with the elbow high (bent-arm pull, not a straight windmill)
    const u = ((paddlePh + off) / (Math.PI * 2)) % 1, sh = _ps.copy(ua.getWorldPosition(_ps));
    const wl = rig.position.y + 0.02;                                                   // the water line beside the board
    if (u < 0.55) { const k = u / 0.55;                                                  // pull: catch ahead -> hip, under the surface
      _t.copy(sh).addScaledVector(_pf, 0.47 - 0.77 * k).addScaledVector(_pr, side * (0.05 + 0.05 * Math.sin(k * Math.PI)));
      _t.y = wl - 0.03 - 0.18 * Math.sin(k * Math.PI);
      { const half = BOARD_WIDTH(boardType) / 2, lat = _ps2.subVectors(_t, rig.position).dot(_pr), want = side * (half + 0.08 + 0.05 * Math.sin(k * Math.PI)); if (lat * side < want * side) _t.addScaledVector(_pr, want - lat); }   // (just outside this board's rail: a wide board would swallow the hands)   // (full reach at the catch: the fingertips go in ahead, where you can see them)
      _ppo.copy(_pr).multiplyScalar(side * 0.7).addScaledVector(WORLD_UP, 0.7);          // elbow up and out, like pulling over a barrel
    } else { const k = (u - 0.55) / 0.45, e = k * k * (3 - 2 * k);                     // recovery: out by the hip, forward over the water
      _t.copy(sh).addScaledVector(_pf, -0.3 + 0.77 * e).addScaledVector(_pr, side * (0.1 + 0.12 * Math.sin(k * Math.PI)));
      _t.y = wl + 0.02 + 0.13 * Math.sin(k * Math.PI);   // (low over the water: swung high, the hand passed over your head and read as scratching it)
      { const half = BOARD_WIDTH(boardType) / 2, lat = _ps2.subVectors(_t, rig.position).dot(_pr), want = side * (half + 0.12 + 0.1 * Math.sin(k * Math.PI)); if (lat * side < want * side) _t.addScaledVector(_pr, want - lat); }
      _ppo.copy(WORLD_UP).multiplyScalar(0.45).addScaledVector(_pr, side * 0.85).addScaledVector(_pf, -0.3);   // elbow leading, out to the side more than up
    }
    reachArm(ua, la, hd, _t, _ppo, 0.95 * paddleW);
  }
}
// two-bone arm reach: put the hand on T (or as close as the arm allows), elbow bending toward the pole direction
const _ik1 = new THREE.Vector3(), _ik2 = new THREE.Vector3(), _ik3 = new THREE.Vector3(), _ik4 = new THREE.Vector3();
function reachArm(ua, la, hd, T, pole, w) {
  ua.getWorldPosition(_ik1); la.getWorldPosition(_ik2); hd.getWorldPosition(_ik3);
  const a = _ik1.distanceTo(_ik2), b = _ik2.distanceTo(_ik3);
  const toT = _ik4.subVectors(T, _ik1); let d = toT.length(); d = Math.min(Math.max(d, Math.abs(a - b) + 0.01), (a + b) * 0.94); toT.normalize();   // a soft bend always stays in the elbow (a locked-straight arm looks wrong)
  // elbow: along the reach by a*cos, out toward the pole by a*sin (law of cosines)
  const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const pp = _ik2.copy(pole).addScaledVector(toT, -pole.dot(toT)).normalize();
  const elbow = _ik3.copy(_ik1).addScaledVector(toT, a * ca).addScaledVector(pp, a * sa);
  // set both bones' full orientation (not just their aim), so the elbow is a true hinge: this rig's bones run along
  // their local +Y and the elbow folds the forearm toward the upper arm's local +Z. Aiming alone left the arm's roll to
  // chance, and the elbow crease could face in (it read as a twisted, inward elbow). Here the elbow point faces the pole.
  const Y = _hY.subVectors(elbow, _ik1).normalize();
  const tgt = _hT.copy(_ik1).addScaledVector(toT, d), f = _hF.subVectors(tgt, elbow).normalize();
  const Z = _hZ.copy(f).addScaledVector(Y, -f.dot(Y)); if (Z.lengthSq() < 1e-6) Z.copy(pp).negate(); Z.normalize();
  const X = _hX.crossVectors(Y, Z).normalize();
  setWorldBasis(ua, X, Y, Z, w);
  const Z2 = _hZ.crossVectors(X, f).normalize();
  setWorldBasis(la, X, f, Z2, w);
  hd.quaternion.slerp(_hQ.identity(), 0.8 * w); hd.updateMatrixWorld(true);   // wrist in line with the forearm, relaxed (the clip's wrist bend on a re-posed arm reads as a flexed-back 'stop' hand)
  // then roll the hand about its own length so the palm faces the water (this rig's palm is the hand's local +X on the
  // left, -X on the right), relaxed a little inward
  hd.getWorldQuaternion(_hQ);
  const ay = _hY.set(0, 1, 0).applyQuaternion(_hQ), palm = _hX.set(hd.name.endsWith('_l') ? 1 : -1, 0, 0).applyQuaternion(_hQ);
  const want = _hZ.set(0, -1, 0).addScaledVector(ay, ay.y); if (want.lengthSq() > 1e-4) {
    want.normalize(); palm.addScaledVector(ay, -palm.dot(ay)).normalize();
    const ang = Math.atan2(_hF.crossVectors(palm, want).dot(ay), palm.dot(want));
    hd.quaternion.multiply(_hP.setFromAxisAngle(_hT.set(0, 1, 0), ang * 0.85 * w)); hd.updateMatrixWorld(true);
  }
  // fingers relaxed and open (the clip curls them into a fist)
  hd.traverse((f) => { if (f !== hd && f.isBone) f.quaternion.slerp(_hQ.identity(), 0.75 * w); });
  relaxHand(hd, w);
}
// a relaxed hand: each finger curled a little toward the palm, more at the knuckle than the tip, fanning slightly, the
// thumb resting in (dead straight fingers pressed together read as a foot at the end of your arm)
const HANDCURL = { f: [0.22, 0.3, 0.2], thumb: [0.12, 0.15, 0.1], fan: 0.06 };
const _rp = new THREE.Vector3(), _rd = new THREE.Vector3(), _ra = new THREE.Vector3(), _rq2 = new THREE.Quaternion(), _rh = new THREE.Vector3(), _rq3 = new THREE.Quaternion();
const handRig = new Map();   // per hand: each finger bone with its curl axis in its own frame (worked out once: the rig never changes)
function relaxHand(hd, w) {
  let R = handRig.get(hd);
  if (!R) {
    R = []; const sd = hd.name.slice(-2); hd.updateMatrixWorld(true); hd.getWorldQuaternion(_rq2);
    const palm = _rp.set(sd === '_l' ? 1 : -1, 0, 0).applyQuaternion(_rq2);
    ['index', 'middle', 'ring', 'pinky', 'thumb'].forEach((nm, k) => {
      const th = nm === 'thumb', C = th ? HANDCURL.thumb : HANDCURL.f;
      for (let j = 1; j <= 3; j++) {
        const bn = hd.getObjectByName(nm + '_0' + j + sd), ch = bn && bn.children.find((c) => c.isBone); if (!ch) continue;
        bn.getWorldPosition(_rh); ch.getWorldPosition(_rd); _rd.sub(_rh).normalize();
        _ra.crossVectors(_rd, palm); if (_ra.lengthSq() < 1e-6) continue; _ra.normalize();
        bn.getWorldQuaternion(_rq3).invert();
        const q = new THREE.Quaternion().setFromAxisAngle(_ra.clone().applyQuaternion(_rq3), C[j - 1]);   // curl, about the bone's own axis
        if (j === 1 && !th) q.multiply(new THREE.Quaternion().setFromAxisAngle(palm.clone().applyQuaternion(_rq3), (k - 1.5) * HANDCURL.fan * (sd === '_l' ? 1 : -1)));   // and fan
        R.push({ bn, q });
      }
    });
    handRig.set(hd, R);
  }
  for (const f of R) { _rq2.identity().slerp(f.q, w); f.bn.quaternion.multiply(_rq2); }   // (no matrix updates: nothing reads the fingers before the frame is drawn)
}
const _hX = new THREE.Vector3(), _hY = new THREE.Vector3(), _hZ = new THREE.Vector3(), _hF = new THREE.Vector3(), _hT = new THREE.Vector3(), _hM = new THREE.Matrix4(), _hQ = new THREE.Quaternion(), _hP = new THREE.Quaternion();
function setWorldBasis(bone, X, Y, Z, w) {
  _hQ.setFromRotationMatrix(_hM.makeBasis(X, Y, Z));
  bone.parent.getWorldQuaternion(_hP); _hQ.premultiply(_hP.invert());
  bone.quaternion.slerp(_hQ, w); bone.updateMatrixWorld(true);
}
// swing a leg sideways (about the axis the rider faces) so its foot moves toward sgn * board-forward; keeps the knee bend
const _ax = new THREE.Vector3();
function swingBone(bone, end, sgn, ang) {
  _ax.crossVectors(bodyUp, bodyFwd).normalize();
  bone.getWorldPosition(_a); end.getWorldPosition(_b); _d.subVectors(_b, _a);
  const dir = Math.sign(_t.crossVectors(_ax, _d).dot(bodyFwd) * sgn) || 1;
  _q.setFromAxisAngle(_ax, ang * dir);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}
let stanceW = 0, pumpC = 0, pumpA = 0, pumpPh = 0, barrelK = 0, airK = 0, sitting = false, sitTilt = 0;
const rigQ = new THREE.Quaternion();
function straddle() { straddleFor(bones, rig, surfer); }
// the same straddle for any sitting body B (bone map) on its board frame R (the locals use it too)
function straddleFor(B, R, body) {
  // the sit clip is a chair pose (thighs forward); on a board the thighs go down either side and the shins hang in the water
  if (!B.thigh_l) body.traverse((o) => { if (o.isBone) B[o.name] = o; });
  body.updateMatrixWorld(true);
  R.getWorldQuaternion(_rq); _bf.set(0, 0, 1).applyQuaternion(_rq); _bs.set(1, 0, 0).applyQuaternion(_rq);
  for (const [s, sg] of [['l', 1], ['r', -1]]) {
    const side = B['thigh_' + s].getWorldPosition(_a).sub(R.getWorldPosition(_b)).dot(_bs) > 0 ? 1 : -1;
    // thighs forward and down either side of the rails (your knees are what you see below you), shins hanging
    _t.set(0, -0.3, 0).addScaledVector(_bs, side * 0.32).addScaledVector(_bf, 1.1).normalize();   // thighs along the rails, knees at the rail edge
    aimBone(B['thigh_' + s], B['calf_' + s], _t, 0.9);
    _t.set(0, -1, 0).addScaledVector(_bf, 0.1).addScaledVector(_bs, side * 0.1).normalize();
    aimBone(B['calf_' + s], B['foot_' + s], _t, 0.8);
  }
  // hands resting on the deck in front of you, either side of the stringer: from your own eyes you see your
  // knees, your hands and the board you're sitting on (without them the board looks like it floats away from you)
  B.pelvis.getWorldPosition(_sp);
  const deckY = R.getWorldPosition(_b).y + 0.07;
  for (const s of ['l', 'r']) {
    const ua = B['upperarm_' + s], side = ua.getWorldPosition(_a).sub(_b).dot(_bs) > 0 ? 1 : -1;
    _sT.copy(_sp).addScaledVector(_bf, 0.85).addScaledVector(_bs, side * 0.2); _sT.y = deckY;   // hands on the rails just ahead of your knees
    reachArm(ua, B['lowerarm_' + s], B['hand_' + s], _sT, _t.set(0, 0, 0).addScaledVector(_bs, side).addScaledVector(_bf, -0.3), 0.9);
  }
}
const _sp = new THREE.Vector3(), _sT = new THREE.Vector3();
// turn a bone about a world axis (keeps everything below it attached)
function turnBone(bone, axis, ang) {
  if (!bone || Math.abs(ang) < 1e-4) return;
  _q.setFromAxisAngle(axis, ang);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}
const _in = new THREE.Vector3(), _fw = new THREE.Vector3();
let bodyT = 0, gLoad = 0; const STOOP = 0.25; const ARM = { ff: 0.62, fd: 0.32, bf: 0.5, bd: 0.4 };   // hand targets ahead of / below the eyes (front hand, back hand), vetted in first-person
const _af = new THREE.Vector3(), _ar = new THREE.Vector3(), _ah = new THREE.Vector3(), _ap = new THREE.Vector3(), _aq = new THREE.Vector3(); const _sideAx = new THREE.Vector3();
// the deck's height along the stringer, from the board's own mesh (highest point near the centre line in each slice)
const deckCache = new WeakMap();
function deckAt(zRig) {
  let D = deckCache.get(board);
  if (!D) {
    const P = board.geometry.attributes.position, N = 64; board.geometry.computeBoundingBox(); const bb = board.geometry.boundingBox, z0 = bb.min.z, z1 = bb.max.z;
    const top = new Float32Array(N).fill(-1);
    for (let i = 0; i < P.count; i++) { if (Math.abs(P.getX(i)) > 0.08) continue; const k = Math.min(N - 1, Math.max(0, Math.round((P.getZ(i) - z0) / (z1 - z0) * (N - 1)))); top[k] = Math.max(top[k], P.getY(i)); }
    for (let k = 0; k < N; k++) if (top[k] < -0.5) top[k] = k ? top[k - 1] : 0.04;
    D = { top, z0, z1, N }; deckCache.set(board, D);
  }
  const u = Math.min(1, Math.max(0, (zRig - board.position.z - D.z0) / (D.z1 - D.z0))) * (D.N - 1), k = Math.floor(u), f = u - k;
  return board.position.y + D.top[k] + (D.top[Math.min(D.N - 1, k + 1)] - D.top[k]) * f;
}
// legs: each foot planted flat on the deck, front foot ahead of the hips toward the nose and the back foot over the tail
// pad, toes across the board; the knees bend to reach (two-bone reach, knees toward your toes, the back knee angled in
// toward the front one). The board rolling onto its rail is taken up in the knees, the feet stay on it.
const _fA = new THREE.Vector3(), _fB = new THREE.Vector3(), _fC = new THREE.Vector3(), _fD = new THREE.Vector3(), _fT = new THREE.Vector3(), _fN = new THREE.Vector3(), _fX = new THREE.Vector3(), _fP = new THREE.Vector3();
const FEET = { front: 0.3, back: 0.3, ankle: 0.085, toeIn: 0.35, backToe: 0.12 };
function plantFeet(w) {
  const tl = bones.thigh_l, tr = bones.thigh_r; if (!tl || !tr || !bones.ball_l) return;
  const inv = _hM.copy(rig.matrixWorld).invert();
  const zl = tl.getWorldPosition(_fA).applyMatrix4(inv).z, zr = tr.getWorldPosition(_fA).applyMatrix4(inv).z;
  const pz = bones.pelvis.getWorldPosition(_fA).applyMatrix4(inv).z;
  const nose = _fN.set(0, 0, 1).transformDirection(rig.matrixWorld), up = _fX.set(0, 1, 0).transformDirection(rig.matrixWorld);
  const toes = _fP.set(0, 0, 1).transformDirection(bones.pelvis.matrixWorld); toes.addScaledVector(nose, -toes.dot(nose)).addScaledVector(up, -toes.dot(up)).normalize();   // (the way your chest faces, across the board)
  const lim = BOARD_LENGTH(boardType) / 2 - 0.12;
  for (const s of ['l', 'r']) {
    const front = (s === 'l') === (zl > zr), th = bones['thigh_' + s], ca = bones['calf_' + s], ft = bones['foot_' + s], ba = bones['ball_' + s];
    const z = Math.max(board.position.z - lim, Math.min(board.position.z + lim, pz + (front ? FEET.front : -FEET.back)));
    const T = _fT.set(0, deckAt(z) + FEET.ankle, z).applyMatrix4(rig.matrixWorld);
    // knee: toward your toes, the front one a little toward the nose, the back one in toward the front knee
    const pole = _fD.copy(toes).addScaledVector(nose, front ? 0.25 : 0.45).addScaledVector(up, 0.1).normalize();
    th.getWorldPosition(_fA); ca.getWorldPosition(_fB); ft.getWorldPosition(_fC);
    const a = _fA.distanceTo(_fB), b = _fB.distanceTo(_fC), toT = _fB.subVectors(T, _fA); let d = toT.length();
    d = Math.min(Math.max(d, Math.abs(a - b) + 0.02), (a + b) * 0.985); toT.normalize();
    const cA = (a * a + d * d - b * b) / (2 * a * d), sA = Math.sqrt(Math.max(0, 1 - cA * cA));
    const pp = pole.addScaledVector(toT, -pole.dot(toT)).normalize();
    const knee = _fC.copy(_fA).addScaledVector(toT, a * cA).addScaledVector(pp, a * sA);
    aimBone(th, ca, _fB.subVectors(knee, _fA).normalize(), w);
    ca.getWorldPosition(_fA); aimBone(ca, ft, _fB.subVectors(T, _fA).normalize(), w);
    // the foot flat on the deck: toes across the board (the front foot turned a little toward the nose), sole on the deck
    const tdir = _fB.copy(toes).addScaledVector(nose, front ? FEET.toeIn : FEET.backToe).normalize();
    ft.getWorldPosition(_fA); const bT = _fC.copy(_fA).addScaledVector(tdir, 0.12);
    const zb = bT.clone().applyMatrix4(inv); bT.addScaledVector(up, deckAt(zb.z) + 0.03 - zb.y);
    aimBone(ft, ba, _fB.subVectors(bT, _fA).normalize(), w);
    ba.quaternion.slerp(_hQ.identity(), 0.8 * w); ba.updateMatrixWorld(true);   // toes flat, not curled
  }
}
function surfStance() {
  if (sitting) straddle();
  const st = rider.state, want = st === 'RIDE' ? 1 : st === 'POP' ? Math.min(1, popClock() / 0.45) : 0;
  stanceW += (want - stanceW) * (1 - Math.exp(-13 * dtArm));
  if ((stanceW < 0.02 && st !== 'POP') || (st === 'WIPE' && W.on)) return;   // (never pose a body that's been thrown off)
  if (!bones.thigh_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  surfer.updateMatrixWorld(true);
  bodyT += dtArm;
  // which way along the board each side of the body sits
  bones.thigh_l.getWorldPosition(_a); bones.thigh_r.getWorldPosition(_b);
  const side = Math.sign(_d.subVectors(_a, _b).dot(bodyFwd)) || 1;
  const w = stanceW, deep = barrelK;
  // how hard the turn is loading the legs (sideways g), smoothed; which way is the inside of the turn
  gLoad += (Math.min(1.4, Math.abs(rider.turn) * rider.v / 9.8) - gLoad) * (1 - Math.exp(-10 * dtArm));
  const leanN = Math.max(-1, Math.min(1, rider.lean / RIDE.leanMax));
  _in.crossVectors(bodyFwd, bodyUp).normalize().multiplyScalar(Math.sign(leanN) || 1);   // toward the inside of the carve (forward x up = your right; +lean turns right)
  plantFeet(w);   // (feet flat on the deck along the stringer, knees bent to reach it: the clips' legs went through the board or floated above it)
  // upper body: shoulders twist into the turn and the chest bends toward the inside; a slow balance sway on top
  const twist = (leanN * 0.45 + Math.sin(bodyT * 1.1) * 0.05) * w;
  turnBone(bones.spine_02, bodyUp, twist * 0.5); turnBone(bones.spine_03, bodyUp, twist * 0.5);
  _fw.copy(bodyFwd);
  turnBone(bones.spine_01, _fw, -leanN * 0.18 * w * side);
  // an athletic stance: chest a little forward over the knees, not standing up straight
  _sideAx.crossVectors(bodyFwd, bodyUp).normalize(); turnBone(bones.spine_02, _sideAx, STOOP * w);
  // head: look ahead along your line (surfers always look where they're going)
  turnBone(bones.head, bodyUp, side * 0.55 * w - twist * 0.6);
  // arms last (after the torso has twisted and leaned), from surf-coaching descriptions of each moment, measured from
  // your eyes (F = where you look, R = right, "wave" = toward the face). Frontside = chest to the wave.
  //   trim:        front hand low and ahead over the rail, palm down, pointing where you go; back hand low by the hip
  //   bottom turn: frontside the front arm reaches to the lip and the inside (back) hand drops to the water;
  //                backside the front hand drops to the water as the pivot
  //   top turn / cutback: the front arm leads round and points down the face, the back arm comes across low
  //   stall:       the trailing hand drags in the face;  barrel: compact, front hand toward the wall
  //   pop-up:      hands flat on the deck under your shoulders, then the front arm opens forward and low
  // arms never go above the shoulders, and they lead the board: the lean you ask for (not the board's heading) drives them
  const F = _af.set(Math.cos(pov.yaw), 0, Math.sin(pov.yaw)), R = _ar.set(-F.z, 0, F.x);
  // which side the wave is on, with a dead band: heading straight at the beach or the wave it would flip every frame
  { const d = INTO_WAVE.dot(R); if (Math.abs(d) > 0.25) waveSide = Math.sign(d); }
  const ws = waveSide, stallK = Math.min(1, (rider.stalling || 0) * 1.3);
  const popK = st === 'POP' ? 1 : st === 'RIDE' ? Math.max(0, 1 - rider.stateT / 0.5) : 0;
  // frontside or backside: which way your chest faces
  bones.upperarm_l.getWorldPosition(_ik1); bones.upperarm_r.getWorldPosition(_ik2);
  const chest = _cv.crossVectors(WORLD_UP, _ik3.subVectors(_ik2, _ik1)).dot(INTO_WAVE) > 0 ? 1 : 0;   // up x (right - left shoulder) = chest
  const leanW = Math.abs(leanN) * (Math.sign(_in.dot(R) * ws) || 0);   // + = leaning toward the wave (bottom turn), - = away (top turn / cutback)
  const bt = Math.max(0, leanW), tt = Math.max(0, -leanW), pumpUp = 0;
  // pumping arms: in time with each stroke, both hands drive down and forward as the legs compress, then lift a little
  // above where they were as you spring up (a full swing every stroke, like a skater pumping a ramp); the front hand
  // leads, the back hand follows smaller. Only what you see: the physics doesn't know about the arms.
  { const pg = rider.pumpGap, want = rider.standing && pg < PUMP_PERIOD ? Math.sin(2 * Math.PI * pg / PUMP_PERIOD) : 0;
    armPw += (want - armPw) * Math.min(1, dtArm * 18); }
  const aw = (armPw > 0 ? armPw : 0.55 * armPw) * 0.14 * (1 - popK);   // metres: down 14 cm at the press, up ~8 cm on the spring
  // your eyes this frame (the camera itself is placed after the pose, a frame behind: at 10 m/s that's 17 cm)
  const eye = bones.head.getWorldPosition(_eyeA).addScaledVector(F, POVCAM.fwd).addScaledVector(WORLD_UP, POVCAM.up);
  // a target in eye space: f forward, d down, x toward the wave (negative = open side)
  const at = (out, f, d, x) => out.copy(eye).addScaledVector(F, f).addScaledVector(WORLD_UP, -d).addScaledVector(R, x * ws);
  // the front arm is whichever shoulder is further ahead along your line (worked out, not assumed from the stance)
  const frontArm = _cv.subVectors(_ik1, eye).dot(F) > _ik4.subVectors(_ik2, eye).dot(F) ? 'l' : 'r';
  for (const s of ['l', 'r']) {
    const front = s === frontArm, sway = Math.sin(bodyT * 1.7 + (front ? 0 : 1.3)) * 0.03;
    const P = _ap;
    if (front) {
      at(P, chest ? 0.64 : 0.6, 0.58 - sway, chest ? 0.3 : -0.3);   // out over the rail, beside the board                       // trim
      if (bt) P.lerp(chest ? at(_aq, 0.55, 0.5, 0.3) : at(_aq, 0.45, 0.78, 0.34), bt);                               // bottom turn
      if (tt) P.lerp(at(_aq, 0.5, 0.68, -0.32), tt);                                                                  // top turn / cutback: leads round, points down the face
      if (deep) P.lerp(chest ? at(_aq, 0.45, 0.66, 0.45) : at(_aq, 0.48, 0.72, -0.22), deep);                           // barrel (backside pigdog: low, grabbing the outside rail)
    } else {
      at(P, -0.08, 0.78 - sway, -0.3);   // relaxed and low, just ahead of the back hip toward the rail (the shoulder is ~0.35 below the eyes)                                                                                // trim: by the back hip
      if (bt) P.lerp(chest ? at(_aq, -0.08, 0.92, 0.35) : at(_aq, -0.2, 0.62, -0.25), bt);
      if (tt) P.lerp(at(_aq, 0.3, 0.75, -0.15), tt);                                                                  // comes across low
      if (deep) P.lerp(chest ? at(_aq, -0.15, 0.7, 0.2) : at(_aq, -0.3, 0.6, 0.4), deep);                             // barrel (backside: trailing arm along the face)
    }
    // a hand never reaches across your body (a whole arm across the view reads as broken): if its pose asks for the
    // other side, it goes to its own side instead; in a stall the drag is done by the hand on the wave side
    bones['upperarm_' + s].getWorldPosition(_ik4);
    if (stallK) { if ((chest ? !front : front)) { at(_aq, 0.35, 0.62, 0.5); _aq.y = Math.min(Math.max(heightAt(waves, _aq.x, _aq.z) + 0.02, eye.y - 0.85), eye.y - 0.5); P.lerp(_aq, stallK); } else P.lerp(front ? at(_aq, 0.45, 0.55, -0.2) : at(_aq, -0.1, 0.75, -0.3), stallK); }   // the other hand stays relaxed (never folded back behind its own shoulder)   // frontside the back hand drags, backside the front hand; ahead enough to see it trail through the face   // the drag hand is on the water itself: fingers in the face beside you
    // pop-up: flat on the deck under your shoulders, beside your ribs
    // pop-up: hands flat on the deck either side of the stringer, just ahead of your chest (placed on the board itself)
    if (popK > 0) { const sideSign = Math.sign(_cv.subVectors(bones['upperarm_' + s].getWorldPosition(_ik4), bones.spine_03.getWorldPosition(_ik1)).dot(_ik2.set(1, 0, 0).applyQuaternion(rig.quaternion))) || 1;
      P.lerp(rig.localToWorld(_aq.set(0.17 * sideSign, 0.1, 0.35)), popK); }
    if (aw) P.addScaledVector(F, (front ? 0.6 : 0.25) * aw).addScaledVector(WORLD_UP, -(front ? 1 : 0.6) * aw);   // (the pump swing, on top of whatever the arms are doing)
    // smooth each hand's path (the pose blends above can jump between frames when the lean changes side)
    // (smoothed relative to your eyes: smoothing in the world would leave the hands trailing behind you at speed)
    const sm = armSm[s]; P.sub(eye); if (!sm.ok || snapCam) { sm.p.copy(P); sm.ok = true; } else sm.p.lerp(P, Math.min(1, dtArm * 14)); P.copy(sm.p).add(eye);
    // never into the lens
    const cd = P.distanceTo(eye); if (cd < 0.45) P.addScaledVector(F, 0.45 - cd);
    const ua = bones['upperarm_' + s], la = bones['lowerarm_' + s], hd = bones['hand_' + s], cl = bones['clavicle_' + s];
    // the shoulder follows the reach (collarbone rolls forward/down toward the hand), so the upper arm doesn't have to
    // twist to an extreme angle and stretch the skin at the shoulder into a fin
    if (cl) { cl.getWorldPosition(_ik1); aimBone(cl, ua, _ik3.subVectors(P, _ik1).normalize(), 0.8 * w); }
    // your right hand stays on the right of what you see and your left hand on the left (a hand crossing to the other
    // side of the view reads as the wrong hand with its elbow twisted in), and each elbow bends out to its own side
    // (only the front arm: the back arm hangs behind you, out of view, and forcing it across would cramp it into the chest)
    const own = s === 'r' ? 1 : -1, lat = _cv.subVectors(P, eye).dot(R);
    if (front && lat * own < 0.1) P.addScaledVector(R, own * 0.1 - lat);
    // the back elbow points away from the body (out from the chest along the shoulder line) and down
    if (front) _aq.copy(R).multiplyScalar(own * 0.8).addScaledVector(WORLD_UP, -0.6).addScaledVector(F, -0.15);
    else { bones.spine_03.getWorldPosition(_ik1); _aq.subVectors(_ik4, _ik1).setY(0).normalize().multiplyScalar(0.8).addScaledVector(WORLD_UP, -0.6); }
    reachArm(ua, la, hd, P, _aq, st === 'POP' ? 0.95 : 0.92 * w);
  }
}
let waveSide = -1, armPw = 0; const _eyeA = new THREE.Vector3(), _wr = new THREE.Vector3(), _ray = new THREE.Raycaster(); const armSm = { l: { p: new THREE.Vector3(), ok: false }, r: { p: new THREE.Vector3(), ok: false } }, _hq = new THREE.Quaternion();
let dtArm = 1 / 60;

// ---------- HUD + end of ride
const setText = (el, t) => { if (el && el._t !== t) { el._t = t; el.textContent = t; if (el === ui.hint) document.body.classList.toggle('hinting', !!t); } };   // (a tip up top: the spot name beside it steps aside, on a small phone the two ran into each other)   // only touch the page when the text changes
let endT = -1, snapCam = true, tubeShowT = 0, lastAir = false;
// ---- the HUD's speed, score and move callouts (look: index.html #speed, #score, #tube)
const hudSpdB = ui.speed.querySelector('b'), hudBar = ui.speed.querySelector('.sbar i'), hudScB = ui.score.querySelector('b');
const cBig = ui.tube.querySelector('.cbig'), cWord = ui.tube.querySelector('.cword'), cPts = ui.tube.querySelector('.cpts');
let hudKmh = -2, scShown = -1, callKey = null, callOn = false, callSlamT = 0;
ui.score.addEventListener('animationend', () => ui.score.classList.remove('bump'));
function hudSpeed(kmh) {
  if (kmh === hudKmh) return; const on = kmh >= 0; ui.speed.classList.toggle('on', on); hudKmh = kmh; if (!on) return;
  hudSpdB.textContent = kmh; hudBar.style.width = (Math.min(1, kmh / 70) * 100).toFixed(1) + '%';   // (full at 70 km/h; the gold end fills in as you go faster)
}
function hudScore(v, dt) {
  const on = v >= 0; if (ui.score.classList.contains('on') !== on) ui.score.classList.toggle('on', on);
  if (!on) { scShown = -1; return; }
  if (scShown < 0 || v < scShown) scShown = v;
  else if (v > scShown + 0.05) { if (!ui.score.classList.contains('bump') || v - scShown > 0.3) { ui.score.classList.remove('bump'); void ui.score.offsetWidth; ui.score.classList.add('bump'); } scShown += (v - scShown) * Math.min(1, dt * 9); }   // (counts up, with a bump)
  else scShown = v;
  const t = scShown.toFixed(1); if (hudScB.textContent !== t) hudScB.textContent = t;
}
const CALL_COL = { gold: '#ffcf8a', sea: '#8fe6d6', coral: '#ff8e6e' };
function hudCallOff(now) { if (!callOn && !now) return; callOn = false; callKey = null; ui.tube.classList.remove('on', 'slam', 'big', 'live'); if (!now) ui.tube.classList.add('out'); else ui.tube.classList.remove('out'); }
function hudCallShow(key, big, word, pts, col, slam) {
  if (cWord.textContent !== word) cWord.textContent = word;
  if (key === callKey) return;
  callKey = key; callOn = true; cBig.textContent = big; cPts.textContent = pts; ui.tube.style.setProperty('--c', CALL_COL[col]);
  ui.tube.classList.remove('out', 'slam', 'big', 'live'); void ui.tube.offsetWidth; ui.tube.classList.add('on');
  if (slam) { ui.tube.classList.add('slam'); if (big) ui.tube.classList.add('big'); callSlamT = big ? 0.46 : 0.34; }
}
// the callout: the barrel's own clock while you're in it (counting up, pulsing), or the move you just landed with its points
function hudCall(st, dt) {
  callSlamT = Math.max(0, callSlamT - dt);
  if (st === 'RIDE' && tubeShowT > 0) {
    hudCallShow('tube', '', `BARREL ${Math.max(0, rider.ride.tubeT).toFixed(1)}s`, '', 'sea', true);
    if (!callSlamT && !ui.tube.classList.contains('live')) { ui.tube.classList.remove('slam', 'big'); ui.tube.classList.add('live'); }
    return;
  }
  const tr = st === 'RIDE' ? rider.trick : null;
  if (!tr) { hudCallOff(false); return; }
  if (tr !== callKey) {
    const m = /^(BIG |DEEP )?(.*)$/.exec(tr.name), word = m[2], mv = rider.ride.moves[rider.ride.moves.length - 1];
    hudCallShow(tr, (m[1] || '').trim(), word, mv ? `+${mv.pts.toFixed(1)}` : '', /^BARREL/.test(word) ? 'sea' : /^AIR/.test(word) ? 'coral' : 'gold', true);
  }
}
function updateHUD(dt) {
  const st = rider.state;
  hudSpeed(rider.standing ? Math.round(rider.v * 3.6) : -1);
  if (mode === 'random') setText(ui.cond, rider.wave && rider.standing ? `Random: ${rider.wave.cond.name.toLowerCase()} wave` : 'Random');
  ui.paddle.style.visibility = st === 'WIPE' || st === 'OUT' ? 'hidden' : 'visible';
  const lbl = rider.standing ? 'PUMP' : 'PADDLE'; if (ui.paddle.dataset.l !== lbl) { ui.paddle.dataset.l = lbl; ui.paddle.innerHTML = DESK ? `${lbl}<small>SPACE</small>` : lbl; }
  // coaching for the first few waves: read the sea like a surfer would
  let hint = '';
  if (st === 'LIE' && ranchWaiting()) hint = session.waves < 3 ? 'Order a wave: it comes out of the machine wall in front of you' : '';
  else if (st === 'LIE') {
    const inc = incoming(), facingIn = Math.sin(rider.th) > 0.5;
    const onWave = rider.y > 0.3 && rider.onFace;
    if (rider.washed) hint = 'Caught inside! Hold on, paddle back out';
    else if (onWave) hint = rider.paddling ? 'Keep paddling!' : 'Paddle now!';
    else if (inc.w && inc.t < 9 && inc.t > 3 && !isRanch() && Math.abs(rider.x - (inc.w.peelX + inc.w.cond.peel * inc.t + 0.3 * inc.w.cond.H)) > 0.6 * RIDE.catchReach * inc.w.cond.H) {
      // this wave breaks up or down the reef from you: move along to where it will break (left and right as you see it)
      const dx = inc.w.peelX + inc.w.cond.peel * inc.t + 0.3 * inc.w.cond.H - rider.x, side = dx * -Math.sin(rider.th) * (MIRROR ? -1 : 1);
      hint = `Wave coming: paddle ${side > 0 ? 'right' : 'left'} to where it breaks`;
    }
    else if (inc.w && inc.t < 7 && inc.t > -0.5) hint = !facingIn ? `Wave coming: turn to face ${isRanch() ? 'the shallow end' : 'the beach'}` : inc.t < 2.5 ? 'Paddle hard!' : 'Wave coming... get ready';
    else if (session.waves < 2 && inc.t >= 7) hint = 'Watch the horizon for the next set';
    else if (rider.z > 12) hint = 'Too far in: paddle back out past the break';
  } else if (st === 'POP') hint = session.waves < 5 ? `Up! Go ${MIRROR ? 'RIGHT' : 'LEFT'} along the wave, hold PUMP for speed` : 'Up!';
  else if (st === 'RIDE' && rider.inBarrel && (rider.foamT || 0) > 0.4) hint = 'Too deep! PUMP and steer up the face to get out';
  else if (st === 'RIDE' && rider.stateT < 7.5 && session.waves < 3) hint = rider.stateT < 2.5 ? 'Slide your thumb left and right to carve, like a steering wheel' : rider.stateT < 5 ? 'Hold PUMP and carve gently for speed, STALL to brake and let the barrel catch you' : 'Let go and the board just glides straight';
  else if (st === 'RIDE' && rider.stateT > 8 && rider.stateT < 12 && session.waves < 5 && !rider.ride.cutbacks) hint = `Cutback: keep turning ${MIRROR ? 'left' : 'right'} till you face the breaking wave, then turn back`;
  else if (st === 'RIDE' && rider.stateT > 13 && rider.stateT < 17 && session.waves >= 1 && session.waves < 6 && !rider.ride.moves.some((m) => m.name.startsWith('AIR')) && RIDE.air) hint = 'Air: race down, then turn hard up the face into the lip and it launches you';
  // the curl is right behind you: tell the player how to get covered (a barrel comes to whoever sets up for it)
  if (st === 'RIDE' && !hint && !rider.inBarrel && rider.wave && rider.s > 0 && rider.s < 2.2 * rider.wave.cond.H && rider.wave.cond.hollow > 0.5 && session.barrels < 2) hint = rider.y < 0.6 * rider.wave.cond.H ? 'Barrel coming! Stay low and hold STALL' : 'The lip is pitching behind you: drop low to get barreled';
  setText(ui.hint, session.waves < 5 || st === 'POP' ? (DESK ? deskHint(hint) : hint) : '');
  // the callout: BARREL while you're in it, or the move you just landed
  tubeShowT = rider.inBarrel ? 0.4 : Math.max(0, tubeShowT - dt);   // (held a moment: a wobble at the tube's edge doesn't flicker the word)
  hudCall(st, dt);
  if (st === 'RIDE') { if (isRanch() && ranchKind && rider.stateT > 1.5) chalKinds.add(ranchKind); chalCheck(false); }   // (challenges done mid-ride show the moment they happen)
  hudScore(st === 'RIDE' ? rider.liveScore() : -1, dt);
  if ((st === 'WIPE' || st === 'OUT') && endT < 0) {
    endT = 0;
    const r = rider.ride;
    const prevBest = bestFor(mode), newBest = r.t > 0 && r.score > prevBest && prevBest > 0;
    if (r.t > 0 && r.score > prevBest) saveBest(mode, r.score);
    if (r.t > 0 || st === 'WIPE') { session.waves++; session.total += r.score; session.best = Math.max(session.best, r.score); session.scores.push(r.score); if (r.barrel > 0.5) session.barrels++; }
    // heat total, like a contest: your best two waves count
    const two = [...session.scores].sort((a, b) => b - a).slice(0, 2), heat = two.reduce((a, b) => a + b, 0);
    ui.msgT.textContent = rider.why;
    ui.msgN.innerHTML = r.t > 0 ? `${r.score.toFixed(1)}${newBest ? '<small>NEW BEST</small>' : ''}` : '';
    const stat = (v, l) => `<div>${v}<span>${l}</span></div>`;
    ui.msgS.innerHTML = r.t > 0 ? stat(`${r.t.toFixed(1)}s`, 'RIDE') + stat(`${Math.round(r.top)}`, 'TOP KM/H') + stat(r.turns, 'TURNS') + (r.cutbacks ? stat(r.cutbacks, r.cutbacks > 1 ? 'CUTBACKS' : 'CUTBACK') : '') + (r.snaps ? stat(r.snaps, r.snaps > 1 ? 'SNAPS' : 'SNAP') : '') + (r.barrel > 0.2 ? stat(`${r.barrel.toFixed(1)}s`, 'BARREL') : '') : '';
    // the judges' sheet: the moves that counted and why (so you can see how to beat it)
    { const J = r.t > 0 ? rider.liveScore(st === 'WIPE', true) : null, NM = { TURN: 'Turn', SNAP: 'Snap', CUTBACK: 'Cutback', FLOATER: 'Floater', AIR: 'Air', 'AIR 360': 'Air 360', BARREL: 'Barrel', VARIETY: 'Variety of moves', 'SPEED + CLEAN FINISH': 'Speed and a clean finish', SPEED: 'Speed' };
      ui.msgJ.innerHTML = J && J.lines.length ? J.lines.slice(0, 6).map((l) => `<div><span><b>${NM[l.name] || l.name}${l.name === 'BARREL' ? ` ${l.dur.toFixed(1)}s` : ''}</b>${l.notes.length ? `<i>${l.notes.join(', ')}</i>` : ''}</span><em>${l.pts.toFixed(1)}</em></div>`).join('') + (J.fell ? '<div><span><i>fell at the end: moves in the last moment don\'t count</i></span><em></em></div>' : '') : ''; }
    ui.sess.textContent = session.waves ? `Heat ${heat.toFixed(2)} / 20 ${session.waves > 1 ? `(your best two of ${session.waves} waves)` : '(your best two waves count)'}  ·  best wave ever ${Math.max(bestFor(mode), r.score).toFixed(1)}` : '';
    chalCheck(true, heat); if (CHAL[mode]) ui.sess.textContent += `${ui.sess.textContent ? '  ·  ' : ''}Challenges ${chalCount(mode)}/3`;   // (the ones that need the finished ride: its score, your heat)
  }
  // a wipeout plays out first (you see yourself go over), then the summary fades in
  if (endT >= 0) {
    endT += dt;
    const showAt = st === 'WIPE' ? 1.4 : 0.2;
    if (endT >= showAt && ui.msg.style.display !== 'flex') { ui.msg.style.opacity = 0; ui.msg.style.display = 'flex'; requestAnimationFrame(() => (ui.msg.style.opacity = 1)); }
    if (endT > showAt + (st === 'WIPE' ? 4.6 : 4.0)) spawnRider();   // (long enough to read the judges' sheet)
  }
}

// ---------- automatic quality
let fpsAcc = 0, fpsN = 0, lowT = 0, highT = 0, refFps = 60, prCap = MAX_PR, capT = 0, probe = null;
function autoQuality(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc < 1) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  fit();
  // compare against what this screen can actually do (60, 120, or 30 in iPhone Low Power Mode), not a fixed number
  refFps = Math.max(Math.min(fps, 125), refFps - 2);
  // every change of sharpness rebuilds the screen's buffers: a visible stall (~70 ms on a laptop chip), so it isn't done
  // lightly: a level that proved too slow isn't retried for a minute (no drop, climb, drop, climb every few seconds), and
  // climbing back up waits until you're not mid-ride (dropping still happens at once: a slow ride is worse than one stall)
  if (capT > 0 && --capT === 0) prCap = MAX_PR;
  // a drop is a test: two seconds on, did it get faster? if not, the screen itself is the limit (30 Hz Low Power Mode),
  // not the drawing: put the sharpness back and take this pace as the screen's
  if (probe) { if (++probe.t < 2) return; if (fps < probe.fps * 1.12) { pr = probe.pr; renderer.setPixelRatio(pr); prCap = pr; capT = 60; refFps = Math.min(refFps, fps + 2); } probe = null; lowT = highT = 0; return; }
  if (fps < refFps * 0.82) { lowT++; highT = 0; } else if (fps > refFps * 0.95) { highT++; lowT = 0; }
  const riding = rider && (rider.state === 'RIDE' || rider.state === 'POP');
  if (lowT >= 2 && pr > 0.75) { probe = { pr, fps, t: 0 }; prCap = pr - 0.05; capT = 60; pr = Math.max(0.75, pr - 0.15); renderer.setPixelRatio(pr); lowT = 0; }
  if (highT >= 6 && pr + 0.1 <= prCap && !riding) { pr = Math.min(MAX_PR, pr + 0.1); renderer.setPixelRatio(pr); highT = 0; }
  if (Q.has('debug')) document.getElementById('fps').textContent = `${Math.round(fps)} fps · pr ${pr.toFixed(2)}`;
}

// ---------- loop
const portrait = matchMedia('(orientation: portrait) and (max-width: 900px)'); let lastPortrait = false;
// the turn-your-phone screen: Android can be turned for you (full screen, locked sideways); its rotation lock has another name
{ const rtT = document.getElementById('rtTurn'), android = /Android/i.test(navigator.userAgent);
  if (android) document.querySelector('#rotate .rtLock span').innerHTML = '<b>Screen will not turn?</b> Auto rotate is off. Swipe down from the top of your screen and tap Auto rotate to switch it on.';
  if (android && screen.orientation && screen.orientation.lock && document.documentElement.requestFullscreen) {
    rtT.hidden = false;
    rtT.addEventListener('click', () => { try { document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation.lock('landscape')).catch(() => { rtT.hidden = true; }); } catch (e) { rtT.hidden = true; } });
  } }
// opened from a link inside Instagram, TikTok, Facebook and the like: their built-in browser stays upright whatever you
// do, so the screen says so and helps you out to the phone's own browser (Android: straight into Chrome; iPhone: copy the link)
{ const ua = navigator.userAgent, q = new URLSearchParams(location.search).get('inapp');
  const apps = [['Instagram', /Instagram/], ['TikTok', /musical_ly|BytedanceWebview|TikTok/i], ['Threads', /Barcelona/], ['Facebook', /FBAN|FBAV|FB_IAB/], ['Messenger', /Messenger/],
    ['Snapchat', /Snapchat/], ['LinkedIn', /LinkedInApp/], ['LINE', /\bLine\//]];
  const hit = q ? [q.charAt(0).toUpperCase() + q.slice(1)] : apps.find(([, re]) => re.test(ua));
  if (hit) {
    document.body.classList.add('inapp'); document.getElementById('rtAppName').textContent = hit[0];
    const btn = document.getElementById('rtOpen'), url = 'https://sumbasurf.app/';
    if (/Android/i.test(ua)) btn.addEventListener('click', () => { location.href = 'intent://sumbasurf.app/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end'; });
    else { btn.textContent = 'OPEN IN SAFARI';   // (iOS 17 and later hand an x-safari link to Safari; if the app blocks it, the same tap has already copied the link)
      btn.addEventListener('click', () => { let ok = false; try { navigator.clipboard.writeText(url).then(() => { ok = true; }, () => {}); } catch (e) {}
        location.href = 'x-safari-' + url;
        setTimeout(() => { if (document.visibilityState === 'visible') btn.textContent = ok ? 'LINK COPIED. PASTE IT IN SAFARI' : 'SEE THE LINK BELOW'; }, 1500); }); }
  } }
let liveShown = false;
let last = performance.now(), T = 0, strokeT = 0, lastState = '', lastTrick = null, crashT = 1, lastPump = false, speedFlash = 0;
// ---------- your villa: walk around the clifftop villa at Tanjung Uma, pick a board from the rack, watch the waves
const _wl = new THREE.Vector3();
const vSitB = document.getElementById('vSit');
// music: OpenMindAudio (Pixabay): all 14 reggae songs plus three island calypso and two dancehall tracks, shuffled. From the villa radio (quieter and duller the further you are from it), under the
// menu, loud at the Surf Ranch like a pool speaker; never on the reef
const SONGS = {
  'stand-firm-like-a-tree': ['Stand Firm Like a Tree', 'OpenMindAudio'], 'barefoot-in-the-breeze': ['Barefoot in the Breeze', 'OpenMindAudio'], 'streets-still-singing': ['Streets Still Singing', 'OpenMindAudio'],
  'drop-of-peace': ['Drop of Peace', 'OpenMindAudio'], 'generational-stew': ['Generational Stew', 'OpenMindAudio'], 'shelter-in-the-storm': ['Shelter in the Storm', 'OpenMindAudio'],
  'yardman-sing-along': ['Yardman Sing Along', 'OpenMindAudio'], 'rise-again': ['Rise Again', 'OpenMindAudio'], 'moonbeam-rendezvous': ['Moonbeam Rendezvous', 'OpenMindAudio'],
  'dawn-still-knows-your-name': ['Dawn Still Knows Your Name', 'OpenMindAudio'], 'breathe-and-hold-on': ['Breathe and Hold On', 'OpenMindAudio'], 'after-the-rain-we-feast': ['After the Rain We Feast', 'OpenMindAudio'],
  'slow-kisses-warm-nights': ['Slow Kisses, Warm Nights', 'OpenMindAudio'], 'relaxed-summer-groove': ['Relaxed Summer Groove', 'OpenMindAudio'],
  'moonlit-mermaids': ['Moonlit Mermaids', 'OpenMindAudio'], 'sun-kiss-sip': ['Sun Kiss Sip', 'OpenMindAudio'],
  'break-of-day': ['Break of Day', 'OpenMindAudio'], 'old-friends': ['Old Friends', 'OpenMindAudio'], 'sunset-cup': ['Sunset Cup', 'OpenMindAudio'] };
const songOf = (src) => SONGS[(src || '').split('/').pop().replace('.mp3', '')] || ['Island radio', ''];
// the Now playing box: tap it and back / next buttons open under the song (they fold away again after a few seconds)
{ const box = document.getElementById('vSong'); let shut = null; const later = () => { clearTimeout(shut); shut = setTimeout(() => box.classList.remove('open'), 6000); };
  const tap = (e) => { e.preventDefault(); e.stopPropagation(); audio.musicKick(); box.classList.toggle('open'); later(); };
  box.addEventListener('click', tap); box.addEventListener('touchstart', tap, { passive: false });
  for (const [id, f] of [['mPrev', () => audio.musicPrev()], ['mNext', () => audio.musicNext()]]) { const b = document.getElementById(id), go = (e) => { e.preventDefault(); e.stopPropagation(); f(); audio.musicKick(); later(); };
    b.addEventListener('click', go); b.addEventListener('touchstart', go, { passive: false }); } }
audio.onTrack = (src) => { const [t, a] = songOf(src); if (villaW) villaW.setSong(t, a); document.getElementById('vSongT').textContent = t; document.getElementById('vSongA').textContent = a ? 'by ' + a : ''; };
const MUSIC = ['stand-firm-like-a-tree', 'barefoot-in-the-breeze', 'streets-still-singing', 'drop-of-peace', 'generational-stew', 'shelter-in-the-storm', 'yardman-sing-along', 'rise-again', 'moonbeam-rendezvous', 'dawn-still-knows-your-name', 'breathe-and-hold-on', 'after-the-rain-we-feast', 'slow-kisses-warm-nights', 'relaxed-summer-groove', 'moonlit-mermaids', 'sun-kiss-sip', 'break-of-day', 'old-friends', 'sunset-cup'].map((n) => 'music/' + n + '.mp3');
let radioOn = true;   // (the villa's speakers, all together)
let earOn = false; try { earOn = localStorage.getItem('sumbasurf.ear') === '1'; } catch (e) {}   // an earpiece while you surf: your call, remembered
{ const eb = document.getElementById('ear'), show = () => { eb.classList.toggle('on', earOn); eb.querySelector('span').textContent = earOn ? 'EARPIECE ON' : 'EARPIECE'; };
  show(); const t = (e) => { e.preventDefault(); e.stopPropagation(); earOn = !earOn; try { localStorage.setItem('sumbasurf.ear', earOn ? '1' : '0'); } catch (err) {} show(); audio.musicKick(); };
  eb.addEventListener('touchstart', t, { passive: false }); eb.addEventListener('click', t); }
function musicTick() {
  if (!audio.mel) return;
  const playing = document.body.classList.contains('playing');
  if (!playing) return audio.musicLevel(0.45);
  if (mode === 'villa' || isRanch()) audio.gameLevel(1);
  if (mode === 'villa' && walker && villaW) { if (!radioOn) { document.getElementById('vSong').classList.remove('on'); return audio.musicLevel(0); } let d = 1e9; for (const R of villaW.sounds.speakers) d = Math.min(d, Math.hypot(R[0] - walker.x, R[1] - walker.z, R[2] - (walker.y - 1.2)));   // (the nearest speaker)
    document.getElementById('vSong').classList.toggle('on', !drone.on && ((d < 7 && !walker.watch) || document.getElementById('vSong').classList.contains('open')));   // (kept up while you're using its buttons)
    const k = Math.max(0, 1 - d / 24), k15 = Math.pow(k, 1.5);   // (carries through the house: a clear tune by the speakers, still there in the board room)
    return audio.musicLevel(0.09 + 0.75 * k15, 1800 + 12000 * k15); }
  if (isRanch()) return audio.musicLevel(0.38, 14000);
  if (earOn) { audio.musicLevel(0.34, 20000); audio.gameLevel(0.3); }   // earpiece in: the music in your ears, the sea turned down behind it
  else { audio.musicLevel(0); audio.gameLevel(1); }   // (otherwise on the reef, only the sea: the sound of the wave is how you surf)
}
// sound can only start from a tap (a phone plays nothing before one, and an iPhone only counts the END of a tap, not
// the finger going down). Every tap tries until the sound and the music are really running, then it stops listening
{ const tip = document.getElementById('soundTip');
  const unlock = () => { audio.start(); audio.wake(); audio.musicStart(MUSIC); audio.musicKick(); if (!document.body.classList.contains('playing')) audio.quiet(true);
    setTimeout(() => { if (audio.ok && audio.ctx.state === 'running' && audio.mel && !audio.mel.paused) { for (const ev of ['touchend', 'click', 'keydown']) removeEventListener(ev, unlock, true); if (tip) tip.hidden = true; } }, 400); };
  for (const ev of ['touchend', 'click', 'keydown']) addEventListener(ev, unlock, true); }
function vSit() { const W_ = walker; if (!W_ || !W_.near) return;
  if (W_.near.radio) { radioOn = !radioOn; vSitB.textContent = radioOn ? 'MUSIC OFF' : 'MUSIC ON'; return; }   // (the radio: a switch, not a seat)
  W_.sit = W_.near; W_.stand = [W_.x, W_.z, W_.y]; W_.sitT = 1.2; W_.mx = W_.mz = 0; vSitB.textContent = 'STAND UP'; }
function vStand() { const W_ = walker; if (!W_ || !W_.sit) return; [W_.x, W_.z, W_.y] = W_.stand;   // (feet back where they were: standing up on the tree deck, you're still on the deck)
  W_.sit = null; W_.near = null; W_.seatT = 0.5; vSitB.classList.remove('on'); }
{ const t = (e) => { e.preventDefault(); e.stopPropagation(); if (walker && walker.sit) vStand(); else vSit(); }; vSitB.addEventListener('click', t); vSitB.addEventListener('touchstart', t, { passive: false }); }
let villaW = null, crewW = null, wildW = null, birdsW = null, friendsW = null, walker = null, vMoveT = null, vLookT = null, vPickType = null;
const vStick = document.getElementById('vStick'), vPanel = document.getElementById('vPanel');
// the villa, its surfers, the wildlife and the birds: built once. Normally done quietly while you're on the menu (so
// tapping Your villa opens at once); if you get there first, right then
function prepVilla() {
  if (villaW) return;
  villaW = villa(scene); villaW.group.position.z = SPOTS.medium.dz; crewW = crew(scene); if (audio.now) villaW.setSong(...songOf(audio.now));
    wildW = wildlife(scene, { point: { x: 172, z: 125 } });   // (the balcony, in the waves' frame)
    birdsW = makeBirds(wildW.group, { center: [60, 5], span: [140, 40], splash: (x, z) => wildW.splash(x, z) });   // (seabirds over the break: frigatebirds high, terns diving for fish)
    wildW.notify = (msg) => { const n = document.getElementById('vNote'); n.textContent = msg; n.classList.add('on'); clearTimeout(n.t); n.t = setTimeout(() => n.classList.remove('on'), 9000); };   // (up through the first seconds of the show it announces)
    wildW.sound = (kind, x, z) => { const d = walker ? Math.hypot(x - walker.x, z - (walker.z + SPOTS.medium.dz)) : 250, late = d / 343, k = Math.min(1, 120 / d);   // (sound takes its time over 250 m of water)
      if (kind === 'blow') { audio.burst(0.25 * k, 500, 1.4, 'bandpass', late); audio.burst(0.15 * k, 180, 1.2, 'lowpass', late); }
      else if (kind === 'slap') { audio.burst(0.4 * k, 260, 1.1, 'lowpass', late); audio.burst(0.22 * k, 1100, 0.7, 'bandpass', late + 0.02); }   // (a tail or a manta hitting the water flat)
      else { audio.burst(0.7 * k, 160, 2.6, 'lowpass', late); audio.burst(0.4 * k, 900, 1.8, 'bandpass', late + 0.05); for (const q of crewW.surfers) if (q.st !== 'RIDE') { audio.hoot(0.6 * k); break; } } };
}
// while you look at the menu: build the villa and get every shader in the game ready, in the background, a bit after
// the page has settled (each would otherwise be a stall the first time you tap to surf or to go to the villa)
function warmAll() {
  if (warmAll.done) return; warmAll.done = true; warmShaders.done = true;
  const shown = []; scene.traverse((o) => { if (!o.visible) { o.visible = true; shown.push(o); } });
  try { renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : renderer.compile(scene, camera); } finally { for (const o of shown) o.visible = false; }   // (the driver finishes them off the main thread where it can)
}
// the two locals in the lineup as real people (Rocketbox, in boardshorts: see surfers.js), fetched once the game is up;
// until they're in (or if they can't load) they sit there in the old body
const LOCALS = [['m16', 0x1f3f5f], ['m07', 0xb8452c]];
function loadLocals() {
  const L = new GLTFLoader();
  Promise.all(LOCALS.map(([id]) => new Promise((res, rej) => L.load(`people/water/${WATER_PEOPLE[id].file}.glb?v=1`, (g) => res(g.scene), undefined, rej)))).then((a) => {
    a.forEach((src, i) => { const lc = locals[i]; if (!lc) return; const [id, shorts] = LOCALS[i], P = waterPerson(src, { ...WATER_PEOPLE[id], shorts });
      P.root.position.set(0, 0.12 - P.pelvisY, -0.2); lc.grp.add(P.root); lc.body.visible = false; lc.P = P; });
    const v = locals.map((q) => q.grp.visible); for (const q of locals) q.grp.visible = true; renderer.compile(scene, camera); locals.forEach((q, i) => { q.grp.visible = v[i]; });   // (their shader built now, not in a stall mid-session)
  }).catch(() => {});
}
{ const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 60));
  ready.then(() => setTimeout(() => idle(loadLocals), 900)).catch(() => {});
  ready.then(() => setTimeout(() => idle(() => { if (mode === 'villa' || starting) return; prepVilla(); if (villaW) { villaW.group.visible = false; crewW.group.visible = false; wildW.group.visible = false; } idle(() => { if (!starting) warmAll(); }); }), 1800)).catch(() => {}); }
// your villa friends' own bodies (Rocketbox people, MIT licence: see people/): fetched only when you first go to the
// villa, so a surf session never downloads or carries them. Until they're in, nobody is shown (if they can't load,
// the friends come as before, in your own body)
const PEOPLE = { kai: 'Male_Adult_09', wayan: 'Male_Adult_10', nando: 'Male_Adult_06', rudi: 'Male_Adult_05', putu: 'Male_Adult_01', belle: 'Female_Adult_03' };
let people = null, peopleFailed = false, peopleLoading = false, life = null;
function loadPeople() {
  if (people || peopleLoading) return; peopleLoading = true; const L = new GLTFLoader();
  const lifeP = fetch('people/idle.json?v=1').then((r) => r.json()).then(lifeLib).catch(() => null);   // (their small movements: without it they just hold their poses)
  Promise.all(Object.entries(PEOPLE).map(([id, f]) => new Promise((res, rej) => L.load(`people/${f}.glb?v=1`, (g) => res([id, g.scene]), undefined, rej))))
    .then((a) => {
      // (a little of their own colour as fill light: at dusk, with the low sun behind someone in the garden, a real face
      // otherwise goes to a black silhouette)
      for (const [, sc] of a) sc.traverse((o) => { if (o.isMesh && o.material.map) { o.material.emissiveMap = o.material.map; o.material.emissive.setScalar(0.3); } });
      return lifeP.then((lb) => { life = lb; people = Object.fromEntries(a); }); }).catch(() => { peopleFailed = true; });
}
// the surfers you watch from the villa as real people too (surfers.js): fetched on your first visit, stick figures till then
const CREW = [['m02', 0x16181c], ['m07', 0x2f5f8a], ['m08', 0x9a2a22], ['m16', 0x2e2e30], ['f17', 0x1d6f7a], ['m02', 0xd49a2a], ['m08', 0x284a2c]];
let crewLoading = false;
function loadCrew() {
  if (crewLoading || !crewW) return; crewLoading = true; const L = new GLTFLoader(), ids = [...new Set(CREW.map(([id]) => id))];
  Promise.all(ids.map((id) => new Promise((res, rej) => L.load(`people/water/${WATER_PEOPLE[id].file}.glb?v=1`, (g) => res([id, g.scene]), undefined, rej)))).then((a) => {
    const src = Object.fromEntries(a); crewW.setPeople(CREW.map(([id, shorts]) => [src[id], { ...WATER_PEOPLE[id], shorts }]));
    const v = crewW.group.visible; crewW.group.visible = true; renderer.compile(scene, camera); crewW.group.visible = v;   // (their shader built now, not in a stall when you first look out to sea)
  }).catch(() => {});
}
function startVilla() {
  chalHide(); loadPeople();
  if (starting) return;
  hello('the villa');
  mode = 'villa'; setWeather('villa'); audio.start(); audio.quiet(false); audio.musicStart(MUSIC);
  prepVilla(); loadCrew();
  setSpot('villa');
  if (!warmAll.done) { crewW.group.visible = true; renderer.compile(scene, camera); }   // (build every villa shader now, not in a stall the first time each thing comes into view: normally already done on the menu)
  for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 3; setLeft = 0; setPos = 0;
  if (surfer) endWipe(); rider = null; rig.visible = false;
  document.getElementById('vZoom').classList.remove('on'); document.querySelector('#vZoom span').textContent = 'ZOOM'; document.getElementById('vWatch').classList.remove('on'); document.querySelector('#vWatch span').textContent = 'WATCH A RIDE'; vSitB.classList.remove('on');
  if (drone.on) droneSet(false); showOff(true); glareTick(false); setTimeout(() => { if (!showW && mode === 'villa') showW = droneShow(scene); }, 2500);   // (the show's shapes are worked out while you look around, not the moment you press the button)
  walker = { x: villaW.spawn.x, z: villaW.spawn.z, yaw: villaW.spawn.yaw, pitch: -0.08, y: VILLA.Y + 1.65, mx: 0, mz: 0 };
  ui.start.style.display = 'none'; document.body.classList.add('playing', 'villa'); ui.cond.textContent = 'Your villa';
  document.getElementById('vTip').textContent = DESK ? 'WASD or the arrow keys walk, drag the mouse to look, click to pick. Boards are in the board room.' : 'Left thumb walks, right thumb looks. Boards are in the board room.';
  document.getElementById('vTip').style.opacity = 1; setTimeout(() => { document.getElementById('vTip').style.opacity = 0; }, 7000);
}
document.getElementById('goVilla').addEventListener('click', startVilla);
document.getElementById('goVilla').addEventListener('touchend', (e) => { e.preventDefault(); startVilla(); }, { passive: false });
document.getElementById('vGo').addEventListener('click', (e) => { e.stopPropagation(); toMenu(); });
{ const zb = document.getElementById('vZoom'), zt = (e) => { e.preventDefault(); e.stopPropagation(); if (!walker) return; walker.zoom = !walker.zoom; zb.classList.toggle('on', walker.zoom); zb.querySelector('span').textContent = walker.zoom ? 'ZOOM OUT' : 'ZOOM'; };
  zb.addEventListener('click', zt); zb.addEventListener('touchstart', zt, { passive: false });
  const wb = document.getElementById('vWatch'), wt = (e) => { e.preventDefault(); e.stopPropagation(); if (!walker) return; walker.watch = !walker.watch; walker.watchI = -1; walker.vant = null; wb.classList.toggle('on', walker.watch); wb.querySelector('span').textContent = walker.watch ? 'STOP WATCHING' : 'WATCH A RIDE'; };
  wb.addEventListener('click', wt); wb.addEventListener('touchstart', wt, { passive: false }); }
document.getElementById('vGo').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); toMenu(); }, { passive: false });
// the drone: launch it from anywhere in the villa (indoors, it takes off from the balcony) and fly out over the break. Left thumb flies (the way the camera faces), right
// thumb turns and tilts the camera, hold UP / DOWN to climb and sink (on a keyboard: WASD, E or Space up, Q or Shift
// down). It drifts and banks like a real one, keeps above the water (skims the faces if you let it), stays clear of the
// house and the banyan, and has a range: out past the reef and back. LAND brings the view home to where you're standing
const drone = { on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, up: 0, roll: 0, t: 0, save: null };
const droneB = document.getElementById('vDrone'), droneAlt = document.getElementById('vAlt');
function droneSet(on) {
  if (!walker || on === drone.on) return; const W_ = walker;
  if (on) {
    // (press it anywhere: indoors or up the tree it would lift straight through the roof or the canopy, so from there it
    //  takes off from the east balcony by the radio instead, facing the surf; LAND still brings you back where you stood)
    const lx = 88 - W_.x, lz = W_.z - 31, inside = lx > VILLA.x0 && lx < VILLA.x1 && lz > VILLA.z0 && lz < VILLA.z1, up = W_.y - 1.65 > VILLA.Y + 1.5;
    const pad = inside || up;
    document.getElementById('vSong').classList.remove('open');
    if (W_.sit) vStand(); if (W_.watch) document.getElementById('vWatch').click(); vSitB.classList.remove('on'); W_.near = null;
    Object.assign(drone, pad ? { x: 88 + 84.5, y: VILLA.Y + 1.95, z: 31 + 37 } : { x: W_.x + Math.cos(W_.yaw) * 0.8, y: W_.y + 0.3, z: W_.z + Math.sin(W_.yaw) * 0.8 }, { on: true, vx: 0, vy: 0, vz: 0, up: 0, roll: 0, t: 0, save: [W_.yaw, W_.pitch] });
    if (pad) W_.yaw = Math.PI;   // (looking out to sea from the balcony)
    W_.pitch = -0.15; const tip = document.getElementById('vTip'); tip.textContent = DESK ? 'WASD flies, drag the mouse to turn the camera, Space or E climbs, Q or Shift sinks.' : 'Left thumb flies, right thumb turns the camera. Hold UP or DOWN to climb and sink.'; tip.style.opacity = 1; clearTimeout(tip.t); tip.t = setTimeout(() => { tip.style.opacity = 0; }, 6000);
  } else { drone.on = false; if (drone.save) [W_.yaw, W_.pitch] = drone.save; audio.droneBuzz(0); }
  document.body.classList.toggle('drone', drone.on); droneB.classList.toggle('on', drone.on); droneB.querySelector('span').textContent = drone.on ? 'LAND' : 'FLY DRONE';
}
{ const t = (e) => { e.preventDefault(); e.stopPropagation(); droneSet(!drone.on); }; droneB.addEventListener('click', t); droneB.addEventListener('touchstart', t, { passive: false });
  for (const [id, v] of [['vUp', 1], ['vDn', -1]]) { const b = document.getElementById(id), on = (e) => { e.preventDefault(); e.stopPropagation(); drone.up = v; b.classList.add('down'); }, off = (e) => { e.preventDefault(); if (drone.up === v) drone.up = 0; b.classList.remove('down'); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false }); b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off); } }
// (the point the house stands on, in the drone's frame: the same spine and width villa.js builds it on)
const onPoint = (x, wz) => { const lz = wz - 31 - SPOTS.medium.dz, lx = 88 - x, k = Math.min(1, Math.max(0, (lz - 70) / 150)), cxl = -93 + 4 * Math.sin((lz - 37) * 0.03) - 60 * k * k * (3 - 2 * k), hw = 13.6 + 11 * Math.min(1, Math.max(0, (lz - 60) / 120));
  return lz > 24 && Math.abs(lx - cxl) < hw + 4; };
function droneTick(dt, mx, mz) {
  const D = drone, W_ = walker; D.t += dt;
  const fx = Math.cos(W_.yaw), fz = Math.sin(W_.yaw), lift = D.t < 2.2;   // (first it lifts straight up off the balcony, clear of the roof and the tree)
  const SP = 15, tx = lift ? 0 : (fx * mz - fz * mx) * SP, tz = lift ? 0 : (fz * mz + fx * mx) * SP;
  const kv = (keys.has('Space') || keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0);
  const ty = lift ? 7.5 : Math.max(-1, Math.min(1, D.up + kv)) * 6;
  const a = Math.min(1, dt * 2.2); D.vx += (tx - D.vx) * a; D.vz += (tz - D.vz) * a; D.vy += (ty - D.vy) * Math.min(1, dt * 3);
  D.x += D.vx * dt; D.y += D.vy * dt; D.z += D.vz * dt;
  const dz = SPOTS.medium.dz; D.x = Math.max(-60, Math.min(300, D.x)); D.z = Math.max(-150 - dz, Math.min(235 - dz, D.z));   // (range: the whole reef, not the coast behind)
  const wz = D.z + dz, floor = !lift && onPoint(D.x, wz) ? VILLA.Y + 18 : heightAt(waves, D.x, wz) + 1.1;
  if (D.y < floor) { D.y += (floor - D.y) * Math.min(1, dt * 5); if (D.vy < 0) D.vy *= 0.5; }
  D.y = Math.min(D.y, 140);
  const side = -D.vx * fz + D.vz * fx; D.roll += (-side * 0.014 - D.roll) * Math.min(1, dt * 3);
  audio.droneBuzz(0.6 + 0.4 * Math.min(1, Math.hypot(D.vx, D.vz) / SP), Math.min(1, Math.hypot(D.vx, D.vy, D.vz) / 12));
  const out = Math.hypot(D.x - W_.x, wz - (W_.z + dz)); droneAlt.textContent = `ALT ${Math.max(0, D.y - heightAt(waves, D.x, wz)).toFixed(0)} m    ${out.toFixed(0)} m OUT`;
}

// ---------- the drone light show: press DRONE SHOW anywhere in the villa and you're taken out to the balcony, the sky
// goes to night, and the drones rise off the water and draw over the bay (see show.js); END SHOW (or when it's over)
// brings the evening back
let showW = null, dayEnv = null;
const showB = document.getElementById('vShow');
const NIGHT = { zen: new THREE.Color(0x060b1c), hor: new THREE.Color(0x1b2744), sunCol: new THREE.Color(0x5a6a8a), fog: new THREE.Color(0x141d33), deep: new THREE.Color(0x03121c), turq: new THREE.Color(0x07302f) };
function applyNight(k) {
  if (!dayEnv) return;
  for (const c of ['zen', 'hor', 'sunCol', 'fog', 'deep', 'turq']) ENV['u' + c[0].toUpperCase() + c.slice(1)].value.copy(dayEnv[c]).lerp(NIGHT[c], k);
  ENV.uGold.value = dayEnv.gold * (1 - k); ENV.uSunVis.value = dayEnv.sunVis * (1 - k); ENV.uCloud.value = dayEnv.cloud * (1 - 0.8 * k); ENV.uNight.value = k;   // (a clear night: bright clouds glowing in the dark looked wrong)
  if (villaW && villaW.setLights) villaW.setLights(1 - 0.85 * k);   // (the house lights go down for the show)
  hemi.intensity = dayEnv.hemi * (1 - 0.8 * k); sunLight.intensity = dayEnv.sun * (1 - 0.85 * k); renderer.toneMappingExposure = dayEnv.exp * (1 - 0.1 * k);
}
function showOff(now = false) {
  if (!showW || !dayEnv) return;
  showW.stop(); showB.classList.remove('on'); showB.querySelector('span').textContent = 'DRONE SHOW'; document.body.classList.remove('show');
  if (now) { applyNight(0); dayEnv = null; }
}
function showStart() {
  const W_ = walker; if (!W_ || !villaW) return;
  if (!showW) showW = droneShow(scene);
  if (drone.on) droneSet(false); if (W_.sit) vStand(); if (W_.watch) document.getElementById('vWatch').click(); if (W_.zoom) document.getElementById('vZoom').click();
  if (!dayEnv) dayEnv = { gold: ENV.uGold.value, sunVis: ENV.uSunVis.value, cloud: ENV.uCloud.value, hemi: hemi.intensity, sun: sunLight.intensity, exp: renderer.toneMappingExposure,
    ...Object.fromEntries(['zen', 'hor', 'sunCol', 'fog', 'deep', 'turq'].map((c) => [c, ENV['u' + c[0].toUpperCase() + c.slice(1)].value.clone()])) };
  // out at the corner of the balcony, where it wraps round the two sea sides, looking out to the open sea (not along the
  // bay parallel to the house): the show is 130 m out
  // (standing just off the corner and looking a little more out to sea than the diagonal: dead on the diagonal the
  //  roof's corner post stood right in the middle of the show)
  const lx = VILLA.x1 + 1.7, lz = VILLA.z0 - 1.8, ya = -115 * Math.PI / 180, dx = Math.cos(ya), dzz = Math.sin(ya);   // (villa east = world -x, south = world -z)
  W_.x = 88 - lx; W_.z = 31 + lz; W_.y = VILLA.Y + 1.65; W_.yaw = Math.atan2(dzz, dx); W_.pitch = 0.1; W_.near = null;
  const dz = SPOTS.medium.dz, C = new THREE.Vector3(W_.x + dx * 130, 0, W_.z + dz + dzz * 130); C.y = heightAt(waves, C.x, C.z);
  showW.start(C, new THREE.Vector3(-dzz, 0, dx));   // (left to right as you look at it)
  showB.classList.add('on'); showB.querySelector('span').textContent = 'END SHOW'; document.body.classList.add('show');
  const tip = document.getElementById('vTip'); tip.textContent = 'Drone show over the bay. Look around as you like.'; tip.style.opacity = 1; clearTimeout(tip.t); tip.t = setTimeout(() => { tip.style.opacity = 0; }, 4000);
}
{ const t = (e) => { e.preventDefault(); e.stopPropagation(); if (showW && showW.on) showOff(); else showStart(); }; showB.addEventListener('click', t); showB.addEventListener('touchstart', t, { passive: false }); }

// the board panel: what it is and how it feels, and a button to take it
function vPick(type) {
  vPickType = type; vPanel.classList.toggle('on', !!type); if (!type) return;
  const I = BOARD_INFO[type]; document.getElementById('vName').textContent = I[0]; document.getElementById('vDesc').textContent = I[1];
  document.getElementById('vStats').innerHTML = ['Paddling', 'Speed', 'Turning', 'Stability', 'Airs'].map((l, k) => `<div><span>${l}</span><i>${'<b></b>'.repeat(I[3][k])}${'<b class="o"></b>'.repeat(5 - I[3][k])}</i></div>`).join('') + `<div class="best">Best at: ${I[2]}</div>`;
  const tk = document.getElementById('vTake'), mine = type === boardType; tk.textContent = mine ? 'YOUR BOARD' : 'TAKE THIS BOARD'; tk.classList.toggle('mine', mine);
}
{ const tk = document.getElementById('vTake'), take = (e) => { e.preventDefault(); e.stopPropagation(); if (vPickType) { useBoard(vPickType); vPick(vPickType); } };
  tk.addEventListener('click', take); tk.addEventListener('touchstart', take, { passive: false }); }
// tap on the screen: is it a board in the rack (close enough to reach)?
const _vr = new THREE.Raycaster(), _vp = new THREE.Vector2();
function vTap(cx, cy) {
  if (!villaW) return; _vp.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); _vr.setFromCamera(_vp, camera); _vr.far = 7;
  const hit = _vr.intersectObjects(villaW.rack, true)[0]; vPick(hit ? hit.object.userData.type : null);
}
// left thumb: a stick where you put it down; right thumb: drag to look, a quick tap picks
const vm = document.getElementById('vMove'), vl = document.getElementById('vLook');
vm.addEventListener('touchstart', (e) => { e.preventDefault(); audio.wake(); const t = e.changedTouches[0]; vMoveT = { id: t.identifier, x0: t.clientX, y0: t.clientY, t0: performance.now() }; vStick.style.left = t.clientX + 'px'; vStick.style.top = t.clientY + 'px'; vStick.classList.add('live'); }, { passive: false });
vm.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (vMoveT && t.identifier === vMoveT.id && walker) {
  const dx = (t.clientX - vMoveT.x0) / 55, dy = (t.clientY - vMoveT.y0) / 55, l = Math.hypot(dx, dy), k = l > 1 ? 1 / l : 1; walker.mx = dx * k; walker.mz = -dy * k;
  vStick.querySelector('b').style.transform = `translate(${dx * k * 30}px, ${dy * k * 30}px)`; } }, { passive: false });
const vmEnd = (e) => { e.preventDefault(); for (const t of e.changedTouches) if (vMoveT && t.identifier === vMoveT.id) { if (Math.hypot(t.clientX - vMoveT.x0, t.clientY - vMoveT.y0) < 10 && performance.now() - vMoveT.t0 < 350) vTap(t.clientX, t.clientY);   // (a quick tap on the walk side picks too)
  vMoveT = null; if (walker) walker.mx = walker.mz = 0; vStick.classList.remove('live'); vStick.querySelector('b').style.transform = ''; } };
vm.addEventListener('touchend', vmEnd, { passive: false }); vm.addEventListener('touchcancel', vmEnd, { passive: false });
const lookStart = (id, x, y) => { vLookT = { id, x, y, x0: x, y0: y, t0: performance.now() }; };
const lookMove = (id, x, y) => { if (!vLookT || vLookT.id !== id || !walker) return; if (walker.watch && Math.hypot(x - vLookT.x0, y - vLookT.y0) > 25) document.getElementById('vWatch').click();   // (look away yourself and it lets go)
  const zs = hfovHalf / 50; walker.yaw += (x - vLookT.x) * 0.0055 * zs; walker.pitch = Math.max(-1.1, Math.min(0.9, walker.pitch - (y - vLookT.y) * 0.0045 * zs)); vLookT.x = x; vLookT.y = y; };   // (zoomed in, the look slows to match)
const lookEnd = (id, x, y) => { if (!vLookT || vLookT.id !== id) return; if (Math.hypot(x - vLookT.x0, y - vLookT.y0) < 10 && performance.now() - vLookT.t0 < 350) vTap(x, y); vLookT = null; };
vl.addEventListener('touchstart', (e) => { e.preventDefault(); audio.wake(); const t = e.changedTouches[0]; lookStart(t.identifier, t.clientX, t.clientY); }, { passive: false });
vl.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) lookMove(t.identifier, t.clientX, t.clientY); }, { passive: false });
vl.addEventListener('touchend', (e) => { e.preventDefault(); for (const t of e.changedTouches) lookEnd(t.identifier, t.clientX, t.clientY); }, { passive: false });
vl.addEventListener('mousedown', (e) => lookStart('m', e.clientX, e.clientY));
vm.addEventListener('mousedown', (e) => lookStart('m', e.clientX, e.clientY));   // (with a mouse, either side drags to look and clicks to pick)
addEventListener('mousemove', (e) => lookMove('m', e.clientX, e.clientY));
addEventListener('mouseup', (e) => lookEnd('m', e.clientX, e.clientY));
function villaTick(dt) {
  const beat = radioOn ? audio.musicBeat() : 0;   // (once a frame: it keeps a running peak)
  updateWaves(dt); crewW.detail = !!(walker && (walker.watch || walker.zoom || drone.on)); crewW.update(dt, waves, T); if (!(showW && showW.on)) wildW.update(dt, waves); birdsW.update(dt);   /* (the whales and eagles wait while the drone show is on: their 'tap ZOOM' notes would pop up with ZOOM hidden) */   // (zoomed in on them: every surfer posed every frame)
  if (!friendsW && surfer && (people || peopleFailed)) friendsW = friends(scene, surfer, villaW.friendSpots.map((f) => ({ ...f, z: f.z + SPOTS.medium.dz, board: f.board && [f.board[0], f.board[1], f.board[2] + SPOTS.medium.dz] })), people, life);   // (your friends: as soon as the body model is in)
  if (friendsW) friendsW.update(dt, T, beat, { x: walker.x, y: walker.y, z: walker.z + SPOTS.medium.dz }, camera); if (villaW.tick) villaW.tick(dt, beat, walker.x, walker.z, walker.y - 1.65);
  if (showW && dayEnv) { showW.update(dt, renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)), beat); applyNight(showW.night);
    if (showW.done && showB.classList.contains('on')) showOff();   // (over: the button goes back, the evening comes back)
    if (showW.done && showW.night < 0.005) { applyNight(0); dayEnv = null; } }
  const W_ = walker, V = villaW;
  // walk: the stick (or WASD / arrows) in the direction you're facing, sliding along anything solid
  const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), kz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  // swimming in the pool: slower, head bobbing just above the water; a splash as you slide in, strokes as you swim
  const swim = !!(V.inPool && V.inPool(W_.x, W_.z, W_.y - 1.65));
  if (swim !== !!W_.swim) { W_.swim = swim; audio.splash(swim ? 0.35 : 0.12); }
  let mx = W_.mx || kx, mz = W_.mz || kz; const fx = Math.cos(W_.yaw), fz = Math.sin(W_.yaw), sp = (swim ? 1.25 : 2.7) * dt;
  if (drone.on) { droneTick(dt, mx, mz); mx = mz = 0; }   // (flying: the thumbs fly the drone; you stay standing where you launched it)
  // sitting: ease into the seat and its view; push the stick (or a key) and you stand back up where you were
  if (W_.sit && Math.hypot(mx, mz) > 0.3) vStand();
  if (W_.sit) { const S = W_.sit, k = Math.min(1, dt * 3); W_.x += (S.x - W_.x) * k; W_.z += (S.z - W_.z) * k;
    if (W_.sitT > 0) { W_.sitT -= dt; W_.yaw += Math.atan2(Math.sin(S.yaw - W_.yaw), Math.cos(S.yaw - W_.yaw)) * k; W_.pitch += (S.pitch - W_.pitch) * k; } }
  let nx = W_.sit ? W_.x : W_.x + (fx * mz - fz * mx) * sp, nz = W_.sit ? W_.z : W_.z + (fz * mz + fx * mx) * sp;
  const r = 0.3, A = V.walk, foot = W_.y - 1.65;
  if (!W_.sit) {
  nx = Math.min(A.x1, Math.max(A.x0, nx)); nz = Math.min(A.z1, Math.max(A.z0, nz));
  for (const c of V.colliders) {
    if (nx > c[0] - r && nx < c[1] + r && nz > c[2] - r && nz < c[3] + r) {
      const px = Math.min(nx - (c[0] - r), c[1] + r - nx), pz = Math.min(nz - (c[2] - r), c[3] + r - nz);
      if (px < pz) nx = nx - (c[0] - r) < c[1] + r - nx ? c[0] - r : c[1] + r; else nz = nz - (c[2] - r) < c[3] + r - nz ? c[2] - r : c[3] + r;
    }
  }
  if (V.fix) { const f = V.fix(nx, nz, foot); if (f) [nx, nz] = f; }
  if (V.solid && V.solid(nx, nz, foot) && !V.solid(W_.x, W_.z, foot)) { if (!V.solid(nx, W_.z, foot)) nz = W_.z; else if (!V.solid(W_.x, nz, foot)) nx = W_.x; else { nx = W_.x; nz = W_.z; } }   // (the stair, the deck, the tree)   // (and if you're ever somewhere you shouldn't be, you can always walk out: never trapped)
  }
  W_.x = nx; W_.z = nz;
  // look at a board in the rack and its card comes up by itself (no need to tap); look away and it goes
  // a seat within reach (at your level): offer it
  W_.seatT = (W_.seatT || 0) - dt;
  if (W_.seatT <= 0 && !W_.sit && !drone.on) { W_.seatT = 0.2; let best = null, bd = 2.1; for (const S of V.seats) { const d = Math.hypot(S.x - W_.x, S.z - W_.z); if (d < bd && Math.abs(S.eye - 1.1 - foot) < 1.3) { bd = d; best = S; } }
    if (best !== W_.near) { W_.near = best; vSitB.classList.toggle('on', !!best); if (best) vSitB.textContent = best.radio ? (radioOn ? 'MUSIC OFF' : 'MUSIC ON') : best.name; } }
  // the sounds of the place: the fire, the wind chimes, birds, and the lineup hooting a good barrel
  { const d3 = (p) => Math.hypot(p[0] - W_.x, p[1] - W_.z, p[2] - (W_.y - 1.2));
    const df = d3(V.sounds.fire); if (df < 14 && (W_.fireT = (W_.fireT || 0) - dt) <= 0) { W_.fireT = 0.06 + Math.random() * 0.22; audio.crackle(Math.pow(1 - df / 14, 2)); }
    const dc = d3(V.sounds.chime); if (dc < 20 && (W_.chimeT = (W_.chimeT || 0) - dt) <= 0) { W_.chimeT = Math.random() < 0.6 ? 0.25 + Math.random() * 0.5 : 2 + Math.random() * 4; audio.chime(Math.pow(1 - dc / 20, 1.5)); }
    if ((W_.birdT = (W_.birdT === undefined ? 3 : W_.birdT) - dt) <= 0) { W_.birdT = 5 + Math.random() * 9; audio.bird(0.5 + Math.random() * 0.5); }
    for (const q of crewW.surfers) { if (q.st === 'RIDE' && q.tubeT > 2.4 && !q.hooted) { q.hooted = true; const d = Math.hypot(q.p.x - W_.x, q.p.z - (W_.z + SPOTS.medium.dz)); audio.hoot(Math.max(0.2, Math.min(1, 70 / d))); if (friendsW && Math.random() < 0.6) friendsW.say('nando', ['Did you see that? Spat right out of it!', 'Barrel! What a ride!', 'Deep in there, whoa!', 'That one was all time, brother.'][Math.random() * 4 | 0]); } if (!(q.tubeT > 0.1)) q.hooted = false; } }
  W_.gazeT = (W_.gazeT || 0) - dt;
  if (W_.gazeT <= 0) { W_.gazeT = 0.2; _vp.set(0, -0.1); _vr.setFromCamera(_vp, camera); _vr.far = 4.5;
    const hit = _vr.intersectObjects(V.rack, true)[0], t = hit ? hit.object.userData.type : null;
    if (t) { W_.gazeOff = 0; if (t !== vPickType) vPick(t); } else if (vPickType && (W_.gazeOff = (W_.gazeOff || 0) + 0.2) > 1.2 && Math.hypot(W_.x - V.rackAt.x, W_.z - V.rackAt.z) > 5) vPick(null); }
  const moving = Math.hypot(mx, mz) > 0.1; W_.bob = (W_.bob || 0) + (moving ? dt * 8 : 0);
  if (swim && moving && (W_.strokeT = (W_.strokeT || 0) - dt) <= 0) { W_.strokeT = 1.1; audio.paddle(); }
  W_.y += ((W_.sit ? W_.sit.eye - 1.65 : V.floorAt(W_.x, W_.z, foot)) + 1.65 + (swim ? Math.sin(T * 1.8) * 0.03 + (moving ? Math.sin(W_.bob * 0.55) * 0.02 : 0) : moving ? Math.sin(W_.bob) * 0.025 : 0) - W_.y) * Math.min(1, dt * (swim ? 5 : 10));
  camera.position.set(W_.x, W_.y, W_.z + SPOTS.medium.dz);
  _pe.set(W_.pitch, -W_.yaw - Math.PI / 2, 0); camera.quaternion.setFromEuler(_pe);
  if (drone.on) { camera.position.set(drone.x, drone.y + Math.sin(drone.t * 2.1) * 0.04, drone.z + SPOTS.medium.dz); _pe.set(W_.pitch, -W_.yaw - Math.PI / 2, drone.roll); camera.quaternion.setFromEuler(_pe); }   // (the drone's camera: your look, its position, a little bank into turns and the hover's bob)
  // watching: the camera follows one surfer's ride (the one deepest in the barrel, else the longest ride going), zoomed
  // so they fill a good part of the view; between rides it rests on the lineup
  if (W_.watch) {
    const S = crewW.surfers; let s = S[W_.watchI];
    if (!s || s.st !== 'RIDE') { W_.watchI = -1; let best = -1, bs = -1; S.forEach((q, i) => { if (q.st === 'RIDE') { const sc = q.tau + (q.tubeT > 0 ? 50 : 0); if (sc > bs) { bs = sc; best = i; } } }); W_.watchI = best; s = S[best]; }
    const c = camera.position, P = s ? s.p : _wl.set(5, 0, -18);
    // from where you stand, is the break in sight? (indoors, a friend or the furniture filled the zoomed view) If not, the
    // camera goes up to the tree deck for the ride, and you're back where you were when you stop watching
    if (W_.vant == null) { _wr.set(P.x - c.x, P.y + 1 - c.y, P.z - c.z); const L = _wr.length(); _ray.set(c, _wr.normalize()); _ray.far = Math.min(L, 60);
      W_.vant = _ray.intersectObjects([villaW.group, friendsW && friendsW.group].filter(Boolean), true).some((h) => h.object.visible && h.distance > 0.3); }
    if (W_.vant) c.set(169.4, 35.6, 139.0);
    const dx = P.x - c.x, dz = P.z - c.z, dy = P.y + (s ? 0.9 : 0) - c.y, d = Math.hypot(dx, dz);
    const yaw = Math.atan2(dz, dx), pitch = Math.atan2(dy, d), k = Math.min(1, dt * (s ? 4 : 1.5));
    W_.yaw += Math.atan2(Math.sin(yaw - W_.yaw), Math.cos(yaw - W_.yaw)) * k; W_.pitch += (pitch - W_.pitch) * k;
    W_.watchH = Math.max(3, Math.min(30, THREE.MathUtils.radToDeg(Math.atan((s ? 14 : 40) / d))));
  }
  { const tgt = W_.watch ? W_.watchH : W_.zoom ? 8 : 50; if (Math.abs(hfovHalf - tgt) > 0.05) setHfov(hfovHalf + (tgt - hfovHalf) * Math.min(1, dt * 6)); else if (hfovHalf !== tgt) setHfov(tgt); }   // binoculars: about 5x
  sunLight.position.copy(camera.position).addScaledVector(ENV.uSun.value, 30); sunLight.target.position.copy(camera.position);
  // the sea from up here: a steady wash below the cliff, softer indoors (the walls between you and it)
  { const lx = 88 - W_.x, lz = W_.z - 31, inside = lx > VILLA.x0 && lx < VILLA.x1 && lz > VILLA.z0 && lz < VILLA.z1 && W_.y < VILLA.Y + 3;
    W_.seaK = (W_.seaK ?? 0.62) + ((inside ? 0.34 : 0.62) - (W_.seaK ?? 0.62)) * Math.min(1, dt * 2);
    audio.update({ H: 3, near: 0.1, seaMul: W_.seaK, barrel: false, riding: false, v: 0, turn: 0, lean: 0, slide: 0, stall: false, storm: 0, rain: 0, underwater: false, dt, chop: 1 }); }
  villaBody(dt, moving);
}
// your own body in the villa, as a head-mounted camera sees it: standing tall, legs stepping and arms swinging opposite
// as you walk (look down and there they are), and a hand going out toward whatever you walk up to: a board in the rack,
// a speaker, a seat. Hidden while you sit, zoom or watch a ride.
const _vb = { fw: new THREE.Vector3(), rt: new THREE.Vector3(), sh: new THREE.Vector3(), T: new THREE.Vector3(), P: new THREE.Vector3(), h: new THREE.Vector3(), reach: 0, rT: new THREE.Vector3() };
function villaBody(dt, moving) {
  const W_ = walker; if (!surfer || !W_) return;
  const show = !W_.sit && !W_.zoom && !W_.watch && !drone.on && !W_.swim && hfovHalf > 40; rig.visible = show; board.visible = false; if (!show) return;   // (swimming, your body is under the water)
  if (!bones.upperarm_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  if (mixer) mixer.stopAllAction(); curClip = null;
  surfer.traverse((o) => { if (o.isSkinnedMesh && !o.userData.posed) { o.skeleton.pose(); } });
  const B = _vb, fw = B.fw.set(Math.cos(W_.yaw), 0, Math.sin(W_.yaw)), rt = B.rt.set(-fw.z, 0, fw.x);
  rig.quaternion.setFromAxisAngle(WORLD_UP, Math.atan2(fw.x, fw.z)); rig.position.set(W_.x, W_.y - 1.62, W_.z + SPOTS.medium.dz); rig.updateMatrixWorld(true);
  const ph = (W_.bob || 0) / 2, mv = moving ? 1 : 0; B.mv = (B.mv || 0) + (mv - (B.mv || 0)) * Math.min(1, dt * 6); const k = B.mv;
  // legs: a relaxed stride, the back leg's knee bending as it lifts
  for (const [sd, sg] of [['l', 1], ['r', -1]]) { const th = bones['thigh_' + sd], ca = bones['calf_' + sd]; if (!th || !ca) continue;
    const sw = Math.sin(ph) * sg * k;
    aimBone(th, ca, B.T.set(0, -1, 0).addScaledVector(fw, 0.38 * sw).normalize(), 1);
    aimBone(ca, bones['foot_' + sd], B.T.set(0, -1, 0).addScaledVector(fw, 0.38 * sw - 0.45 * Math.max(0, -sw)).normalize(), 1); }
  // arms: hanging relaxed, elbows soft, swinging opposite to the legs; the right hand reaches out to what you're next to
  let tgt = null;
  if (W_.near) tgt = B.rT.set(W_.near.x, W_.near.eye - 0.55, W_.near.z + SPOTS.medium.dz);
  else if (vPickType && villaW) { const b = villaW.rack.find((r) => r.userData.type === vPickType); if (b) { b.getWorldPosition(B.rT); B.rT.y = W_.y - 0.35; tgt = B.rT; } }
  B.reach += ((tgt ? 1 : 0) - B.reach) * Math.min(1, dt * 3);
  for (const [sd, sg] of [['l', -1], ['r', 1]]) { const ua = bones['upperarm_' + sd], la = bones['lowerarm_' + sd], hd = bones['hand_' + sd]; if (!ua || !la || !hd) continue;
    ua.getWorldPosition(B.sh); const out = Math.sign(B.h.subVectors(B.sh, rig.position).dot(rt)) || 1;
    B.T.copy(B.sh).addScaledVector(WORLD_UP, -0.56).addScaledVector(fw, 0.08 + 0.2 * Math.sin(ph) * sg * k).addScaledVector(rt, out * 0.07);
    if (tgt && out === 1 || tgt && sd === 'r') { const d = B.h.subVectors(tgt, B.sh), L = Math.min(0.58, d.length()); B.P.copy(B.sh).addScaledVector(d.normalize(), L); B.T.lerp(B.P, B.reach * (sd === 'r' ? 1 : 0)); }
    reachArm(ua, la, hd, B.T, B.P.copy(fw).negate().addScaledVector(rt, out * 0.4), 1); }
  if (bones.head) bones.head.scale.setScalar(0.001);   // (your own head: not in your own eyes)
  // line the body up under the camera: the eyes a little in front of the head's centre
  if (bones.head) { bones.head.getWorldPosition(B.h); B.T.copy(camera.position).addScaledVector(fw, -0.1).addScaledVector(WORLD_UP, -0.06).sub(B.h); rig.position.add(B.T); rig.updateMatrixWorld(true); }
}

function tick(dt) {
  T += dt;
  ENV.uTime.value += dt;
  const inp = readInput(dt);
  // (in the barrel view the camera looks back at you, so left/right are flipped to match the screen)
  if (rider && rider.standing && input.test == null) {
    // (scripted checks drive a virtual stick: y down = STALL held, y up = PUMP held)
    const stallOn = !!input.stallBtn || keys.has('ArrowDown') || !!(input.stick && input.stick.y > 0.5);
    const pumpOn = inp.pump || !!(input.stick && input.stick.y < -0.3);
    const o = surfSteer(tubeK > 0.5 ? -inp.steer : inp.steer, stallOn);
    inp.steer = o.steer; inp.pump = pumpOn; inp.stall = o.stall;
  }
  if (rider) {
    updateWaves(dt);
    rider.update(dt, inp, waves); updateRanch(dt);
    rider.caughtT = rider.washed ? 6 : Math.max(0, (rider.caughtT || 0) - dt);   // (remember being washed in for a few seconds: that's why you ended up inside)
    // drifting too far inside or out wide on a lie: bring the surfer back to the lineup (the pool's walls hold you in)
    if (!isRanch() && rider.state === 'LIE' && (rider.z > 40 || Math.abs(rider.x - 5) > 70 || rider.z < -60)) { rider.out(rider.z > 40 && rider.caughtT > 0 ? 'Caught inside: the whitewater washed you in' : 'Drifted out of the lineup'); }
    updateRig(dt, T);
    if (mixer) { mixer.update(dt); paddleArms(dt); dtArm = dt; surfStance(); }
    updateLeash(); updateScenery(dt); updateLocals(dt);
    railSpray.update(dt);
    wake.update(dt); track.update(dt); surfFx.attach(); surfFx.update(dt);
    updateCamera(dt);
    updateHUD(dt); lensTick(dt);
    // sound follows what's happening: the breaking wave is loud near the curl
    const st = rider.state, w = rider.wave;
    let near = 0;
    for (const v of waves) { const s = rider.x - v.peelX, zl = rider.z - v.zW; if (zl > -20 && zl < 25) near = Math.max(near, Math.max(0, 1 - Math.hypot(s < 0 ? s * 0.4 : s, zl) / (7 * v.cond.H))); }
    let underwater = false;
    if (st === 'WIPE' && W.on && surfer) { const b = surfer.position; underwater = W.t < 1.4 && b.y < heightAt(waves, b.x, b.z) - 0.2; }
    audio.update({ H: w ? w.cond.H : 1.5, near, barrel: rider.inBarrel && st === 'RIDE', riding: rider.standing, v: rider.v, turn: rider.turn, lean: rider.lean, slide: Math.max(rider.skid, (rider.slide || 0) * 2.5), stall: !!(inp.stall), dt, chop: ENV.weather ? ENV.weather.chop : 1, storm: ENV.weather ? ENV.weather.chop / 2.4 : 0, rain: ENV.weather ? ENV.weather.rain : 0, underwater });
    // the nearest breaking wave thumps each time a new stretch of lip lands (every second or two, faster in big surf)
    crashT -= dt;
    if (crashT <= 0) {
      let best = null, bd = 1e9;
      for (const v of waves) { if (v.peelX < -5) continue; const lx = v.peelX - 1.5 * v.cond.H, lz = v.zW + 1.5 * v.cond.H; const d = Math.hypot(rider.x - lx, rider.z - lz); if (d < bd) { bd = d; best = v; } }
      if (best) audio.crash(best.cond.H * (best.size || 1), bd);
      crashT = 1.1 + Math.random() * 0.9 - (best ? best.cond.H * 0.1 : 0);
    }
    if (st === 'LIE' && rider.paddling) { strokeT -= dt * 1.6; if (strokeT <= 0) { strokeT = 0.55; audio.paddle(); } }
    if (st !== lastState) {
      if (st === 'POP') audio.splash(0.35);
      lastState = st;
    }
    if (!!rider.air !== lastAir) { if (rider.air) audio.air(); else if (rider.state === 'RIDE') audio.land(); lastAir = !!rider.air; }
    // a snap or cutback rips spray off the rail: a sharp tearing hiss
    if (rider.trick && rider.trick !== lastTrick) { audio.burst(0.3, 3200, 0.45, 'highpass'); audio.burst(0.2, 1300, 0.35); }
    lastTrick = rider.trick;
    if (rider.pumpN !== lastPump) { if (rider.standing && st === 'RIDE' && rider.pumpN > 0) { audio.pump(); railSpray.burst(rig.position, 22, 1.1); speedFlash = 0.3; } lastPump = rider.pumpN; }   // every stroke: a push of water off the rails, a little spray and the speed lights up
    if (speedFlash > 0) { speedFlash -= dt; if (speedFlash <= 0) ui.speed.classList.remove('up'); else if (!ui.speed.classList.contains('up')) ui.speed.classList.add('up'); }

    sunLight.position.copy(camera.position).addScaledVector(ENV.uSun.value, 30); sunLight.target.position.copy(camera.position);
  } else if (mode === 'villa' && walker) {
    villaTick(dt);
  } else {
    // behind the start screen: a slow drift along a peeling wave
    if (!tick.demo) { tick.demo = new Wave(scene, CONDITIONS.medium); tick.demo.peelX = -30; }
    tick.demo.update(dt);
    railSpray.update(dt); wake.update(dt); track.update(dt);   // (let any spray left from the last ride fall and fade)
    rig.visible = false; leash.visible = false; jukung.visible = false; for (const L of locals) L.grp.visible = false; for (const b of birds) b.visible = false;   // the menu shows only the sea
    // ...seen from inside the barrel: tucked in under the lip, looking out down the line through the opening
    const w = tick.demo, H = w.cond.H, px = w.peelX, sw = Math.sin(T * 0.6);
    if (!w.prof) w.prof = new Profile(w);
    const ak = Math.min(1, Math.max(0, (camera.aspect - 1) / 1.2)), M = { s: -1.8, y: 0.3, off: 0.75, ahead: 2.5, ly: 0.8 + 0.55 * ak, lz: -2.0 - 1.8 * ak };   // (deep under the lip; the opening framed low right, clear of the menu, on a phone on its side and a squarer screen alike)
    const s0 = M.s * H, y0 = M.y * H + 0.12 * sw, zl = w.prof.frontZAt(s0, y0) + M.off + 0.25 * Math.sin(T * 0.37);
    camera.position.set(px + s0, y0, w.zW + w.bend(s0) + zl);
    camera.lookAt(px + M.ahead * H, M.ly * H, w.zW + w.bend(M.ahead * H) + zl + M.lz);
  }
  if (rider && tick.demo) { tick.demo.dispose(scene); tick.demo = null; }
  fx.update(dt, camera.position);
}
// flipping the picture: the camera's projection mirrored left to right, and every triangle's facing with it (done at
// the GL call, so the renderer's own bookkeeping stays as it is)
const flipProj = (cam) => { cam.projectionMatrix.elements[0] *= -1; cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); };
{ const gl = renderer.getContext(), ff = gl.frontFace.bind(gl); gl.frontFace = (m) => ff(MIRROR ? (m === gl.CW ? gl.CCW : gl.CW) : m); }
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!(window.__g && window.__g.paused) && (!portrait.matches || ui.start.style.display !== 'none')) tick(dt);   // turned upright: the game waits (the menu's wave keeps rolling behind the turn-your-phone screen)
  if (!liveShown && (tick.demo || mode)) { liveShown = true; requestAnimationFrame(() => document.body.classList.add('live')); }   // (the wave is drawn: the poster behind the turn-your-phone screen fades away)
  if (portrait.matches !== lastPortrait) { lastPortrait = portrait.matches; if (document.body.classList.contains('playing')) audio.pause(portrait.matches); }   // (and so does the sound: no endless drone while it waits)
  // pass 1: the world; pass 2: your body through its own lens (skipped when a test view shows the body in the world cam)
  const mir = MIRROR; if (mir) flipProj(camera);   // (a right-hand spot: the picture drawn flipped left to right)
  HIDELEGS.value = camera.layers.isEnabled(1) || mode === 'villa' ? 0 : 1;
  for (const h of hairMeshes) h.visible = camera.layers.isEnabled(1);   // (walking round the villa, your legs are yours again)
  // the ride's over (the score is up): your body settling back onto the board moves faster than your eyes follow, and
  // from just behind it you'd see your own back; it isn't drawn in your view until you're back in the lineup
  if (surfer && !W.on) surfer.visible = !(rider && rider.state === 'OUT' && !camera.layers.isEnabled(1));
  ARMTH.value = rider && rider.standing ? 0.02 : 0.12;   // standing, shoulder skin is kept whole (no holes up the arm); sitting or lying your shoulder is right at the lens, so it's cut away   // (outside views, e.g. tests and replays, show the whole body)
  if (camera.layers.isEnabled(1)) renderer.render(scene, camera);
  else {
    if (foamK && !(rider && rider.state === 'WIPE' && W.on)) setFoam(0);   // (never left on screen: back to the menu mid-wipeout, the villa)
    ARMCUT.value = rider && rider.standing ? armCutNow() : 0; WATERY.value = rider && rider.state === 'LIE' && !W.on ? rig.position.y + 0.01 : -99;
    armK += ((rider && rider.standing && !(W.on) ? 1 : 0) - armK) * Math.min(1, dt * 4);
    armCam.position.copy(camera.position); armCam.quaternion.copy(camera.quaternion);
    armCam.aspect = camera.aspect; armCam.fov = camera.fov + (62 - camera.fov) * armK; armCam.updateProjectionMatrix(); if (mir) flipProj(armCam);
    renderer.autoClear = false; renderer.clear(); renderer.render(scene, camera); renderer.clearDepth(); scene.matrixWorldAutoUpdate = !!globalThis.__slowMat; renderer.render(scene, armCam); scene.matrixWorldAutoUpdate = true; renderer.autoClear = true;   // (the arms pass draws the same scene a moment later: nothing has moved, so don't work everything out again)
  }
  if (mir) { flipProj(camera); if (!camera.layers.isEnabled(1)) flipProj(armCam); }   // (both lenses back to normal between frames)
  autoQuality(dt); musicTick();
});
window.__g = { get hfov() { return hfovHalf; }, get show() { return showW; }, FADE, HIDELEGS, WATERY, ARMCUT, get mirror() { return MIRROR; }, flipProj: (c) => flipProj(c), get walker() { return walker; }, get villaW() { return villaW; }, get drone() { return drone; }, get crew() { return crewW; }, get friends() { return friendsW; }, get wild() { return wildW; }, startVilla: () => startVilla(), useBoard: (t) => useBoard(t), ranchSend: (k) => ranchSend(k), paused: false, cutaway, CUT, armCam, audio, renderer, scene, camera, rig, get surfer() { return surfer; }, get rider() { return rider; }, get waves() { return waves; }, incoming, input, keys, setMode: (m) => { mode = m; setWeather(m); setSpot(m); ui.cond.textContent = modeName(m); for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 15; updateWaves(0); }, step: (sec, dt = 1 / 30, draw = true) => { for (let t = 0; t < sec; t += dt) tick(dt); if (draw) renderer.render(scene, camera); }, spawnRider, splashLens, get T() { return T; }, want: () => _want };
