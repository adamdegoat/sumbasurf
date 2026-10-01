// Bali surf: session loop, controls, camera, surfer model, HUD, automatic quality.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { Wave, CONDITIONS, RANCH_CONDITIONS, skyDome, ocean, setWeather, WeatherFX, ENV, bioMat } from './wave.js?v=194';
import { Rider, Profile, waterAt, heightAt, RIDE, setBoard, PUMP_STROKE, PUMP_PERIOD } from './surf.js?v=190';
import { makeBoard, BOARD_LENGTH, BOARD_WIDTH, BOARD_WATER } from './board.js?v=21';
import { SurfAudio } from './audio.js?v=24';
import { ranch, POOL } from './ranch.js?v=9';
import { SPOTS, spotGroup, builtSpots } from './spots.js?v=129';
import { villa, VILLA } from './villa.js?v=163';
import { makeBirds } from './birds.js?v=1';
import { friends } from './friends.js?v=28';
import { lifeLib, idle as lifeIdle } from './life.js?v=1';
import { WATER_PEOPLE, waterPerson, straddle as straddleP } from './surfers.js?v=3';
import { crew } from './crew.js?v=57';
import { wildlife } from './wildlife.js?v=61';
import { droneShow } from './show.js?v=13';
import { makeBoat, DECK_Y, DECK, LADDER, HALF, BLOCKS } from './boat.js?v=5';

const Q = new URLSearchParams(location.search);
// ---------- renderer with hidden automatic quality (drops sharpness if the phone struggles, raises it back if not)
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const MAX_PR = Math.min(devicePixelRatio, 1.3);   // (the sharpness never climbs past where it starts, his heat call 30 Sep 2026: it crept up to 1.6 whenever the device kept up, so it never rested and ran hot; same picture everyone gets on arrival)
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
for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, () => { if (audio.ok) audio.wake(); }, { capture: true, passive: true });   // (any touch brings the music back)
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
document.addEventListener('touchmove', (e) => { if (!(e.target.closest && e.target.closest('.pnBox, #start .spotList, #start .fsRooms'))) e.preventDefault(); }, { passive: false });   // (except inside the patch notes, the spot list and the free surf beach list, which scroll: 1 Oct 2026, his catch, a phone couldn't reach the beaches or spots below the fold)
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
// in the Safari browser (not opened from the home screen icon), tell them how to get full screen
// on a computer (a mouse, no touch screen): the menu shows a QR code to play on the phone instead, and the keys
const DESK = matchMedia('(hover: hover) and (pointer: fine)').matches && !('ontouchstart' in window) && !navigator.maxTouchPoints;   // (a computer: keyboard and mouse)
// computers play too (his call 28 Sep 2026): keyboard words in the tips, arrows steer, Space paddles, Shift stalls.
// On sumbasurf.app itself a computer is sent on (his call, same day): play on Wavedash (where computer play earns), or
// scan the code to play on the phone. The game plays on a computer inside the Wavedash copy, on this Mac (localhost),
// for the owner (?me=1), and with ?desk=1; ?po=1 shows the card anywhere, for checking it
{ let own = /[?&]me=(1|claude)\b/.test(location.search); try { own = own || !!localStorage.getItem('sumbasurf.me'); } catch (e) {}
  const force = /[?&]po=1\b/.test(location.search);
  if (DESK && (force || (!own && !globalThis.Wavedash && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]desk=1\b/.test(location.search)))) document.body.classList.add('phoneonly'); }
if (DESK) {
  document.body.classList.add('desk');
  document.querySelector('#start .keys').innerHTML = '<span><kbd>\u2190 \u2192</kbd>turn</span><span><kbd>Space</kbd>paddle, then pump for speed</span><span><kbd>Shift</kbd>stall into the barrel</span>';   // (the keyboard's own controls)
  document.getElementById('soundTip').lastChild.textContent = ' Click anywhere for music';
}
if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches && document.getElementById('homeTip')) document.getElementById('homeTip').hidden = false;   // (the Wavedash copy has no tip: without the check, iPhones stopped right here, 28 Sep 2026)
fit();

// ---------- surfer on a board
const rig = new THREE.Group(); scene.add(rig);           // board frame: +z along the board, +y out of the deck
let board = makeBoard('short', true); rig.add(board);
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
  short: ['Shortboard', "6'2\" thruster. The high-performance board: sharp, snappy turns, snaps off the lip and airs. It's small, so it paddles slowly and you have to take off late and steep, and it loses speed if you stop pumping.", 'Tanjung Uma, Batu Hitam, Watu Kanan, Karang Hiu, Pantai Bintang, the Ranch', [2, 4, 5, 2, 5]],
  fish: ['Fish', "5'8\" wide twin fin with a swallow tail. Loose and fast: planes easily, paddles well and flies down the line on soft or slow waves with little pumping. Turns are skatey and the tail drifts early; on steep, heavy waves it's twitchy and loses grip.", 'Pantai Kuda, Watu Kanan, Pantai Bintang, the Ranch', [4, 5, 4, 3, 4]],
  long: ['Longboard', "9'2\" single fin. Smooth and relaxed: paddles fast and catches waves early, rock steady, glides forever. Turns are slow, wide arcs, like steering a boat, and it can't do snaps or airs. Clumsy in steep barrels.", 'Pantai Kuda (learning)', [5, 3, 1, 5, 0]],
  alaia: ['Alaia', "7'2\" wooden plank with no fins, the old Hawaiian board. The fastest glide of all and very loose: throw the tail out and slide sideways down the face, then catch it again. Thin, so it paddles slowly, catches waves late and sinks under you if you slow down. Push a slide too far and it slides right out. No airs.", 'Tanjung Uma, Watu Kanan', [1, 5, 4, 1, 0]],
  gun: ['Gun', "9'6\" big-wave board with a pointed nose and pin tail. Paddles into giant waves early, before they get too steep, and holds its line at high speed with lots of grip. Stiff, long turns; sluggish on small waves.", 'Gunung Laut', [5, 4, 2, 5, 2]],
};
// the board picker in the menu: each board's outline in its own colours, the one you're riding lit up
const BOARD_SVG = {
  short: ['M20 17 C20 11 40 8 62 8 C84 8 98 13 102 17 C98 21 84 26 62 26 C40 26 20 23 20 17Z', '#f4f1ea', '#e8715a'],
  fish: ['M22 9 L28 17 L22 25 C40 29 70 28 86 24 C94 21 97 18 97 17 C97 16 94 13 86 10 C70 6 40 5 22 9Z', '#e0b23a', '#1f8a8a'],
  long: ['M4 17 C4 11 22 8 60 8 C100 8 116 12 116 17 C116 22 100 26 60 26 C22 26 4 23 4 17Z', '#efe4c8', '#2f5d8a'],
  gun: ['M3 17 C18 12 48 9 70 9 C94 9 110 14 118 17 C110 20 94 25 70 25 C48 25 18 22 3 17Z', '#c8322a', '#f4f1ea'],
  alaia: ['M12 11 L12 23 C40 25 82 25 100 22 C108 20 111 18 111 17 C111 16 108 14 100 12 C82 9 40 9 12 11Z', '#b8804a', '#6b4423'] };
function boardPicker() {
  const box = document.getElementById('boards'); if (!box || box.childElementCount) return;
  for (const t of ['short', 'fish', 'long', 'gun', 'alaia']) { const [d, fill, rail] = BOARD_SVG[t], b = document.createElement('button'); b.dataset.board = t;
    b.innerHTML = `<svg viewBox="0 0 120 34"><path d="${d}" fill="${fill}" stroke="${rail}" stroke-width="2.5"/><path d="M${t === 'gun' ? 8 : 26} 17 H${t === 'long' ? 112 : 96}" stroke="${rail}" stroke-width="1" opacity=".6"/></svg><span>${BOARD_INFO[t][0]}</span><small>${BOARD_INFO[t][2]}</small>`;
    const pick = (e) => { e.preventDefault(); e.stopPropagation(); useBoard(t); }; b.addEventListener('click', pick); b.addEventListener('touchend', pick, { passive: false }); box.appendChild(b); }
  for (const b of box.children) b.classList.toggle('on', b.dataset.board === boardType); document.getElementById('boardName').textContent = BOARD_INFO[boardType][0];
  try { mmPanel(); } catch (e) {}   // (the BEST tags for the spot already chosen)
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
  rig.remove(board); board.geometry.dispose(); board = makeBoard(t, true); board.position.z = Math.max(0, (BOARD_LENGTH(t) - 1.88) * 0.33); board.position.y = t === 'alaia' ? 0.034 : 0;   /* (the alaia is 2.8 cm thick, half a shortboard: its deck raised to where theirs is, or lying on it the water washed over it as a pale sheet; the feet follow via deckAt) */ board.scale.x = MIRROR ? -1 : 1; rig.add(board);   // (at a mirrored spot, mirrored back: the logo reads right)
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
let gullT = 4, breezeT = 5, breezeN = 0, boomT = 6;
function updateLocals(dt) {
  if (rider && mode === 'easy') { gullT -= dt; if (gullT <= 0) { gullT = 7 + Math.random() * 11; audio.gull(0.6 + Math.random() * 0.4); } }   // (Pantai Kuda: gulls over the beach now and then)
  if (rider && mode === 'bintang') { breezeT -= dt; if (breezeT <= 0) { breezeN++; breezeT = 0.5 + 1.6 * Math.abs(Math.sin(breezeN * 1.37)); audio.cricket(0.6 + 0.4 * Math.abs(Math.sin(breezeN * 2.1))); } }   // (Pantai Bintang: crickets and frogs in the night)
  if (rider && mode === 'hiu') { breezeT -= dt; if (breezeT <= 0) { breezeN++; breezeT = 6 + 6 * Math.abs(Math.sin(breezeN * 1.9)); audio.breeze(0.9 + 0.3 * Math.abs(Math.sin(breezeN * 2.3))); } }   // (Karang Hiu: the strong offshore gusting through the palms)
  if (rider && mode === 'medium') { breezeT -= dt; if (breezeT <= 0) { breezeN++; const k = 0.6 + 0.4 * Math.abs(Math.sin(breezeN * 2.3)); breezeT = 9 + 8 * Math.abs(Math.sin(breezeN * 1.7)); audio.breeze(k); } }   // (Tanjung Uma: warm gusts over the dry grass; its own beat, off the shared dice)
  audio.fallsLevel(rider && mode === 'kanan' ? 1 : 0);   // (Watu Kanan: the waterfall's rush, faint under the surf)
  if (rider && mode === 'hard') { boomT -= dt; if (boomT <= 0) { breezeN++; boomT = 8 + 9 * Math.abs(Math.sin(breezeN * 1.3)); audio.boom(0.6 + 0.4 * Math.abs(Math.sin(breezeN * 2.9))); } }   // (Batu Hitam: waves booming into the cliffs down the coast)
  for (const L of locals) {
    L.grp.visible = !!rider && !isRanch() && !isFree(); if (!L.grp.visible) continue;   // (the free beach: only real players, his call 30 Sep 2026)
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
  surferGltf = g; surfer = g.scene; rig.add(surfer);
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
let spec = null, contestHold = false, waveSeq = 0, surferGltf = null;   // (the surf contest, Wavedash copy only: see specApply)
let mode = null, rider = null, waves = [], session = { waves: 0, total: 0, best: 0, scores: [], barrels: 0 }, nextBreak = 0, setLeft = 0, setPos = 0;
let REEF = { xEnd: 190, zBeach: 150 }; const PROFILES = new Map(), PROFILES_W = new Map();   // room for the bigger swells to run (the sand starts ~185 m in)
const OCEAN_REEF = REEF, RANCH_REEF = { xEnd: POOL.x1 - 60, zBeach: POOL.z1 - 20 };
const POOL_PLANES = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -POOL.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), POOL.x1), new THREE.Plane(new THREE.Vector3(0, 0, 1), -POOL.z0), new THREE.Plane(new THREE.Vector3(0, 0, -1), POOL.z1)];
renderer.localClippingEnabled = true;
let ranchKind = 'medium';   // the wave you last ordered at the Sumba Ranch
const isRanch = () => mode === 'ranch';
const modeName = (m) => m === 'villa' ? 'Your villa' : m === 'ranch' ? 'Sumba Ranch' : m === 'random' ? 'Random' : SPOTS[m] ? SPOTS[m].name : CONDITIONS[m].name;
// which world you're in: the Bali coast, or the wave pool (same water and waves, clipped to the pool, no reef under it)
function setSpot(m) {
  const r = m === 'ranch', key = SPOTS[m] ? m : 'medium', S = SPOTS[key];
  for (const g of builtSpots()) g.visible = false;
  if (!r) { const sg = spotGroup(scene, key); sg.visible = true; if (sg.userData.farVilla) sg.userData.farVilla.visible = m !== 'villa'; }   // (at the villa itself the real house is drawn, not the stand-in seen from the water)
  ranchW.group.visible = r; audio.crowdLevel(r ? 1 : 0); if (r) loadPeople();   // (the people round the pool are your villa friends' bodies: fetched now if they aren't in yet)
  if (villaW) villaW.group.visible = m === 'villa'; if (crewW) crewW.group.visible = m === 'villa'; if (wildW) wildW.group.visible = m === 'villa'; if (friendsW) { friendsW.group.visible = m === 'villa'; if (m !== 'villa') friendsW.hide(); }
  { const warm = m === 'villa', W = ENV.weather || {}; hemi.color.set(warm ? 0xfff0dc : W.hemi || 0xcfe6ff); hemi.groundColor.set(warm ? 0x5a4030 : W.hemiGround || 0x3a4a48); sunLight.color.set(warm ? 0xffdcb0 : W.light || 0xfff0dd); }
  hemi.intensity = W.night && !(m === 'villa') ? 1.5 : 1.3; sunLight.intensity = W.night && !(m === 'villa') ? 1.5 : 2.0;   // (29 Sep 2026: players found the night spot too dark: a brighter moon and sky, still night)   // (the night spot: people, boards and the land lit only by the moon)   // (a spot's own light on the land: its weather can warm it or grey it)   // (the villa in warm evening light, reflected off the wood; the surf spots keep their clear daylight)
  ENV.uReefEnd.value = 190 + S.dz; ENV.uReefTint.value.setRGB(...S.reefTint); ENV.uReefK.value = S.reefK || 0.38;
  if (m === 'free') { ENV.uChan.value.set(FREE[0].xEnd + 4, FREE[1].x - 12, 1); ENV.uReefX0.value = -240; } else { ENV.uChan.value.set(0, 0, 0); ENV.uReefX0.value = -160; }   // (the free-surf beach: the channel between its two reefs, and reef all along its shore)
  if (r) ENV.uPool.value.set(POOL.x0, POOL.x1, POOL.z0, POOL.z1); else ENV.uPool.value.set(-1e6, 1e6, -1e6, 1e6);
  ENV.uReef.value = r ? 0 : 1;
  REEF = r ? RANCH_REEF : { xEnd: S.xEnd || OCEAN_REEF.xEnd, zBeach: OCEAN_REEF.zBeach + S.dz };   // (each spot's beach is further back or closer in)
  // a right-hand spot: the same world and physics as a left, the finished picture flipped left to right (so the wave
  // peels to your right); the stance you chose is kept as you see it, which means the body inside is the other way round
  const was = MIRROR; MIRROR = !!S.mirror && !r && m !== 'villa'; board.scale.x = MIRROR ? -1 : 1; applyStance();   // (the board mirrored back, so its logo reads right in the flipped picture)
  if (MIRROR !== was) renderer.state.reset();   // (the triangle facing flips with it: have the renderer set it afresh)
}
// the free-surf beach (30 Sep 2026, his layout): three places to surf, each with its own waves and its own stretch of
// reef, and a channel between the two peaks where nothing breaks (the way out). Both peaks break left (the game's waves
// all peel the same way: a right is the whole picture drawn mirrored, which can't be done for half a beach).
//   x: where its waves break (+- jx), z: how far in (0 = the usual lineup), xEnd: where its reef ends (the wave backs off)
const FREE = [
  { cond: 'free_out', x: -165, jx: 6, z: 0, xEnd: -18, sets: true },    // 1 the outside peak: the main one (a reef ~150 m long: a Tanjung Uma length ride)
  { cond: 'free_mid', x: 30, jx: 5, z: 16, xEnd: 170, sets: true },     // 2 the second peak, down the beach past the channel (x -18..30)
  // (no small inside waves: his call 30 Sep 2026, they ran through the peaks' waves rolling in and weren't worth it)
];
const isFree = () => mode === 'free';
FREE.net = { role: 'solo', onWave: null };   // surfing the free beach together (see wavedash/src/freeroom.js): 'solo', 'host' (makes the waves) or 'client'
// a wave's own dice (free beach): the same numbers in the same order on every player's copy of that wave
function wr(w) { if (w.rs === undefined) return Math.random(); w.rs = (w.rs + 0x6D2B79F5) | 0; let t = Math.imul(w.rs ^ (w.rs >>> 15), 1 | w.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function condFor(m) { return m === 'free' ? 'free_out' : m === 'villa' ? 'medium' : m === 'ranch' ? ranchKind : m === 'random' ? ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] : m; }
function addWave(tBreak, zone) {
  const cond = mode === 'ranch' ? RANCH_CONDITIONS[ranchKind] : zone ? CONDITIONS[zone.cond + (FREE.extreme ? '_x' : '')] : CONDITIONS[condFor(mode)];   // (the pool has its own machine waves; the free-surf beach one kind per place to surf)
  const w = new Wave(scene, cond);
  if (!PROFILES.has(cond)) { PROFILES.set(cond, new Profile(w)); PROFILES_W.set(cond, new Profile(w.whiteView())); }   // (and its closed-out copy)      // the surface shape is the same for every wave of a size: share its cache
  if (isRanch()) for (const k of ['mist', 'spit', 'veil', 'spray']) if (w[k]) { w[k].material.clippingPlanes = POOL_PLANES; w[k].material.needsUpdate = true; }   // (spray and mist stay inside the pool, not drifting over the deck)
  w.tBreak = tBreak; w.prof = PROFILES.get(cond); w.profW = PROFILES_W.get(cond); w.xEnd = REEF.xEnd; w.zBeach = REEF.zBeach; w.seed = Math.random() * 100;
  if (zone) { w.sid = ++waveSeq; w.rs = (Math.random() * 2 ** 31) | 0; w.zone = zone; w.pkX = zone.x2 !== undefined ? zone.x + Math.random() * (zone.x2 - zone.x) : zone.x + (Math.random() * 2 - 1) * zone.jx; w.pkZ = zone.z; w.xEnd = zone.span ? w.pkX + zone.span : zone.xEnd; }
  waves.push(w);
  return w;
}
function updateWaves(dt) {
  for (const pr of PROFILES.values()) pr.warm(24);
  for (const pr of PROFILES_W.values()) pr.warm(12);
  // keep the next wave lined up out to sea; a swell period apart, give or take
  // swell arrives in sets: 3-4 waves one period apart, the bigger ones in the middle, then a lull (shortened for play)
  if (isFree()) freeSets();   // (each place to surf keeps its own sets)
  while (!isRanch() && !isFree() && nextBreak - T < 150 / 6) {   // (the Sumba Ranch only makes a wave when you order one)
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
      if (w.secT === undefined) w.secT = 3 + wr(w) * 4;
      // set up in the pocket (standing, just ahead of the curl, low on the face, not racing away) and the next section
      // throws right over you soon: real barrels mostly come to you like this, rather than after a long wait
      if (C.assist !== false && rider && rider.wave === w && rider.state === 'RIDE' && !rider.inBarrel && rider.s > 0.2 * C.H && rider.s < 2.2 * C.H && rider.y < 0.6 * C.H && !(w.secK > 0) && w.secT > 0.6) { w.secT = 0.6; w.secSoft = true; }   // (a softer section: it covers you rather than racing past)
      // a long time in the tube and the barrel breathes out: the spit blows you out onto the open face (if you're sitting
      // too deep by then, the foam ball gets you first). Real barrels last a few seconds; a perfectly even tube went on for
      // half a minute. A barrel spits after 4.5-6.5 s
      if (rider && rider.wave === w && rider.inBarrel) {
        if (!rider.spitAt) rider.spitAt = 3.2 + Math.random() * 1.8;   // (29 Sep 2026, his call: most barrels 3 to 5 s, was 4.5 to 6.5)
        if ((rider.ride.tubeT || 0) > rider.spitAt) { rider.spitAt += 2.5; if (rider.s > -1.5 * C.H || (C.tube || 0) >= 0.8) { rider.spitOut = 1.8; w.secT = Math.max(w.secT || 0, 3 + Math.random() * 2); if (w.spitT !== undefined) w.spitT = 0.25; } }   // (spat out onto the open face: the next section waits a few seconds, so you ride on and carve before another barrel)   // (at the heavy spots the spit only blows you out if you're near the mouth; the friendly tubes forgive a deeper line)   // (and again every 3 s if you hang on in there)
      } else if (rider && rider.wave === w && !(rider.ride.tubeT > 0)) rider.spitAt = 0;
      if (w.secK === undefined || w.secK <= 0) { w.secT -= dt; if (w.secT <= 0) { w.secK = 1.1; w.secA = w.secSoft ? C.softA : 1; w.secSoft = false; w.secT = 5 + wr(w) * 5; if (w.spitT !== undefined) w.spitT = 0.25; } }   // (a heavy wave's section throws hard over you: race it or it closes on you)
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
    const reefK = Math.min(1, Math.max(0, ((w.xEnd ?? REEF.xEnd) - w.peelX) / (w.zone ? 22 : 38))), beachK = Math.min(1, Math.max(0, (REEF.zBeach - w.zW) / 45));   // (each wave its own reef end: the free-surf peaks end at the channel)
    w.endK = Math.min(reefK, beachK); w.endBy = beachK < reefK ? 'beach' : 'reef';
    if (!w.closing && !isRanch() && w.endBy === 'beach' && beachK < 0.55) { w.closing = true; w.closeT = 0; }   // (a little further in than the old racing break started: its lip reaches you sooner, so rides last as long as they did)
    if (w.endK < 0.88 && !w.spat) { w.spat = true; if (w.spitT !== undefined) w.spitT = 0.3; if (rider && rider.wave === w && rider.inBarrel) rider.spitOut = 1.8; }   // (the spit: see the rider's judge)
    w.fade = (w.size || 1) * (w.closing ? 1 - 0.97 * smooth01((w.closeT - 1.5) / 5.5) : reefK) * Math.min(1, Math.max(0.15, 1 + (w.zW + 160) / 60));   // (closed out, it keeps its height while it breaks, then the whitewater shrinks as it rolls on into the shallows)
    if (isRanch()) w.fade = Math.min(1, Math.max(0.02, (w.zW - POOL.z0) / 22)) * w.endK;   // the pool wave rises out of the machine wall   // far out it's a small swell; past the end of the reef it backs off
    // (performance) a wave far from you (not yours, 120 m+ off) moves its spray and mist 30 times a second instead of 60:
    // at that distance nobody can tell, and it was the biggest single cost left in a frame
    w.update(dt, !globalThis.__slowMat && !(rider && rider.wave === w) && Math.hypot(w.peelX - camera.position.x, w.zW - camera.position.z) > 120);
    if (w.zW > REEF.zBeach + 40 || w.peelX > (w.xEnd ?? REEF.xEnd) + 45 || w.closeT > 7.5) { w.dispose(scene); waves.splice(i, 1); }
  }
}
// the free-surf beach: sets at each peak on their own clocks (a set is 3-4 waves a swell period apart, bigger in the
// middle, then a lull), and a small inside wave every so often somewhere along the shore
function freeSets() {
  if (FREE.net.role === 'client') return;   // (on a shared beach the host's waves come in over the network: see freeWaveApply)
  for (const z of FREE) {
    if (z.next === undefined) { z.next = T + (z.sets ? 4 + Math.random() * 6 : 2 + Math.random() * 3); z.left = 0; z.pos = 0; }
    const C = CONDITIONS[z.cond + (FREE.extreme ? '_x' : '')];
    while (z.next - T < 12) {   // (only the next few waves at each place exist: three places queuing 25 s ahead kept 15 waves alive, each costing work every frame)
      const w = addWave(z.next, z); w.netNew = true;
      if (z.sets) {
        if (z.left <= 0) { z.left = 3 + (Math.random() < 0.5 ? 1 : 0); z.pos = 0; }
        const n = z.pos / Math.max(1, z.left + z.pos - 1); w.size = 0.82 + 0.28 * Math.sin(Math.PI * Math.min(1, n + 0.15)) + (Math.random() - 0.5) * 0.08;
        z.pos++; z.left--; z.next += z.left > 0 ? C.period * (0.9 + Math.random() * 0.2) : C.period * (1.2 + Math.random() * 0.4);
      } else { w.size = 0.85 + Math.random() * 0.25; z.next += C.period * (0.8 + Math.random() * 0.8); }
      if (FREE.net.onWave) FREE.net.onWave(w);
    }
  }
}
// Paddle out (free-surf beach): a shortcut back to the nearest peak's lineup, with a quick fade, for when you'd rather not
// paddle all the way back. Shown only while you're lying on your board, more than 40 m from either peak's lineup
const freeBtn = document.getElementById('freeOut'), fadeEl = document.getElementById('fade');
let freeJumping = false;
function freeOut() {
  if (!freeBtn) return;
  boatBtnTick();
  const r = rider, far = isFree() && !freeJumping && !!(strand || r && r.state === 'LIE' && Math.min(Math.hypot(r.x - FREE[0].x, r.z - FREE[0].z + 8), Math.hypot(r.x - FREE[1].x, r.z - FREE[1].z + 8)) > 40);   // (!!: on foot it was the walker object, never equal to hidden's true/false, so the button never showed)
  if (freeBtn.hidden === far) { freeBtn.hidden = !far; document.body.classList.toggle('fo', far); }   // (fo: the tip up top narrows to clear the button)
  freeGuide();
}
// finding your way on the free beach (his call 30 Sep 2026): a marker buoy floats just outside each peak's lineup, and
// while you're lying on your board away from both, a small pill up top points to the nearest one with its distance
// (for the first seconds after you arrive it says to paddle out to it)
const guideEl = document.getElementById('freeGuide'), guideRot = guideEl && guideEl.querySelector('.gRot'), guideDist = guideEl && guideEl.querySelector('.gTxt b'), guideTxt = guideEl && guideEl.querySelector('.gTxt i'), _gP = new THREE.Vector3();
const PEAK_NAMES = ['Big waves', 'Smaller waves'], buoys = [], _gdir = new THREE.Vector3();   // (plain words, his note 30 Sep 2026: 'peak' was hard to understand)
function makeBuoy() {
  const g = new THREE.Group(), orange = new THREE.MeshLambertMaterial({ color: 0xff6a1a }), dark = new THREE.MeshLambertMaterial({ color: 0x2a2622 }), flagM = new THREE.MeshLambertMaterial({ color: 0xffc23a, side: THREE.DoubleSide });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), orange); ball.scale.y = 0.8; g.add(ball);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), dark); pole.position.y = 1.4; g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), flagM); flag.position.set(0.58, 2.3, 0); g.add(flag);
  g.scale.setScalar(1.9); g.visible = false; scene.add(g); return g;   // (big as a real channel marker: small ones vanished among the swells from 60 m)
}
function freeGuide() {
  const on = isFree() && !!(rider || strand);   // (on the sand too: you look out for them from the beach)
  if (on && !buoys.length) for (let i = 0; i < 2; i++) buoys.push(makeBuoy());
  buoys.forEach((b, i) => { b.visible = on; if (!on) return; const x = FREE[i].x + 4, z = FREE[i].z - 16, y = heightAt(waves, x, z);
    b.position.set(x, y - 0.15, z); b.rotation.set(Math.sin(T * 1.3 + i) * 0.08, T * 0.1, Math.cos(T * 1.1 + i) * 0.08); });
  if (!guideEl) return;
  const r = rider, show = on && !!r && !freeJumping && r.state === 'LIE' && !FREE.follow;   // (not while heading to a friend: one way to go at a time)
  let i = 0, d = Infinity;
  if (show) for (let k = 0; k < 2; k++) { const dk = Math.hypot(r.x - FREE[k].x, r.z - FREE[k].z + 8); if (dk < d) { d = dk; i = k; } }
  if (show && Math.hypot(r.x - BOAT.x, r.z - BOAT.z) < 70) { i = 0; d = Math.hypot(r.x - FREE[0].x, r.z - FREE[0].z + 8); }   // (by the boat it's the big waves it sits beside, his catch 30 Sep 2026: the smaller waves across the bay were a few metres nearer)
  const vis = show && d > 40;
  if (guideEl.hidden === vis) guideEl.hidden = !vis;
  if (!vis) return;
  // an arrow (his call 30 Sep 2026: an animated arrow, not a pill): just under the buoy when it's in view, pointing up at
  // it (far away it sits on the horizon, at the top of the screen); otherwise at the side it's round to, pointing that way
  camera.getWorldDirection(_gdir); const dx = FREE[i].x - r.x, dz = FREE[i].z - 8 - r.z;
  const rel = Math.atan2(_gdir.x * dz - _gdir.z * dx, _gdir.x * dx + _gdir.z * dz);   // (how far round from where you look: positive is to your right)
  const b = buoys[i], W = innerWidth, H = innerHeight; _gP.set(b.position.x, b.position.y, b.position.z).project(camera);
  const inView = _gP.z < 1 && Math.abs(_gP.x) < 0.8 && _gP.y < 1 && _gP.y > -0.4;
  let x, y, ang;
  if (inView) { x = (_gP.x + 1) / 2 * W; y = Math.max(80, (1 - _gP.y) / 2 * H + 12); ang = 0; }   // (never up among the tip and a private beach's code)
  else { x = rel > 0 ? W - 84 : 150; y = rel > 0 ? H * 0.62 : H * 0.3; ang = rel > 0 ? 90 : -90; }   // (right: lower, clear of the list of who's on the beach)   // (on the left, clear of the earpiece's song buttons)
  if (guideEl._mk !== inView || guideEl._x === undefined) { guideEl._x = x; guideEl._y = y; guideEl._mk = inView; guideEl.classList.toggle('mk', inView); guideRot.style.transform = `rotate(${ang}deg)`; }
  else { guideEl._x += (x - guideEl._x) * 0.25; guideEl._y += (y - guideEl._y) * 0.25; }
  guideEl.style.left = guideEl._x.toFixed(1) + 'px'; guideEl.style.top = guideEl._y.toFixed(1) + 'px';
  if (FREE.edgeT > 0) FREE.edgeT -= 1 / 60;
  const m = `${Math.round(d / 10) * 10} M`, t = FREE.edgeT > 0 ? 'Too far out: head back' : FREE.arriveT !== undefined && T - FREE.arriveT < 8 ? 'Paddle out to the waves' : PEAK_NAMES[i];
  if (guideDist.textContent !== m) guideDist.textContent = m;
  if (guideTxt.textContent !== t) guideTxt.textContent = t;
}
// ---- surfing the free beach together (his call 30 Sep 2026; the network side is wavedash/src/freeroom.js). The host
// makes the waves and sends each one out as a list of numbers; every copy then breaks the same way (the same size, peak
// and dice for its sections). Whoever is riding a wave also sends its state now and then, since the help a rider gets
// in the pocket and a barrel's spit only happen on the rider's own copy. Each player sends where they are ~12 times a
// second; the others are drawn a moment behind (140 ms), in between the last two messages, so they glide.
function freeWaveOut(w) { return [w.sid, FREE.indexOf(w.zone), +w.tBreak.toFixed(3), +(w.size || 1).toFixed(4), +w.pkX.toFixed(3), +w.pkZ.toFixed(3), +w.seed.toFixed(4), w.rs | 0,
  w.px === undefined ? null : +w.px.toFixed(3), +(w.secK || 0).toFixed(3), w.secA || 1, w.secT === undefined ? null : +w.secT.toFixed(3), w.closing ? 1 : 0, +(w.closeT || 0).toFixed(3), w.spat ? 1 : 0]; }
