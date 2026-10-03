// Free surf teaser (30 Sep 2026): four long, smooth shots of friends surfing the free beach together, filmed frame by
// frame at 1080x1920 (vertical) with the game paused and stepped exactly 1/30 s a frame. Frames go to the local receiver
// (scratchpad recv.py on :8799, /b?shot=). The friends are drawn by the game itself (its friend models and name tags):
// paddlers and people on the boat are fed in as friend messages, and the one surfing is you (the bot riding), mirrored
// in as a friend so the camera can film you from outside.
//   const R = await import('./test/fsreel.js?x=1'); await R.setup(); await R.run('paddle')   (repeat run until done)
import * as THREE from 'three';
import { brain, carveBrain } from './sim2.js';
import { heightAt } from '../js/surf.js?v=234';
const G = () => window.__g;
export const OPT = { tick: true };
const FPS = 30, W = 1080, H = 1920;
// a clock that only moves when a frame is filmed: the friends' smoothing runs on performance.now()
const realNow = performance.now.bind(performance); let VT = 0, vOn = false;
performance.now = () => (vOn ? VT : realNow());
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 4000); cam.layers.set(0);
const BOAT = { x: -52, z: 92 }, PEAK = { x: -161, z: -8.5 };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (k) => k * k * (3 - 2 * k);
const qYaw = (th) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2 - th);
// ---- friends
const F = {};   // id -> { name, kind: 'pad'|'deck', x, z, th, v, lx, lz, yaw, board }
const KAI = { on: false };   // (you, mirrored in as the friend Kai)
function feed() {
  const g = G();
  for (const [id, f] of Object.entries(F)) {
    if (f.kind === 'deck') { g.freePeer(id, ['DECK', +f.lx.toFixed(2), 0, +f.lz.toFixed(2), +f.yaw.toFixed(3)], f.name, VT); continue; }
    const q = qYaw(f.th), y = heightAt(g.waves, f.x, f.z);
    g.freePeer(id, ['LIE', f.x, y, f.z, q.x, q.y, q.z, q.w, 5, f.v, 0, 0, 0, 0, 0, 0, 0, f.board || 'short', f.stance || 'regular', 0, f.v > 0.1 ? 1 : 0, 0, 0], f.name, VT);
  }
  // you, riding, as the friend 'Kai' (far off to the side before you stand up, so you never shove into yourself: the
  // game keeps friends from overlapping you, and a ride is placed by where you are on the wave, not by x and z)
  if (KAI.on) { const a = g.freeSnap(); if (a && a[0] !== 'DECK' && a[0] !== 'FOOT') { a[1] += 600; a[3] += 600; g.freePeer('kai', a, 'Kai', VT); } }
}
function stepFrame(n = 1) {
  const g = G();
  for (let i = 0; i < n; i++) {
    for (const f of Object.values(F)) if (f.kind === 'pad' && f.v) { f.x += Math.cos(f.th) * f.v / FPS; f.z += Math.sin(f.th) * f.v / FPS; }
    if (BOT.on) botInput();
    g.step(1 / FPS, 1 / 60, false); VT += 1000 / FPS; feed(); if (g.peers.size) g.peersTick(1 / FPS);   // (the game moves friends when it draws its own view, which filming skips)
  }
}
// ---- the bot surfing (you)
const BOT = { on: false, br: brain({}), cb: carveBrain({ hi: 0.62, lo: 0.3, gain: 3.0 }) };
function botInput() { const g = G(), r = g.rider; if (!r) return; let o = BOT.br(r); if (r.state === 'RIDE' && r.stateT > 1) o = BOT.cb(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? false : !!o.paddle; }
const kaiS = () => { const P = G().peers.get('kai'); return P && P.S && P.os ? P.S : null; };
// ---- drawing
function tag(name, p, dist) {   // the game's name tag over a friend's head (index.html .fsTag): small dark pill, warm white condensed type
  const v = p.clone().project(cam); if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
  const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, fs = 36, pad = 16;
  cx.save(); cx.font = `700 ${fs}px "Barlow Condensed", sans-serif`; cx.letterSpacing = '1.5px'; const w = cx.measureText(name).width + pad * 2, h = fs + 12;
  cx.globalAlpha = (dist < 60 ? 1 : 0.8) * (1 - CARD.a); cx.fillStyle = 'rgba(24,18,13,.45)'; cx.beginPath(); cx.roundRect(x - w / 2, y - h, w, h, 14); cx.fill();
  cx.fillStyle = '#fff3df'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 4; cx.fillText(name, x, y - h / 2 + 1); cx.restore();
}
const CARD = { a: 0 };
function card() {   // the end card: over the bay as the camera rises
  if (CARD.a <= 0.01) return; const a = CARD.a;
  cx.save(); cx.globalAlpha = a; const gr = cx.createLinearGradient(0, H * 0.28, 0, H * 0.62); gr.addColorStop(0, 'rgba(10,8,6,0)'); gr.addColorStop(0.5, 'rgba(10,8,6,.34)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); cx.fillStyle = gr; cx.fillRect(0, H * 0.28, W, H * 0.34);
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = 18;
  cx.fillStyle = '#ffc978'; cx.font = '800 44px "Barlow Condensed", sans-serif'; cx.letterSpacing = '9px'; cx.fillText('MULTIPLAYER', W / 2, H * 0.385);
  cx.fillStyle = '#f6ecdc'; cx.font = '900 190px "Barlow Condensed", sans-serif'; cx.letterSpacing = '0px'; cx.fillText('FREE SURF', W / 2, H * 0.47);
  cx.font = '600 52px "Barlow", sans-serif'; cx.fillText('Surf with your friends', W / 2, H * 0.52);
  cx.font = '800 46px "Barlow Condensed", sans-serif'; cx.letterSpacing = '4px'; cx.fillStyle = '#ffc978'; cx.fillText('PLAY NOW ON WAVEDASH', W / 2, H * 0.575); cx.restore();
}
function draw(fov) {
  const g = G(), r = g.renderer;
  if (r.domElement.width !== W || r.domElement.height !== H) { r.setPixelRatio(1); r.setSize(W, H, false); }
  cam.fov = fov; cam.aspect = W / H; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const rv = g.rig.visible; g.rig.visible = false;
  for (const P of g.peers.values()) if (P.os) { if (OPT.tick) P.os.tick(0, P.S, null); else P.os.group.visible = true; }   // (posed for this camera, whatever the game's own view can see)
  r.render(g.scene, cam); g.rig.visible = rv;
  cx.drawImage(r.domElement, 0, 0, W, H);
  for (const [id, P] of g.peers) { if (!P.S || !P.name || cam.position.distanceTo(P.S.pos) < 6) continue; const st = P.S.state, hy = st === 'DECK' ? 1.95 : st === 'RIDE' || st === 'POP' ? 2.3 : P.S.paddling ? 0.65 : 1.4; tag(P.name, P.S.pos.clone().add(V(0, hy, 0)), cam.position.distanceTo(P.S.pos)); }
  card();
}
let batch = [], batchShot = '';
async function flush() { if (!batch.length) return; const b = batch; batch = []; await fetch(`http://127.0.0.1:8799/b?shot=${batchShot}`, { method: 'POST', body: JSON.stringify(b) }); }
async function grab(shot, i) { if (batchShot !== shot) { await flush(); batchShot = shot; } batch.push([i, cv.toDataURL('image/jpeg', 0.93)]); if (batch.length >= 10) await flush(); }
// ---- setup: the free beach, you in the water at the lineup, nobody else yet
export async function setup() {
  const g = G(); vOn = true; VT = realNow(); g.paused = true;
  if (g.mode !== 'free') { await g.freeStart(false); }
  for (let i = 0; i < 20; i++) stepFrame();
  const fo = document.getElementById('freeOut'); if (g.strand && fo) { fo.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); await new Promise((r) => setTimeout(r, 700)); }
  for (let i = 0; i < 10; i++) stepFrame();
  // (the friend models load the first time a friend appears: one stand-in, then wait for it)
  F.tmp = { name: 'x', kind: 'pad', x: -120, z: 40, th: 0, v: 0 }; for (let t = 0; t < 40 && ![...g.peers.values()].some((P) => P.os); t++) { stepFrame(); await new Promise((r) => setTimeout(r, 150)); }
  delete F.tmp; g.freePeerGone('tmp');
  await document.fonts.load('900 100px "Barlow Condensed"'); await document.fonts.load('600 40px "Barlow"');
  for (const id of ['hint', 'fsTags']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
  return { mode: g.mode, deck: !!(g.strand && g.strand.deck), rider: g.rider && g.rider.state };
}
// ---- the takes
const T = {};
// 1: paddling out together toward the big waves, the camera gliding along beside the group
T.paddle = { n: 300, init() { const g = G(); for (const k of Object.keys(F)) delete F[k]; for (const id of [...g.peers.keys()]) g.freePeerGone(id); BOT.on = false; KAI.on = false;
    g.rider.reset(160, 120, -Math.PI / 2);   // (you: out of the way, not in this one)
    const th = Math.atan2(PEAK.z - 44, PEAK.x + 112), px = -Math.sin(th), pz = Math.cos(th);
    F.mei = { name: 'Mei', kind: 'pad', x: -112, z: 44, th, v: 1.7, board: 'short', stance: 'regular' };
    F.arif = { name: 'Arif', kind: 'pad', x: -112 + px * 2.3 - Math.cos(th) * 2.5, z: 44 + pz * 2.3 - Math.sin(th) * 2.5, th, v: 1.7, board: 'fish', stance: 'goofy' };
    F.jess = { name: 'Jess', kind: 'pad', x: -112 - px * 1.6 - Math.cos(th) * 4.5, z: 44 - pz * 1.6 - Math.sin(th) * 4.5, th, v: 1.7, board: 'long', stance: 'regular' };
    this.th = th; this.px = px; this.pz = pz; stepFrame(12); },
  frame(i) { stepFrame(); const f = F.mei, k = i / this.n, th = this.th;
    const back = 13 - 3 * ease(k), side = 1.2 + 2.2 * ease(k);   // (from behind the group, drifting in and round to one side)
    const x = f.x - Math.cos(th) * back + this.px * side, z = f.z - Math.sin(th) * back + this.pz * side, y = heightAt(G().waves, x, z) + 1.4;
    cam.position.lerp(V(x, y, z), i ? 0.25 : 1); cam.lookAt(f.x + Math.cos(th) * 12 - this.px * 0.5, 0.4, f.z + Math.sin(th) * 12 - this.pz * 0.5); return 60; } };
// 2: the ride: you on a big wave, filmed from the shoulder ahead, gliding back along the face with you
T.ride = { n: 300, init() { const g = G(); for (const k of Object.keys(F)) delete F[k]; for (const id of [...g.peers.keys()]) g.freePeerGone(id);
    KAI.on = true; BOT.on = true; g.rider.reset(PEAK.x, PEAK.z, -Math.PI / 2);
    for (let i = 0; i < FPS * 120; i++) { stepFrame(); const r = g.rider; if (r.state === 'RIDE' && r.stateT > 1.2) break; if (r.state === 'WIPE' || r.state === 'OUT') r.reset(PEAK.x, PEAK.z, -Math.PI / 2); }
    this.c = null; },
  frame(i) { stepFrame(); const S = kaiS(); if (!S) return 50; const k = i / this.n;
    const tx = S.pos.x + 13 - 4 * ease(k), tz = S.pos.z + 7, ty = Math.max(heightAt(G().waves, tx, tz) + 1.3, S.pos.y + 0.6);
    const want = V(tx, ty, tz); if (!this.c) this.c = want.clone(); this.c.lerp(want, 0.18); cam.position.copy(this.c);
    const look = S.pos.clone().add(V(0, 1.0, 0)); if (!this.l) this.l = look.clone(); this.l.lerp(look, 0.3); cam.lookAt(this.l); return 48; } };
// 3: from the boat: two friends at the rail, you riding toward them
T.boat = { n: 210, init() { const g = G(); for (const k of Object.keys(F)) delete F[k]; for (const id of [...g.peers.keys()]) g.freePeerGone(id);
    F.mei = { name: 'Mei', kind: 'deck', lx: -2.3, lz: -2.2, yaw: -2.4 }; F.arif = { name: 'Arif', kind: 'deck', lx: 0.4, lz: -5.2, yaw: -2.2 };
    KAI.on = true; BOT.on = true; g.rider.reset(PEAK.x, PEAK.z, -Math.PI / 2);
    for (let i = 0; i < FPS * 150; i++) { stepFrame(); const r = g.rider; if (r.state === 'RIDE' && Math.hypot(r.x - BOAT.x, r.z - BOAT.z) < 95) break; if (r.state === 'WIPE' || r.state === 'OUT') r.reset(PEAK.x, PEAK.z, -Math.PI / 2); }
    this.l = null; },
  frame(i) { stepFrame(); const g = G(), S = kaiS(), k = i / this.n, bt = g.scene.children.find((o) => o.isGroup && o.userData.flag);
    for (const f of [F.mei, F.arif]) if (S) { const p = bt.localToWorld(V(f.lx, 0, f.lz)); f.yaw = Math.atan2(S.pos.z - p.z, S.pos.x - p.x); }
    const eye = bt.localToWorld(V(1.7 - 0.6 * ease(k), 2.95, -0.1 - 0.8 * ease(k))); cam.position.copy(eye);   // (from the middle of the open front deck, over both friends' shoulders, drifting in)
    const look = S ? S.pos.clone().add(V(0, 0.4, 0)) : V(PEAK.x, 1, PEAK.z); if (!this.l) this.l = look.clone(); this.l.lerp(look, 0.12); cam.lookAt(this.l); return 58; } };
// 4: rising away over the bay, the boat and your friends below, the end card coming up
T.outro = { n: 200, init() { const g = G(); for (const k of Object.keys(F)) delete F[k]; for (const id of [...g.peers.keys()]) g.freePeerGone(id); BOT.on = false; KAI.on = false;
    g.rider.reset(160, 120, -Math.PI / 2);
    F.mei = { name: 'Mei', kind: 'deck', lx: -2.2, lz: -2.0, yaw: -2.4 }; F.arif = { name: 'Arif', kind: 'deck', lx: -0.8, lz: -4.6, yaw: -2.3 };
    F.jess = { name: 'Jess', kind: 'pad', x: -75, z: 70, th: -2.4, v: 1.5, board: 'long' }; F.kai = { name: 'Kai', kind: 'pad', x: -80, z: 76, th: -2.3, v: 1.5, board: 'short' };
    stepFrame(10); CARD.a = 0; },
  frame(i) { stepFrame(); const k = i / this.n, e = ease(Math.min(1, k * 1.1));
    cam.position.set(BOAT.x + 16 + 18 * e, 5 + 34 * e, BOAT.z + 22 + 40 * e); cam.lookAt(BOAT.x - 40 * e, 0, BOAT.z - 50 * e);
    CARD.a = Math.max(0, Math.min(1, (k - 0.35) / 0.25)); return 50; },
  done() { CARD.a = 0; } };
// ---- run a take, resumable (the browser tool gives ~40 s a call)
const ST = {};
export async function run(name, budget = 33000) {
  const t = T[name]; if (!t) return 'no take ' + name;
  if (!ST[name]) { ST[name] = { i: 0 }; t.init(); }
  const s = ST[name], t0 = realNow();
  while (s.i < t.n && realNow() - t0 < budget) { const fov = t.frame(s.i); draw(fov); await grab('fsr_' + name, s.i); s.i++; }
  await flush();
  if (s.i >= t.n) { if (t.done) t.done(); return `${name}: done (${t.n} frames)`; }
  return `${name}: ${s.i}/${t.n}`;
}
export function reset(name) { delete ST[name]; }
export async function peek(name, k = 0) { delete ST[name]; const t = T[name]; t.init(); let fov = 50; for (let i = 0; i <= k; i++) fov = t.frame(i); draw(fov);
  const b = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85)); await fetch(`http://127.0.0.1:8799/f?shot=fsr_peek_${name}&i=${k}`, { method: 'POST', body: b }); return 'peeked ' + name; }
