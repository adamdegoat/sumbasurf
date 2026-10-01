// Other surfers, seen from outside (30 Sep 2026, his call: "we do the avatar properly, then think about free surf").
// Your own body (game.js surfStance) is posed for your own eyes: arms kept out of the lens, the torso quiet so the view
// stays steady. Seen from outside that reads stiff: one crouch that tilts. This is a separate body, posed only for
// being watched, so nothing here can touch the first-person view: same model and board, its own copy of the skeleton,
// driven by a snapshot of a rider's state (what a contest or free surf would send over the network), with body language
// a surf coach would recognise:
//   trim:        front arm low and ahead over the rail, back hand relaxed by the back hip, knees soft
//   bottom turn: sink low and load the legs, lean in, front arm reaching toward the lip, inside hand dropping to the water
//   top turn / cutback: extend out of it, the front arm leads round and points down the face, shoulders turn first
//   pumping:     compress and spring with each stroke, arms swinging down and forward in time
//   barrel:      tight crouch, chest low, trailing hand along the face (frontside) or grabbing the rail (backside)
//   stall:       the wave-side hand drags in the face, weight back
// Every target is eased so a change of pose is a movement, never a snap.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeBoard, BOARD_LENGTH, BOARD_WIDTH } from './board.js?v=21';

const UP = new THREE.Vector3(0, 1, 0), INTO_WAVE = new THREE.Vector3(0, 0, -1);
const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const _k2 = new THREE.Matrix4(), _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _f = V(), _g = V(), _h = V(), _k = V(), _q1 = Q(), _q2 = Q(), _q3 = Q(), _m = new THREE.Matrix4();
const ease = (cur, want, dt, rate) => cur + (want - cur) * (1 - Math.exp(-rate * dt));

// ---- bone helpers (the same maths as game.js, on any skeleton)
function aimBone(bone, child, target, w) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _d.subVectors(_b, _a).normalize();
  _q1.setFromUnitVectors(_d, target); _q1.slerp(_q2.identity(), 1 - w);
  bone.getWorldQuaternion(_q2); bone.parent.getWorldQuaternion(_q3);
  bone.quaternion.copy(_q3.invert().multiply(_q1.multiply(_q2))); bone.updateMatrixWorld(true);
}
function turnBone(bone, axis, ang) {
  if (!bone || Math.abs(ang) < 1e-4) return;
  _q1.setFromAxisAngle(axis, ang); bone.getWorldQuaternion(_q2); bone.parent.getWorldQuaternion(_q3);
  bone.quaternion.copy(_q3.invert().multiply(_q1.multiply(_q2))); bone.updateMatrixWorld(true);
}
function setWorldBasis(bone, X, Y, Z, w) {
  _q1.setFromRotationMatrix(_m.makeBasis(X, Y, Z)); bone.parent.getWorldQuaternion(_q2); _q1.premultiply(_q2.invert());
  bone.quaternion.slerp(_q1, w); bone.updateMatrixWorld(true);
}
// two-bone arm: shoulder -> elbow -> hand to T, the elbow bending toward the pole; a soft bend always stays in
function reachArm(ua, la, hd, T, pole, w) {
  ua.getWorldPosition(_a); la.getWorldPosition(_b); hd.getWorldPosition(_c);
  const a = _a.distanceTo(_b), b = _b.distanceTo(_c), toT = _d.subVectors(T, _a); let d = toT.length();
  d = Math.min(Math.max(d, Math.abs(a - b) + 0.01), (a + b) * 0.95); toT.normalize();
  const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const pp = _e.copy(pole).addScaledVector(toT, -pole.dot(toT)).normalize();
  const elbow = _f.copy(_a).addScaledVector(toT, a * ca).addScaledVector(pp, a * sa);
  const Y = _g.subVectors(elbow, _a).normalize(), tgt = _h.copy(_a).addScaledVector(toT, d), fw = _k.subVectors(tgt, elbow).normalize();
  const Z = _b.copy(fw).addScaledVector(Y, -fw.dot(Y)); if (Z.lengthSq() < 1e-6) Z.copy(pp).negate(); Z.normalize();
  const X = _c.crossVectors(Y, Z).normalize();
  setWorldBasis(ua, X, Y, Z, w);
  const Z2 = _e.crossVectors(X, fw).normalize(); setWorldBasis(la, X, fw, Z2, w);
  hd.quaternion.slerp(_q1.identity(), 0.7 * w); hd.updateMatrixWorld(true);   // (wrist in line with the forearm)
}