function freeWaveApply(a, off = 0) {   // (off: the host's clock minus ours)
  if (!isFree() || !a) return;
  let w = waves.find((v) => v.sid === a[0]);
  if (!w) { const z = FREE[a[1]]; if (!z) return; w = addWave(a[2] - off, z); w.sid = a[0]; waveSeq = Math.max(waveSeq, a[0]); w.size = a[3]; w.pkX = a[4]; w.pkZ = a[5]; w.xEnd = z.xEnd; w.seed = a[6]; w.rs = a[7]; }
  freeWaveSync([a[0], a[8], a[9], a[10], a[11], a[12], a[13], a[14]], true);
}
function freeWaveState(w) { return [w.sid, w.px === undefined ? null : +w.px.toFixed(3), +(w.secK || 0).toFixed(3), w.secA || 1, w.secT === undefined ? null : +w.secT.toFixed(3), w.closing ? 1 : 0, +(w.closeT || 0).toFixed(3), w.spat ? 1 : 0]; }
function freeWaveSync(a, force = false) {   // [sid, px, secK, secA, secT, closing, closeT, spat]: never onto the wave you're riding yourself
  const w = waves.find((v) => v.sid === a[0]); if (!w || (!force && rider && rider.wave === w && rider.standing)) return;
  if (a[1] !== null) w.px = a[1]; w.secK = a[2]; w.secA = a[3]; if (a[4] !== null) w.secT = a[4];
  if (a[5] && !w.closing) { w.closing = true; } w.closeT = a[6]; w.spat = !!a[7];
}
function freeClearWaves() { for (const w of waves) w.dispose(scene); waves = []; for (const z of FREE) z.next = undefined; }
function freeBecomeHost() {   // (the host left: carry on the sets from the waves already out there)
  for (const z of FREE) { const zw = waves.filter((v) => v.zone === z), C = CONDITIONS[z.cond + (FREE.extreme ? '_x' : '')];
    z.next = zw.length ? Math.max(...zw.map((v) => v.tBreak)) + C.period * 1.3 : undefined; z.left = 0; z.pos = 0; }
}
// Follow a friend (his ask 30 Sep 2026): tap their name on the list and you paddle over to them. It steers and
// paddles for you while you're lying on your board; your own steering or paddling, catching a wave, getting next to
// them (6 m) or tapping the name again stops it
function freeFollow(id) { FREE.follow = id && FREE.follow !== id && peers.has(id) ? id : null; dispatchEvent(new CustomEvent('ss:follow', { detail: FREE.follow })); return FREE.follow; }
function freeFollowTick(own) {
  const P = peers.get(FREE.follow), r = rider;
  if (!isFree() || !P || !P.S || !r || own || r.standing) { freeFollow(null); return; }
  const dx = P.S.pos.x - r.x, dz = P.S.pos.z - r.z, d = Math.hypot(dx, dz); FREE.followD = d;
  if (d < 6) { freeFollow(null); return; }
  if (r.state !== 'LIE') return;   // (wiped out: carries on once you're back on the board)
  const e = Math.atan2(Math.sin(Math.atan2(dz, dx) - r.th), Math.cos(Math.atan2(dz, dx) - r.th));
  input.steer = Math.max(-1, Math.min(1, e * 2)); input.paddle = Math.abs(e) < 1.2;
}
function freeSnap() {
  if (!isFree()) return null;
  if (strand && strand.deck) return ['DECK', +strand.lx.toFixed(2), 0, +strand.lz.toFixed(2), +strand.yaw.toFixed(3)];   // (on the boat: where on its deck and which way you face; each copy of the boat rides the same swell)
  if (strand) return ['FOOT', +strand.x.toFixed(2), 0, +strand.z.toFixed(2)];
  if (!rider) return null;
  const p = rig.position, q = rig.quaternion, wv = rider.wave;
  return [rider.state, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4), +q.w.toFixed(4), +rider.stateT.toFixed(2), +rider.v.toFixed(2),
    +(rider.lean / RIDE.leanMax).toFixed(3), +(rider.turn || 0).toFixed(3), rider.inBarrel ? 1 : 0, rider.pumping ? 1 : 0, +(rider.pumpT || 0).toFixed(2), +stallV.toFixed(2),
    wv ? +(rider.v / wv.cond.speed).toFixed(2) : 0, boardType, stance, wv && rider.standing ? wv.sid || 0 : 0, rider.state === 'LIE' && !sitting ? 1 : 0,   // (20: lying down paddling, not sitting up)
    wv && rider.standing ? +(p.x - wv.peelX).toFixed(2) : 0, wv && rider.standing ? +(p.z - wv.zW).toFixed(2) : 0];   // (21, 22: where on the wave they are, so the others can put them on their own copy of it)
}
const peers = new Map(), _tagV = new THREE.Vector3(), tagsOn = []; let OSmod = null, osLoading = false;
const _pqa = new THREE.Quaternion(), _pqb = new THREE.Quaternion();
function freePeer(id, a, name, sent) {   // (sent: the sender's own clock when it was taken, so uneven delivery doesn't make them judder)
  if (!isFree() || !Array.isArray(a)) return;
  let P = peers.get(id); const now = performance.now();
  if (!P) { P = { buf: [], name, lag: Infinity }; peers.set(id, P); }
  let t = now;
  if (typeof sent === 'number') { const l = now - sent; P.lag = Math.min(P.lag + 0.02, l); t = sent + P.lag; }   // (the quickest a message has ever taken, creeping up slowly in case the clocks drift)
  if (P.buf.length && t <= P.buf[P.buf.length - 1].t) return;   // (out of order: an older one)
  if (P.buf.length) { const L = P.buf[P.buf.length - 1].a; if (Math.hypot(a[1] - L[1], a[3] - L[3]) > 25) P.buf = []; }   // (Paddle out: they're simply there, not sliding across the bay; his note 30 Sep 2026)
  if (name) P.name = name;
  P.buf.push({ t, a }); if (P.buf.length > 12) P.buf.shift(); P.last = now;
  if (!OSmod && !osLoading && surferGltf) { osLoading = true; import('./others.js?v=21').then((m) => { OSmod = m; }).catch(() => { osLoading = false; }); }
}
function freeSay(id, text) { const P = peers.get(id); if (P) P.say = { text: String(text).slice(0, 90), until: performance.now() + 5000 }; }
// every player's own shorts colour (his call 30 Sep 2026: automatic, different for each), picked from their player id,
// so everyone sees the same colour on the same friend
const SHORTS = [0xd8452c, 0x1f4f8f, 0xe8b830, 0x1b9a8a, 0xe8772a, 0x6a3fa0, 0x7cb342, 0xd9559a, 0x2e2e2e, 0xf2f2f2];
let shortsMap = null;   // (from the room, see freeShorts: nobody on a beach shares a colour)
function shortsFor(id) { if (shortsMap && shortsMap[id] != null) return shortsMap[id]; let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return SHORTS[h % SHORTS.length]; }
// the players in the order they joined: each takes the colour its id points at, or the next one nobody earlier has, so
// no two share one and someone arriving later never changes anyone's
function freeShorts(ids) { const used = new Set(), m = {}; for (const id of ids) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; let k = h % SHORTS.length; while (used.has(k)) k = (k + 1) % SHORTS.length; used.add(k); m[id] = SHORTS[k]; } shortsMap = m; }
function freePeerGone(id) { const P = peers.get(id); if (P && P.os) scene.remove(P.os.group); if (P && P.tag) P.tag.remove(); peers.delete(id); }
function freePeersClear() { for (const id of [...peers.keys()]) freePeerGone(id); }
function peersTick(dt) {
  const now = performance.now(), at = now - 140; tagsOn.length = 0;
  for (const [id, P] of peers) {
    if (now - P.last > 6000) { freePeerGone(id); continue; }   // (gone quiet: taken off the beach)
    const b = P.buf, n = b.length; let A = b[n - 1], B = A;
    if (n > 1 && at > b[n - 1].t) { A = b[n - 2]; B = b[n - 1]; }   // (the next message is late: carry on the way they were going, up to 150 ms)
    else for (let k = 0; k < n - 1; k++) if (b[k].t <= at && b[k + 1].t >= at) { A = b[k]; B = b[k + 1]; break; }
    const c = B.a, a = A.a[0] === 'FOOT' || c[0] === 'FOOT' ? c : A.a, f = B.t > A.t ? Math.min(1 + 150 / (B.t - A.t), Math.max(0, (at - A.t) / (B.t - A.t))) : 1;
    if (c[0] === 'FOOT') { if (P.os) P.os.group.visible = false; continue; }   // (on the sand: not drawn yet)
    if (!OSmod || !surferGltf) continue;
    if (!P.os || (c[0] !== 'DECK' && (P.os.boardType !== c[17] || P.stance !== c[18]))) {   // (on deck no board is sent: keep theirs)
      if (P.os) scene.remove(P.os.group); P.os = new OSmod.OtherSurfer(surferGltf, { board: c[17], stance: c[18], shorts: shortsFor(id) }); P.stance = c[18]; scene.add(P.os.group); }
    P.os.setShorts(shortsFor(id));
    const S = P.S || (P.S = { pos: new THREE.Vector3(), q: new THREE.Quaternion() });
    if (c[0] === 'DECK') {   // on the boat: stood on its deck (their spot on it, on your copy of the boat), facing their way
      if (!boat) continue; const a2 = a[0] === 'DECK' ? a : c, lx = a2[1] + (c[1] - a2[1]) * f, lz = a2[3] + (c[3] - a2[3]) * f, dy = Math.atan2(Math.sin(c[4] - a2[4]), Math.cos(c[4] - a2[4])), yaw = a2[4] + dy * f;
      S.pos.copy(boatWorld(lx, DECK_Y, lz)); S.q.setFromAxisAngle(_yUp, Math.PI / 2 - yaw).premultiply(boat.quaternion);
      S.state = 'DECK'; S.v = B.t > A.t ? Math.hypot(c[1] - a2[1], c[3] - a2[3]) / ((B.t - A.t) / 1000) : 0; S.paddling = false;
    } else {
    S.pos.set(a[1] + (c[1] - a[1]) * f, a[2] + (c[2] - a[2]) * f, a[3] + (c[3] - a[3]) * f);
    // riding: placed on the wave itself (its peel point and crest line now, on your copy), not where they were 140 ms
    // ago, when the face was a metre further out and they'd sit inside the water; in the water, at your water's height
    const wv = c[19] && a[19] === c[19] ? waves.find((v) => v.sid === c[19]) : null;
    if (wv) S.pos.set(wv.peelX + a[21] + (c[21] - a[21]) * f, S.pos.y, wv.zW + a[22] + (c[22] - a[22]) * f);   // (their own height on the face: inside a barrel the water's top is the lip overhead)
    else if (c[0] !== 'WIPE') S.pos.y = heightAt(waves, S.pos.x, S.pos.z);
    _pqa.set(a[4], a[5], a[6], a[7]); _pqb.set(c[4], c[5], c[6], c[7]); S.q.copy(_pqa).slerp(_pqb, Math.min(1, f));
    S.state = c[0]; S.stateT = c[8]; S.v = c[9]; S.lean = c[10]; S.turn = c[11]; S.inBarrel = !!c[12]; S.pumping = !!c[13]; S.pumpT = c[14]; S.stalling = c[15]; S.speedK = c[16]; S.paddling = !!c[20];
    }
    P.os.tick(dt, S, camera);
    // their name, small over their head (his call 30 Sep 2026), fading out far away; not drawn behind you
    if (!P.tag) { let lay = document.getElementById('fsTags'); if (!lay) { lay = document.createElement('div'); lay.id = 'fsTags'; document.body.appendChild(lay); }
      P.tag = document.createElement('div'); P.tag.className = 'fsTag'; P.tag.innerHTML = '<i></i><span></span><b></b>'; lay.appendChild(P.tag); }
    const nmEl = P.tag.children[1], dEl = P.tag.children[2], sayEl = P.tag.firstChild, saying = P.say && now < P.say.until ? P.say.text : '';   // (a chat line floats over their head for 5 s)
    if (nmEl.textContent !== (P.name || '')) nmEl.textContent = P.name || '';
    if (sayEl.textContent !== saying) { sayEl.textContent = saying; sayEl.style.display = saying ? 'block' : 'none'; }
    _tagV.set(S.pos.x, S.pos.y + (c[0] === 'DECK' ? 2.05 : c[0] === 'RIDE' || c[0] === 'POP' ? 2.3 : c[20] ? 0.75 : 1.4), S.pos.z).project(camera);   // (just over their head: standing, lying paddling, or sitting up)
    // (no distance limit any more, his note 30 Sep 2026: friends were hard to find; far away it also says how far)
    const dd = camera.position.distanceTo(S.pos), onS = P.name && _tagV.z < 1 && Math.abs(_tagV.x) < 1.05 && Math.abs(_tagV.y) < 1.05;
    const dTxt = dd > 40 ? `${Math.round(dd / 10) * 10} M` : ''; if (dEl.textContent !== dTxt) { dEl.textContent = dTxt; dEl.style.display = dTxt ? '' : 'none'; }
    P.tag.style.display = onS ? '' : 'none';
    if (onS) { P.tagX = (_tagV.x + 1) / 2 * innerWidth; P.tagY = (1 - _tagV.y) / 2 * innerHeight; P.tagW = (P.name || '').length * 6.5 + 18; P.tagD = dd; P.tag.style.opacity = dd < 60 ? 1 : 0.8; tagsOn.push(P); }
    // solid, not magnetic (his call 30 Sep 2026: no push-apart effect): you can come right up beside a friend, you just
    // can't pass through them. Only when you'd actually overlap (closer than 1.3 m) are you held at the edge; each player
    // takes half of the overlap, so between the two it closes exactly, nobody is shoved further, nobody falls
    // (against where they are now, not where they're drawn: drawn 140 ms behind, at riding speed that's more than a metre off)
    const L1 = b[n - 1], L0 = n > 1 ? b[n - 2] : L1, ahead = Math.min(0.3, (now - L1.t) / 1000), span = Math.max(1, L1.t - L0.t) / 1000;
    const nx = L1.a[1] + (L1.a[1] - L0.a[1]) / span * ahead * (L0 !== L1), nz = L1.a[3] + (L1.a[3] - L0.a[3]) / span * ahead * (L0 !== L1);
    if (rider && rider.state !== 'WIPE' && S.state !== 'WIPE' && L1.a[0] !== 'FOOT' && L0.a[0] !== 'FOOT' && L1.a[0] !== 'DECK' && L0.a[0] !== 'DECK') { const dx = rig.position.x - nx, dz = rig.position.z - nz, d = Math.hypot(dx, dz), R0 = 1.3;
      if (d < R0 && d > 0.01) { const k = (R0 - d) / 2; rider.x += dx / d * k; rider.z += dz / d * k; } }
  }
  // name tags: where two would overlap (friends paddling side by side), the nearer friend's shows clearly on top and
  // the farther one's fades back
  tagsOn.sort((p, q) => p.tagD - q.tagD); const placed = [];
  tagsOn.forEach((P, i) => { const hit = placed.some((o) => Math.abs(o.x - P.tagX) < (o.w + P.tagW) / 2 && Math.abs(o.y - P.tagY) < 17);
    placed.push({ x: P.tagX, y: P.tagY, w: P.tagW }); if (hit) P.tag.style.opacity = '0.3';
    P.tag.style.zIndex = String(60 - i);   // (nearer on top, inside their own layer under the game's buttons and tips)
    P.tag.style.transform = `translate(${P.tagX.toFixed(1)}px, ${P.tagY.toFixed(1)}px) translate(-50%, -100%)`; });
}
// the score of a wave on the free beach: a small card for 3 s while you paddle on (his call 30 Sep 2026)
let fsScoreT = 0;
function freeScore(v) {
  let el = document.getElementById('fsScore'); if (!el) { el = document.createElement('div'); el.id = 'fsScore'; el.className = 'hud'; el.innerHTML = '<b></b><small></small>'; document.body.appendChild(el); }
  const judge = v < 2 ? 'Poor' : v < 5 ? 'Fair' : v < 6.5 ? 'Good' : v < 8 ? 'Very good' : v < 10 ? 'Excellent' : 'Perfect';   // (the contest judges' own words, as on the score screen)
  el.querySelector('b').textContent = v.toFixed(1); el.querySelector('small').textContent = judge.toUpperCase();
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); document.body.classList.add('fsScoring'); clearTimeout(fsScoreT); fsScoreT = setTimeout(() => { el.classList.remove('on'); document.body.classList.remove('fsScoring'); }, 3000);
}
function freeJump() {
  if (freeJumping || !isFree() || (!strand && (!rider || rider.state !== 'LIE'))) return;
  freeJumping = true; freeBtn.hidden = true; fadeEl.classList.add('on');
  setTimeout(() => { if (strand) endStrand(); FREE.jump = true; spawnRider(); setTimeout(() => { fadeEl.classList.remove('on'); freeJumping = false; }, 120); }, 380);
}
if (freeBtn) for (const ev of ['pointerup', 'touchend', 'click']) freeBtn.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); freeJump(); }, { passive: false });   // (pointerup: a mouse click on it never arrived as a click while playing)
// ---- the boat (his idea 30 Sep 2026): a platform boat anchored in the channel between the peaks (boat.js). Paddle up
// to its ladder and Climb on; walk round the deck (the walking thumbs and keys, as the villa) to watch your friends
// ride past; Back in the water drops you in by the ladder on your board. It rides the swell passing under it
// where: down the line from the big waves' peak, just seaward of where they're ridden (the ride runs from the peak at
// x -162, z 0 toward x -60, z 120). The channel between the peaks, the first idea, had 3.5-5.5 m faces and whitewater
const BOAT = { x: -52, z: 92 }, _yUp = new THREE.Vector3(0, 1, 0);   // (moved 30 Sep 2026, twice at his notes: at -95, 22 a friend was a speck; at -104, 42 you mostly saw the back of the wave. Here, further down the line, riders come toward you on the face: 6 bot rides in 3 styles, closest 16 m; swell up to 1.7 m, slope .11)
let boat = null, boatNear = false, boatBtn = null;
const _bm = new THREE.Matrix4(), _bi = new THREE.Matrix4(), _bv = new THREE.Vector3();
function boatTick(dt) {
  if (!boat) { boat = makeBoat(); scene.add(boat); boat.userData.y = 0; boat.userData.p = 0; boat.userData.r = 0; }
  boat.visible = true;
  if (FREE.toDeck) { FREE.toDeck = false; if (!strand) { boatDeck(-3); FREE.deckT = T; } }
  // afloat: its height, pitch and roll from the water under its four corners, eased (a heavy boat, not a cork)
  const hb = heightAt(waves, BOAT.x, BOAT.z - 6), hs = heightAt(waves, BOAT.x, BOAT.z + 6), hp = heightAt(waves, BOAT.x - 3, BOAT.z), hq = heightAt(waves, BOAT.x + 3, BOAT.z), u = boat.userData, k = 1 - Math.exp(-4 * dt);
  u.y += ((hb + hs + hp + hq) / 4 - u.y) * k; u.p += (Math.atan2(hb - hs, 12) - u.p) * k; u.r += (Math.atan2(hp - hq, 6) - u.r) * k;
  boat.position.set(BOAT.x, u.y, BOAT.z); boat.rotation.set(u.p, 0, u.r, 'YXZ'); boat.updateMatrixWorld(true);
  const f = boat.userData.flag; if (f) f.rotation.y = Math.PI / 2 + Math.sin(T * 2.3) * 0.25;
}
function boatLocal(x, z) { _bi.copy(boat.matrixWorld).invert(); return _bv.set(x, boat.position.y, z).applyMatrix4(_bi); }
function boatWorld(lx, ly, lz) { return _bv.set(lx, ly, lz).applyMatrix4(boat.matrixWorld); }
function boatBump(r) {   // (paddlers and surfers go round it, never through: pushed out of its footprint the shortest way)
  if (!boat) return; const dx = r.x - BOAT.x, dz = r.z - BOAT.z, m = 0.5;
  if (Math.abs(dx) > HALF.x + m || Math.abs(dz) > HALF.z + m) return;
  const ox = HALF.x + m - Math.abs(dx), oz = HALF.z + m - Math.abs(dz);
  if (ox < oz) r.x += Math.sign(dx || 1) * ox; else r.z += Math.sign(dz || 1) * oz;
  if (r.v) r.v *= 0.5;
}
// the buttons top right, one under the other (his call 30 Sep 2026): Go to lineup, Go to boat (from anywhere in the
// water), Climb on (at its ladder) or Back in the water (on deck), then the list of who's on the beach
let boatFar = null;
function boatBtnTick() {
  if (!boatBtn) { const tr = document.getElementById('fsTR') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'fsTR' }));
    if (freeBtn) tr.appendChild(freeBtn);
    const mk = (id, fn, icon) => { const b = document.createElement('div'); b.className = 'ctl'; b.id = id; b.hidden = true; b.innerHTML = icon + '<span></span>'; tr.appendChild(b);
      for (const ev of ['pointerup', 'touchend', 'click']) b.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); return b; };
    const ic = (d) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
    boatFar = mk('boatGo', () => boatGo(true), ic('M2 10h12l-2 3H4zM8 10V3l4 5H8'));   // (a little boat with a sail)
    boatBtn = mk('boatBtn', () => boatGo(false), ic('M5 14V3M11 14V3M5 6h6M5 10h6')); }   // (a ladder)
  const r = rider, onDeck = !!(strand && strand.deck), lying = isFree() && !!boat && !freeJumping && !onDeck && !!r && r.state === 'LIE';
  boatNear = lying && Math.hypot(r.x - BOAT.x - LADDER.x, r.z - BOAT.z - LADDER.z) < 5;
  const far = lying && !boatNear && Math.hypot(r.x - BOAT.x, r.z - BOAT.z) > 15;
  const set = (b, on, t) => { if (b.hidden === on) b.hidden = !on; const sp = b.lastChild; if (on && sp.textContent !== t) sp.textContent = t; };
  set(boatFar, far, 'GO TO BOAT');
  const edge = onDeck && !!boatEdge();   // ('Back in the water' is gone, his call 30 Sep 2026: on deck you jump in from any edge you're facing out over)
  set(boatBtn, isFree() && !freeJumping && (boatNear || edge), edge ? 'JUMP IN' : 'CLIMB ON');
}
const DECK_SPOTS = [[0, -3], [-0.5, -4.6], [0.3, -1.0], [2.2, -3.4], [-1.6, -1.6], [-2.2, -0.2]];   // (clear of the beanbags, the cooler and the rope)
const deckTaken = () => [...peers.values()].map((P) => P.buf.length && P.buf[P.buf.length - 1].a).filter((a) => a && a[0] === 'DECK');
function boatDeck(lz) {   // (on deck at the first spot nobody's standing on: friends arriving together used to stand inside each other, his catch 30 Sep 2026)
  let lx = 0; if (lz === -3) { const taken = deckTaken();
    const free = DECK_SPOTS.find(([x, z]) => !taken.some((a) => Math.hypot(a[1] - x, a[3] - z) < 1)) || DECK_SPOTS[(Math.random() * DECK_SPOTS.length) | 0]; lx = free[0]; lz = free[1]; }
  startStrand(BOAT.x, BOAT.z + 3, -2.4); strand.deck = true; strand.lx = lx; strand.lz = lz; strand.pitch = -0.08; strand.arr = T; strand.chk = T + 0.6 + Math.random() * 0.6; }