export function teardown() { const g = G(), r = g.renderer; vOn = false; BOT.on = false; g.input.test = null; r.setPixelRatio(Math.min(devicePixelRatio, 1.3)); r.setSize(innerWidth, innerHeight, false); g.paused = false; }
export { cam, F, CARD, draw, cv };
// close-ups of the riding friend from all round (to vet the body): n frames of a ride, every k-th filmed from 4 sides
export async function orbitRide(shot, n = 240, k = 30) {
  const g = G(); T.ride.init(); let c = 0;
  const log = []; for (let i = 0; i < n; i++) { stepFrame(); if (i % k) continue; const S = kaiS(); if (!S) continue; log.push(S.state + (S.inBarrel ? '+B' : '') + ' L' + (+S.lean).toFixed(1) + ' me:' + g.rider.state);
    for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2 + 0.4, p = S.pos; cam.position.set(p.x + Math.cos(ang) * 3.4, Math.max(heightAt(g.waves, p.x + Math.cos(ang) * 3.4, p.z + Math.sin(ang) * 3.4) + 0.4, p.y + 1.2), p.z + Math.sin(ang) * 3.4); cam.lookAt(p.x, p.y + 0.9, p.z);
      draw(45); await grab(shot, c++); } }
  await flush(); return log;
}
// the riding friend's pose, frame by frame: head height above the board and what drives the pose, to find crumples
export function probeRide(n = 600) {
  const g = G(); T.ride.init(); const out = [], V3 = THREE.Vector3;
  for (let i = 0; i < n; i++) { stepFrame(); const P = g.peers.get('kai'); if (!P || !P.os || !P.S || P.S.state !== 'RIDE') continue; const os = P.os; os.tick(0, P.S, null);
    const head = os.B.head.getWorldPosition(new V3()), up = new V3(0, 1, 0).applyQuaternion(os.group.quaternion), base = os.group.position;
    const h = head.clone().sub(base).dot(up), hy = head.y - base.y;
    const B = os.B, wp = (n) => B[n].getWorldPosition(new V3()), tilt = (a, b) => Math.round(THREE.MathUtils.radToDeg(wp(b).sub(wp(a)).angleTo(new V3(0, 1, 0))));
    if (P.S && out.length < 99999) os.__tilts = [tilt('pelvis', 'spine_01'), tilt('spine_01', 'spine_02'), tilt('spine_02', 'spine_03'), tilt('spine_03', 'neck_01'), tilt('neck_01', 'head'), tilt('pelvis', 'head')];
    out.push([i, os.__tilts.join('/'), +hy.toFixed(2), +os.crouch.toFixed(2), +os.lean.toFixed(2), +os.twist.toFixed(2), +os.load.toFixed(2), +os.barrel.toFixed(2), +os.pumpA.toFixed(2), +os.stall.toFixed(2), +(P.S.turn || 0).toFixed(2), +up.y.toFixed(2)]); }
  return out;
}