// shared by every other surfer: one board of each type (geometry, painted materials, the see-through copy) cloned per
// surfer, and one copy of each body material (drawn plainly in the world, not through your own body's lens)
const BOARDS = new Map(), MATS = new Map();
function boardFor(type) {
  let b = BOARDS.get(type); if (b) return b;
  b = makeBoard(type); b.position.z = Math.max(0, (BOARD_LENGTH(type) - 1.88) * 0.33);
  // (the water's face curves over a board lying on it: seen from low down the rails hid behind the surface itself; your
  // own board has a see-through copy for that (board.js BOARD_WATER), other boards are drawn a little in front of the water)
  b.traverse((o) => { if (o.isMesh) { const m = o.material = o.material.clone(); m.polygonOffset = true; m.polygonOffsetFactor = -6; m.polygonOffsetUnits = -6; } });
  // and where the drawn water still covers it, a see-through copy shows it under the surface, in its own colours tinted
  // by the water (as your own board's copy does), pulled nearer than the board itself (level with it, it counted as
  // 'behind' the board and tinted it everywhere)
  const gm = b.material.clone(); gm.transparent = true; gm.opacity = 0.45; gm.color.multiply(new THREE.Color(0x86c3d6)); gm.depthFunc = THREE.GreaterDepth; gm.depthWrite = false; gm.polygonOffsetFactor = -10; gm.polygonOffsetUnits = -10;
  const ghost = new THREE.Mesh(b.geometry, gm); ghost.name = 'ghost'; ghost.renderOrder = 5; b.add(ghost);
  BOARDS.set(type, b); return b;
}
// (drawn after the see-through board copy, so the copy never shows through the surfer lying on it: his catch 30 Sep
// 2026, a friend paddling looked merged into the board. Solid all the same: full opacity, writes its depth)
function bodyMat(m) { let c = MATS.get(m.uuid); if (!c) { c = m.clone(); c.side = THREE.FrontSide; c.transparent = true; c.opacity = 1; c.depthWrite = true; MATS.set(m.uuid, c); } return c; }