// just arrived and standing inside a friend (you both came on before hearing where the other stood: the usual case when
// a friend joins, since you arrive before their first message): step to a free spot, picked at random so two of you
// don't both hop to the same one; checked at random moments for the first 6 s, only until you walk off yourself
function deckSpread(W_) {
  if (!W_.arr || T - W_.arr > 6 || T < W_.chk) return; W_.chk = T + 0.4 + Math.random() * 0.8;
  const taken = deckTaken(); if (!taken.some((a) => Math.hypot(a[1] - W_.lx, a[3] - W_.lz) < 0.8)) return;
  const free = DECK_SPOTS.filter(([x, z]) => !taken.some((a) => Math.hypot(a[1] - x, a[3] - z) < 1) && Math.hypot(W_.lx - x, W_.lz - z) > 0.5);
  if (free.length) { const f = free[(Math.random() * free.length) | 0]; W_.lx = f[0]; W_.lz = f[1]; }
}   // (on deck, looking up the line toward the peak, where the rides come from)
// at an edge of the deck, looking out over the water: which side, and where you land (just clear of the hull, facing out)
function boatEdge() {
  const W_ = strand; if (!W_ || !W_.deck || W_.jump) return null; const fx = Math.cos(W_.yaw), fz = Math.sin(W_.yaw), e = 0.5;
  if (W_.lx <= DECK.x0 + 0.3 + e && fx < -0.55) return { lx: -(HALF.x + 1.4), lz: W_.lz, th: Math.atan2(fz, fx) };
  if (W_.lx >= DECK.x1 - 0.3 - e && fx > 0.55) return { lx: HALF.x + 1.4, lz: W_.lz, th: Math.atan2(fz, fx) };
  if (W_.lz <= DECK.z0 + 0.3 + e && fz < -0.55) return { lx: W_.lx, lz: -(HALF.z + 1.4), th: Math.atan2(fz, fx) };
  if (W_.lz >= DECK.z1 - 0.2 - e && fz > 0.55) return { lx: W_.lx, lz: HALF.z + 1.4, th: Math.atan2(fz, fx) };
  return null;
}
function boatGo(far) {
  if (freeJumping || !isFree() || !boat) return; const onDeck = !!(strand && strand.deck);
  if (far ? onDeck || !rider || rider.state !== 'LIE' : !onDeck && !boatNear) return;
  if (onDeck && !far) { const E = boatEdge(); if (E) { strand.jump = { t: 0, ...E, x0: strand.lx, z0: strand.lz }; boatBtn.hidden = true; } return; }   // (Jump in: played by deckTick, no fade)
  freeJumping = true; boatBtn.hidden = true; boatFar.hidden = true; fadeEl.classList.add('on');
  setTimeout(() => {
    boatDeck(far ? -3 : 4.4);
    setTimeout(() => { fadeEl.classList.remove('on'); freeJumping = false; }, 120);
  }, 380);
}
function deckTick(dt, W_) {
  if (W_.jump) {   // jumping in (his call 30 Sep 2026): off the edge in a short arc, a splash, and you're lying on your board right there
    const J = W_.jump; J.t += dt; const k = Math.min(1, J.t / 0.6), lx = J.x0 + (J.lx - J.x0) * k, lz = J.z0 + (J.lz - J.z0) * k;
    const top = DECK_Y + 1.65, y = top + 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.15)) - (top - 0.2) * k * k;
    const p = boatWorld(lx, y, lz); camera.position.copy(p); _pe.set(W_.pitch - 0.5 * k, -W_.yaw - Math.PI / 2, 0); camera.quaternion.setFromEuler(_pe);
    if (k >= 1) { const q = boatWorld(J.lx, 0, J.lz); FREE.walkIn = { x: q.x, z: q.z, th: J.th }; endStrand(); spawnRider(); audio.splash(0.5); }
    return;
  }
  const kx = inputLock ? 0 : (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), kz = inputLock ? 0 : (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const mx = W_.mx || kx, mz = W_.mz || kz, fx = Math.cos(W_.yaw), fz = Math.sin(W_.yaw), sp = 1.6 * dt;   // (the boat points along z, not turned: world steps are its steps)
  W_.lx = Math.max(DECK.x0 + 0.3, Math.min(DECK.x1 - 0.3, W_.lx + (fx * mz - fz * mx) * sp)); W_.lz = Math.max(DECK.z0 + 0.3, Math.min(DECK.z1 - 0.2, W_.lz + (fz * mz + fx * mx) * sp));
  for (const [x0, x1, z0, z1] of BLOCKS) { const r = 0.3; if (W_.lx > x0 - r && W_.lx < x1 + r && W_.lz > z0 - r && W_.lz < z1 + r) {   // (round the things on deck, not through them: out the nearest side)
    const o = [W_.lx - (x0 - r), x1 + r - W_.lx, W_.lz - (z0 - r), z1 + r - W_.lz], m = Math.min(...o), i = o.indexOf(m); if (i === 0) W_.lx -= m; else if (i === 1) W_.lx += m; else if (i === 2) W_.lz -= m; else W_.lz += m; } }
  const moving = Math.hypot(mx, mz) > 0.1; if (moving) W_.arr = 0; else deckSpread(W_); W_.bob = (W_.bob || 0) + (moving ? dt * 8 : 0);
  const p = boatWorld(W_.lx, DECK_Y + 1.65 + (moving ? Math.sin(W_.bob) * 0.02 : 0), W_.lz); W_.x = p.x; W_.z = p.z; W_.y = p.y;
  camera.position.copy(p); _pe.set(W_.pitch + boat.rotation.x * 0.5, -W_.yaw - Math.PI / 2, boat.rotation.z * 0.5); camera.quaternion.setFromEuler(_pe);   // (half the boat's rock reaches your eyes)
  setText(ui.hint, FREE.deckT !== undefined && T - FREE.deckT < 10 ? 'Walk to the edge of the boat and jump in' : ''); freeOut();
}
// ---- the free-surf beach on foot (his layout): you arrive on the sand, walk into the water and drop onto your board to
// paddle out; paddle into the shallows and you stand up and walk out again. Same thumbs and keys as the villa (left
// thumb walks, right thumb looks; WASD or arrows, mouse drag to look)
let strand = null;
const _gr = new THREE.Raycaster(), _gDown = new THREE.Vector3(0, -1, 0), _gO = new THREE.Vector3();
function groundAt(x, z) {   // the beach under a point (sand, rock), by a ray down onto the spot; far below if it's open sea
  _gO.set(x, 40, z); _gr.set(_gO, _gDown); _gr.far = 80; const h = _gr.intersectObject(spotGroup(scene, 'free'), true)[0];
  return h ? h.point.y : -20;
}
function shoreZ(x) { spotGroup(scene, 'free').updateMatrixWorld(true); for (let z = REEF.zBeach - 60; z < REEF.zBeach + 90; z += 2) if (groundAt(x, z) > 0.35) return z; return REEF.zBeach + 46; }   // (the beach not built yet: where it will be; freshly built it's moved into place first, above: before its first frame it sat 90 m out to sea)   // (where the sand comes out of the water)
function offSand(x, z) { for (let k = 0; k < 60 && groundAt(x, z) > heightAt(waves, x, z) - 0.9; k++) z -= 1; return z; }   // (the nearest spot out from here with water deep enough to lie on your board: the shallows reach well past where the old fixed line put you back)
function startStrand(x, z, yaw) {
  if (surfer) endWipe(); if (rider) FREE.rider = rider; rider = null; rig.visible = false; endT = -1; ui.msg.style.display = 'none';
  const g = groundAt(x, z); strand = walker = { x, z, yaw, pitch: -0.1, y: Math.max(g, 0) + 1.65, mx: 0, mz: 0, g, gT: 0 };
  document.body.classList.add('strand'); document.body.classList.remove('riding');
}
function endStrand() { strand = null; walker = null; rider = rider || FREE.rider; rig.visible = true; document.body.classList.remove('strand'); }
function strandTick(dt) {
  updateWaves(dt); railSpray.update(dt); wake.update(dt); track.update(dt);
  const W_ = strand;
  if (W_.deck) { deckTick(dt, W_); return; }
  const kx = inputLock ? 0 : (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), kz = inputLock ? 0 : (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  if ((W_.gT -= dt) <= 0) { W_.gT = 0.08; W_.g = groundAt(W_.x, W_.z); }
  const sea = heightAt(waves, W_.x, W_.z), depth = W_.g > -19 ? sea - W_.g : 1.5, wading = depth > 0.05;   // (past the end of the sand the beach mesh stops: open water, deep enough to paddle)
  const mx = W_.mx || kx, mz = W_.mz || kz, fx = Math.cos(W_.yaw), fz = Math.sin(W_.yaw), sp = (wading ? 1.3 : 2.6) * dt;
  W_.x = Math.max(-190, Math.min(210, W_.x + (fx * mz - fz * mx) * sp)); W_.z = Math.min(REEF.zBeach + 70, W_.z + (fz * mz + fx * mx) * sp);
  // deep enough (about waist deep): onto your board and paddling, facing where you were walking
  if (depth > 0.8) { FREE.walkIn = { x: W_.x, z: W_.z, th: Math.atan2(fz, fx) }; endStrand(); spawnRider(); audio.splash(0.3); return; }
  const moving = Math.hypot(mx, mz) > 0.1; if (moving) W_.arr = 0; else deckSpread(W_); W_.bob = (W_.bob || 0) + (moving ? dt * 8 : 0);
  const eye = Math.max(W_.g, sea - 0.4) + 1.65 + (moving ? Math.sin(W_.bob) * (wading ? 0.015 : 0.025) : 0);
  W_.y += (eye - W_.y) * Math.min(1, dt * 8);
  camera.position.set(W_.x, W_.y, W_.z); _pe.set(W_.pitch, -W_.yaw - Math.PI / 2, 0); camera.quaternion.setFromEuler(_pe);
  if (wading && moving && (W_.splT = (W_.splT || 0) - dt) <= 0) { W_.splT = 0.55; audio.splash(0.08); }
  setText(ui.hint, depth < -0.2 ? 'Walk into the water to paddle out' : '');
  freeOut();
}
// the next wave that hasn't reached you yet, and how many seconds until its face gets to you
function incoming() {
  let best = null, tBest = 1e9;
  for (const w of waves) {
    const zl = rider.z - w.zW; if (zl < -2) continue;                 // already past you
    if (w.zone && (rider.x < w.pkX - 25 || rider.x > w.xEnd + 10 || w.zone.z - rider.z > 40)) continue;   // (the free-surf beach: a wave breaking somewhere else along it isn't yours, nor an inside wave still rolling in under you as swell)
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
  if (isFree()) {   // the free-surf beach (his call 30 Sep 2026, option 2): no teleporting. After a wave you come up where you are and
    // paddle back out yourself (your friends see you do it); the first time, and when you tap Paddle out, you're at a peak's lineup
    const lx = rider.x ?? FREE[0].x, lz = rider.z ?? 0;
    if (FREE.fresh && !/[?&]fsw=1\b/.test(location.search)) {   // arriving: lying on your board in the shallows at the channel, facing the sea (his call 30 Sep 2026: no walk from the sand; ?fsw=1 = at the outside peak)
      const zs = shoreZ(6); let z = zs - 4; while (z > zs - 40 && groundAt(6, z) > -1.2) z -= 1; z -= 14;   // (well clear of the sand's edge: right at it, the first bit of whitewater washed you up onto your feet)
      rider.reset(6, z, -Math.PI / 2); FREE.arriveT = T; FREE.fresh = false; FREE.jump = false; ui.msg.style.display = 'none';
      FREE.toDeck = true; return;   // (then straight onto the boat's front deck, his call 30 Sep 2026: everyone arrives there, walks to the edge and jumps in; boatTick does it once the boat exists)
    }
    if (FREE.climb) { const c = FREE.climb; FREE.climb = null; { const x = Math.max(-185, Math.min(205, c.x)); rider.reset(x, offSand(x, c.z), -Math.PI / 2); } FREE.fresh = false; FREE.jump = false; ui.msg.style.display = 'none'; return; }   // (after a wipeout: back on your board where it floated)
    if (FREE.walkIn) { rider.reset(FREE.walkIn.x, FREE.walkIn.z, FREE.walkIn.th); FREE.walkIn = null; FREE.fresh = false; FREE.jump = false; ui.msg.style.display = 'none'; return; }   // (walked into the water: on your board right there)
    if (FREE.fresh || FREE.jump) {
      const near = FREE[0];   // (always the big waves, his call 30 Sep 2026: one place every time, so everyone knows where Go to lineup takes them; it used to pick the nearer peak)
      rider.reset(near.x + 4, near.z - 8.5, -Math.PI / 2);   // (the same spot every time; friends arriving together are kept apart by the no-overlap rule)
    } else { const x = Math.max(-185, Math.min(205, lx)); rider.reset(x, offSand(x, lz), -Math.PI / 2); }   // (right where the wave left you; back off the sand if it washed you all the way in)
    const fresh = FREE.fresh; FREE.fresh = false; FREE.jump = false;
    if (!fresh) { ui.msg.style.display = 'none'; return; }   // (a shared beach: nobody's waves are held back for you, only on arrival)
  } else rider.reset(2 + Math.random() * 4, -7 - Math.random() * 3, -Math.PI / 2);
  // don't drop a wave on your head as you arrive
  // don't drop a wave on your head as you arrive: hold back every wave that hasn't reached you yet
  { const inc = incoming(); if (inc.t < 7) { const shift = 7 - inc.t;
      for (const w of waves) if (rider.z - w.zW >= -2) { w.tBreak += shift; if (w.px !== undefined) w.px -= w.cond.peel * shift; }   // (its break point too, or it breaks down the reef)
      nextBreak += shift; } }
  ui.msg.style.display = 'none';
}

// ---------- the Sumba Ranch: you order each wave. The machine starts it at the deep end a few seconds out, it runs down
// the pool past you, and you can order the next one once it has gone by.
const ranchWaiting = () => isRanch() && rider && !rider.standing && rider.state === 'LIE' && !waves.some((w) => w.zW < rider.z + 4);
let ranchLock = null;   // (a multiplayer contest at the pool: the host picked the wave, so every order is that wave)
function lockRanch(k) { ranchLock = k || null; if (ranchLock) ranchKind = ranchLock; for (const b of document.querySelectorAll('#ranch button')) b.style.display = ranchLock && b.dataset.wave !== ranchLock ? 'none' : ''; }
function ranchSend(kind) {
  if (!ranchWaiting()) return;
  if (ranchLock) kind = ranchLock;
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
  // the buoys ride up and over each wave as it runs past them
  { const B = ranchW.buoys, N = ranchW.bands; for (let i = 0; i < ranchW.buoyX.length; i++) { const x = ranchW.buoyX[i], y = heightAt(waves, x, ranchW.BZ);
      _rm.makeTranslation(x, y + 0.12, ranchW.BZ); B.setMatrixAt(i, _rm); _rm.makeTranslation(x, y + 0.2, ranchW.BZ); N.setMatrixAt(i, _rm); }
    B.instanceMatrix.needsUpdate = true; N.instanceMatrix.needsUpdate = true; }
  // the crowd goes up for a barrel or a big move
  if (rider && rider.trick && rider.trick !== cheerFor && /^(BIG|DEEP) |BARREL|ROUNDHOUSE|HANG TEN|AIR/.test(rider.trick.name)) { cheerFor = rider.trick; audio.cheer(/^(BIG|DEEP) |ROUNDHOUSE|AIR 360/.test(rider.trick.name) ? 1 : 0.7); }
  try { ranchPeople(dt); } catch (e) { if (!ranchPeople.err) { ranchPeople.err = 1; console.error('ranch people', e); } }
  // the pool walls: you can't paddle through them
  if (rider) { const m = 3; rider.x = Math.min(POOL.x1 - m, Math.max(POOL.x0 + m, rider.x)); rider.z = Math.min(POOL.z1 - m, Math.max(POOL.z0 + m, rider.z)); }
}
const _rc = new THREE.Color(), _rm = new THREE.Matrix4(); let cheerFor = null;
// people round the pool: your villa friends' bodies (Rocketbox, see loadPeople), standing about the deck in groups,
// facing the water, with their small idle movements. Never near the camera: they're scenery, 20 m and more away
let crowd = null;
// Rocketbox people come in their modelling pose, arms out from the sides: let them hang down, a little forward, the
// elbows soft (turned in world space, from the shoulder toward the elbow and the elbow toward the wrist)
const _rkA = new THREE.Vector3(), _rkB = new THREE.Vector3(), _ranchQ = new THREE.Quaternion(), _rkP = new THREE.Quaternion(), _rkW = new THREE.Quaternion();
function aimRanch(bone, child, want) {
  bone.updateMatrixWorld(true); bone.getWorldPosition(_rkA); child.getWorldPosition(_rkB); const d = _rkB.sub(_rkA).normalize();
  _ranchQ.setFromUnitVectors(d, want); bone.getWorldQuaternion(_rkW); _rkW.premultiply(_ranchQ); bone.parent.getWorldQuaternion(_rkP); bone.quaternion.copy(_rkP.invert().multiply(_rkW)); bone.updateMatrixWorld(true);
}
function relaxArms(body, B) {
  body.updateMatrixWorld(true); const g = (n) => B['Bip01_' + n] || B['Bip01 ' + n.replace(/_/g, ' ')];
  const fq = body.getWorldQuaternion(new THREE.Quaternion()), side = new THREE.Vector3(1, 0, 0).applyQuaternion(fq), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(fq);
  for (const [s, sg] of [['L', 1], ['R', -1]]) { const up = g(s + '_UpperArm'), fo = g(s + '_Forearm'), ha = g(s + '_Hand'); if (!up || !fo || !ha) continue;
    // (which way is 'out' for this arm: from the spine toward the shoulder)
    const out = fo.getWorldPosition(new THREE.Vector3()).sub(up.getWorldPosition(new THREE.Vector3())); const k = Math.sign(out.dot(side)) || sg;
    aimRanch(up, fo, new THREE.Vector3(0, -1, 0).addScaledVector(side, 0.17 * k).addScaledVector(fwd, 0.06).normalize());
    aimRanch(fo, ha, new THREE.Vector3(0, -1, 0).addScaledVector(side, 0.08 * k).addScaledVector(fwd, 0.28).normalize()); }
}
// the rows behind the front one: cut-outs of the same people (each drawn once, from the front, into a texture), stood
// on the deck facing the water. At 20 m and more across the pool they read as a crowd, for next to nothing
function crowdBack(ids) {
  const back = ranchW.back; if (!back || !back.length) return;
  const s2 = new THREE.Scene(); s2.add(new THREE.HemisphereLight(0xfff4e6, 0x6d6252, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(0.6, 1.4, 1.2); s2.add(dl);
  const cam = new THREE.OrthographicCamera(-0.56, 0.56, 1.98, -0.06, 0.1, 10); cam.position.set(0, 0.96, 4); cam.lookAt(0, 0.96, 0);
  const prevRT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  const geo = new THREE.PlaneGeometry(1.12, 2.04); geo.translate(0, 0.96, 0); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const per = ids.map(() => []); back.forEach((b, i) => per[i % ids.length].push(b));
  ids.forEach((id, n) => {
    const body = cloneSkinned(people[id]); const B = {}; body.traverse((o) => { if (o.isBone) B[o.name] = o; if (o.isMesh) o.frustumCulled = false; }); s2.add(body); body.updateMatrixWorld(true);
    const hd = B.Bip01_Head, le = B.Bip01_LEye, re = B.Bip01_REye; if (hd && le && re) { const hp = hd.getWorldPosition(new THREE.Vector3()), ep = le.getWorldPosition(new THREE.Vector3()).add(re.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5).sub(hp); body.rotation.y = -Math.atan2(ep.x, ep.z); }
    relaxArms(body, B);
    const rt = new THREE.WebGLRenderTarget(160, 290); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(s2, cam); s2.remove(body);
    const list = per[n]; if (!list.length) return;
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: rt.texture, alphaTest: 0.5 }), list.length);
    list.forEach(([x, z, yaw, lift], i) => { q.setFromAxisAngle(Y, yaw + (Math.random() - 0.5) * 0.4); sc.setScalar(0.94 + Math.random() * 0.1); pos.set(x, POOL.deck + (lift || 0), z); inst.setMatrixAt(i, m4.compose(pos, q, sc)); });
    ranchW.group.add(inst);
  });
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevC, prevA);
}
function ranchPeople(dt) {
  if (!crowd) { if (!people) return; crowd = [];
    const ids = Object.keys(people), CL = { kai: ['m_idle_neutral_01', 'm_idle_look_around_01'], wayan: ['m_idle_neutral_02'], nando: ['m_idle_neutral_03'], rudi: ['m_idle_neutral_02', 'm_idle_look_around_01'], putu: ['m_idle_neutral_01'], belle: ['f_idle_neutral_01', 'f_idle_look_around_01'] };
    ranchW.seats.forEach(([x, z], i) => { const id = ids[i % ids.length], body = cloneSkinned(people[id]), root = new THREE.Group(); root.add(body); ranchW.group.add(root);
      const B = {}; body.traverse((o) => { if (o.isMesh) o.castShadow = false; if (o.isBone) B[o.name] = o; });   // (left to frustum culling: they barely move, so their bounds hold, and the ones behind you cost nothing)
      body.updateMatrixWorld(true); const hd = B.Bip01_Head || B['Bip01 Head'], le = B.Bip01_LEye || B['Bip01 LEye'], re = B.Bip01_REye || B['Bip01 REye'];
      if (hd && le && re) { const hp = hd.getWorldPosition(new THREE.Vector3()), ep = le.getWorldPosition(new THREE.Vector3()).add(re.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5).sub(hp); body.rotation.y = -Math.atan2(ep.x, ep.z); }   // (turned to face +z, as the villa does it)
      relaxArms(body, B);
      const rest = []; body.traverse((o) => { if (o.isBone) rest.push([o, o.position.clone(), o.quaternion.clone()]); });
      const yaw = x < POOL.x0 ? Math.PI / 2 : x > POOL.x1 ? -Math.PI / 2 : Math.PI;   // (facing the water: from the start end, the far end or the beach deck)
      root.position.set(x, POOL.deck, z); root.rotation.y = yaw + (Math.random() - 0.5) * 0.5;
      crowd.push({ root, rest, lf: life ? lifeIdle(life, B, CL[id] || ['m_idle_neutral_01']) : null }); });
    crowdBack(ids); renderer.compile(scene, camera); }
  for (const P of crowd) { if (!P.lf) continue; if (P.root.position.distanceToSquared(camera.position) > 160 * 160 && P.posed) continue; P.posed = true;
    for (const [b, p, q] of P.rest) { b.position.copy(p); b.quaternion.copy(q); } P.lf.update(dt); P.lf.apply(1, 1); }
}

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
const DESK_WORDS = [['Slide your thumb left and right to carve, like a steering wheel', 'Carve with the left and right arrows: tap for a small turn, hold for a hard one'], ['Let go and the board just glides straight', 'Let go of the keys and the board just glides straight'],
  ['PUMP and steer', 'Hold Space and steer'], ['hold PUMP', 'hold Space'], ['Hold PUMP', 'Hold Space'], ['tap PUMP', 'tap Space'], ['Tap PUMP', 'Tap Space'], ['STALL', 'Shift'], ['Paddle now!', 'Paddle now! (Space)'], ['Paddle hard!', 'Paddle hard! (hold Space)'], ['Keep paddling!', 'Keep paddling! (Space)'],
  ['Wave coming: turn to face', 'Wave coming: use the arrow keys to face']];
const deskHint = (h) => { for (const [a, b] of DESK_WORDS) if (h.includes(a)) h = h.replace(a, b); return h; };
const hold = (el, on, off) => {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); on(e); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); if (e.targetTouches.length === 0) off(e); }, { passive: false });
  el.addEventListener('touchcancel', (e) => { e.preventDefault(); if (e.targetTouches.length === 0) off(e); }, { passive: false });
  el.addEventListener('mousedown', on); addEventListener('mouseup', off);
};
if (DESK) ui.stall.innerHTML = 'STALL<small>SHIFT</small>';   // (Shift only, his call 28 Sep 2026: one stall key, no confusion)
hold(ui.paddle, () => { audio.wake(); input.paddleBtn = true; ui.paddle.classList.add('down'); }, () => { input.paddleBtn = false; ui.paddle.classList.remove('down'); });
hold(ui.stall, () => { audio.wake(); input.stallBtn = true; ui.stall.classList.add('down'); }, () => { input.stallBtn = false; ui.stall.classList.remove('down'); });
// thumb: touch anywhere on the right half and drag; the spot you first touch is the centre.
// Left/right turns the board left/right, like leaning on a real board: lying, it points you where you paddle; standing, it carves.
let keyLean = 0; const KEY_START = 0.3, KEY_FULL = 0.6;   // (0.35 to a full lean until 28 Sep 2026: held keys gave the hardest carve every time, his call: gentler and smoother)           // (arrow keys: the lean a press starts at, seconds held to a full lean)
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
  const kraw = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  // keys are on or off, a thumb isn't: standing, a press eases in to a third of a lean in 0.1 s (a quick tap trims ~7 deg
  // on a shortboard) and holding builds to a full carve by ~0.6 s; letting go
  // straightens in ~0.4 s. Long and gun stay slow because the boards are (the keys match the thumb on them too).
  // Lying down the keys still turn the board at once, as before
  const kStand = !!(rider && rider.standing);
  if (!kStand || !kraw) keyLean = kStand ? keyLean * Math.max(0, 1 - dt * 8) : kraw;   // (let go: back to straight in ~0.4 s, was ~0.3)
  else {   // (29 Sep 2026, his call: no jolt. A press eases in to that first third over 0.1 s instead of jumping there, and a
    // change of side swings back through straight at the same quick rate instead of snapping across; still full by ~0.6 s)
    const k0 = KEY_START, EASE = 0.1, ramp = (1 - k0) / (KEY_FULL - EASE);
    if (Math.sign(keyLean) !== kraw) keyLean += kraw * dt * (k0 / EASE) * 2;   // (coming back from the other side: through straight in a blink)
    else if (Math.abs(keyLean) < k0) keyLean += kraw * dt * (k0 / EASE);
    else keyLean += kraw * dt * ramp;
    keyLean = Math.max(-1, Math.min(1, keyLean)); }
  const kx = Math.abs(keyLean) < 0.02 ? 0 : keyLean;
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
  if (FREE.follow) freeFollowTick(Math.abs(sx) > 0.05 || input.paddle);
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