export class OtherSurfer {
  // gltf: the loaded surfer.glb (the same body as yours); opts: board type, stance ('goofy' | 'regular')
  constructor(gltf, { board = 'short', stance = 'goofy', shorts = null } = {}) {
    this.group = new THREE.Group();
    this.body = cloneSkinned(gltf.scene);
    this.body.traverse((o) => { o.layers.set(0); if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 10; o.material = bodyMat(o.material);
      if (/shorts/i.test(o.name)) { o.material = o.material.clone(); this.shortsMat = o.material; if (shorts != null) o.material.color.set(shorts); } } });   // (one set of materials for every other surfer, but their own shorts colour)
    this.shorts = shorts; this.boardType = board; this.board = boardFor(board).clone(true); this.ghost = this.board.getObjectByName('ghost');
    this.group.add(this.board, this.body);
    this.B = {}; this.body.traverse((o) => { if (o.isBone) { this.B[o.name] = o; o.scale.set(1, 1, 1); } });   // (full size: your own body's head is shrunk to nothing so it's never in your eyes, and a copy took that along)
    this.body.traverse((o) => { if (o.isMesh && /hair/i.test(o.name + (o.material && o.material.name))) this.hair = o; });
    this.mixer = new THREE.AnimationMixer(this.body); this.clips = {};
    // (the fingers take no part in the clips here: posed once, relaxed and a little open, they never need touching again,
    // which spares the clips and the arms a few dozen bones each frame)
    const FINGER = /^(thumb|index|middle|ring|pinky)_/;
    for (const c of gltf.animations) { const cc = c.clone(); cc.tracks = cc.tracks.filter((t) => !t.name.endsWith('.scale') && !FINGER.test(t.name)); this.clips[cc.name] = this.mixer.clipAction(cc); }
    this.body.traverse((b) => { if (b.isBone && FINGER.test(b.name)) b.quaternion.slerp(_q1.identity(), 0.6); });
    for (const a of Object.values(this.clips)) { a.play(); a.weight = 0; } this.clips.crouch.weight = 0.4; this.clips.stand.weight = 0.6;
    this.W = { crouch: 0.4, stand: 0.6 };   // each clip's weight, eased toward what the moment wants (a change of pose is a blend, never a snap)
    this.seed = Math.random() * 20;   // (each friend's own rhythm for the idle sway on deck: two friends never move in step)
    this.pos0 = V().set(0, -0.36, -0.25); this.q0 = Q(); this.paddlePh = 0; this.paddleW = 0; this.sitW = 0;
    this.stanceQ = Q().setFromAxisAngle(UP, (stance === 'regular' ? -1 : 1) * Math.PI / 2);
    // eased state
    this.crouch = 0.4; this.lean = 0; this.twist = 0; this.barrel = 0; this.load = 0; this.pumpA = 0; this.stall = 0; this.t = 0;
    this.hand = { l: { p: V(), ok: false }, r: { p: V(), ok: false } };
    this.bodyUp = V(); this.bodyFwd = V(); this.bodyX = V(); this.bodyQ = Q(); this.inv = Q();
  }
  // S: { pos, q (the board's world pose), state, stateT, v, lean (-1..1 of full lean), turn, inBarrel, pumping, pumpT,
  //      stalling (0..1), speedK (0..1 of the wave's speed) }
  // Each frame: place the board and body where they are (cheap, always), and re-pose the body only as often as its
  // distance needs: within 15 m every frame, to 40 m every 2nd, to 80 m every 3rd, beyond every 5th (a figure a few pixels tall can't
  // show the difference). Out of view it isn't posed at all. Their ghost copy of the board (the part under the water)
  // is drawn only close up. cam: the camera it's seen through.
  tick(dt, S, cam) {
    this.cam = cam;
    this.acc = (this.acc || 0) + dt; this.frame = (this.frame || 0) + 1;
    const d = cam ? cam.position.distanceTo(S.pos) : 0;
    if (cam) { if (!this._fr) { this._fr = new THREE.Frustum(); this._pm = new THREE.Matrix4(); this._sp = new THREE.Sphere(V(), 2.6); }
      this._pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); this._fr.setFromProjectionMatrix(this._pm); this._sp.center.copy(S.pos); }
    const seen = !cam || this._fr.intersectsSphere(this._sp);
    this.group.visible = seen; if (!seen) { this.place(S); return; }   // (kept where they are even out of view: turning to look, they're never somewhere old for a frame)
    this.ghost.visible = d < 30;
    const every = d < 15 ? 1 : d < 40 ? 2 : d < 80 ? 3 : 5;   // (measured 30 Sep 2026: posing costs ~0.24 ms a surfer a frame on his Mac, ~1 ms on a slow phone)
    if (this.hair) this.hair.visible = d < 70;   // (8k of the body's 39k triangles, a speck that far out)
    if (this.frame % every && this.posedOnce) { this.place(S); return; }
    this.update(this.acc, S); this.acc = 0; this.posedOnce = true;
  }
  setShorts(c) { if (this.shorts === c || !this.shortsMat) return; this.shorts = c; this.shortsMat.color.set(c); }
  place(S) { this.group.position.copy(S.pos).addScaledVector(_c.set(0, 1, 0).applyQuaternion(S.q), this.lift ?? 0.1); this.group.quaternion.copy(S.q); }
  update(dt, S) {
    const B = this.B; if (!B.pelvis) return;
    this.t += dt;
    // (a little proud of the water: your own board is drawn through the surface with a see-through copy, see board.js
    // BOARD_WATER; this plain board sat half under the surface where the water hid it entirely)
    this.group.position.copy(S.pos).addScaledVector(_c.set(0, 1, 0).applyQuaternion(S.q), this.lift ?? 0.1); this.group.quaternion.copy(S.q); this.group.updateMatrixWorld(true);
    const st = S.state; this.body.visible = this.board.visible = true;
    if (st !== 'LIE') { this.board.rotation.x = 0; this.board.position.y = 0; this.sitW = 0; }   // (the sitting tilt only while in the water)
    if (st === 'DECK') return this.deck(dt, S);
    if (st === 'WIPE') return this.wipe(dt, S);
    if (st !== 'RIDE' && st !== 'POP') return this.water(dt, S);
    const fwd = _a.set(0, 0, 1).applyQuaternion(S.q), bup = _b.set(0, 1, 0).applyQuaternion(S.q);
    // ---- eased drivers
    const leanN = Math.max(-0.55, Math.min(0.55, S.lean || 0));   // (the body shows a hard turn's lean only up to about half: at full lean the twist, bend and head turn together contorted it, his catch 30 Sep 2026)
    this.lean = ease(this.lean, leanN, dt, 9);
    this.load = ease(this.load, Math.min(1.4, Math.abs(S.turn || 0) * (S.v || 0) / 9.8), dt, 8);
    this.barrel = ease(this.barrel, S.inBarrel ? 1 : 0, dt, 3);
    this.stall = ease(this.stall, Math.min(1, (S.stalling || 0) * 1.3), dt, 6);
    const pe = S.pumping ? 0.5 - 0.5 * Math.cos(2 * Math.PI * (S.pumpT || 0) / 0.7) : 0; this.pumpA = ease(this.pumpA, pe, dt, 16);
    // ---- the body over the board: leaning into the turn and a little toward the wave, turned side-on
    this.bodyFwd.set(fwd.x, 0, fwd.z).normalize();
    const side = _c.crossVectors(this.bodyFwd, UP).normalize();   // (the board's right)
    this.bodyUp.copy(UP).addScaledVector(INTO_WAVE, Math.tan(0.12 + 0.1 * this.barrel)).addScaledVector(side, Math.tan(0.3 * this.lean)).normalize();   // (from true up, not the board's: going vertical in a snap the board's up went past level and turned the body upside down, his catch 30 Sep 2026)
    { const ang = this.bodyUp.angleTo(UP), MAXT = 0.36; if (ang > MAXT) this.bodyUp.lerp(UP, 1 - MAXT / ang).normalize(); }   // (never tipped more than ~20 deg from upright: past that, with the crouch and stoop on top, a hard turn folded the body over onto the deck, his catch 30 Sep 2026)
    this.bodyUp.addScaledVector(this.bodyFwd, -this.bodyUp.dot(this.bodyFwd)).normalize();
    this.bodyX.crossVectors(this.bodyUp, this.bodyFwd); this.bodyQ.setFromRotationMatrix(_m.makeBasis(this.bodyX, this.bodyUp, this.bodyFwd));
    this.inv.copy(S.q).invert(); _q3.copy(this.inv).multiply(this.bodyQ).multiply(this.stanceQ);
    // pop-up: from flat along the board, turning side-on and rising into the crouch in about a third of a second
    const pop = st === 'POP' ? Math.min(1, (S.stateT || 0) / 0.35) : 1, pe2 = pop * pop * (3 - 2 * pop);
    if (pe2 < 1) _q3.slerp(_q2.identity(), 1 - pe2);
    if (st === 'POP') this.q0.copy(_q3); else this.q0.slerp(_q3, 1 - Math.exp(-20 * dt)); this.body.quaternion.copy(this.q0);
    // ---- knees: soft in trim, low under load (bottom turn), in the barrel and at the press of each pump; up out of a top turn
    const bt0 = this.btTt(); const want = Math.min(0.5, 0.18 + 0.1 * (S.speedK || 0.5) + 0.35 * this.barrel + 0.22 * this.pumpA + 0.22 * this.load + 0.18 * bt0.bt + 0.15 * this.stall - 0.1 * bt0.tt);
    this.crouch = ease(this.crouch, st === 'POP' ? 0.8 : want, dt, 10);
    this.weights(dt, { crouch: this.crouch, stand: 1 - this.crouch }, st === 'POP' ? 30 : 12);   // (the pop-up leaves the paddling pose at once: blended slowly the two clips mixed into a crumpled shape)
    // weight shift: hips back over the tail into a bottom turn or a stall, forward out of a top turn; across toward the
    // inside rail as the board goes over on it
    this._bt = bt0.bt;
    const px = 0.06 * this.lean, pz = -0.1 - 0.07 * bt0.bt - 0.05 * this.stall + 0.03 * bt0.tt, py = -0.05 * this.crouch;
    if (st === 'POP') this.pos0.set(0, -0.45 * (1 - pe2) - 0.04, -0.1); else this.pos0.lerp(_d.set(px, py, pz), 1 - Math.exp(-14 * dt)); this.body.position.copy(this.pos0);
    this.mixer.update(dt); this.body.updateMatrixWorld(true);
    turnBone(B.pelvis, this.bodyUp, this.twist * 0.3);   // (the hips follow the shoulders round, a little behind them)
    if (pe2 > 0.6) this.plantFeet();
    // ---- torso: shoulders turn into the turn first, chest bends to the inside, stooped low in the barrel
    const bu = this.bodyUp, bf = this.bodyFwd;
    this.twist = ease(this.twist, this.lean * 0.75 + (bt0.tt ? -0.25 * bt0.tt : 0), dt, 7);
    const sway = Math.sin(this.t * 1.1) * 0.05;
    turnBone(B.spine_02, bu, (this.twist + sway) * 0.38); turnBone(B.spine_03, bu, (this.twist + sway) * 0.38);
    turnBone(B.spine_01, bf, -this.lean * 0.3 * this.sideSign());
    const stoop = (0.16 + 0.16 * this.barrel + 0.08 * this.load + 0.06 * this.pumpA) * (1 - 0.45 * Math.min(1, Math.abs(this.lean)));   // (less stoop the harder the lean: both at once folded the body over)
    _d.crossVectors(bf, bu).normalize(); turnBone(B.spine_02, _d, stoop);
    turnBone(B.head, bu, this.sideSign() * 0.5 - this.twist * 0.3);   // (looking down the line: surfers look where they're going)
    turnBone(B.head, _d, -stoop * 0.9);   // (and the head stays up, eyes level, however low the chest goes: a doubled-over surfer reads as falling)
    // (his catch 30 Sep 2026: in a hard turn the bends above stacked up and the chest and head went near flat, the body
    // folded over the deck. The upper body is held within ~42 deg of upright and the head within ~45 of its neck)
    if (st === 'RIDE') {
      const pv = B.pelvis.getWorldPosition(V()), d = B.head.getWorldPosition(V()).sub(pv), ang = d.angleTo(UP), MAX = 0.73;
      if (ang > MAX) { const ax = V().crossVectors(d, UP).normalize(), fix = ang - MAX; turnBone(B.spine_01, ax, fix * 0.4); turnBone(B.spine_02, ax, fix * 0.35); turnBone(B.spine_03, ax, fix * 0.25); }
      const nk = B.neck_01.getWorldPosition(V()), dh = B.head.getWorldPosition(V()).sub(nk), ah = dh.angleTo(UP), MH = 0.8;
      if (ah > MH) turnBone(B.neck_01, V().crossVectors(dh, UP).normalize(), (ah - MH) * 0.8);
    }
    if (st === 'POP') this.popArms(pe2); else this.arms(dt, S, bt0);
  }
  sideSign() {   // which way along the board the body's left side points (worked out from the thighs, not assumed)
    this.B.thigh_l.getWorldPosition(_e); this.B.thigh_r.getWorldPosition(_f); return Math.sign(_g.subVectors(_e, _f).dot(this.bodyFwd)) || 1;
  }
  btTt() {   // leaning toward the wave = bottom turn (bt), away = top turn / cutback (tt)
    const inside = _h.crossVectors(this.bodyFwd, UP).normalize().multiplyScalar(Math.sign(this.lean) || 1), toWave = inside.dot(INTO_WAVE);
    const k = Math.abs(this.lean) * (Math.sign(toWave) || 0); return { bt: Math.max(0, k), tt: Math.max(0, -k) };
  }
  plantFeet() {   // each foot flat on the deck, front ahead of the hips toward the nose, back over the tail pad; knees bend to reach
    const B = this.B, g = this.group, inv = _m.copy(g.matrixWorld).invert();
    const zl = B.thigh_l.getWorldPosition(_a).applyMatrix4(inv).z, zr = B.thigh_r.getWorldPosition(_a).applyMatrix4(inv).z, pz = B.pelvis.getWorldPosition(_a).applyMatrix4(inv).z;
    const nose = _k.set(0, 0, 1).transformDirection(g.matrixWorld), up = _h.set(0, 1, 0).transformDirection(g.matrixWorld);
    const toes = _g.set(0, 0, 1).transformDirection(B.pelvis.matrixWorld); toes.addScaledVector(nose, -toes.dot(nose)).addScaledVector(up, -toes.dot(up)).normalize();
    const lim = BOARD_LENGTH(this.boardType) / 2 - 0.12;
    for (const s of ['l', 'r']) {
      const front = (s === 'l') === (zl > zr), th = B['thigh_' + s], ca = B['calf_' + s], ft = B['foot_' + s], ba = B['ball_' + s];
      const z = Math.max(this.board.position.z - lim, Math.min(this.board.position.z + lim, pz + (front ? 0.32 + 0.05 * (this._bt || 0) : -0.3 - 0.04 * (this._bt || 0))));
      const T = _f.set(0, this.deckAt(z) + 0.085, z).applyMatrix4(g.matrixWorld);
      const pole = V().copy(toes).addScaledVector(nose, front ? 0.25 : 0.45).addScaledVector(up, 0.1).normalize();
      th.getWorldPosition(_a); ca.getWorldPosition(_b); ft.getWorldPosition(_c);
      const a = _a.distanceTo(_b), b = _b.distanceTo(_c), toT = _d.subVectors(T, _a); let d = toT.length();
      d = Math.min(Math.max(d, Math.abs(a - b) + 0.02), (a + b) * 0.985); toT.normalize();
      const cA = (a * a + d * d - b * b) / (2 * a * d), sA = Math.sqrt(Math.max(0, 1 - cA * cA));
      const pp = pole.addScaledVector(toT, -pole.dot(toT)).normalize();
      const knee = _e.copy(_a).addScaledVector(toT, a * cA).addScaledVector(pp, a * sA);
      aimBone(th, ca, V().subVectors(knee, _a).normalize(), 1);
      ca.getWorldPosition(_a); aimBone(ca, ft, V().subVectors(T, _a).normalize(), 1);
      const tdir = V().copy(toes).addScaledVector(nose, front ? 0.35 : 0.12).normalize();
      ft.getWorldPosition(_a); const bT = V().copy(_a).addScaledVector(tdir, 0.12); const zb = bT.clone().applyMatrix4(inv); bT.addScaledVector(up, this.deckAt(zb.z) + 0.03 - zb.y);
      aimBone(ft, ba, V().subVectors(bT, _a).normalize(), 1);
      ba.quaternion.slerp(_q1.identity(), 0.8); ba.updateMatrixWorld(true);
    }
  }
  // a wipeout: thrown off, a moment of falling (arms out, the fall clip), then under the water and gone from view; the
  // board, let go, floats on at the surface where it was
  wipe(dt, S) {
    const t = S.stateT || 0, fall = 0.75;
    if (t > fall) return this.tread(dt, S);
    this.weights(dt, { fall: 1 }, 20);
    const k = t / fall;
    this.pos0.lerp(_d.set(0.25 * k, 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.4)) - 1.2 * k * k, -0.1 - 0.4 * k), 1 - Math.exp(-20 * dt)); this.body.position.copy(this.pos0);
    this.q0.multiply(_q2.setFromAxisAngle(_e.set(1, 0, 0), dt * 3.5)); this.body.quaternion.copy(this.q0);   // (tipping over as they go)
    this.mixer.update(dt); this.body.updateMatrixWorld(true);
    this.hand.l.ok = this.hand.r.ok = false; this.crouch = 0.8;
  }
  // back up after the fall (his note 30 Sep 2026: only the board showed): treading water beside the board, head and
  // shoulders out, upright whatever the board is doing, turned toward you, until they're back on it
  tread(dt, S) {
    this.body.visible = true;
    this.weights(dt, this.clips.tread ? { tread: 1 } : { sit: 1 }, 6);
    const c = this.cam ? this.cam.position : _e.set(S.pos.x, 0, S.pos.z + 5);
    const x = S.pos.x + 0.7, z = S.pos.z + 0.4, yaw = Math.atan2(c.x - x, c.z - z);
    this.group.updateMatrixWorld(true);
    _m.compose(_f.set(x, S.pos.y - 1.35, z), _q1.setFromAxisAngle(UP, yaw), _g.set(1, 1, 1)).premultiply(_k2.copy(this.group.matrixWorld).invert());   // (that world pose, as seen from inside the group)
    _m.decompose(this.body.position, this.body.quaternion, _g);
    this.pos0.copy(this.body.position); this.q0.copy(this.body.quaternion);
    this.mixer.update(dt); this.body.updateMatrixWorld(true);
    this.hand.l.ok = this.hand.r.ok = false; this.crouch = 0.8;
  }
  // on the boat (30 Sep 2026): stood up on the deck, arms by their sides, walking when they move. This body has no
  // standing or walking clips (only surfing ones), so from its rest pose each limb is pointed where it should hang, the
  // legs and arms swinging in turn as they walk, and the body lifted so the lower foot is flat on the deck
  deck(dt, S) {
    const B = this.B; this.board.visible = false; if (this.ghost) this.ghost.visible = false;
    this.weights(dt, {}, 40); this.body.position.set(0, 0, 0); this.body.quaternion.identity(); this.mixer.update(dt); this.body.updateMatrixWorld(true);
    const sp = Math.min(2, S.v || 0); this.walkA = ease(this.walkA || 0, Math.min(1, sp / 0.7), dt, 6); this.walkPh = (this.walkPh || 0) + dt * (2.2 + sp * 2.6) * (this.walkA > 0.05 ? 1 : 0);
    const q = this.group.quaternion, down = V().set(0, -1, 0), fwd = V().set(0, 0, 1).applyQuaternion(q), side = V().set(1, 0, 0).applyQuaternion(q), gp = this.group.getWorldPosition(V());
    // (the rest pose leans forward, head down: the back and neck are stood up straight first, the head looking a little down)
    const up = V().set(0, 1, 0).applyQuaternion(q);
    // (1 Oct 2026, his check: stood still they were mannequins, arms straight down. Now at rest the weight sits on one leg,
    // shifting to the other every few seconds, the hips over it and the chest leaning a touch the other way, breathing)
    const idle = 1 - this.walkA, sh = Math.sin(this.t * 0.55 + this.seed) * idle, br = Math.sin(this.t * 2.3 + this.seed) * idle;
    for (const [bn, cn, k, sw] of [['pelvis', 'spine_01', 0, 0.05], ['spine_01', 'spine_02', 0.02, -0.04], ['spine_02', 'spine_03', 0.03 + 0.012 * br, -0.03], ['spine_03', 'neck_01', 0.04 + 0.01 * br, -0.02], ['neck_01', 'head', 0.12, 0.03]])
      if (B[bn] && B[cn]) aimBone(B[bn], B[cn], V().copy(up).addScaledVector(fwd, k).addScaledVector(side, sw * sh).normalize(), 1);
    for (const s of ['l', 'r']) {
      const th = B['thigh_' + s], sd = Math.sign(th.getWorldPosition(V()).sub(gp).dot(side)) || 1, ph = Math.sin(this.walkPh + (s === 'l' ? 0 : Math.PI)) * this.walkA;
      const soft = Math.max(0, sh * sd) * 0.9;   // (the leg on the other side from the weight: knee relaxed forward)
      aimBone(th, B['calf_' + s], V().copy(down).addScaledVector(fwd, 0.42 * ph + 0.12 * soft).addScaledVector(side, (0.05 + 0.03 * idle) * sd).normalize(), 1);
      aimBone(B['calf_' + s], B['foot_' + s], V().copy(down).addScaledVector(fwd, 0.42 * ph - 0.35 * Math.max(0, -Math.cos(this.walkPh + (s === 'l' ? 0 : Math.PI))) * this.walkA - 0.1 * soft).normalize(), 1);   // (the knee bends as the leg comes through)
      if (B['ball_' + s]) aimBone(B['foot_' + s], B['ball_' + s], V().copy(fwd).addScaledVector(down, 0.15).normalize(), 1);
      const ua = B['upperarm_' + s], asd = Math.sign(ua.getWorldPosition(V()).sub(gp).dot(side)) || 1;
      aimBone(ua, B['lowerarm_' + s], V().copy(down).addScaledVector(side, (0.14 + 0.05 * idle) * asd).addScaledVector(fwd, -0.45 * ph + 0.04 * idle).normalize(), 1);   // (each arm swings with the other leg; at rest a little out from the body)
      aimBone(B['lowerarm_' + s], B['hand_' + s], V().copy(down).addScaledVector(fwd, 0.32 - 0.3 * ph).addScaledVector(side, 0.04 * asd).normalize(), 1);   // (elbows a little bent, not locked straight)
    }
    const yl = B.foot_l.getWorldPosition(V()).y, yr = B.foot_r.getWorldPosition(V()).y;
    this.body.position.y += S.pos.y + 0.09 - Math.min(yl, yr) + Math.abs(Math.sin(this.walkPh)) * 0.025 * this.walkA; this.body.position.x += 0.03 * sh; this.body.updateMatrixWorld(true);   // (hips over the leg that carries them)
  }
  weights(dt, want, rate) {   // ease every clip toward its wanted weight (missing = 0)
    for (const [n, a] of Object.entries(this.clips)) { const w = ease(this.W[n] || 0, want[n] || 0, dt, rate); this.W[n] = w; a.weight = w; }
  }
  popArms(k) {   // pop-up: hands flat on the deck either side of the stringer, just ahead of the chest, until they're up
    const B = this.B; if (k > 0.85) return;
    for (const s of ['l', 'r']) { const ua = B['upperarm_' + s], sd = Math.sign(ua.getWorldPosition(V()).applyMatrix4(_m.copy(this.group.matrixWorld).invert()).x) || 1;
      const T = this.group.localToWorld(V().set(0.17 * sd, 0.1, 0.35)); reachArm(ua, B['lowerarm_' + s], B['hand_' + s], T, V().set(0, 1, 0).addScaledVector(V().set(sd, 0, 0).applyQuaternion(this.group.quaternion), 0.8), 0.95 * (1 - k)); }
  }
  // in the water: paddling (a crawl, alternate arms) or sitting astride the board waiting for a set, legs hanging in
  // the water either side and hands on the deck; the body glides between the two
  water(dt, S) {
    const B = this.B, paddling = S.state === 'LIE' && S.paddling;
    this.weights(dt, paddling ? { paddle: 1 } : { sit: 1 }, 8);
    if (this.clips.paddle) this.clips.paddle.timeScale = 0.7 + (S.v || 0) / 3;
    // (lying: -0.76 puts the belly on the deck, checked in close-ups; at -0.93 the spine sat level with the deck, half the body inside the board: his catch 30 Sep 2026)
    this.pos0.lerp(_d.set(0, paddling ? -0.76 : -0.36, paddling ? -0.5 : -0.25), 1 - Math.exp(-8 * dt)); this.body.position.copy(this.pos0);
    this.q0.slerp(_q2.identity(), 1 - Math.exp(-10 * dt)); this.body.quaternion.copy(this.q0);
    this.mixer.update(dt); this.body.updateMatrixWorld(true);
    this.paddleW = ease(this.paddleW, paddling ? 1 : 0, dt, 6); this.sitW = ease(this.sitW, paddling ? 0 : 1, dt, 6);
    this.hand.l.ok = this.hand.r.ok = false;   // (riding hands start afresh after)
    this.crouch = 0.8; this.lean = 0; this.twist = 0;   // (so the pop-up starts from a crouch)
    // (1 Oct 2026, his check: sitting, the board floated flat on top like a bench. A sitting surfer's weight sinks the tail:
    // nose up, the board and the surfer a little lower in the water)
    this.board.rotation.x = -0.16 * this.sitW; this.board.position.y = -0.06 * this.sitW; this.body.position.y += -0.06 * this.sitW; this.body.updateMatrixWorld(true);
    if (this.sitW > 0.05) this.straddle(this.sitW);
    if (this.paddleW > 0.05) this.crawl(dt, S, this.paddleW);
  }
  crawl(dt, S, w) {   // the hand's path of a real crawl stroke: in ahead of the shoulder outside the rail, a bent-arm pull back to the hip under the surface, out and forward low over the water
    const B = this.B, g = this.group; this.paddlePh += dt * Math.PI * 2 * 0.75;
    const F = V().set(0, 0, 1).applyQuaternion(g.quaternion).setY(0).normalize(), R = V().set(-F.z, 0, F.x);
    const half = BOARD_WIDTH(this.boardType) / 2, wl = g.position.y - (this.lift ?? 0.1) + 0.02;
    for (const [sd, off] of [['l', 0], ['r', Math.PI]]) {
      const ua = B['upperarm_' + sd], sh = ua.getWorldPosition(V()), side = Math.sign(V().subVectors(sh, g.position).dot(R)) || 1;
      const u = ((this.paddlePh + off) / (Math.PI * 2)) % 1, T = V(), pole = V();
      if (u < 0.55) { const k = u / 0.55; T.copy(sh).addScaledVector(F, 0.47 - 0.77 * k); T.y = wl - 0.03 - 0.18 * Math.sin(k * Math.PI);
        const lat = V().subVectors(T, g.position).dot(R), want = side * (half + 0.08 + 0.05 * Math.sin(k * Math.PI)); if (lat * side < want * side) T.addScaledVector(R, want - lat);
        pole.copy(R).multiplyScalar(side * 0.7).addScaledVector(UP, 0.7); }
      else { const k = (u - 0.55) / 0.45, e = k * k * (3 - 2 * k); T.copy(sh).addScaledVector(F, -0.3 + 0.77 * e); T.y = wl + 0.02 + 0.13 * Math.sin(k * Math.PI);
        const lat = V().subVectors(T, g.position).dot(R), want = side * (half + 0.12 + 0.1 * Math.sin(k * Math.PI)); if (lat * side < want * side) T.addScaledVector(R, want - lat);
        pole.copy(UP).multiplyScalar(0.45).addScaledVector(R, side * 0.85).addScaledVector(F, -0.3); }
      reachArm(ua, B['lowerarm_' + sd], B['hand_' + sd], T, pole, 0.95 * w);
    }
    // legs lying along the board behind, feet together near the tail (the clip lifts them into the air)
    const back = V().copy(F).negate().addScaledVector(UP, -0.12).normalize();
    for (const sd of ['l', 'r']) { aimBone(B['thigh_' + sd], B['calf_' + sd], back, 0.8 * w); aimBone(B['calf_' + sd], B['foot_' + sd], back, 0.8 * w); }
  }
  straddle(w) {   // sitting: thighs down either side of the rails, shins hanging in the water, hands on the deck ahead of the knees
    const B = this.B, g = this.group, bf = V().set(0, 0, 1).applyQuaternion(g.quaternion), bs = V().set(1, 0, 0).applyQuaternion(g.quaternion);
    for (const s of ['l', 'r']) {
      const side = B['thigh_' + s].getWorldPosition(V()).sub(g.position).dot(bs) > 0 ? 1 : -1;
      aimBone(B['thigh_' + s], B['calf_' + s], V().set(0, -0.3, 0).addScaledVector(bs, side * 0.32).addScaledVector(bf, 1.1).normalize(), 0.9 * w);
      aimBone(B['calf_' + s], B['foot_' + s], V().set(0, -1, 0).addScaledVector(bf, 0.1).addScaledVector(bs, side * 0.1).normalize(), 0.8 * w);
    }
    const hip = B.pelvis.getWorldPosition(V()), deckY = g.position.y - (this.lift ?? 0.1) + 0.07 + (this.lift ?? 0.1) + (0.136 - 0.06) * w;   // (the deck ahead of the knees is higher with the nose up: see water())
    for (const s of ['l', 'r']) {
      const ua = B['upperarm_' + s], side = ua.getWorldPosition(V()).sub(g.position).dot(bs) > 0 ? 1 : -1;
      const T = V().copy(hip).addScaledVector(bf, 0.85).addScaledVector(bs, side * 0.2); T.y = deckY;
      reachArm(ua, B['lowerarm_' + s], B['hand_' + s], T, V().addScaledVector(bs, side).addScaledVector(bf, -0.3), 0.9 * w);
    }
  }
  deckAt(z) {   // the deck's height along the stringer, from the board's own mesh (as game.js deckAt)
    let D = this._deck; const bd = this.board;
    if (!D) { const P = bd.geometry.attributes.position, N = 64; bd.geometry.computeBoundingBox(); const bb = bd.geometry.boundingBox, z0 = bb.min.z, z1 = bb.max.z, top = new Float32Array(N).fill(-1);
      for (let i = 0; i < P.count; i++) { if (Math.abs(P.getX(i)) > 0.08) continue; const k = Math.min(N - 1, Math.max(0, Math.round((P.getZ(i) - z0) / (z1 - z0) * (N - 1)))); top[k] = Math.max(top[k], P.getY(i)); }
      for (let k = 0; k < N; k++) if (top[k] < -0.5) top[k] = k ? top[k - 1] : 0.04;
      D = this._deck = { top, z0, z1, N }; }
    const u = Math.min(1, Math.max(0, (z - bd.position.z - D.z0) / (D.z1 - D.z0))) * (D.N - 1), k = Math.floor(u), f = u - k;
    return bd.position.y + D.top[k] + (D.top[Math.min(D.N - 1, k + 1)] - D.top[k]) * f;
  }
  arms(dt, S, { bt, tt }) {
    const B = this.B, A = this.bodyFwd, U = this.bodyUp, Wv = _c.copy(INTO_WAVE).addScaledVector(A, -INTO_WAVE.dot(A)).normalize();   // along, up, toward the wave
    B.upperarm_l.getWorldPosition(_a); B.upperarm_r.getWorldPosition(_b);
    const frontArm = _a.dot(A) > _b.dot(A) ? 'l' : 'r';
    const chest = _d.crossVectors(UP, _e.subVectors(_b, _a)).dot(INTO_WAVE) > 0;   // frontside: chest to the wave
    const pw = this.pumpA;
    for (const s of ['l', 'r']) {
      const front = s === frontArm, sh = B['upperarm_' + s].getWorldPosition(V()), P = V();
      const o = (a, u, w) => P.copy(sh).addScaledVector(A, a).addScaledVector(U, u).addScaledVector(Wv, w);
      const mix = (a, u, w, k) => { if (k > 0.001) P.lerp(V().copy(sh).addScaledVector(A, a).addScaledVector(U, u).addScaledVector(Wv, w), k); };
      const sw = Math.sin(this.t * 1.6 + (front ? 0 : 1.4)) * 0.04;
      if (front) {
        o(0.46, -0.3 + sw, chest ? -0.1 : 0.12);                           // trim: low and ahead over the rail, pointing the way
        mix(0.36, 0.08, 0.34, bt);                                          // bottom turn: reaching toward the lip
        mix(0.08, -0.12, -0.5, tt);                                         // top turn / cutback: leads round, pointing down the face
        mix(0.42, -0.36, 0.1, this.barrel);                                 // barrel: forward and low, compact
      } else {
        o(-0.34, -0.38 + sw, chest ? 0.12 : -0.12);                         // trim: relaxed by the back hip, on the chest side (it sat behind the hips and poked out through the shorts like a tail: his catch 30 Sep 2026)
        mix(0.02, -0.72, 0.36, bt);                                         // bottom turn: inside hand dropping to the water
        mix(0.28, -0.3, -0.26, tt);                                         // top turn: follows across, high
        mix(chest ? -0.3 : 0.05, chest ? -0.34 : -0.62, chest ? 0.46 : 0.08, this.barrel);   // barrel: frontside the trailing hand runs along the face; backside down to the rail
      }
      if (this.stall > 0.01) { if (chest ? !front : front) mix(-0.1, -0.64, 0.52, this.stall); }   // stall: the wave-side hand drags in the face
      if (pw) P.addScaledVector(A, (front ? 0.14 : 0.06) * pw).addScaledVector(U, -(front ? 0.16 : 0.1) * pw);   // pump: swing down and forward with the press
      const h = this.hand[s]; P.sub(this.group.position);
      if (!h.ok) { h.p.copy(P); h.ok = true; } else h.p.lerp(P, 1 - Math.exp(-12 * dt));
      P.copy(h.p).add(this.group.position);
      // elbow: out to its own side and a little down (never folded into the chest)
      const own = V().subVectors(sh, B.spine_03.getWorldPosition(V())).setY(0).normalize();
      const pole = own.multiplyScalar(0.8).addScaledVector(UP, -0.6);
      const cl = B['clavicle_' + s]; if (cl) aimBone(cl, B['upperarm_' + s], V().subVectors(P, cl.getWorldPosition(V())).normalize(), 0.35);
      reachArm(B['upperarm_' + s], B['lowerarm_' + s], B['hand_' + s], P, pole, 0.95);
    }
  }
}