// ---------- score levels: what a wave's score makes you, the same at every spot (they replaced the challenges, his call
// 28 Sep 2026). Your best wave at a spot sets your level there; the menu shows it, arriving shows all three, the score
// screen says which one each wave reached and how far the next is
const LEVELS = [['Amateur', 5, '5.0 to 6.9'], ['Advanced', 7, '7.0 to 8.4'], ['Pro Surfer', 8.5, '8.5 and up']];
const levelOf = (v) => { let k = -1; LEVELS.forEach(([, t], i) => { if (v >= t) k = i; }); return k; };
// your best ride per level, kept on this phone (quietly does nothing if storage is blocked)
// (best8: the tougher top end and the perfect 10 of 30 Sep 2026 evening started everyone's bests afresh, his call; best7 that morning, best6 (29 Sep), best5, best4 before 28 Sep)
const bestFor = (m) => { try { return +localStorage.getItem('balisurf.best8.' + m) || 0; } catch (e) { return 0; } };
const saveBest = (m, v) => { try { localStorage.setItem('balisurf.best8.' + m, String(v)); } catch (e) {} showBests(); if (typeof mmPanel === 'function') mmPanel(); };
// moments other code can listen for (the Wavedash copy's saves, badges and leaderboards; on sumbasurf.app nothing listens)
const ssEvent = (n, d) => { try { dispatchEvent(new CustomEvent('ss:' + n, { detail: d })); } catch (e) {} };
function showBests() {
  for (const b of document.querySelectorAll('[data-mode]')) {
    let el = b.querySelector('.best'); const v = bestFor(b.dataset.mode);
    if (!el) { el = document.createElement('em'); el.className = 'best'; b.appendChild(el); }
    const lv = levelOf(v); el.innerHTML = v ? `<b>${v.toFixed(1)}</b>${lv >= 0 ? LEVELS[lv][0] : 'best wave'}` : '';
  }
}
showBests();
// the menu: each spot's three dots light up to the level your best wave there reached
function levelDots() {
  for (const b of document.querySelectorAll('[data-mode]')) {
    const m = b.dataset.mode;
    let el = b.querySelector('.chd'); if (!el) { el = document.createElement('i'); el.className = 'chd'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<b></b><b></b><b></b>'; b.appendChild(el); }
    const lv = levelOf(bestFor(m)); [...el.children].forEach((d, i) => d.classList.toggle('on', i <= lv));
  }
}
levelDots();
globalThis.ssRefreshBests = () => { showBests(); levelDots(); if (typeof mmPanel === 'function') try { mmPanel(); } catch (e) {} };   // (the Wavedash copy's cloud save can come back after the menu is up)
const chalBox = document.getElementById('chal'), chalBan = document.getElementById('chalDone');
const TICK = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.8 8.3l2.2 2.2 4.2-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RING = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
let chalHideT = null;
// arriving at a spot: the three levels and the scores they need, ticked where you've already made it, then out of the way
function levelIntro(m) {
  if (!chalBox) return; const lv = levelOf(bestFor(m));
  chalBox.innerHTML = `<b>Score levels</b>` + LEVELS.map(([name, , range], i) => `<div class="${i <= lv ? 'ok' : ''}">${i <= lv ? TICK : RING}<span>${name}</span><em>${range}</em></div>`).join('');
  chalBox.classList.add('on'); clearTimeout(chalHideT); chalHideT = setTimeout(() => chalBox.classList.remove('on'), 4500);
}
function chalHide() { if (chalBox) chalBox.classList.remove('on'); clearTimeout(chalHideT); }
let chalBanT = null;
function levelWin(name) {
  if (!chalBan) return;
  chalBan.innerHTML = `<small>New level at ${modeName(mode)}</small>${name}`; chalBan.classList.remove('on'); void chalBan.offsetWidth; chalBan.classList.add('on');
  clearTimeout(chalBanT); chalBanT = setTimeout(() => chalBan.classList.remove('on'), 2600);
}

// the spots only select (the one you'll surf lights up and is remembered); START SURFING takes you there
let spotSel = 'easy'; try { const v = localStorage.getItem('sumbasurf.spot'); if (v && document.querySelector(`[data-mode="${v}"]`)) spotSel = v; } catch (e) {}
const spotLabel = (m) => m === 'ranch' ? 'Sumba Ranch' : (SPOTS[m] && SPOTS[m].name) || m;
function selSpot(m) { spotSel = m; try { localStorage.setItem('sumbasurf.spot', m); } catch (e) {}
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('sel', b.dataset.mode === m);
  document.getElementById('goSpot').textContent = spotLabel(m); mmPanel(); mpSel(null); }
// the multiplayer modes at the top of the spot list (his design 30 Sep 2026). On Wavedash its own code opens each one
// (wavedash/src: freeroom.js, contest.js) on the 'ss:mp' event; here on sumbasurf.app they show the Wavedash invite
function mpSel(k) { for (const id of ['mpFree', 'mpCont']) { const b = document.getElementById(id); if (b) b.classList.toggle('sel', !!k && b.id === (k === 'free' ? 'mpFree' : 'mpCont')); }
  if (!k) document.body.classList.remove('fsOpen', 'fsNewOpen');
  if (k) for (const b of document.querySelectorAll('#start .spotList [data-mode]')) b.classList.remove('sel'); }
for (const [id, k] of [['mpFree', 'free'], ['mpCont', 'contest']]) { const b = document.getElementById(id); if (b) onTap(b, () => {
  if (globalThis.Wavedash || /wavedashcdn/.test(location.hostname)) { mpSel(k); dispatchEvent(new CustomEvent('ss:mp', { detail: k })); }
  else if (globalThis.__invite) globalThis.__invite(); }); }
window.__mpSel = mpSel;
// the menu's big panel: the chosen spot, what it's like, your level there, the boards the board notes recommend for it,
// and its wave drawn to scale beside a 1.8 m surfer (the size in its description; the pool's wave is ordered, so none)
// the list's wave icons: each glyph drawn in a wide strip for the old tiles; cropped to the wave so it shows in a small icon
// (the bigger waves stay bigger)
function mmGlyphs() { for (const g of document.querySelectorAll('#start .spotList [data-mode] .wg')) { const p = g.querySelector('path[fill]'); if (!p) continue; try { const bb = p.getBBox(); if (bb.width) g.setAttribute('viewBox', `0 0 ${Math.max(22, bb.x + bb.width + 3).toFixed(1)} 30`); g.setAttribute('preserveAspectRatio', 'xMidYMax meet'); } catch (e) {} } }
setTimeout(mmGlyphs, 0);
function mmPanel() {
  const m = spotSel, b = document.querySelector(`[data-mode="${m}"]`), $ = (id) => document.getElementById(id); if (!b || !$('mmBig')) return;
  const sm = b.querySelector('small'), lvl = sm && sm.querySelector('i') ? sm.querySelector('i').textContent : '', desc = sm ? [...sm.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '';
  const name = b.querySelector('.nm').textContent;
  $('mmKick').textContent = lvl; $('mmBig').textContent = name; $('mmKick').classList.toggle('nite', m === 'bintang'); $('mmDesc').textContent = desc ? desc + '.' : '';
  const v = bestFor(m), lv = levelOf(v), nx = LEVELS[lv + 1], dots = `<i>${[0, 1, 2].map((i) => `<b${i <= lv ? ' class="on"' : ''}></b>`).join('')}</i>`;
  $('mmLvl').innerHTML = v ? `<span class="chip">${dots}${lv >= 0 ? LEVELS[lv][0] : 'No level yet'}</span><span>Your best ${v.toFixed(1)}${nx ? `  \u00b7  ${(nx[1] - v).toFixed(1)} more for ${nx[0]}` : ''}</span>` : '<span>No waves here yet</span>';
  const best = Object.keys(BOARD_INFO).filter((t) => BOARD_INFO[t][2].includes(name) || (m === 'ranch' && /Ranch/.test(BOARD_INFO[t][2]))), bb = best.map((t) => BOARD_INFO[t][0]);
  $('mmBB').innerHTML = bb.length ? `Best boards here: <b>${bb.join(', ')}</b>` : '';
  for (const k of document.querySelectorAll('#boards [data-board]')) k.classList.toggle('best', best.includes(k.dataset.board));   // (and a BEST tag on those boards in the picker: seen on a phone too, where the line above is hidden)
  const hm = desc.match(/([\d.]+) m\b/), h = hm ? +hm[1] : 0;
  if (m === 'ranch' || !h) { $('mmScale').innerHTML = '<svg viewBox="0 0 200 240" aria-hidden="true"><text x="100" y="128" text-anchor="middle" fill="rgba(246,236,220,.55)" font-family="Barlow Condensed" font-weight="700" font-size="20" letter-spacing="2">YOU PICK THE WAVE</text></svg>'; return; }
  // one wave shape, the 15 m one, shrunk evenly for smaller spots: the size you see is the real size next to you
  const base = 222, k = Math.min(1, h / 15), H = 200, top = base - H, man = 200 * (1.8 / 15), topK = base - H * k, Y = (f) => (top + f * H).toFixed(1), sx = 14 + 44 * k, sy = base - 3;
  const face = `M14 ${base} C58 ${base} 74 ${Y(0.7)} 80 ${Y(0.4)} C70 ${Y(0.3)} 56 ${Y(0.3)} 47 ${Y(0.43)} C49 ${Y(0.13)} 72 ${top} 97 ${top} C127 ${top} 150 ${Y(0.45)} 196 ${base} Z`;
  $('mmScale').innerHTML = `<svg viewBox="0 0 200 240" aria-label="${h} metre wave next to a 1.8 metre surfer"><line x1="10" y1="${base}" x2="190" y2="${base}" stroke="rgba(246,236,220,.3)"/>
    <path d="${face}" transform="translate(14 ${base}) scale(${k.toFixed(3)}) translate(-14 -${base})" fill="rgba(159,227,214,.85)"/>
    <line x1="${14 + 186 * k}" y1="${topK}" x2="${14 + 186 * k}" y2="${base}" stroke="rgba(246,236,220,.45)" stroke-dasharray="3 3"/><line x1="${8 + 186 * k}" y1="${topK}" x2="${20 + 186 * k}" y2="${topK}" stroke="rgba(246,236,220,.6)"/>
    <text x="${Math.max(60, 6 + 186 * k)}" y="${Math.max(18, topK - 8)}" text-anchor="end" fill="#ffc978" font-family="Barlow Condensed" font-weight="800" font-size="26">${h} m</text>
    <g fill="#f6ecdc"><circle cx="${sx}" cy="${sy - man + man * 0.1}" r="${man * 0.1}"/><rect x="${sx - man * 0.07}" y="${sy - man * 0.8}" width="${man * 0.14}" height="${man * 0.45}" rx="${man * 0.05}"/>
    <path d="M${sx - man * 0.06} ${sy - man * 0.36} L${sx - man * 0.18} ${sy} M${sx + man * 0.06} ${sy - man * 0.36} L${sx + man * 0.2} ${sy}" stroke="#f6ecdc" stroke-width="${man * 0.08}" stroke-linecap="round"/></g>
    <text x="${sx}" y="${base + 16}" text-anchor="middle" fill="rgba(246,236,220,.6)" font-family="Barlow" font-size="11">you, 1.8 m</text></svg>`;
}
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
onTap(document.getElementById('goSurf'), () => start(/[?&]free=1\b/.test(location.search) ? 'free' : spotSel));   // (?free=1: the free-surf beach, for trying it before it has its own menu)
if (/[?&]free=1\b/.test(location.search)) { const sp = document.querySelector('#goSurf span'); sp.firstChild.nodeValue = 'START FREE SURF'; sp.style.whiteSpace = 'nowrap'; const gs = document.getElementById('goSpot'); new MutationObserver(() => { if (gs.textContent !== 'The free beach') gs.textContent = 'The free beach'; }).observe(gs, { childList: true, characterData: true, subtree: true }); gs.textContent = 'The free beach'; }   // (the test link says where Start takes you)
for (const b of document.querySelectorAll('[data-board]')) b.addEventListener('click', () => useBoard(b.dataset.board));
let starting = false;
// back to the level select: stop the game behind the menu (you pick a level again to restart)
function toMenu() {
  spec = null; contestHold = false; document.body.classList.remove('watching');
  starting = false; chalHide(); if (drone.on) droneSet(false); showOff(true); glareTick(false); audio.quiet(true);
  // clear the session: the menu gets its slow drifting wave behind it again (and nothing of the old ride keeps running)
  if (surfer) endWipe(); rider = null; rig.visible = false; endT = -1;
  for (const w of waves) w.dispose(scene); waves = [];
  setWeather(menuSpot()); setSpot(menuSpot()); ui.cond.textContent = '';
  if (tick.demo) { tick.demo.dispose(scene); tick.demo = null; }   // (the menu's wave made afresh in the light it's shown in: a night wave's glow never carried into the day)
  underK = 0; underWas = false; clearLens(); underEl.style.opacity = 0; underEl.style.display = 'none'; hudSpeed(-1); hudScore(-1, 0); hudCallOff(true); setText(ui.hint, '');
  input.paddleBtn = false; input.stallBtn = false; input.stick = null; padTouch = null; padX = padY = 0;
  keys.clear(); steerF = stickY = 0; ui.paddle.classList.remove('down'); ui.stall.classList.remove('down');
  if (strand) { endStrand(); rider = null; rig.visible = false; }   // (endStrand hands you back your board: not on the menu, where it went on lying in the shallows and stood you up again)
  FREE.rider = null; FREE.follow = null; freeOut(); freePeersClear(); FREE.net.role = 'solo'; FREE.net.onWave = null;   // (hides Paddle out, the pill and the free beach's buoys, which otherwise floated on in the menu's sea)
  document.body.classList.remove('playing', 'riding', 'ranch-wait', 'villa', 'reef', 'strand'); ui.msg.style.display = 'none'; walker = null; vPick(null); setHfov(50);
  ui.start.style.display = ''; showBests();
  dispatchEvent(new Event('ss:menu'));   // (a free surf beach on Wavedash: off it, see wavedash/src/freeroom.js)
}
document.getElementById('menu').addEventListener('touchstart', (e) => { e.preventDefault(); toMenu(); }, { passive: false });
document.getElementById('menu').addEventListener('click', toMenu);
// someone played: ONE note to the owner's Telegram (through /api/ping on Cloudflare) when they leave, i.e. when the page
// is hidden after they started surfing (his call 29 Sep 2026: nothing when they come in). It says new or returning,
// the device, where they came from, how long, waves, best, spots and boards. A second note only if they come back after
// a break and play on ('Same player again'). Never for the owner's own devices (open the game once with ?me=1 to mark
// one), never from localhost or GitHub Pages. Nothing personal: no names, no addresses, only names from fixed lists.
const PING_OK = /(^|\.)sumbasurf\.app$|\.pages\.dev$|\.wavedashcdn\.com$/.test(location.hostname), ON_WD = /\.wavedashcdn\.com$/.test(location.hostname);
let visit = null;
try { const me = (location.search.match(/[?&]me=(1|0|claude)\b/) || [])[1]; if (me === '0') localStorage.removeItem('sumbasurf.me'); else if (me) localStorage.setItem('sumbasurf.me', me); } catch (e) {}   // (?me=claude: the owner's assistant testing the live site: still sends, marked as such)
// where this player came from, as a name from a fixed list: the app they tapped the link in (Instagram's own browser
// names itself), else the page that sent them, else a link typed, saved or opened from the home screen
function cameFrom() {
  if (ON_WD) return 'Wavedash';
  const ua = navigator.userAgent, q = (location.search.match(/[?&]utm_source=([a-z]+)/i) || [])[1] || '';
  if (/Instagram/.test(ua) || /^ig|instagram/i.test(q)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/.test(ua) || /^fb|facebook/i.test(q)) return 'Facebook';
  if (/musical_ly|TikTok|Bytedance/i.test(ua) || /tiktok/i.test(q)) return 'TikTok';
  let h = ''; try { h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\.|^m\.|^l\./, '') : ''; } catch (e) {}
  if (h && h !== location.hostname) {
    for (const [re, n] of [[/instagram\.com$/, 'Instagram'], [/facebook\.com$|fb\.com$|fb\.me$/, 'Facebook'], [/tiktok\.com$/, 'TikTok'], [/^google\.|\.google\./, 'Google'], [/bing\.com$|duckduckgo\.com$|yahoo\.|baidu\.com$|yandex\./, 'another search engine'],
      [/youtube\.com$|youtu\.be$/, 'YouTube'], [/^x\.com$|^t\.co$|twitter\.com$/, 'X'], [/reddit\.com$/, 'Reddit'], [/t\.me$|telegram\.(org|me)$/, 'Telegram'], [/whatsapp\.com$|wa\.me$/, 'WhatsApp'], [/wavedash\.com$/, 'Wavedash']]) if (re.test(h)) return n;
    return 'another website';
  }
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return 'home screen app';
  return 'a direct link';
}
function hello(where) {   // (called each time they start somewhere: the first time sets the visit up)
  if (!PING_OK) return;
  if (!visit) {
    let kind = 'new', who = '';
    try { const me = localStorage.getItem('sumbasurf.me'); if (me === '1') { visit = false; return; } if (me === 'claude') who = 'claude';
      kind = localStorage.getItem('sumbasurf.seen') ? 'back' : 'new'; localStorage.setItem('sumbasurf.seen', new Date().toISOString().slice(0, 10)); } catch (e) {}
    // (the device, as the game sees it: an iPad's browser says it's a Mac, so the server alone called iPads computers)
    const ua = navigator.userAgent, touch = navigator.maxTouchPoints > 1;
    const dev = /iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && touch) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'tablet' : /iPhone|Android|Mobile/i.test(ua) ? 'phone' : touch ? 'touchscreen computer' : 'computer';
    visit = { kind, who, dev, src: cameFrom(), ms: 0, since: performance.now(), waves: 0, best: 0, bestAt: '', spots: new Set(), boards: new Set(), sentAt: -1, sentMs: 0, sent: 0 };
    // and a short note the moment they start (his call 30 Sep 2026: to see the traffic as it happens, not only when they leave)
    const body = JSON.stringify({ kind: 'in', seen: kind, who, dev, src: visit.src, host: ON_WD ? 'wavedash' : 'app', where });
    fetch((ON_WD ? 'https://sumbasurf.app' : '') + '/api/ping', { method: 'POST', body, keepalive: true, mode: ON_WD ? 'no-cors' : 'same-origin' }).catch(() => {});
  }
  if (visit) visit.spots.add(where);
}
function visitWave(score, where) { if (!visit) return; visit.waves++; visit.boards.add(boardType); if (score > visit.best) { visit.best = score; visit.bestAt = where; } }
function bye() {
  if (!visit || document.visibilityState !== 'hidden' || !visit.since) return;
  visit.ms += performance.now() - visit.since; visit.since = 0;
  if (visit.waves === visit.sentAt && visit.ms - visit.sentMs < 60e3) return;   // (nothing new since the last note: a quick look at another app)
  const body = JSON.stringify({ kind: visit.kind, who: visit.who, dev: visit.dev, src: visit.src, host: ON_WD ? 'wavedash' : 'app', again: visit.sent > 0, mins: visit.ms / 60e3, waves: visit.waves, best: visit.best, bestAt: visit.bestAt, spots: [...visit.spots], boards: [...visit.boards] });
  const url = (ON_WD ? 'https://sumbasurf.app' : '') + '/api/ping';
  // (a beacon still goes out while the page is being closed; plain text, so the Wavedash copy needs no extra permission)
  let ok = false; try { ok = navigator.sendBeacon(url, body); } catch (e) {}
  if (!ok) fetch(url, { method: 'POST', body, keepalive: true, mode: ON_WD ? 'no-cors' : 'same-origin' }).catch(() => {});
  visit.sentAt = visit.waves; visit.sentMs = visit.ms; visit.sent++;
}
addEventListener('visibilitychange', () => { if (!visit) return; if (document.visibilityState === 'hidden') bye(); else if (!visit.since) visit.since = performance.now(); });
addEventListener('pagehide', bye);
async function start(m, quick = false) {
  if (starting) return; starting = true; if (window.__g) window.__g.paused = false;
  hello(m === 'ranch' ? 'Sumba Ranch' : (SPOTS[m] && SPOTS[m].name) || m);
  showOff(true); mode = m; setWeather(m); setSpot(m); audio.start(); audio.quiet(false); audio.musicStart(MUSIC); document.body.classList.toggle('reef', m !== 'ranch');
  // fullscreen + landscape lock must be asked for inside the tap, before any waiting (Android); iOS ignores both safely
  if (!DESK) try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch (e) {}
  ui.load.textContent = surfer ? '' : 'Loading...'; document.getElementById('goSurf').classList.toggle('wait', !surfer);
  try { await ready; } catch (e) { starting = false; return; }
  ui.load.textContent = ''; document.getElementById('goSurf').classList.remove('wait');
  ui.start.style.display = 'none'; document.body.classList.add('playing');
  session = { waves: 0, total: 0, best: 0, scores: [], barrels: 0 };
  if (m !== 'free') levelIntro(m);   // (the three score levels, shown for a few seconds as you arrive)
  setLeft = 0; setPos = 0;
  for (const z of FREE) z.next = undefined; FREE.fresh = true;   // (the free-surf beach's sets start afresh too, and you start at the outside peak)
  FREE.extreme = FREE.forceX !== undefined ? FREE.forceX : /[?&]fx=1\b/.test(location.search); FREE.forceX = undefined;   // (Extreme: the host's choice once rooms exist; ?fx=1 for now)
  for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + (quick ? 5 : 15);   // a calm start: time to look around and find the set (a contest turn: the first wave sooner)
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
const _gl = new THREE.Vector3();
function povCamera(dt) {
  if (!bones.head && surfer) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const standing = rider.standing || finishing(), st = rider.state;   // (kicking out at the end you're still on your feet: eyes on the water ahead, not up at the next wave)
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
  let yawT = travel + dh * (standing ? 0.8 - 0.4 * popIn : 0.8);
  if (noseV > 0.001) yawT += Math.atan2(Math.sin(rider.th - yawT), Math.cos(rider.th - yawT)) * 0.35 * noseV;   // (on the nose, head up and looking ahead down the wave, as real longboarders do: only partly round to the board, his call 29 Sep 2026)   // (up the longboard you look along the board, down at its nose)   // (a little toward where the board points: you see the nose swing in a turn)
  // in the barrel look down the tube toward the exit (along the line), not out through the open side at the beach
  tubeLook += ((standing && (rider.inBarrel || (rider.ride && rider.ride.tubeT > 0)) ? 1 : 0) - tubeLook) * Math.min(1, dt * 1.5);   // (held through a wobble at the tube's edge: tubeT only clears after 0.4 s out)
  const tubeEase = smooth01(tubeLook);   // (eases in and out: no kick as you enter)
  // (no automatic turn in the barrel: the view swinging on its own as you went in felt like losing control; your view
  // follows your line as always, and the tube wraps around it)   // (more of the board heading: in a snap the board stays in view instead of swinging out of shot)
  // popping up, the head drives forward over the board (the eye ahead of the shoulders, which stay out of view), easing back as you rise
  const popFwd = st === 'POP' ? 0.15 : st === 'RIDE' ? 0.15 * Math.max(0, 1 - rider.stateT / 0.8) : 0;
  const sK = standing ? (st === 'POP' ? Math.min(1, popClock() / 0.25) : 1) : 0;   // (lying -> standing eye point blended over the start of the pop, not switched in a frame)
  const ef = -0.05 + (POVCAM.fwd + popFwd + 0.05 + 0.18 * noseV) * sK, eu = 0.2 + (POVCAM.up - 0.2 + 0.06 * noseV) * sK;   // (walking to the nose you turn square to it and your shoulders come round beside the camera: the eyes sit a little further ahead, clear of them)   // lying: eyes at the head, a bit up, so your paddling hands pass below them
  _eye.x += Math.cos(yawT) * ef; _eye.z += Math.sin(yawT) * ef; _eye.y += eu - 0.08 * stallV;   // (sitting back in a stall: a little lower)   // camera just in front of the face, like a surfer's mouth-mounted camera
  // the nose starting to dig in on the longboard: you look at it (head turned and tipped down to the tip), so you see
  // the water coming over it even when a lean has carried your head out over the rail
  const glK = standing ? Math.min(1, Math.max(0, (pearlV - 0.15) / 0.3)) * noseV : 0; let glP = 0;
  if (glK > 0.001) { _gl.set(0, 0.05, board.position.z + BOARD_LENGTH(boardType) / 2 - 0.2).applyMatrix4(rig.matrixWorld).sub(_eye);
    const yN = Math.atan2(_gl.z, _gl.x); yawT += Math.atan2(Math.sin(yN - yawT), Math.cos(yN - yawT)) * glK; glP = Math.max(-0.62, Math.atan2(_gl.y, Math.hypot(_gl.x, _gl.z))); }   // (not straight down at the nose: looking steeply down you saw your own chest, his report 29 Sep 2026)
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
  // waiting in the water, lying or sitting (his call 30 Sep 2026): one fixed view, eyes level on the water at the height
  // they used to lift to when a wave came, so you watch the sets coming yourself and nothing shifts on its own
  let pitchT = standing ? POVCAM.pitch - POVCAM.drop * dropK : -0.22;
  if (!standing && isRanch()) pitchT = Math.max(pitchT, -0.2);   // at the Sumba Ranch, eyes up on the machine wall where your wave comes from
  pitchT += 0.14 * tubeEase + 0.07 * stallV + 0.035 * bogV * Math.sin(T * 7.3) + 0.12 * noseV + (standing && noseV > 0.01 ? 0.25 * noseV * Math.min(0, Math.asin(Math.max(-1, Math.min(1, pose.fwd.y)))) : 0); if (glK > 0.001) pitchT += (glP - pitchT) * glK;   // (on the nose your eyes follow the board's slope: heading down the face you look down it, so the tip stays in view)   // (up on the nose your eyes drop a little; when it starts to dig in you glance down at it, so you see the tip going under)   // (a stall: you sit back and your eyes tip up a little; sinking, they bob)   // (in the barrel your eyes lift ~8 deg, so you see the tube arching over you)   // (a slight, slow lift of the eyes toward the lip overhead)   // and up a little: the lip over your head
  pov.pitch += (pitchT - pov.pitch) * Math.min(1, dt * (st === 'POP' ? 4 + 20 * Math.min(1, popClock() / 0.3) : st === 'RIDE' ? 5 + 19 * Math.max(0, 1 - rider.stateT / 0.4) : 5));   // (and out of it without a kink: the rates hand over gradually when you're up)   // (the pop: eyes snap down to the board between your hands)
  pov.roll += ((standing ? -rider.lean * 0.2 - 0.55 * (rider.wob || 0) + 0.05 * bogV * Math.sin(T * 9.1) : 0) - pov.roll) * Math.min(1, dt * 6);   // (the wobble of a sinking tail rocks the horizon)   // you feel the lean: the horizon tips as you lay into a carve (less than the board: people hold their head nearer level)
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
    const want = (rider.standing && (rider.air || (rider.v > 3 && slip > 0.35))) || finishing() ? 1 : 0;   // (and while you kick out at the end: the board turns under you)
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
const _stq = new THREE.Quaternion(), _idq = new THREE.Quaternion();
const setStance = () => { invQ.copy(rig.quaternion).invert(); surfer.quaternion.copy(invQ).multiply(bodyQ).multiply(_stq.copy(stanceQ).slerp(_idq, 0.55 * noseV)); };   // (walking to the nose you turn to face it, gradually over the steps)
// body moves between poses (sitting -> lying -> popping up) glide over ~0.15 s instead of jumping in one frame: the
// camera rides on your head, so a jump was a jolt in the view (sit to paddle dropped 57 cm, paddle to pop rose 44 cm)
const _gp = new THREE.Vector3();
function glideTo(x, y, z, dt, rate = 18) {
  _gp.set(x, y, z);
  if (snapCam || surfer.position.distanceTo(_gp) > 1.5) surfer.position.copy(_gp); else surfer.position.lerp(_gp, 1 - Math.exp(-dt * rate));
}
// the end of a ride you stood up on (his note 29 Sep 2026: it dropped you onto your backside in a blink): you stay on your
// feet for a moment, straightening up tall as the board glides on and turns up over the back of the wave, then settle
// down to sit on the board over most of a second
const FIN_HOLD = 0.8, FIN_SIT = 0.7;
// the stall you can see and hear (his call 29 Sep 2026: the stronger stall must show): stallV eases in and out with the
// button, bogV rises as the board stops planing under you (the warning before the tail sinks). They tip your eyes back
// and lift the nose (updateRig, povCamera), throw spray off your dragging hand, gurgle, wobble, and pulse the button
let stallV = 0, bogV = 0, stallSprayAcc = 0, gurgleT = 0, noseV = 0, noseVv = 0, pearlV = 0, shoulderV = 0, pearlSprayAcc = 0, pearlGurgleT = 0, pearlBuzzed = false;
const _stP = new THREE.Vector3(), _stV = new THREE.Vector3();
function stallFx(dt) {
  const on = rider && rider.standing && rider.state === 'RIDE';
  // (the physics walks you up in four stop-start steps; what you see moves smoothly: body, arms and eyes all follow one
  // softly sprung copy of it, together, so your view glides up the board and never slips behind your own shoulders)
  if (on) { const w = 9, h = Math.min(dt, 0.05); noseVv += ((rider.nose || 0) - noseV) * w * w * h - 2 * w * noseVv * h; noseV = Math.max(0, Math.min(1, noseV + noseVv * h)); }
  else { noseV *= Math.max(0, 1 - dt * 4); noseVv = 0; }
  pearlV += ((on ? rider.pearlK || 0 : 0) - pearlV) * Math.min(1, dt * 8);
  shoulderV += ((on ? rider.shoulderK || 0 : 0) - shoulderV) * Math.min(1, dt * 6);
  // the nose about to go under, in two stages you can see and hear (walk back in either and you're fine): from a
  // quarter of the way the tip dips, water washes up over it and it gurgles; past 70% it dips hard, more water piles
  // on, the board shudders and (Android) the phone buzzes
  if (on && pearlV > 0.25 && rider.v > 1) {
    const k2 = pearlV > 0.7 ? 1 : 0; pearlSprayAcc += (60 + 140 * k2) * pearlV * dt;
    const nz = board.position.z + BOARD_LENGTH(boardType) / 2 - 0.25;
    while (pearlSprayAcc >= 1) { pearlSprayAcc -= 1;
      _stP.set((Math.random() - 0.5) * 0.35, 0.02, nz).applyMatrix4(rig.matrixWorld);
      _stV.set(rider.vx * 0.6, 0.5 + Math.random() * (0.8 + 0.8 * k2), rider.vz * 0.6).addScaledVector(pose.fwd, -0.8 - Math.random() * 0.8);
      railSpray.stream(_stP, _stV, 1, 0.45); }
    pearlGurgleT -= dt; if (pearlGurgleT <= 0) { pearlGurgleT = (k2 ? 0.2 : 0.38) + 0.15 * Math.random(); audio.burst(0.08 + 0.14 * pearlV, 220 + 80 * Math.random(), 0.28, 'lowpass'); }
    if (k2 && !pearlBuzzed) { pearlBuzzed = true; if (!DESK) try { navigator.vibrate && navigator.vibrate([40, 60, 40]); } catch (e) {} }
  }
  if (pearlV < 0.5) pearlBuzzed = false;
  stallV += ((on ? rider.stalling || 0 : 0) - stallV) * Math.min(1, dt * (rider && rider.stalling ? 7 : 4));
  bogV += ((on ? rider.bogK || 0 : 0) - bogV) * Math.min(1, dt * 8);
  if (ui.stall.classList.contains('bog') !== bogV > 0.12) ui.stall.classList.toggle('bog', bogV > 0.12);
  if (!on || stallV < 0.2 || rider.v < 1.5) return;
  // spray off the hand dragging in the face, on the wave side, thrown back and up; less as you slow down
  stallSprayAcc += 170 * stallV * Math.min(1, rider.v / 6) * dt;
  while (stallSprayAcc >= 1) { stallSprayAcc -= 1;
    _stP.copy(rig.position).addScaledVector(INTO_WAVE, 0.5 + Math.random() * 0.15).addScaledVector(pose.fwd, 0.15 - Math.random() * 0.3); _stP.y = heightAt(waves, _stP.x, _stP.z) + 0.05;
    _stV.set(rider.vx * 0.35, 0.9 + Math.random() * 1.3, rider.vz * 0.35).addScaledVector(pose.fwd, -1.2 - Math.random()).addScaledVector(INTO_WAVE, 0.4);
    railSpray.stream(_stP, _stV, 1, 0.5); }
  // the tail sinking: a gurgle every so often as the warning builds
  if (bogV > 0.2) { gurgleT -= dt; if (gurgleT <= 0) { gurgleT = 0.28 + 0.2 * Math.random(); audio.burst(0.1 + 0.12 * bogV, 180 + 60 * Math.random(), 0.3, 'lowpass'); } }
}
const finishing = () => rider && rider.state === 'OUT' && rider.ride && rider.ride.t > 0 && rider.stateT < FIN_HOLD && !/^Closed out:/.test(rider.why || '');   // (not when the whitewater has you: then it knocks you down onto the board)
const settling = () => rider && rider.state === 'OUT' && rider.ride && rider.ride.t > 0 && rider.stateT < FIN_HOLD + FIN_SIT + 0.6;
let bobK = 1;
function updateRig(dt, t) {
  if (rider.state === 'WIPE' && W.on) { wipeout(dt); return; }
  rider.pose(pose);
  const fin = finishing(), standing = rider.standing || fin;
  // standing, the board rides on its rail (partway between the face and level) and rolls into the carve
  if (standing) {
    pose.up.lerp(WORLD_UP, 0.45).normalize();
    // each pump stroke swoops the board a little, rail to rail and nose swinging, like the small S a real pump makes
    // (only what you see: your line and the physics are untouched). One stroke one way, the next the other way.
    const pw = rider.pumping ? Math.sin(Math.PI * rider.pumpT / PUMP_STROKE) : 0, ps = rider.pumpN % 2 ? 1 : -1;
    const roll = rider.lean * 0.8 + ps * 0.12 * pw + (rider.wob || 0);   // (up on the longboard's nose: the rock you're balancing)                     // the board on its rail: the lean you're carving with
    pose.fwd.applyAxisAngle(WORLD_UP, ps * 0.07 * pw);
    pose.fwd.y += 0.14 * stallV + 0.07 * bogV * Math.sin(t * 7.5) - 0.05 * noseV - 0.12 * pearlV - (pearlV > 0.7 ? 0.05 * pearlV + 0.025 * Math.sin(t * 23) : 0);   // (the last stage: dipping hard, shuddering) pose.fwd.normalize();   // (walking forward the nose dips; about to pearl, it dips hard)   // (a stall: weight on the tail lifts the nose; sinking, it bobs)
    pose.up.applyAxisAngle(pose.fwd, roll);   // (+lean turns right, toward +z; rolling up toward +z puts the right rail in the water)
  }
  pose.up.addScaledVector(pose.fwd, -pose.up.dot(pose.fwd)).normalize();
  xAxis.crossVectors(pose.up, pose.fwd).normalize();
  const up = _up.crossVectors(pose.fwd, xAxis).normalize();
  tmpM.makeBasis(xAxis, up, pose.fwd);
  _tq.setFromRotationMatrix(tmpM);
  // the water surface kinks where the face bends; ease the board's tilt so it rides over those instead of snapping
  // the sitting tilt eases in and out too; smoothing runs on its own copy so extra tilts never pile up
  const sitK = rider.state === 'LIE' && !rider.paddling || (rider.state === 'OUT' && !fin) ? 1 : 0;
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
  if (st === 'OUT' && fin) {   // (the finish: still on your feet, rising out of the crouch)
    if (curClip !== clips.crouch) { play('crouch', { fade: 0.3 }); clips.stand.reset().play(); }
    const k = Math.min(1, rider.stateT / FIN_HOLD); clips.crouch.weight += (0.25 - clips.crouch.weight) * Math.min(1, dt * 3); clips.stand.weight = 1 - clips.crouch.weight;
    setStance(); surfer.position.set(0, -0.04 * clips.crouch.weight, -0.1 - 0.05 * k);
  } else if (st === 'LIE' || st === 'OUT') {
    if (rider.paddling && st === 'LIE') { play('paddle', { speed: 0.7 + rider.v / 3 }); glideTo(0, -0.93, -0.5, dt); }   // chest mid-board, feet at the tail
    else {
      // sitting astride: weight over the tail sinks it, nose tips up ~14 deg, legs hang in the water either side
      const slow = settling(); play('sit', { fade: slow ? FIN_SIT : 0.25 }); glideTo(0, -0.36, -0.25, dt, slow ? 5 : 18);   // (after a ride: sinking down onto the board slowly)
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
    clips.crouch.weight = (0.8 + (deep - 0.8) * rise) * (1 - 0.45 * noseV); clips.stand.weight = 1 - clips.crouch.weight;   // (on the nose you stand tall)
    setStance();
    surfer.position.set(0, -0.04 * clips.crouch.weight, -0.1);       // hips drop a little as the feet spread
    if (noseV > 0.001 || rider.stepDir) {   // cross-stepping up the longboard: forward a step at a time, the body rising a little and rocking side to side with each step
      const run = board.position.z + BOARD_LENGTH(boardType) / 2 - 0.2, u = rider.stepU || 0   /* (right out at the tip on a hang ten, toes over the nose: was 0.5 m short, his call 29 Sep 2026) */, lift = Math.sin(Math.PI * u), sideS = (rider.noseStep || 0) % 2 ? 1 : -1;
      surfer.position.z += noseV * run; surfer.position.y += 0.025 * lift; surfer.position.x += 0.015 * lift * sideS;   // (a light bob and sway with each step: more read as a jolt at the lens)
    }
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
  const pts = new THREE.Points(g, bioMat(new THREE.PointsMaterial({ color: 0xf6f1ea, size: 0.11, map: tex, transparent: true, opacity: 0.8, depthWrite: false })));   // (bigger, soft drops: at 7 cm they read as specks)
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
        acc += load * 1150 * dt * (1 + 0.8 * ENV.uBio.value);   // (the night spot: more of it, each drop a blue spark)
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
        const cutK = rider.trick && /CUTBACK|ROUNDHOUSE$/.test(rider.trick.name) && rider.trick.t < 0.3 ? 1 : 0;
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
  const spts = new THREE.Points(sg, bioMat(new THREE.PointsMaterial({ color: 0xf4f7f6, size: 0.34, map: soft, transparent: true, opacity: 0.42, depthWrite: false }), 0.6));
  spts.frustumCulled = false; scene.add(spts); for (let i = 0; i < SN; i++) sp[i * 3 + 1] = -99;
  // drops on the deck (in the board's own frame, so they ride with it)
  const DN = 48, dp = new Float32Array(DN * 3), dsp = new Float32Array(DN);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dpts = new THREE.Points(dg, bioMat(new THREE.PointsMaterial({ color: 0xf2fbff, size: 0.045, map: soft, transparent: true, opacity: 0.95, depthWrite: false })));
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
        if (rider.trick && rider.trick !== lastTrick && /SNAP|CUTBACK|ROUNDHOUSE/.test(rider.trick.name)) {
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
    uniforms: { uScale: { value: 1 }, uMax: { value: 8 }, uBio: ENV.uBio },
    vertexShader: 'attribute float aA; attribute float aS; varying float vA; uniform float uScale; uniform float uMax; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = min(aS * uScale / -mv.z, uMax); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uBio; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d, d) * 4.; if (r > 1.) discard; gl_FragColor = vec4(mix(vec3(.96, .95, .93), vec3(.3, .85, 1.) * 1.8, uBio), vA * (1. - r) * mix(.7, .95, uBio)); }',   // (the night spot: the flecks glow blue)
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
// the night spot's plankton, lit up by you where you can see it from your own eyes: along the rails and round the nose as
// the board moves through the water (more the faster you go and the harder you turn), and a swirl at each hand as you
// paddle. Points that sit on the water where they're stirred and fade over a second (blue light added, so it shines)
const BIO_N = 3200;
const bowGlow = (() => {
  const pos = new Float32Array(BIO_N * 3), col = new Float32Array(BIO_N * 3), life = new Float32Array(BIO_N).fill(-1), max = new Float32Array(BIO_N), vel = new Float32Array(BIO_N * 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.055, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; pts.visible = false; scene.add(pts);
  let next = 0, acc = 0, fr = 0, glowK = 0; const side = new THREE.Vector3();
  const put = (x, z, vx, vz, l) => { const i = next; next = (next + 1) % BIO_N; pos[i * 3] = x; pos[i * 3 + 1] = heightAt(waves, x, z) + 0.03; pos[i * 3 + 2] = z; vel[i * 2] = vx; vel[i * 2 + 1] = vz; life[i] = max[i] = l; };
  return {
    // a paddle stroke: a swirl of light where each hand goes in
    stroke() { if (!(ENV.uBio.value > 0) || !rider) return; side.crossVectors(pose.fwd, pose.up).normalize();
      for (const sgn of [-1, 1]) for (let k = 0; k < 90; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 0.4;
        put(rig.position.x + side.x * sgn * 0.5 + pose.fwd.x * 0.25 + Math.cos(a) * r, rig.position.z + side.z * sgn * 0.5 + pose.fwd.z * 0.25 + Math.sin(a) * r, Math.cos(a) * 0.4 - pose.fwd.x * 0.8, Math.sin(a) * 0.4 - pose.fwd.z * 0.8, 0.8 + Math.random() * 0.7); } },
    update(dt) {
      const on = ENV.uBio.value > 0; pts.visible = on;
      // the board lit from below by the glowing water it runs through: a soft blue on it, stronger as you go faster
      glowK += ((on && rider && rider.y > -1 ? 0.45 + 0.55 * Math.min(1, rider.v / 8) : 0) - glowK) * Math.min(1, dt * 3);
      if (board.material.emissive) board.material.emissive.setRGB(0.03 * glowK, 0.2 * glowK, 0.34 * glowK);
      if (!on) return;
      if (rider && rider.y > -1 && rider.v > 0.6 && rider.state !== 'WIPE') {
        const load = rider.standing ? Math.min(1.5, rider.v / 9 + Math.abs(rider.turn) * rider.v / 12 + rider.skid) : Math.min(0.6, rider.v / 5);
        acc += load * 1300 * dt; side.crossVectors(pose.fwd, pose.up).normalize();
        while (acc >= 1) { acc -= 1; const sgn = Math.random() < 0.5 ? -1 : 1, along = 0.95 - Math.random() * (rider.standing ? 1.6 : 1.9), w = 0.22 + Math.random() * 0.12 + (along > 0.6 ? (0.95 - along) * 0.4 : 0);
          put(rig.position.x + pose.fwd.x * along + side.x * sgn * w, rig.position.z + pose.fwd.z * along + side.z * sgn * w,
            side.x * sgn * (0.6 + Math.random()) + rider.vx * 0.25, side.z * sgn * (0.6 + Math.random()) + rider.vz * 0.25, 0.5 + Math.random() * 0.8); }
      }
      fr = (fr + 1) % 3;
      for (let i = 0; i < BIO_N; i++) {
        if (life[i] < 0) { if (col[i * 3 + 2] !== 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; } continue; }
        life[i] -= dt; const k = Math.max(0, life[i] / max[i]), f = k * k * (0.75 + 0.5 * Math.random());   // (a flicker as it fades)
        pos[i * 3] += vel[i * 2] * dt; pos[i * 3 + 2] += vel[i * 2 + 1] * dt;
        if (i % 3 === fr) pos[i * 3 + 1] = heightAt(waves, pos[i * 3], pos[i * 3 + 2]) + 0.03;   // (kept on the water as the wave moves under it: a third of them a frame)
        vel[i * 2] *= 1 - dt * 2.5; vel[i * 2 + 1] *= 1 - dt * 2.5;
        col[i * 3] = 0.1 * f; col[i * 3 + 1] = 0.7 * f; col[i * 3 + 2] = 1.0 * f;
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
  };
})();
const TRACK_N = 320;
const track = (() => {
  const P = Array.from({ length: TRACK_N }, () => ({ x: 0, y: -99, z: 0, t: -99, w: 0, dx: 1, dz: 0 }));
  const pos = new Float32Array(TRACK_N * 2 * 3), uv = new Float32Array(TRACK_N * 2 * 2), al = new Float32Array(TRACK_N * 2), idx = [];
  for (let i = 0; i < TRACK_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: { uBio: ENV.uBio, uTime: ENV.uTime },
    vertexShader: 'attribute float aA; varying float vA; varying vec2 vUv; void main(){ vA = aA; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uBio, uTime; varying float vA; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ float across = abs(vUv.y - .5) * 2.;                               // 0 on the line, 1 at its edges
        float lace = n(vec2(vUv.x * 1.3, vUv.y * 5.)) * .6 + n(vec2(vUv.x * 4.1, vUv.y * 11.)) * .4;
        float a = vA * smoothstep(1., .25, across) * smoothstep(.28 + (1. - vA) * .35, .62, lace);   // breaking up into lace as it ages
        // the night spot: the line you draw lights up the plankton: a glowing blue trail, brightest where you just passed, with sparks winking in it
        if (uBio > 0.) { float spark = step(.9, h(floor(vec2(vUv.x * 6., vUv.y * 4.)))) * (.5 + .5 * sin(uTime * 7. + vUv.x * 13.));
          float ab = vA * smoothstep(1., .1, across) * (.35 + .65 * lace) + spark * vA * .6;
          if (ab < .01) discard; gl_FragColor = vec4(mix(vec3(.05, .45, 1.), vec3(.5, .95, 1.), vA) * (1.2 + spark), min(1., ab)); return; }
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
    if (noseV > 0.01) P.lerp(at(_aq, front ? 0.08 : -0.08, 0.6 + 0.03 * Math.sin(bodyT * 1.3 + (front ? 0 : 2)), (s === 'r' ? 0.88 : -0.88) * ws), Math.min(1, noseV * 1.4));   // (on the nose: arms out wide for balance, the noserider's poise, away from your eyes and just out of view; low at the hips they were trimmed into jagged shapes right at the lens, his report 29 Sep 2026)
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
const setText = (el, t) => { if (el && el._t !== t) { el._t = t; if (el === ui.hint) return hintSet(t); el.textContent = t; } };
// the tip up top (his note 30 Sep 2026: plain white text looked bland): the game's own pill and lettering, the button names
// and keys in amber, each new tip sliding in, a cleared one fading out
const HINT_KEY = /\b(Space|Shift|[A-Z]{3,}(?: [A-Z]{2,})*)\b/g, hintEsc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
let hintOutT = 0;
function hintSet(t) {
  const el = ui.hint; clearTimeout(hintOutT); document.body.classList.toggle('hinting', !!t);
  if (!t) { el.classList.remove('in'); el.classList.add('gone'); hintOutT = setTimeout(() => { if (!el._t) { el.innerHTML = ''; el.classList.remove('gone'); } }, 260); return; }
  el.innerHTML = `<span>${hintEsc(t).replace(HINT_KEY, '<b>$1</b>')}</span>`; el.classList.remove('gone', 'in'); void el.offsetWidth; el.classList.add('in');
}   // (a tip up top: the spot name beside it steps aside, on a small phone the two ran into each other)   // only touch the page when the text changes
let endT = -1, snapCam = true, tubeShowT = 0, lastAir = false;
// ---- the HUD's speed, score and move callouts (look: index.html #speed, #score, #tube)
const hudSpdB = ui.speed.querySelector('b'), hudBar = ui.speed.querySelector('.sbar i'), hudScB = ui.score.querySelector('b');
const cBig = ui.tube.querySelector('.cbig'), cWord = ui.tube.querySelector('.cword'), cPts = ui.tube.querySelector('.cpts'), cWhy = ui.tube.querySelector('.cwhy'), cBal = ui.tube.querySelector('.cbal'), cBalDot = cBal.querySelector('i');
let hudKmh = -2, scShown = -1, callKey = null, callOn = false, callSlamT = 0, whyT = 0;
// the first time you land a move with a surfer's name, a line under it says what it is (held a little longer to read)
const MOVE_WHY = { 'HANG FIVE': "One foot's toes over the nose", 'HANG TEN': "Both feet's toes over the nose" };
let movesSeen = {}; try { movesSeen = JSON.parse(localStorage.getItem('ssMovesSeen') || '{}') || {}; } catch (e) { movesSeen = {}; }
function moveWhy(word) {
  const k = Object.keys(MOVE_WHY).find((n) => word.startsWith(n)); if (!k || movesSeen[k]) return '';
  movesSeen[k] = 1; try { localStorage.setItem('ssMovesSeen', JSON.stringify(movesSeen)); } catch (e) {} return MOVE_WHY[k];
}
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
function hudCallOff(now) { ui.tube.classList.remove('bal'); if (!callOn && !now) return; callOn = false; whyT = 0; cWhy.textContent = ''; callKey = null; ui.tube.classList.remove('on', 'slam', 'big', 'live'); if (!now) ui.tube.classList.add('out'); else ui.tube.classList.remove('out'); }
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
    const grab = (rider.ride.grabT || 0) > 0.3 ? 'GRAB RAIL' : ''; hudCallShow('tube', grab, `BARREL ${Math.max(0, rider.ride.tubeT).toFixed(1)}s`, '', 'sea', true); if (cBig.textContent !== grab) cBig.textContent = grab;   // (backside in a heavy barrel: on the rail)
    if (!callSlamT && !ui.tube.classList.contains('live')) { ui.tube.classList.remove('slam', 'big'); ui.tube.classList.add('live'); }
    return;
  }
  // up on the longboard's nose: the hang's own clock, like the barrel's (HANG FIVE counting, HANG TEN once you're on
  // the tip), coral while the nose is digging in. Stepping back off it, the scored hang slams in with its points below
  if (st === 'RIDE' && (rider.nose || 0) >= 0.74 && rider.hangT > 0) {
    const ten = rider.hang10T > 0, word = `${ten ? 'HANG TEN' : 'HANG FIVE'} ${(ten ? rider.hang10T : rider.hangT).toFixed(1)}s`;
    hudCallShow(ten ? 'hang10' : 'hang5', '', word, '', 'gold', true);   // (slams again as you reach the tip)
    ui.tube.style.setProperty('--c', pearlV > 0.25 || (rider.wobK || 0) > 0.55 ? CALL_COL.coral : CALL_COL.gold);
    if (!callSlamT && !ui.tube.classList.contains('live')) { ui.tube.classList.remove('slam', 'big'); ui.tube.classList.add('live'); }
    // the balance bar: the dot goes the way the board tips on screen (a mirrored spot flips it), 60 px at the edge
    const bk = Math.max(-1, Math.min(1, (rider.wob || 0) / 0.3)) * (MIRROR ? -1 : 1);
    ui.tube.classList.add('bal'); cBalDot.style.setProperty('--bx', (bk * 60).toFixed(1) + 'px'); cBal.classList.toggle('hot', Math.abs(bk) > 0.55);
    return;
  }
  ui.tube.classList.remove('bal');
  const tr = st === 'RIDE' ? rider.trick : null;
  whyT = Math.max(0, whyT - dt);
  if (!tr) { if (whyT > 0 && st === 'RIDE') return; hudCallOff(false); return; }
  if (tr !== callKey) {
    const m = /^(BIG |DEEP )?(.*)$/.exec(tr.name), word = m[2], mv = rider.ride.moves[rider.ride.moves.length - 1];
    hudCallShow(tr, (m[1] || '').trim(), word, mv ? `+${mv.pts.toFixed(1)}` : '', /^BARREL/.test(word) ? 'sea' : /^AIR/.test(word) ? 'coral' : 'gold', true);
    const why = moveWhy(word); cWhy.textContent = why; whyT = why ? 3.2 : 0;   // (1.4 s callout + time to read the line)
  }
}
function updateHUD(dt) {
  const st = rider.state;
  if (spec && endT >= 0 && st !== 'WIPE' && st !== 'OUT') { endT = -1; ui.msg.style.display = 'none'; if (surfer) endWipe(); lastState = ''; snapCam = true; }   // (the friend you're watching paddled back out)
  hudSpeed(rider.standing ? Math.round(rider.v * 3.6) : -1);
  if (mode === 'random') setText(ui.cond, rider.wave && rider.standing ? `Random: ${rider.wave.cond.name.toLowerCase()} wave` : 'Random');
  ui.paddle.style.visibility = st === 'WIPE' || st === 'OUT' ? 'hidden' : 'visible';
  const lbl = rider.standing ? (boardType === 'long' ? 'WALK' : 'PUMP') : 'PADDLE';   // (the longboard walks to the nose instead of pumping)
  if (ui.paddle.dataset.l !== lbl) { ui.paddle.dataset.l = lbl; ui.paddle.innerHTML = DESK ? `${lbl}<small>SPACE</small>` : lbl; }
  // coaching for the first few waves: read the sea like a surfer would
  let hint = '';
  if (st === 'LIE' && ranchWaiting()) hint = session.waves < 3 ? 'Order a wave: it comes out of the machine, then ride it the way the arrows point' : '';
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
  freeOut();
  setText(ui.hint, spec ? '' : pearlV > 0.25 ? (rider.noseHard ? 'Turning too hard on the nose: ease off, walk back' : 'Nose digging in: walk back') : shoulderV > 0.4 ? (DESK ? 'Out on the shoulder: walk back, Shift to stall to the curl' : 'Out on the shoulder: walk back, STALL to the curl') : bogV > 0.3 ? (DESK ? 'Too slow: let go of Shift' : 'Too slow: let go of STALL') : session.waves < 5 || st === 'POP' ? (DESK ? deskHint(hint) : hint) : '');   // (the sinking-tail warning shows every time, not only in the first waves)   // (no coaching while you watch someone else)
  // the callout: BARREL while you're in it, or the move you just landed
  tubeShowT = rider.inBarrel ? 0.4 : Math.max(0, tubeShowT - dt);   // (held a moment: a wobble at the tube's edge doesn't flicker the word)
  hudCall(st, dt);
  hudScore(st === 'RIDE' && !isFree() ? rider.liveScore() : -1, dt);   // (not on the free beach, his call 30 Sep 2026: it sat under the list of who's there; the score card after each wave stays)
  if ((st === 'WIPE' || st === 'OUT') && endT < 0 && isFree()) { endT = 0; const sc = rider.ride.score || 0; if (rider.ride.t > 0 || st === 'WIPE') { visitWave(sc, 'the free beach'); session.waves++; } if (rider.ride.t > 0 && !spec) { freeScore(sc); const bm = [...rider.ride.moves].sort((a, b) => b.pts - a.pts).find((m) => m.name !== 'TURN'); dispatchEvent(new CustomEvent('ss:freeride', { detail: { s: sc, fell: st === 'WIPE', m: bm ? bm.name : '' } })); } }   // (the free beach: how that wave went, shown for a moment, no best kept, no leaderboard; ss:freeride tells your friends, see freeroom.js)
  else if ((st === 'WIPE' || st === 'OUT') && endT < 0) {
    endT = 0;
    const r = rider.ride;
    const prevBest = bestFor(mode), newBest = !spec && r.t > 0 && r.score > prevBest && prevBest > 0;   // (a friend's wave you watched is never yours: no best, no level, no leaderboard)
    if (!spec && r.t > 0 && r.score > prevBest) saveBest(mode, r.score);
    if (!spec && (r.t > 0 || st === 'WIPE')) { visitWave(r.score, mode === 'ranch' ? 'Sumba Ranch' : (SPOTS[mode] && SPOTS[mode].name) || ''); session.waves++; session.total += r.score; session.best = Math.max(session.best, r.score); session.scores.push(r.score); if (r.barrel > 0.5) session.barrels++; }
    // heat total, like a contest: your best two waves count
    const two = [...session.scores].sort((a, b) => b - a).slice(0, 2), heat = two.reduce((a, b) => a + b, 0);
    // the score screen, trimmed (his call 28 Sep 2026): the score, how it ended (big after a wipeout: it says what went
    // wrong), the three moves that counted most, then the level and your best. No heat total, no stats row.
    ui.msgT.textContent = rider.why; ui.msgT.classList.toggle('big', st === 'WIPE');
    const judge = r.score < 2 ? 'Poor' : r.score < 5 ? 'Fair' : r.score < 6.5 ? 'Good' : r.score < 8 ? 'Very good' : r.score < 10 ? 'Excellent' : 'Perfect';   // (the contest judges' own words for the range, 28 Sep 2026)
    ui.msgN.innerHTML = r.t > 0 ? `${r.score.toFixed(1)}<small>${judge.toUpperCase()}${newBest ? '  \u00b7  NEW BEST' : ''}</small>` : '';
    ui.msgS.innerHTML = '';
    { const J = r.t > 0 ? rider.liveScore(st === 'WIPE', true) : null, NM = { TURN: 'Turn', SNAP: 'Snap', CUTBACK: 'Cutback', FLOATER: 'Floater', AIR: 'Air', 'AIR 360': 'Air 360', 'HANG FIVE': 'Hang five', 'HANG TEN': 'Hang ten', BARREL: 'Barrel' , ROUNDHOUSE: 'Roundhouse', 'LATE DROP': 'Late drop' };
      const top = J ? J.lines.filter((l) => NM[l.name]).slice(0, 3) : [];
      ui.msgJ.innerHTML = top.map((l) => `<div><span><b>${NM[l.name]}${l.name === 'BARREL' || l.name.startsWith('HANG') ? ` ${l.dur.toFixed(1)}<small>s</small>` : ''}</b>${l.notes.length ? `<i>${l.notes.join(', ')}</i>` : ''}</span><em>${l.pts.toFixed(1)}</em></div>`).join('') + (J && J.fell ? '<div><span><i>fell at the end: moves in the last second did not count</i></span></div>' : ''); }
    // the level this wave reached stands out (amber, with the menu's three dots), then how far the next one is
    const parts = []; let lvl = '';
    if (r.t > 0) { const lv = levelOf(r.score), nx = LEVELS[lv + 1];
      if (lv >= 0) lvl = `<span class="lvl"><i>${[0, 1, 2].map((i) => `<b${i <= lv ? ' class="on"' : ''}></b>`).join('')}</i>${LEVELS[lv][0]}</span>`;
      if (nx) parts.push(`${(nx[1] - r.score).toFixed(1)} more for ${nx[0]}`);
      if (!newBest && prevBest > 0 && !globalThis.Wavedash) parts.push(`your best ${prevBest.toFixed(1)}`); }   // (on Wavedash the leaderboard line under it gives your best)
    ui.sess.innerHTML = spec ? '' : lvl + parts.join('  \u00b7  ');
    if (!spec && r.t > 0) { const lv = levelOf(r.score);
      if (lv > levelOf(prevBest)) { levelWin(LEVELS[lv][0]); levelDots(); } }
    if (!spec) ssEvent('ride', { spot: mode, board: boardType, score: r.score, stood: r.t > 0, made: st === 'OUT', tube: r.moves.reduce((a, m) => m.name === 'BARREL' ? Math.max(a, m.dur || 0) : a, 0), move: (r.moves.reduce((a, m) => (!a || m.pts > a.pts ? m : a), null) || {}).name || '', best: Math.max(bestFor(mode), r.score) });
  }
  // the free beach (his call 30 Sep 2026: no score, no teleport): a wipeout plays out, you come up, grab your board where it
  // floated and lie back on it; a ride you kicked out of settles you straight onto it. Paddle on from there
  if (endT >= 0 && isFree()) {
    endT += dt;
    if (endT > (st === 'WIPE' ? 2.6 : FIN_HOLD + 0.5) && !spec) { if (st === 'WIPE') { FREE.climb = { x: rig.position.x, z: rig.position.z }; splashLens(10, 1.1); audio.splash(0.35); } spawnRider(); }
  }
  // a wipeout plays out first (you see yourself go over), then the summary fades in
  else if (endT >= 0) {
    endT += dt;
    const showAt = st === 'WIPE' ? 1.4 : rider.ride && rider.ride.t > 0 ? FIN_HOLD + 0.35 : 0.2;   // (after a ride, once you've kicked out and are settling onto the board)
    if (endT >= showAt && ui.msg.style.display !== 'flex') { if (chalBan) { chalBan.classList.remove('on'); clearTimeout(chalBanT); }   // (the new-level banner steps aside as the score comes up: it sat on top of the score, and the score screen shows the level anyway)
      ui.msg.style.opacity = 0; ui.msg.style.display = 'flex'; requestAnimationFrame(() => (ui.msg.style.opacity = 1)); }
    if (endT > showAt + (st === 'WIPE' ? 4.6 : 4.0) && !spec && !contestHold) spawnRider();   // (in a contest, contest.js says what comes next)   // (long enough to read the judges' sheet)
  }
}

// ---------- automatic quality
let fpsAcc = 0, fpsN = 0, lowT = 0, highT = 0, refFps = 60, prCap = MAX_PR, capT = 0, probe = null, screenSlow = false;   // (screenSlow: a drop didn't make it faster, so the screen sets the pace, e.g. 30 Hz Low Power Mode, not the chip; a slow chip itself never climbs to more sharpness than it can draw at 60)
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
  if (probe) { if (++probe.t < 2) return; if (fps < probe.fps * 1.12) { screenSlow = true; pr = probe.pr; renderer.setPixelRatio(pr); prCap = pr; capT = 60; refFps = Math.min(refFps, fps + 2); } probe = null; lowT = highT = 0; return; }
  const riding = rider && (rider.state === 'RIDE' || rider.state === 'POP');
  if (fps < refFps * (riding ? 0.88 : 0.82)) { lowT++; highT = 0; } else if (fps > refFps * 0.95) { highT++; lowT = 0; }   // (mid-ride a smaller slowdown counts: a ride should stay smooth)
  if (lowT >= 2 && pr > 0.75) { probe = { pr, fps, t: 0 }; prCap = pr - 0.05; capT = 60; pr = Math.max(0.75, pr - 0.15); renderer.setPixelRatio(pr); lowT = 0; }
  if (highT >= 6 && pr + 0.1 <= prCap && !riding && (fps >= 58 || screenSlow)) { pr = Math.min(MAX_PR, pr + 0.1); renderer.setPixelRatio(pr); highT = 0; }
  if (Q.has('debug')) document.getElementById('fps').textContent = `${Math.round(fps)} fps · pr ${pr.toFixed(2)}`;
}

// ---------- loop
const portrait = DESK ? { matches: false } : matchMedia('(orientation: portrait) and (max-width: 900px)'); let lastPortrait = false;   // (a computer never waits for a turn)
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
    // (the game's home: sumbasurf.app, or the Wavedash game page when the Wavedash copy sets SS_HOME; inside Wavedash's
    // frame the jump has to move the whole page, not just the frame)
    const btn = document.getElementById('rtOpen'), url = globalThis.SS_HOME || 'https://sumbasurf.app/', host = url.replace(/^https:\/\//, '');
    const go = (to) => { try { if (window.top !== window) { window.top.location.href = to; return; } } catch (e) {} location.href = to; };
    document.querySelector('#rtApp .rtUrl').textContent = host.replace(/\/$/, '');
    if (/Android/i.test(ua)) btn.addEventListener('click', () => { go('intent://' + host + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end'); });
    else { btn.textContent = 'OPEN IN SAFARI';   // (iOS 17 and later hand an x-safari link to Safari; if the app blocks it, the same tap has already copied the link)
      btn.addEventListener('click', () => { let ok = false; try { navigator.clipboard.writeText(url).then(() => { ok = true; }, () => {}); } catch (e) {}
        go('x-safari-' + url);
        setTimeout(() => { if (document.visibilityState === 'visible') btn.textContent = ok ? 'LINK COPIED. PASTE IT IN SAFARI' : 'SEE THE LINK BELOW'; }, 1500); }); }
  } }
let liveShown = false;
let last = performance.now(), T = 0, strokeT = 0, lastState = '', lastTrick = null, crashT = 1, lastPump = false, speedFlash = 0;
// ---------- your villa: walk around the clifftop villa at Tanjung Uma, pick a board from the rack, watch the waves
const _wl = new THREE.Vector3();
const vSitB = document.getElementById('vSit');
// music: OpenMindAudio (Pixabay): all 14 reggae songs plus three island calypso and two dancehall tracks, shuffled. From the villa radio (quieter and duller the further you are from it), under the
// menu, loud at the Sumba Ranch like a pool speaker; never on the reef
const SONGS = {
  'stand-firm-like-a-tree': ['Stand Firm Like a Tree', 'OpenMindAudio'], 'barefoot-in-the-breeze': ['Barefoot in the Breeze', 'OpenMindAudio'], 'streets-still-singing': ['Streets Still Singing', 'OpenMindAudio'],
  'drop-of-peace': ['Drop of Peace', 'OpenMindAudio'], 'generational-stew': ['Generational Stew', 'OpenMindAudio'], 'shelter-in-the-storm': ['Shelter in the Storm', 'OpenMindAudio'],
  'yardman-sing-along': ['Yardman Sing Along', 'OpenMindAudio'], 'rise-again': ['Rise Again', 'OpenMindAudio'], 'moonbeam-rendezvous': ['Moonbeam Rendezvous', 'OpenMindAudio'],
  'dawn-still-knows-your-name': ['Dawn Still Knows Your Name', 'OpenMindAudio'], 'breathe-and-hold-on': ['Breathe and Hold On', 'OpenMindAudio'], 'after-the-rain-we-feast': ['After the Rain We Feast', 'OpenMindAudio'],
  'slow-kisses-warm-nights': ['Slow Kisses, Warm Nights', 'OpenMindAudio'], 'trust-the-road': ['Trust the Road', 'OpenMindAudio'], 'wish-you-warm-skies': ['Wish You Warm Skies', 'OpenMindAudio'], 'relaxed-summer-groove': ['Relaxed Summer Groove', 'OpenMindAudio'],
  'moonlit-mermaids': ['Moonlit Mermaids', 'OpenMindAudio'], 'sun-kiss-sip': ['Sun Kiss Sip', 'OpenMindAudio'],
  'break-of-day': ['Break of Day', 'OpenMindAudio'], 'old-friends': ['Old Friends', 'OpenMindAudio'], 'sunset-cup': ['Sunset Cup', 'OpenMindAudio'], 'island-after-dark': ['Island After Dark', 'OpenMindAudio'], 'carnival-weekend': ['Carnival Weekend', 'OpenMindAudio'], 'remember': ['Remember', 'OpenMindAudio'], 'elevated': ['Elevated', 'OpenMindAudio'], 'breathe-again': ['Breathe Again', 'OpenMindAudio'], 'rhythm-in-motion': ['Rhythm in Motion', 'OpenMindAudio'], 'bring-yuh-basket': ['Bring Yuh Basket', 'OpenMindAudio'], 'the-last-waltz': ['The Last Waltz', 'OpenMindAudio'], 'everyday-is-a-holiday': ['Everyday Is A Holiday', 'Brotheration Records'], 'dreaming-of-reggae': ['Dreaming Of Reggae', 'Figaro Reggae Music'], 'make-your-grey-skies-blue': ['Make Your Grey Skies Blue', 'Figaro Reggae Music'] };
const songOf = (src) => SONGS[(src || '').split('/').pop().split('?')[0].replace('.mp3', '')] || ['Island radio', ''];
// the Now playing box: tap it and back / next buttons open under the song (they fold away again after a few seconds)
{ const box = document.getElementById('vSong'); let shut = null; const later = () => { clearTimeout(shut); shut = setTimeout(() => box.classList.remove('open'), 6000); };
  const tap = (e) => { e.preventDefault(); e.stopPropagation(); if (!musPaused) audio.musicKick(); box.classList.toggle('open'); later(); };
  box.addEventListener('click', tap); box.addEventListener('touchstart', tap, { passive: false });
  for (const [id, f] of [['mPrev', () => audio.musicPrev()], ['mNext', () => audio.musicNext()], ['mPlay', () => { musPaused = !musPaused; box.classList.toggle('paused', musPaused); box.querySelector('i').textContent = musPaused ? 'Paused' : 'Now playing'; document.getElementById('mPlay').setAttribute('aria-label', musPaused ? 'Play' : 'Pause'); }]]) { const b = document.getElementById(id), go = (e) => { e.preventDefault(); e.stopPropagation(); f(); if (!musPaused) audio.musicKick(); later(); };
    b.addEventListener('click', go); b.addEventListener('touchstart', go, { passive: false }); } }
audio.onTrack = (src) => { const [t] = songOf(src); if (villaW) villaW.setSong(t, ''); document.getElementById('vSongT').textContent = t; document.getElementById('vSongA').textContent = ''; };   // (song name only: Pixabay's licence doesn't need the artist credited, his call 28 Sep 2026)
const MUSIC = ['stand-firm-like-a-tree', 'barefoot-in-the-breeze', 'streets-still-singing', 'drop-of-peace', 'generational-stew', 'shelter-in-the-storm', 'yardman-sing-along', 'rise-again', 'moonbeam-rendezvous', 'dawn-still-knows-your-name', 'breathe-and-hold-on', 'after-the-rain-we-feast', 'slow-kisses-warm-nights', 'relaxed-summer-groove', 'moonlit-mermaids', 'sun-kiss-sip', 'break-of-day', 'old-friends', 'sunset-cup', 'breathe-again', 'rhythm-in-motion', 'bring-yuh-basket', 'the-last-waltz', 'everyday-is-a-holiday', 'dreaming-of-reggae', 'make-your-grey-skies-blue', 'island-after-dark', 'carnival-weekend', 'remember', 'elevated', 'trust-the-road', 'wish-you-warm-skies'].map((n) => 'music/' + n + '.mp3?v=2');   // (v=2: every song evened out to the same loudness, 29 Sep 2026)
let radioOn = true;   // (the villa's speakers, all together)
let musPaused = false;   // (paused from the Now playing box: the song holds its place, the box stays up to start it again)
let earOn = false; try { earOn = localStorage.getItem('sumbasurf.ear') === '1'; } catch (e) {}   // an earpiece while you surf: your call, remembered
{ const eb = document.getElementById('ear'), show = () => { eb.classList.toggle('on', earOn); document.body.classList.toggle('earon', earOn); eb.querySelector('span').textContent = earOn ? 'EARPIECE ON' : 'EARPIECE'; };
  show(); const t = (e) => { e.preventDefault(); e.stopPropagation(); earOn = !earOn; try { localStorage.setItem('sumbasurf.ear', earOn ? '1' : '0'); } catch (err) {} show(); audio.musicKick(); };
  eb.addEventListener('touchstart', t, { passive: false }); eb.addEventListener('click', t); }
// back / next song while surfing with the earpiece in (his ask 30 Sep 2026); the song's name shows beside them for a moment
{ const nm = document.getElementById('earSong'); let hide = 0;
  for (const [id, f] of [['earPrev', () => audio.musicPrev()], ['earNext', () => audio.musicNext()]]) {
    const go = (e) => { e.preventDefault(); e.stopPropagation(); f(); audio.musicKick(); nm.textContent = songOf(audio.now)[0]; nm.classList.add('show'); clearTimeout(hide); hide = setTimeout(() => nm.classList.remove('show'), 2500); };
    const b = document.getElementById(id); b.addEventListener('touchstart', go, { passive: false }); b.addEventListener('click', go); } }
function musicTick() {
  if (!audio.mel) return;
  const playing = document.body.classList.contains('playing');
  if (!playing) return audio.musicLevel(0.45);
  if (mode === 'villa' || isRanch()) audio.gameLevel(1);
  if (mode === 'villa' && walker && villaW) { if (!radioOn) { document.getElementById('vSong').classList.remove('on'); return audio.musicLevel(0); } let d = 1e9; for (const R of villaW.sounds.speakers) d = Math.min(d, Math.hypot(R[0] - walker.x, R[1] - walker.z, R[2] - (walker.y - 1.2)));   // (the nearest speaker)
    document.getElementById('vSong').classList.toggle('on', !drone.on && ((d < 7 && !walker.watch) || document.getElementById('vSong').classList.contains('open')));   // (kept up while you're using its buttons)
    if (musPaused) return audio.musicLevel(0);
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
// a contest room (the Wavedash copy): the villa belongs to the players, so its own people stay away; inputLock holds
// your feet still while a room panel is open (typing, picking a board)
let roomMode = false, inputLock = false;
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
  ssEvent('villa');
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
    ssEvent('drone');
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
  if (showW.on) ssEvent('showoff');
  showW.stop(); showB.classList.remove('on'); showB.querySelector('span').textContent = 'DRONE SHOW'; document.body.classList.remove('show');
  if (now) { applyNight(0); dayEnv = null; }
}
function showStart(skip = 0) {   // (skip: seconds already played, when joining a show a friend started)
  const W_ = walker; if (!W_ || !villaW) return;
  ssEvent('show');
  if (!showW) showW = droneShow(scene);
  if (drone.on) droneSet(false); if (W_.sit) vStand(); if (W_.watch) document.getElementById('vWatch').click(); if (W_.zoom) document.getElementById('vZoom').click();
  if (!dayEnv) dayEnv = { gold: ENV.uGold.value, sunVis: ENV.uSunVis.value, cloud: ENV.uCloud.value, hemi: hemi.intensity, sun: sunLight.intensity, exp: renderer.toneMappingExposure,
    ...Object.fromEntries(['zen', 'hor', 'sunCol', 'fog', 'deep', 'turq'].map((c) => [c, ENV['u' + c[0].toUpperCase() + c.slice(1)].value.clone()])) };
  // out at the corner of the balcony, where it wraps round the two sea sides, looking out to the open sea (not along the
  // bay parallel to the house): the show is 130 m out
  // (standing just off the corner and looking a little more out to sea than the diagonal: dead on the diagonal the
  //  roof's corner post stood right in the middle of the show)
  // (the show is placed for that corner, but you stay where you are: no more jump to the balcony, his call 28 Sep 2026)
  const lx = VILLA.x1 + 1.7, lz = VILLA.z0 - 1.8, ya = -115 * Math.PI / 180, dx = Math.cos(ya), dzz = Math.sin(ya);   // (villa east = world -x, south = world -z)
  const bx = 88 - lx, bz = 31 + lz;
  const dz = SPOTS.medium.dz, C = new THREE.Vector3(bx + dx * 130, 0, bz + dz + dzz * 130); C.y = heightAt(waves, C.x, C.z);
  showW.start(C, new THREE.Vector3(-dzz, 0, dx));   // (left to right as you look at it)
  if (skip > 0) showW.seek(skip);   // (catch up with a show already under way)
  showB.classList.add('on'); showB.querySelector('span').textContent = 'END SHOW'; document.body.classList.add('show');
  const tip = document.getElementById('vTip'); tip.textContent = 'Drone show out over the sea. The balcony has the best view.'; tip.style.opacity = 1; clearTimeout(tip.t); tip.t = setTimeout(() => { tip.style.opacity = 0; }, 4000);
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
  if (!villaW || mode !== 'villa') return; _vp.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); _vr.setFromCamera(_vp, camera); _vr.far = 7;
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
  if (friendsW && roomMode) friendsW.group.visible = false; else if (friendsW) friendsW.update(dt, T, beat, { x: walker.x, y: walker.y, z: walker.z + SPOTS.medium.dz }, camera); if (villaW.tick) villaW.tick(dt, beat, walker.x, walker.z, walker.y - 1.65);
  if (showW && dayEnv) { showW.update(dt, renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)), beat); applyNight(showW.night);
    if (showW.done && showB.classList.contains('on')) showOff();   // (over: the button goes back, the evening comes back)
    if (showW.done && showW.night < 0.005) { applyNight(0); dayEnv = null; } }
  const W_ = walker, V = villaW;
  // walk: the stick (or WASD / arrows) in the direction you're facing, sliding along anything solid
  const kx = inputLock ? 0 : (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), kz = inputLock ? 0 : (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
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
    for (const q of crewW.surfers) { if (q.st === 'RIDE' && q.tubeT > 2.4 && !q.hooted) { q.hooted = true; const d = Math.hypot(q.p.x - W_.x, q.p.z - (W_.z + SPOTS.medium.dz)); audio.hoot(Math.max(0.2, Math.min(1, 70 / d))); if (friendsW && !roomMode && Math.random() < 0.6) friendsW.say('nando', ['Did you see that? Spat right out of it!', 'Barrel! What a ride!', 'Deep in there, whoa!', 'That one was all time, brother.'][Math.random() * 4 | 0]); } if (!(q.tubeT > 0.1)) q.hooted = false; } }
  W_.gazeT = (W_.gazeT || 0) - dt;
  if (W_.gazeT <= 0) { W_.gazeT = 0.2; _vp.set(0, -0.1); _vr.setFromCamera(_vp, camera); _vr.far = 4.5;
    const hit = _vr.intersectObjects(V.rack, true)[0], t = hit ? hit.object.userData.type : null;
    if (t) { W_.gazeOff = 0; if (t !== vPickType) vPick(t); } else if (vPickType && (W_.gazeOff = (W_.gazeOff || 0) + 0.2) > 1.2 && Math.hypot(W_.x - V.rackAt.x, W_.z - V.rackAt.z) > 5) vPick(null); }
  const moving = Math.hypot(mx, mz) > 0.1; if (moving) W_.arr = 0; else deckSpread(W_); W_.bob = (W_.bob || 0) + (moving ? dt * 8 : 0);
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
    const stallOn = !!input.stallBtn || keys.has('ShiftLeft') || keys.has('ShiftRight') || !!(input.stick && input.stick.y > 0.5);
    const pumpOn = inp.pump || !!(input.stick && input.stick.y < -0.3);
    const o = surfSteer(tubeK > 0.5 ? -inp.steer : inp.steer, stallOn);
    inp.steer = o.steer; inp.pump = pumpOn; inp.stall = o.stall;
  }
  if (rider) {
    if (spec) specApply(dt);   // (watching a friend in a contest: their waves and their surfer, no physics of our own)
    else { updateWaves(dt); rider.update(dt, inp, waves); if (isFree()) boatBump(rider); }
    updateRanch(dt);
    rider.caughtT = rider.washed ? 6 : Math.max(0, (rider.caughtT || 0) - dt);   // (remember being washed in for a few seconds: that's why you ended up inside)
    // drifting too far inside or out wide on a lie: bring the surfer back to the lineup (the pool's walls hold you in)
    if (!spec && isFree() && rider.state === 'LIE' && rider.z > REEF.zBeach - 70 && groundAt(rider.x, rider.z) > heightAt(waves, rider.x, rider.z) - 0.45) rider.z -= 4 * dt;   // (the edge of the sand: the shallows hold you off it, his call 30 Sep 2026: nothing to do on the beach, so no walking there)
    if (!spec && isFree() && rider && rider.state === 'LIE' && (rider.x < -190 || rider.x > 210 || rider.z < -90)) { rider.x = Math.max(-190, Math.min(210, rider.x)); rider.z = Math.max(-90, rider.z); FREE.edgeT = 2.5; }   // (the edge of the bay: you just can't paddle further, and the pill up top says to head back; it used to end your go with a score screen, which the free beach no longer has, so it reset you on the spot again and again)   // (the free-surf beach: the whole bay is yours to paddle round)
    else if (!spec && !isRanch() && !isFree() && rider.state === 'LIE' && (rider.z > 40 || Math.abs(rider.x - 5) > 70 || rider.z < -60)) { rider.out(rider.z > 40 && rider.caughtT > 0 ? 'Caught inside: the whitewater washed you in' : 'Drifted out of the lineup'); }
    stallFx(dt);
    if (!spec && finishing()) { if (rider.finTh === undefined) rider.finTh = rider.th; const want = -Math.PI / 2, d = Math.atan2(Math.sin(want - rider.th), Math.cos(want - rider.th)), room = 0.7 - Math.abs(Math.atan2(Math.sin(rider.th - rider.finTh), Math.cos(rider.th - rider.finTh)));
      if (room > 0) rider.th += Math.sign(d) * Math.min(Math.abs(d), room, dt * 1.9); } else if (rider.state !== 'OUT') rider.finTh = undefined;   // (the kick-out: up to ~40 deg round toward the open sea, up the face and over the back as the wave rolls on under you)
    updateRig(dt, T);
    if (mixer) { mixer.update(dt); paddleArms(dt); dtArm = dt; surfStance(); }
    updateLeash(); updateScenery(dt); updateLocals(dt);
    railSpray.update(dt); bowGlow.update(dt);
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
    if (st === 'LIE' && rider.paddling) { strokeT -= dt * 1.6; if (strokeT <= 0) { strokeT = 0.55; audio.paddle(); bowGlow.stroke(); } }
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
  } else if (isFree() && strand) {
    strandTick(dt);
  } else if (mode === 'villa' && walker) {
    villaTick(dt);
  } else {
    // behind the start screen (his call, 29 Sep 2026): sitting on your board out the back, looking out to sea as the
    // sets come in. Each wave rises out of the distance, the peak pitching off to one side and peeling toward you, and
    // lifts you up and over its shoulder before it breaks behind you; then the next
    if (!tick.demo) { tick.demo = new Wave(scene, CONDITIONS.medium); tick.demo.t0 = T; tick.demo.prof = new Profile(tick.demo); }   // (its shape, for the sea under your board)
    const w = tick.demo, C = w.cond, P = 24, ARR = 18, CX = M_SIT.x, CZ = M_SIT.z, t = (T - w.t0) % P;   // (a wave every 24 s, under you 18 s in)
    w.place(CX + M_SIT.ahead - C.peel * (ARR - t), CZ - C.speed * (ARR - t));   // (the break reaches M_SIT.ahead m short of you as it passes: you're on its shoulder)
    w.fade = Math.min(1, Math.max(0.15, 1 + (w.zW + 160) / 60)); w.update(dt);
    railSpray.update(dt); bowGlow.update(dt); wake.update(dt); track.update(dt);   // (let any spray left from the last ride fall and fade)
    leash.visible = false; jukung.visible = false; for (const L of locals) L.grp.visible = false; for (const b of birds) b.visible = false;   // the menu shows only the sea
    const sw = Math.sin(T * 0.45), y = heightAt([w], CX, CZ), ty = heightAt([w], CX, CZ - 3);   // (the sea under you, and a board length out: the board tips up the face as it lifts you)
    rig.visible = true; board.visible = true; rig.position.set(CX, y + 0.05, CZ); rig.quaternion.setFromEuler(new THREE.Euler(-0.12 - Math.atan2(ty - y, 3) + 0.02 * sw, Math.PI + 0.35, 0.03 * Math.sin(T * 0.7), 'YXZ'));
    const ey = Math.max(y, ty - 0.6, heightAt([w], CX, CZ - 1.5) - 0.3) + 0.95; camera.position.set(CX, ey, CZ + 0.45);   // (your eyes, sitting up just behind the middle of the board: kept clear of the crest as it passes under you)
    camera.lookAt(CX + M_SIT.lookX + 2 * sw, ey + M_SIT.lookY + 0.4 * Math.sin(T * 0.31), CZ - 40);
  }
  if (rider && tick.demo) { tick.demo.dispose(scene); tick.demo = null; }
  boardWater(dt);
  fx.update(dt, camera.position);
}
// the water's surface under your board, for the board's foam line and its see-through underwater part (board.js
// BOARD_WATER): three points of the sea under the nose, the tail and a rail, as a plane in world space
const _bwA = new THREE.Vector3(), _bwB = new THREE.Vector3(), _bwC = new THREE.Vector3(), _bwN = new THREE.Vector3(), _bwU = new THREE.Vector3(), _bwV = new THREE.Vector3();
function boardWater(dt) {
  const U = BOARD_WATER; U.uBTime.value += dt;
  FADE.value.x = 0.32 + 0.45 * noseV; FADE.value.y = 0.64 + 0.5 * noseV;   // (up on the longboard's nose your shoulders and chest can swing near the lens as you lean and wobble: they fade softly from further out; hands stay solid)
  ENV.uBDim.value.z = 0;
  if (!rider || !rig.visible || mode === 'villa' || (W.on && rider.state === 'WIPE')) { U.uWOn.value = 0; return; }
  rig.updateMatrixWorld(); const L = BOARD_LENGTH(boardType) * 0.46, bw = BOARD_WIDTH(boardType) * 0.5;
  board.localToWorld(_bwA.set(0, 0, L)); board.localToWorld(_bwB.set(0, 0, -L)); board.localToWorld(_bwC.set(bw, 0, 0));
  for (const p of [_bwA, _bwB, _bwC]) p.y = heightAt(waves, p.x, p.z);
  _bwN.crossVectors(_bwU.subVectors(_bwB, _bwA), _bwV.subVectors(_bwC, _bwA)).normalize(); if (_bwN.y < 0) _bwN.negate();
  if (!(_bwN.y > 0.2)) { U.uWOn.value = 0; return; }   // (a degenerate or silly plane: no effect rather than a wrong one)
  board.localToWorld(_bwU.set(0, -0.01, 0));   // (the sea's slope from the physics, its height from the board's own hull amidships: where the board is seen to sit on the drawn water)
  ENV.uBInv.value.copy(board.matrixWorld).invert(); ENV.uBDim.value.set(BOARD_LENGTH(boardType) * 0.5, BOARD_WIDTH(boardType) * 0.5 * Math.abs(board.scale.x || 1), 1, 0);   // (the water's foam round the board)
  U.uWP.value.set(_bwN.x, _bwN.y, _bwN.z, _bwN.dot(_bwU)); U.uWOn.value = 1; U.uWCol.value.copy(ENV.uTurq.value).lerp(ENV.uDeep.value, 0.35);
}
// flipping the picture: the camera's projection mirrored left to right, and every triangle's facing with it (done at
// the GL call, so the renderer's own bookkeeping stays as it is)
const flipProj = (cam) => { cam.projectionMatrix.elements[0] *= -1; cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); };
{ const gl = renderer.getContext(), ff = gl.frontFace.bind(gl); gl.frontFace = (m) => ff(MIRROR ? (m === gl.CW ? gl.CCW : gl.CW) : m); }
// heat (28 Sep 2026, measured on his 2019 MacBook Pro: the menu kept its graphics chip 86% busy): never more than 60
// pictures a second (a 120 or 144 Hz screen drew twice the work for nothing), and the menu, where the wave is only the
// backdrop behind the panels, 30. A skipped frame does nothing at all, and the next one simply covers the longer time
// (heat, second pass the same night): a picture that isn't moving (the game waiting while a phone is held upright, or
// paused) is drawn 4 times a second, not 60; one nobody can see (Wavedash's send-your-phone card, the computer card
// on sumbasurf.app) the same; and 30 when you can't be playing: the contest board open over the villa, or the game's
// window in the background on a computer (you're in another app or tab beside it)
const M_SIT = { x: 40, z: 0, ahead: -40, lookX: -14, lookY: 0.6 };   // the menu's seat: where you sit, how far down the wave the break is as it passes you, where you look
// behind the menu (his call 29 Sep 2026): Tanjung Uma by day, Pantai Bintang's moonlit night from 7 pm to 7 am on the
// player's own clock (wherever they are). Decided when the game opens and each time you come back to the menu, never
// switched while you're looking at it
function menuSpot() { const h = new Date().getHours(); return h >= 19 || h < 7 ? 'bintang' : 'medium'; }
if (menuSpot() !== 'medium') { setWeather(menuSpot()); setSpot(menuSpot()); }   // (by day the menu is already Tanjung Uma, as the game starts)
let drawnT = 0, menuWas = false;
renderer.setAnimationLoop(() => {
  const now0 = performance.now(), menu = ui.start.style.display !== 'none' && !starting, B = document.body.classList;
  const still = (window.__g && window.__g.paused) || (portrait.matches && ui.start.style.display === 'none') || B.contains('covered') || B.contains('phoneonly');
  const step = still ? 250 : menu || B.contains('cBoard') || (DESK && !document.hasFocus()) ? 1000 / 30 : 1000 / 60;
  if (now0 - drawnT < step - 3) return;   // (3 ms spare: a 60 Hz screen's frames arrive a little early or late, and none may be skipped)
  drawnT = Math.max(drawnT + step, now0 - step);   // (kept on a steady 60 or 30 beat, whatever the screen's own pace)
  const slow = step > 20;
  if (slow !== menuWas) { menuWas = slow; fpsAcc = 0; fpsN = 0; lowT = highT = 0; probe = null; }   // (a slower pace on purpose (the menu, a covered or background window) never counts as the chip being slow, or fast)
  const now = now0, dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!(window.__g && window.__g.paused) && (!portrait.matches || ui.start.style.display !== 'none')) tick(dt);   // turned upright: the game waits (the menu's wave keeps rolling behind the turn-your-phone screen)
  if (!liveShown && (tick.demo || mode)) { liveShown = true; requestAnimationFrame(() => document.body.classList.add('live')); }   // (the wave is drawn: the poster behind the turn-your-phone screen fades away)
  if (portrait.matches !== lastPortrait) { lastPortrait = portrait.matches; if (document.body.classList.contains('playing')) audio.pause(portrait.matches); }   // (and so does the sound: no endless drone while it waits)
  // pass 1: the world; pass 2: your body through its own lens (skipped when a test view shows the body in the world cam)
  const mir = MIRROR; if (mir) flipProj(camera);   // (a right-hand spot: the picture drawn flipped left to right)
  HIDELEGS.value = camera.layers.isEnabled(1) || mode === 'villa' ? 0 : 1;
  for (const h of hairMeshes) h.visible = camera.layers.isEnabled(1);   // (walking round the villa, your legs are yours again)
  // the ride's over (the score is up): your body settling back onto the board moves faster than your eyes follow, and
  // from just behind it you'd see your own back; it isn't drawn in your view until you're back in the lineup
  if (surfer && !W.on) surfer.visible = !(tick.demo && !rider && mode !== 'villa') && !(rider && rider.state === 'OUT' && !camera.layers.isEnabled(1));   // (the menu: just your board, no body)
  ARMTH.value = rider && rider.standing ? 0.02 : 0.12;   // standing, shoulder skin is kept whole (no holes up the arm); sitting or lying your shoulder is right at the lens, so it's cut away   // (outside views, e.g. tests and replays, show the whole body)
  if (isFree()) boatTick(dt); else if (boat) { boat.visible = false; if (boatBtn) boatBtn.hidden = true; }
  if (peers.size) peersTick(dt);   // (friends on the free beach)
  if (camera.layers.isEnabled(1) || (tick.demo && !rider && mode !== 'villa')) renderer.render(scene, camera);   // (the menu has no arms to draw: one pass)
  else {
    if (foamK && !(rider && rider.state === 'WIPE' && W.on)) setFoam(0);   // (never left on screen: back to the menu mid-wipeout, the villa)
    ARMCUT.value = rider && rider.standing ? armCutNow() : 0; WATERY.value = rider && rider.state === 'LIE' && !W.on ? rig.position.y + 0.01 : -99;
    armK += ((rider && rider.standing && !(W.on) ? 1 : 0) - armK) * Math.min(1, dt * 4);
    armCam.position.copy(camera.position); armCam.quaternion.copy(camera.quaternion);
    armCam.aspect = camera.aspect; armCam.fov = camera.fov + (62 - camera.fov) * armK; armCam.updateProjectionMatrix(); if (mir) flipProj(armCam);
    renderer.autoClear = false; renderer.clear(); renderer.render(scene, camera); renderer.clearDepth(); scene.matrixWorldAutoUpdate = !!globalThis.__slowMat; renderer.render(scene, armCam); scene.matrixWorldAutoUpdate = true; renderer.autoClear = true;   // (the arms pass draws the same scene a moment later: nothing has moved, so don't work everything out again)
  }
  if (mir) { flipProj(camera); if (!camera.layers.isEnabled(1)) flipProj(armCam); }   // (both lenses back to normal between frames)
  if (!menuWas) autoQuality(dt); musicTick();
});

// ---------- the surf contest (the Wavedash copy's contest.js drives this; on sumbasurf.app none of it ever runs)
// Watching a friend's wave: their game sends what the waves and their surfer are doing 15 times a second; here the same
// spot is drawn with no surfer of your own to steer. The waves are placed where theirs are, your surfer is posed from
// theirs (so the camera sits in their head and sees what they see), and the rest (spray, sound, the view) runs as normal.
const SPEC_LAG = 0.2;   // (seconds behind the surfer: room to glide smoothly between their updates)
const SPEC_NUM = ['x', 'y', 'z', 'vx', 'vz', 'v', 'th', 'lean', 'turn', 'skid', 'slide', 's', 'zl', 'hx', 'hz', 'gAlong', 'stateT', 'relS', 'liftT', 'paddleT', 'padUp', 'foamT', 'tubeOut', 'catchT', 'vyS', 'stalling', 'pumpT', 'weave'];
const r3 = (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
function contestSnap() {
  if (!rider || spec) return null;
  const r = {}; for (const k in rider) if (k !== 'wave') r[k] = rider[k];
  for (const v of waves) if (!v.sid) v.sid = ++waveSeq;
  r.waveId = rider.wave ? rider.wave.sid : 0;
  const w = waves.map((v) => [v.sid, v.tBreak, v.size || 1, v.pkX || 0, v.pkZ || 0, v.px || 0, v.peelRate || 0, v.secK || 0, v.secA || 1, v.closing ? 1 : 0, v.closeT || 0, v.spat ? 1 : 0, v.spitT || 0]);
  return JSON.stringify({ T, pad: input.paddle ? 1 : 0, rk: ranchKind, r, w }, r3);
}
async function specStart(m) {
  try { await ready; } catch (e) { return; }
  starting = false; chalHide(); if (drone.on) droneSet(false); showOff(true); glareTick(false);
  if (surfer) endWipe(); walker = null; vPick(null); document.body.classList.remove('villa', 'riding', 'ranch-wait'); setHfov(50);
  mode = m; setWeather(m); setSpot(m); audio.start(); audio.quiet(false); document.body.classList.toggle('reef', m !== 'ranch');
  ui.start.style.display = 'none'; document.body.classList.add('playing', 'watching');
  session = { waves: 0, total: 0, best: 0, scores: [], barrels: 0 };
  for (const w of waves) w.dispose(scene); waves = [];
  spec = { buf: [], t: null }; spawnRider(); endT = -1;
  ui.cond.textContent = modeName(mode);
}
function specFeed(json) {
  if (!spec) return; let o; try { o = JSON.parse(json); } catch (e) { return; }
  if (!o || !o.r || !Array.isArray(o.w) || !isFinite(o.T)) return;
  const B = spec.buf; if (B.length && o.T <= B[B.length - 1].T) { if (o.T < B[B.length - 1].T - 5) B.length = 0; else return; }   // (late or repeated: dropped; a restart on their side: begin again)
  B.push(o); if (B.length > 40) B.shift();
}
function specApply(dt) {
  const B = spec.buf; if (!B.length) return;
  const want = B[B.length - 1].T - SPEC_LAG;
  if (spec.t == null || Math.abs(spec.t - want) > 1.5) spec.t = want;   // (the first update, or after a stall: jump there)
  else spec.t += dt + (want - spec.t) * Math.min(1, dt * 1.5);          // (otherwise run at the normal speed, drifting gently onto their clock)
  while (B.length > 2 && B[1].T <= spec.t) B.shift();
  const a = B[0], b = B[1] || B[0], f = b.T > a.T ? Math.max(0, Math.min(1, (spec.t - a.T) / (b.T - a.T))) : 1;
  T = Math.max(a.T, Math.min(b.T, spec.t));
  if (b.rk) ranchKind = b.rk;
  // their waves, one for one
  const keep = new Set();
  for (const q of b.w) {
    const id = q[0]; keep.add(id);
    let w = waves.find((v) => v.sid === id); if (!w) { w = addWave(q[1]); w.sid = id; }
    const p = a.w.find((v) => v[0] === id) || q, L = (i) => p[i] + (q[i] - p[i]) * f;
    w.tBreak = q[1]; w.size = q[2]; w.pkX = q[3]; w.pkZ = q[4]; w.px = L(5); w.peelRate = q[6]; w.secK = q[7]; w.secA = q[8]; w.closing = !!q[9]; w.closeT = L(10); w.spat = !!q[11];
    if (q[12] > 0 && !w.specSpit && w.spitT !== undefined) w.spitT = q[12]; w.specSpit = q[12] > 0;   // (the spit, once each time theirs spits)
  }
  for (let i = waves.length - 1; i >= 0; i--) if (!keep.has(waves[i].sid)) { waves[i].dispose(scene); waves.splice(i, 1); }
  for (const pr of PROFILES.values()) pr.warm(24);
  for (const pr of PROFILES_W.values()) pr.warm(12);
  for (const w of waves) {   // (placed, faded and moved as updateWaves does it)
    const C = w.cond, t = T - w.tBreak;
    w.place(w.pkX + w.px, w.pkZ + C.speed * t);
    const reefK = Math.min(1, Math.max(0, (REEF.xEnd - w.peelX) / 38)), beachK = Math.min(1, Math.max(0, (REEF.zBeach - w.zW) / 45));
    w.endK = Math.min(reefK, beachK); w.endBy = beachK < reefK ? 'beach' : 'reef';
    w.fade = (w.size || 1) * (w.closing ? 1 - 0.97 * smooth01((w.closeT - 1.5) / 5.5) : reefK) * Math.min(1, Math.max(0.15, 1 + (w.zW + 160) / 60));
    if (isRanch()) w.fade = Math.min(1, Math.max(0.02, (w.zW - POOL.z0) / 22)) * w.endK;
    w.update(dt, !globalThis.__slowMat && !(rider && rider.wave === w) && Math.hypot(w.peelX - camera.position.x, w.zW - camera.position.z) > 120);
  }
  // their surfer: everything as it was on their side, the moving parts eased between their updates
  const R = b.r; for (const k in R) if (k !== 'waveId') rider[k] = R[k];
  for (const k of SPEC_NUM) if (typeof a.r[k] === 'number' && typeof R[k] === 'number') rider[k] = a.r[k] + (R[k] - a.r[k]) * f;
  rider.wave = waves.find((v) => v.sid === R.waveId) || null;
  input.paddle = !!b.pad;
}
window.__g = { freeStart: (ext) => { FREE.forceX = !!ext; return start('free'); }, freeNet: FREE.net, freeWaveOut, freeWaveApply, freeWaveState, freeWaveSync, freeClearWaves, freeBecomeHost, freeSnap, freePeer, freePeerGone, freeSay, freeShorts, freeFollow, peersTick: (dt) => peersTick(dt), get following() { return FREE.follow || null; }, get followD() { return FREE.followD || 0; }, shortsFor: (id) => shortsFor(id), get peers() { return peers; }, hint: (t) => setText(ui.hint, t), get strand() { return strand; }, groundAt: (x, z) => groundAt(x, z), shoreZ: (x) => shoreZ(x), lockRanch, get ranchDbg() { return { people: !!people, loading: peopleLoading, failed: peopleFailed, crowd: crowd && crowd.length, life: !!life }; }, get hfov() { return hfovHalf; }, get tubeK() { return tubeK; }, get show() { return showW; }, FADE, HIDELEGS, WATERY, ARMCUT, get mirror() { return MIRROR; }, flipProj: (c) => flipProj(c), get walker() { return walker; }, get villaW() { return villaW; }, get drone() { return drone; }, get crew() { return crewW; }, get friends() { return friendsW; }, get room() { return roomMode; }, set room(v) { roomMode = !!v; if (friendsW) { if (roomMode) friendsW.hide(); friendsW.group.visible = !roomMode && mode === 'villa'; } }, set inputLock(v) { inputLock = !!v; }, toMenu: () => toMenu(), get villa() { return villaW; }, get mode() { return mode; }, get wild() { return wildW; }, startVilla: () => startVilla(), useBoard: (t) => useBoard(t), useStance: (k) => useStance(k), get board() { return boardType; }, get stance() { return stance; }, get spotSel() { return spotSel; }, selSpot: (m) => selSpot(m), MUSIC, songOf: (src) => songOf(src), ranchSend: (k) => ranchSend(k), paused: false, cutaway, CUT, armCam, audio, renderer, scene, camera, rig, get surfer() { return surfer; }, get rider() { return rider; }, get waves() { return waves; }, incoming, input, keys, setMode: (m) => { mode = m; setWeather(m); setSpot(m); ui.cond.textContent = modeName(m); for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 15; for (const z of FREE) z.next = undefined; updateWaves(0); }, step: (sec, dt = 1 / 30, draw = true) => { for (let t = 0; t < sec; t += dt) tick(dt); if (draw) renderer.render(scene, camera); }, spawnRider, splashLens, get T() { return T; }, set T(v) { T = v; }, showStart: (skip) => showStart(skip), showOff: () => showOff(), get showOn() { return !!(showW && showW.on); }, start: (m, quick) => start(m, quick), contestSnap, specStart: (m) => specStart(m), specFeed, get watching() { return !!spec; }, get hold() { return contestHold; }, set hold(v) { contestHold = !!v; }, respawn: () => spawnRider(), timeUp: () => { if (rider && !spec && rider.state === 'LIE') rider.out('Out of time: no wave caught'); }, want: () => _want };
