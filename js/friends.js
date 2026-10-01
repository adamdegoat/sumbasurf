// Your friends at the villa: surfers staying with you, each doing their own thing. Kai plays guitar by the fire,
// nodding along to the music; Wayan waxes a board on the stands in the garden; Nando is up on the tree deck with
// binoculars, watching the sets. In the living room, Coach Rudi stands at the open doors with his clipboard and gives
// you tips on how to surf here, and Putu sits on the sofa with a map, talking up the other breaks. Belle, over from
// Singapore, lazes in the infinity pool, her back to the end wall and her arms along the edge, watching the sea. Same body as yours (their own skin, hair and boardshorts), posed bone by bone every
// frame. Walk up and they look round and say something; Nando calls out the barrels he sees.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { idle } from './life.js?v=1';

const HM = new THREE.Matrix4(), HX = new THREE.Vector3();
const L2 = (F) => (LOOK[F.id] && LOOK[F.id].scale) || 1;   // (a friend's size, for what they wear)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
// turn a bone so the line from it to its child points along dir (world), by weight w
function aim(bone, child, dir, w = 1) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _d.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_d, dir); if (w < 1) _q.slerp(_wq.identity(), 1 - w);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));   // (no need to redo every bone below it: getWorldPosition/Quaternion bring each one up to date as it's read)
}
// two-bone reach: shoulder->elbow->hand to a target, the elbow bending out toward pole
const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function reach(up, lo, hand, target, pole) {
  up.getWorldPosition(_s); lo.getWorldPosition(_e); hand.getWorldPosition(_t);
  const l1 = _s.distanceTo(_e), l2 = _e.distanceTo(_t);
  _x.subVectors(target, _s); const d = Math.max(0.05, Math.min(_x.length(), (l1 + l2) * 0.999)); _x.normalize();
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _y.copy(pole).addScaledVector(_x, -pole.dot(_x)).normalize();
  _e.copy(_s).addScaledVector(_x, a).addScaledVector(_y, h);   // (the elbow)
  _t.copy(_s).addScaledVector(_x, d);                          // (the hand, as far toward the target as the arm reaches)
  aim(up, lo, _z.subVectors(_e, _s).normalize());
  lo.getWorldPosition(_e); aim(lo, hand, _z.subVectors(_t, _e).normalize());
}

const LOOK = {
  kai: { skin: 0x9c6b4c, hair: 0x1b1512, shorts: 0x2f6f73 },
  wayan: { skin: 0x7a5238, hair: 0x120e0c, shorts: 0xd8592f },
  nando: { skin: 0xc79a7a, hair: 0x6b4a2a, shorts: 0x1f2f4f },
  rudi: { skin: 0x8a5c40, hair: 0x9a958c, shorts: 0x3d4a2c },   // (the old coach: grey hair, olive shorts)
  putu: { skin: 0xa8765a, hair: 0x16110e, shorts: 0xb8862c },
  belle: { skin: 0xe8c2a2, hair: 0x100c0b, shorts: 0xd6405c, scale: 0.93 },   // (a coral swimsuit)
};
const LINES = {
  kai: ['Pull up a log, bro. Swell keeps building all evening.', 'This one is for the barrel you just got.', 'Fire is warm, waves are firing. Life is good.', 'Dawn patrol tomorrow? I am in.'],
  wayan: ['Fresh wax, ready for the morning session.', 'Take any board from the rack. All waxed up.', 'Tanjung Uma is pumping today.', 'Feel that offshore? Glassy all day.'],
  nando: ['Set coming! Look out the back.', 'Best seat on the point up here.', 'The peak is shifting right. Sit deeper.', 'Clean lines to the horizon, brother.'],
  // the coach: how to actually surf in this game, one tip at a time
  rudi: ['Watch the horizon out there. When a set comes, turn to the beach and hold PADDLE early. Late is how you miss it.',
    'Once you are up, go along the wave, not straight to the beach. Left on the lefts, right on the rights.',
    'Your right thumb is the steering wheel. Slide it to carve. Let go and the board just runs straight.',
    'Hold PUMP for speed. Lose your speed and the wave leaves without you.',
    'Want the barrel? Stay low on the face and hold STALL. Let the lip throw over your head.',
    'Too deep in there? PUMP and steer up the face. The foam ball behind you does not forgive.',
    'Do not climb too high near the lip. It will pull you over the falls, trust me.',
    'Cutback: keep turning till you face the breaking part, then swing back into it. Keeps you in the power.',
    'For airs, race down first, then turn hard up into the lip. Land it straight or your legs will buckle.',
    'Caught inside? No panic. Hold on, then paddle back out past where it breaks.',
    'New to it? Take the longboard. It catches waves easy and it is very stable. Shortboard later, for the snaps.',
    'The fish is fast and loose. Beautiful on small, soft days. On the steep ones it gets twitchy.',
    'Going to Gunung Laut? Only the gun. It paddles in early, before those giants stand up.',
    'Goofy faces the wave on the lefts, regular faces it on the rights. Backside is a bit harder. Try both.',
    'Boards are in the board room, next door. Walk up to one and it is yours.'],
  belle: ['Eh hi! Come in lah, the water is super shiok.', 'Flew in from Singapore just for this view. So worth it.', 'You surfing later? I watch from here, can?',
    'Sunset from this pool, confirm the best in Sumba.', 'Careful ah, don\'t splash my hair.', 'Singapore got no waves like this one leh.', 'That last set was huge! You saw or not?'],
  // the local: every break in the book, told like he loves them
  putu: ['Pantai Kuda means horse beach. We ride horses on that sand at sunset. Slow, friendly barrels. Where everybody starts.',
    'You are sleeping on top of Tanjung Uma, bro. Clean four and a half metre lefts under the cliffs. Look out the window, that is her.',
    'Batu Hitam, the black rock. Black sand, six metres, fast and heavy. When you make one out there, you remember it forever.',
    'Gunung Laut, the mountain in the sea. She only wakes up in a storm. Fifteen metres. Take the gun and say a small prayer.',
    'Watu Kanan goes right, off those red cliffs. Hollow but kind. Regular foot? That one is made for you.',
    'Karang Hiu, the shark reef. Just the name, relax. Fast right, white sand, water so clear you see every coral.',
    'Sumba Ranch is the wave pool. You order the wave you want, same one again and again. Best place to practise airs.',
    'Sumba is not Bali, you know. No crowds, no traffic. Just you, the horses and perfect waves.',
    'My favourite? Tanjung Uma at sunset. Gold water, nobody out, the uma roof glowing up here.',
    'First time? Start at Pantai Kuda, then come home to Tanjung Uma. The others will wait for you.'],
};

// Belle: the one body the game has is the lads', so hers is reshaped from it in its rest pose (y up, x across, z forward,
// feet at 0, 1.63 m): shoulders and waist in, hips out, a bust; and a coral one-piece painted on in place of the shorts
function womanise(mesh) {
  const g = mesh.geometry = mesh.geometry.clone(), p = g.attributes.position;
  const bump = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ax = Math.abs(x), arm = ax > 0.19 && y > 0.93, torso = ax < 0.2;
    let f = 1 - 0.11 * bump(y, 1.3, 0.1);                                     // (narrower shoulders)
    if (!arm) f *= (1 - 0.13 * bump(y, 1.02, 0.07)) * (1 + (y < 0.97 ? 0.08 * bump(y, 0.86, 0.08) : 0));   // (a waist; fuller hips)
    x = arm ? x - Math.sign(x) * 0.19 * (1 - f) : x * f;
    if (torso && !arm) z = z * (1 - 0.1 * bump(y, 1.02, 0.07)) - 0.012 * bump(y, 0.84, 0.06) * (z < 0 ? -1.6 : 0);
    if (z > 0.03 && y > 1.1 && y < 1.32 && ax < 0.17) z += 0.042 * bump(y, 1.2, 0.05) * bump(ax, 0.085, 0.045);   // (a bust)
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true; g.computeBoundingSphere();
  const m = mesh.material; m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vBP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBP = position;');
    sh.fragmentShader = 'varying vec3 vBP;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float ax = abs(vBP.x), y = vBP.y, e = 0.006;
      float wide = mix(0.26, 0.185, smoothstep(0.93, 0.98, y)); wide = mix(wide, 0.142, smoothstep(1.1, 1.17, y));   // (hugging the sides, cut in under the arms)
      float body = smoothstep(wide + e, wide - e, ax) * smoothstep(0.7, 0.72, y);
      float lo = 0.8 + 0.13 * smoothstep(0.02, 0.15, ax);                                                      // (high-cut legs)
      float hi = vBP.z > 0.0 ? 1.215 + 0.05 * smoothstep(0.02, 0.1, ax) : 1.1 + 0.15 * smoothstep(0.03, 0.12, ax);   // (a scoop at the front, a low back)
      float suit = body * smoothstep(lo - e, lo + e, y) * smoothstep(hi + e, hi - e, y);
      float strap = smoothstep(0.066, 0.072, ax) * smoothstep(0.092, 0.086, ax) * smoothstep(1.37, 1.36, y) * step(hi - 0.01, y) * smoothstep(0.7, 0.72, y);
      suit = max(suit, strap);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.1, 0.18), clamp(suit, 0., 1.));`);
  };
  m.customProgramCacheKey = () => 'belle-suit-2';
}
// the crop's fringe hangs to eye level (made for a head nobody sees: yours). On a friend it read as a blindfold, so
// the front of the hair is lifted to sit on the brow, the eyes clear
function liftFringe(mesh) {
  const g = mesh.geometry = mesh.geometry.clone(), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (p.getZ(i) > 0.04 && y < 1.575) p.setY(i, 1.575 - (1.575 - y) * 0.25); }
  p.needsUpdate = true; g.computeVertexNormals();
}
// the small movements of their own (Rocketbox motion capture, see life.js): which clips each plays while idle, and
// while talking
const LIFE = { kai: ['m_sit_chair_breathe_01', 'm_sit_chair_idle_relaxed_01'], putu: ['m_sit_chair_idle_neutral_01', 'm_sit_chair_idle_look_around', 'm_sit_chair_breathe_01'],
  wayan: ['m_idle_neutral_01', 'm_idle_neutral_02'], nando: ['m_idle_neutral_03', 'm_idle_neutral_01'], rudi: ['m_idle_neutral_02', 'm_idle_neutral_03', 'm_idle_look_around_01'],
  belle: ['f_idle_neutral_01', 'f_idle_look_around_01'] };
const LIFE_TALK = { rudi: ['m_gestic_talk_neutral_01'] };
// a Rocketbox person's skeleton (3ds Max biped) under the names the poses below use
const BIP = { pelvis: 'Pelvis', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', head: 'Head',
  thigh_l: 'L_Thigh', calf_l: 'L_Calf', foot_l: 'L_Foot', thigh_r: 'R_Thigh', calf_r: 'R_Calf', foot_r: 'R_Foot',
  upperarm_l: 'L_UpperArm', lowerarm_l: 'L_Forearm', hand_l: 'L_Hand', upperarm_r: 'R_UpperArm', lowerarm_r: 'R_Forearm', hand_r: 'R_Hand' };
export function friends(scene, src, spots, people, life = null) {
  const group = new THREE.Group(); scene.add(group);
  const list = [];
  spots.forEach((S, i) => {
    const own = people && people[S.id], body = cloneSkinned(own || src), root = new THREE.Group(); root.add(body); group.add(root);   // (their own body if it's in, else yours re-dressed)
    body.position.set(0, 0, 0); body.quaternion.identity(); body.scale.set(1, 1, 1);   // (the clone carries wherever your own body was last posed on the board)
    const L = LOOK[S.id] || LOOK.kai;
    const B = {};
    if (own) {   // a real person: their own face, hair and clothes, as they come
      body.traverse((o) => { o.layers.set(0); if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } if (o.isBone) { const k = o.name.replace(/^Bip01[ _]/, '').replace(/ /g, '_'); B[k] = o; } });
      for (const k in BIP) B[k] = B[BIP[k]];
      // (turn the body so it faces +z like the poses expect: from the head toward the eyes is forward)
      body.updateMatrixWorld(true); const hp = B.head.getWorldPosition(new THREE.Vector3()), ep = B.LEye.getWorldPosition(new THREE.Vector3()).add(B.REye.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5).sub(hp);
      body.rotation.y = -Math.atan2(ep.x, ep.z); body.updateMatrixWorld(true);
      body.userData.rest = []; body.traverse((o) => { if (o.isBone) body.userData.rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });   // (their standing pose, to start each frame from)
      if (life && LIFE[S.id]) { const byName = {}; body.traverse((o) => { if (o.isBone) byName[o.name] = o; }); body.userData.idle = idle(life, byName, LIFE[S.id], LIFE_TALK[S.id]); }
    } else {
      body.traverse((o) => { o.layers.set(0); if (o.isMesh) { o.visible = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.side = THREE.FrontSide;
        const n = o.material.name; if (n === 'skin') o.material.color.setHex(L.skin); else if (n === 'hair') { o.material.color.setHex(L.hair); o.material.side = THREE.DoubleSide; liftFringe(o); } else if (/short/.test(n)) o.material.color.setHex(L.shorts); } });
      body.traverse((o) => { if (o.isBone) B[o.name] = o; });
      if (L.scale) body.scale.setScalar(L.scale);
      if (S.id === 'belle') body.traverse((o) => { if (o.isMesh && (o.material.name === 'hair' || /short/.test(o.material.name))) o.visible = false; if (o.isSkinnedMesh && o.material.name === 'skin') womanise(o); });   // (her own long hair instead of the lads' crop; a swimsuit instead of board shorts)
    }
    const skins = []; body.traverse((o) => { if (o.isSkinnedMesh) skins.push(o); });
    root.position.set(S.x, S.y, S.z); root.rotation.y = S.yaw;
    const F = { id: S.id, name: S.name, root, body, B, skins, S, own: !!own, props: {}, look: 0, lineI: 0, talkT: 0, cool: 0, head: new THREE.Vector3() };
    // what each is holding
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.6 });
    if (S.id === 'kai') {   // an acoustic guitar: round body, sound hole, neck, headstock
      const gt = new THREE.Group(); const sb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.09, 20), wood); sb.rotation.x = Math.PI / 2; sb.scale.set(1, 1, 1); gt.add(sb);
      const sb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 18), wood); sb2.rotation.x = Math.PI / 2; sb2.position.x = 0.2; gt.add(sb2);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), dark); hole.position.set(0.1, 0, 0.047); gt.add(hole);
      const nk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.03), dark); nk.position.set(0.55, 0, 0.03); gt.add(nk);
      const hs = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.03), wood); hs.position.set(0.85, 0, 0.03); gt.add(hs);
      group.add(gt); F.props.guitar = gt;
    }
    if (S.id === 'nando') {   // binoculars, and a sun-faded bucket hat
      const bn = new THREE.Group(); for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.13, 10), dark); t.rotation.x = Math.PI / 2; t.position.x = s * 0.035; bn.add(t); }
      group.add(bn); F.props.bino = bn;
      const hat = new THREE.Group(); const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0xc9b58c, roughness: 0.9 })); hat.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.012, 20), crown.material); brim.position.y = -0.035; brim.rotation.x = 0.12; hat.add(brim);
      if (!own) { group.add(hat); F.props.hat = hat; }   // (a real person has their own hair: no hat perched on it)
    }
    if (S.id === 'rudi') {   // a clipboard, a faded cap and a whistle on a cord
      const cb = new THREE.Group(); const brd = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.012), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7 })); cb.add(brd);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.27), new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.9 })); paper.position.set(0, -0.015, 0.0065); cb.add(paper);
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.6, roughness: 0.4 })); clip.position.set(0, 0.15, 0.01); cb.add(clip);
      group.add(cb); F.props.clip = cb;
      const cap = new THREE.Group(), cm = new THREE.MeshStandardMaterial({ color: 0x2f5a78, roughness: 0.85 });
      const cr = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), cm); cr.scale.set(1, 0.75, 1.08); cap.add(cr);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 14, 1, false, -Math.PI / 2, Math.PI), cm); brim.position.set(0, 0.005, 0.07); brim.scale.set(1, 1, 0.9); cap.add(brim);
      if (!own) { group.add(cap); F.props.cap = cap; }
      const wh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.5, roughness: 0.4 })); group.add(wh); F.props.whistle = wh;
    }
    if (S.id === 'belle' && !own) {   // long black hair (wet ends down her back)
      const hm = new THREE.MeshStandardMaterial({ color: 0x1c1411, roughness: 0.32 }), sw = new THREE.MeshStandardMaterial({ color: 0xd6405c, roughness: 0.55 });
      // (the hair: a crown over the top down to a hairline on the forehead, and a shell round the sides and back; the face left open)
      const hair = new THREE.Group(), hs = THREE.DoubleSide; hm.side = hs;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.116, 18, 7, 0, Math.PI * 2, 0, 1.0), hm); crown.scale.set(1.03, 1.05, 1.12); crown.position.set(0, 0.036, -0.022); hair.add(crown);
      const back = new THREE.Mesh(new THREE.SphereGeometry(0.116, 18, 10, Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, 0, Math.PI * 0.66), hm); back.scale.set(1.03, 1.06, 1.14); back.position.set(0, 0.02, -0.026); hair.add(back);
      const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.05, 0.4, 12, 1, true), hm); fall.material = hm.clone(); fall.material.side = THREE.DoubleSide; fall.scale.set(1, 1, 0.42); fall.position.set(0, -0.16, -0.078); fall.rotation.x = 0.12; hair.add(fall);
      group.add(hair); F.props.hair = hair;
    }
    if (S.id === 'putu') {   // a folded paper map of the island, spots marked
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 176; const c = cv.getContext('2d');
      c.fillStyle = '#e8dcbc'; c.fillRect(0, 0, 256, 176); c.fillStyle = '#9cc7c4'; c.fillRect(0, 0, 256, 176);
      c.fillStyle = '#e3d3a4'; c.beginPath(); c.moveTo(20, 60); c.bezierCurveTo(60, 20, 150, 30, 210, 50); c.bezierCurveTo(240, 70, 230, 120, 190, 135); c.bezierCurveTo(130, 160, 60, 150, 30, 120); c.bezierCurveTo(10, 100, 8, 75, 20, 60); c.fill();
      c.fillStyle = '#7fa564'; c.beginPath(); c.ellipse(120, 90, 60, 28, -0.1, 0, 7); c.fill();
      c.fillStyle = '#c0392b'; for (const [x, y] of [[40, 125], [95, 150], [160, 145], [205, 120], [30, 70], [215, 60]]) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(80,60,30,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(128, 0); c.lineTo(128, 176); c.moveTo(0, 88); c.lineTo(256, 88); c.stroke();   // (fold lines)
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      const mp = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.32), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95, side: THREE.DoubleSide })); group.add(mp); F.props.map = mp;
    }
    list.push(F);
  });
  // the speech bubble: over the head of whoever is talking
  const bub = document.createElement('div'); bub.id = 'fBubble'; document.body.appendChild(bub);
  let talking = null;
  const say = (F, text) => { talking = F; F.talkT = Math.min(9, 2.8 + text.length * 0.05); bub.innerHTML = `<b>${F.name}</b>${text}`; bub.classList.add('on'); };   // (long enough to read)
  const CHATTY = { rudi: 1, putu: 1 };   // (these two keep talking while you stay: a new tip or a new spot every few seconds)
  for (const id in LINES) if (CHATTY[id]) { const a = LINES[id]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }   // (a different order each visit)

  // standing: legs straight down the first time; after that, with their weight shifting, each foot stays where it
  // was planted and the knee gives (thigh and shin reach down to it)
  const FT = new THREE.Vector3(), KP = new THREE.Vector3(), DA = new THREE.Vector3(), DB = new THREE.Vector3();
  function stand(F, fw, dirs) {
    const { B, root } = F;
    for (const sd of ['l', 'r']) { const sg = sd === 'l' ? -1 : 1;
      if (!F.feet || !F.feet[sd] || !F.body.userData.idle) { const [dt, dc] = dirs(sg); aim(B['thigh_' + sd], B['calf_' + sd], dt); aim(B['calf_' + sd], B['foot_' + sd], dc);
        if (F.body.userData.idle) { (F.feet ||= {})[sd] = root.worldToLocal(B['foot_' + sd].getWorldPosition(new THREE.Vector3())); } }
      else reach(B['thigh_' + sd], B['calf_' + sd], B['foot_' + sd], root.localToWorld(FT.copy(F.feet[sd])), KP.copy(fw).addScaledVector(up, -0.2)); }
  }
  const V = new THREE.Vector3(), W = new THREE.Vector3(), fw = new THREE.Vector3(), rt = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tgt = new THREE.Vector3(), tgt2 = new THREE.Vector3(), pole = new THREE.Vector3(), SD = new THREE.Vector3(), TA = new THREE.Vector3(), TB = new THREE.Vector3(), HP = new THREE.Vector3();
  const FR = new THREE.Frustum(), PV = new THREE.Matrix4(), BS = new THREE.Sphere(new THREE.Vector3(), 1.4);
  let frame = 0;
  function update(dt0, t, beat, you, camera) {
    frame++; camera.updateMatrixWorld(); FR.setFromProjectionMatrix(PV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const F of list) {
      const { B, S, root } = F; F.cool -= dt0; F.acc = (F.acc || 0) + dt0;
      // (1 Oct 2026, his call: fewer villa people, and the ones left cheaper. Their bodies skip the GPU's own
      // off-screen check (frustumCulled is off: their bones move them away from it), so we do it here: out of view,
      // not talking and not right beside you = not drawn and not posed. Beyond 12 m they pose every other frame.)
      const away = F.posed ? Math.hypot(you.x - F.head.x, you.z - F.head.z) : 0, seen = !F.posed || FR.intersectsSphere((BS.center.copy(F.head).y -= 0.8, BS));
      root.visible = seen || F.talkT > 0 || away < 5;
      if (F.posed && F.talkT <= 0 && (away > 26 || (!root.visible) || (away > 12 && (frame & 1)))) continue;   // (far off or out of sight: keep the last pose, skip the work)
      const dt = Math.min(F.acc, 0.1); F.acc = 0;   // (capped: after a long while unposed, one big step would end a line the moment it starts)
      F.posed = true;
      if (F.body.userData.rest) for (const [b, p, q, sc] of F.body.userData.rest) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(sc); }   // (a Rocketbox skeleton: back to its own standing pose; its bind data doesn't survive skeleton.pose())
      else F.skins[0].skeleton.pose();
      const LF = F.body.userData.idle;   // (then their own small movements on top: breathing, shifting weight, glancing round)
      if (LF) { LF.update(dt, F.talkT > 0); LF.apply(1, S.pose === 'bino' ? 0 : F.talkT > 0 || F.near ? 0.35 : 1); }   // (the head stays on you while they talk to you; on the binoculars while he looks through them)
      root.updateWorldMatrix(true, false);   // (every mesh of a friend shares the one set of bones: posing it once does them all)
      // you nearby, on their level? then they look round at you, and say something
      B.head.getWorldPosition(F.head);
      const dx = you.x - F.head.x, dz = you.z - F.head.z, dist = Math.hypot(dx, dz), near = dist < 3.6 && Math.abs(you.y - F.head.y) < 1.6; F.near = near;
      if (F.yaw === undefined) F.yaw = S.yaw;
      if (S.pose === 'coach') { const want = near ? Math.atan2(dx, dz) : S.yaw, d = Math.atan2(Math.sin(want - F.yaw), Math.cos(want - F.yaw)); F.yaw += d * Math.min(1, dt * 2.5); root.rotation.y = F.yaw; root.updateWorldMatrix(true, false); }   // (the coach turns right round to talk to you)
      fw.set(Math.sin(F.yaw), 0, Math.cos(F.yaw)); rt.set(-fw.z, 0, fw.x);   // (their right, looking along fw)
      if (near && F.cool <= 0 && !(talking && talking !== F && talking.talkT > 0)) { say(F, LINES[F.id][F.lineI++ % LINES[F.id].length]); F.cool = CHATTY[F.id] ? F.talkT + 3.5 : 18; }   // (never over the top of someone else)
      const toYou = Math.atan2(dx, dz) - F.yaw, want = near ? Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(toYou), Math.cos(toYou)))) : 0;
      F.look += (want - F.look) * Math.min(1, dt * 3);
      const hip = B.pelvis.getWorldPosition(HP);
      if (S.pose === 'guitar') {
        // sitting on the log: hips down to the seat, thighs forward, shins down; leaning a little into the guitar
        root.position.y = S.y + S.seat + 0.02 - (hip.y - root.position.y); root.updateWorldMatrix(true, false);   // (the pelvis down onto the log)
        for (const sd of ['l', 'r']) { const sg = sd === 'l' ? -1 : 1;
          aim(B['thigh_' + sd], B['calf_' + sd], tgt.copy(fw).multiplyScalar(0.92).addScaledVector(up, -0.28).addScaledVector(rt, sg * 0.18).normalize());
          aim(B['calf_' + sd], B['foot_' + sd], tgt.copy(up).multiplyScalar(-0.95).addScaledVector(fw, 0.25).addScaledVector(rt, sg * 0.05).normalize()); }
        aim(B.spine_02, B.spine_03, tgt.copy(up).addScaledVector(fw, 0.28).normalize());
        aim(B.neck_01, B.head, tgt.copy(up).addScaledVector(fw, 0.35 - 0.12 * beat).addScaledVector(rt, Math.sin(F.look) * 0.8).normalize());   // (nodding to the music)
        // the guitar across the lap, neck out to the left and up
        B.pelvis.getWorldPosition(W); const gt = F.props.guitar, gp = tgt.copy(W).addScaledVector(fw, 0.26).addScaledVector(up, 0.2).addScaledVector(rt, 0.06);
        const neck = tgt2.copy(rt).multiplyScalar(-0.85).addScaledVector(up, 0.42).addScaledVector(fw, 0.2).normalize();
        gt.position.copy(gp); gt.quaternion.setFromUnitVectors(_a.set(1, 0, 0), neck); gt.rotateX(-0.25);   // (face out, a little up)
        // left hand on the neck, right hand strumming over the sound hole in time with the beat
        const fret = W.copy(gp).addScaledVector(neck, 0.5).addScaledVector(fw, 0.05);
        reach(B.upperarm_l, B.lowerarm_l, B.hand_l, fret, pole.copy(up).multiplyScalar(-1).addScaledVector(rt, -0.5));
        const strum = W.copy(gp).addScaledVector(neck, 0.05).addScaledVector(fw, 0.09).addScaledVector(up, 0.05 * Math.sin(t * 9) + 0.04 * beat);
        reach(B.upperarm_r, B.lowerarm_r, B.hand_r, strum, pole.copy(up).multiplyScalar(-1).addScaledVector(rt, 0.6));
      } else if (S.pose === 'wax') {
        // bent over the board on its stands, rubbing wax on in slow circles; stops to talk
        const talk = F.talkT > 0;
        aim(B.spine_01, B.spine_02, tgt.copy(up).addScaledVector(fw, talk ? 0.35 : 0.8).normalize());
        aim(B.spine_03, B.neck_01, tgt.copy(up).addScaledVector(fw, talk ? 0.3 : 0.55).normalize());
        aim(B.neck_01, B.head, tgt.copy(up).addScaledVector(fw, talk ? 0.2 : 0.9).addScaledVector(rt, Math.sin(F.look) * 0.9).normalize());
        stand(F, fw, (sg) => [DA.copy(up).multiplyScalar(-1).addScaledVector(rt, sg * 0.1).addScaledVector(fw, -0.05).normalize(), DB.copy(up).multiplyScalar(-1).addScaledVector(fw, 0.03).normalize()]);
        const deck = W.set(S.board[0], S.board[1], S.board[2]);
        const circle = tgt.copy(deck).addScaledVector(rt, 0.12 + Math.cos(t * 3.2) * 0.12).addScaledVector(fw, Math.sin(t * 3.2) * 0.07);
        if (!talk) reach(B.upperarm_r, B.lowerarm_r, B.hand_r, circle, pole.copy(rt).addScaledVector(up, -0.3));
        else reach(B.upperarm_r, B.lowerarm_r, B.hand_r, tgt.copy(hip).addScaledVector(rt, 0.22).addScaledVector(up, -0.05), pole.copy(fw).multiplyScalar(-1));
        reach(B.upperarm_l, B.lowerarm_l, B.hand_l, tgt2.copy(deck).addScaledVector(rt, -0.22).addScaledVector(fw, talk ? -0.22 : -0.02), pole.copy(rt).multiplyScalar(-1).addScaledVector(up, -0.3));   // (a hand on the board; on its near rail while talking)
      } else if (S.pose === 'bino') {
        // standing at the rail with the binoculars up, panning slowly along the line; lowers them to talk to you
        const talk = F.talkT > 0 || Math.sin(t * 0.21) > 0.85, pan = Math.sin(t * 0.3) * 0.35;
        const look = tgt.copy(fw).applyAxisAngle(up, pan + F.look * (talk ? 1 : 0)); look.y = talk ? 0.05 : -0.18; look.normalize();
        stand(F, fw, (sg) => [DA.copy(up).multiplyScalar(-1).addScaledVector(rt, sg * 0.1).normalize(), DB.copy(up).multiplyScalar(-1)]);
        aim(B.spine_03, B.neck_01, tgt2.copy(up).addScaledVector(look, 0.12).normalize());
        aim(B.neck_01, B.head, tgt2.copy(up).addScaledVector(look, 0.55).normalize());
        B.head.getWorldPosition(W); const eyes = W.addScaledVector(up, 0.07);
        const bn = F.props.bino;
        if (!talk) { const at = tgt2.copy(eyes).addScaledVector(look, 0.14); bn.position.copy(at); bn.quaternion.setFromUnitVectors(_a.set(0, 0, 1), look);
          const side = SD.crossVectors(look, up).normalize();
          reach(B.upperarm_l, B.lowerarm_l, B.hand_l, TA.copy(at).addScaledVector(side, 0.07).addScaledVector(up, -0.03), pole.copy(up).multiplyScalar(-1).addScaledVector(side, 0.4));
          reach(B.upperarm_r, B.lowerarm_r, B.hand_r, TB.copy(at).addScaledVector(side, -0.07).addScaledVector(up, -0.03), pole.copy(up).multiplyScalar(-1).addScaledVector(side, -0.4)); }
        else {   // binoculars down: hanging from his right hand at his side, his left hand resting on the rail in front of him
          B.spine_03.getWorldPosition(TA);
          reach(B.upperarm_r, B.lowerarm_r, B.hand_r, TB.copy(hip).addScaledVector(rt, 0.24).addScaledVector(up, -0.08).addScaledVector(fw, 0.04), pole.copy(fw).multiplyScalar(-1).addScaledVector(rt, 0.3));
          reach(B.upperarm_l, B.lowerarm_l, B.hand_l, TA.addScaledVector(fw, 0.38).addScaledVector(rt, -0.2).addScaledVector(up, -0.32), pole.copy(up).multiplyScalar(-1).addScaledVector(rt, -0.6));
          B.hand_r.getWorldPosition(bn.position); bn.position.addScaledVector(up, -0.05); bn.quaternion.setFromUnitVectors(_a.set(0, 0, 1), up); }
        const hat = F.props.hat; if (hat) { B.head.getWorldPosition(hat.position); hat.position.addScaledVector(up, 0.14); B.head.getWorldQuaternion(hat.quaternion); hat.quaternion.setFromUnitVectors(_a.set(0, 1, 0), tgt2.copy(up).addScaledVector(look, 0.35).normalize()); }
      } else if (S.pose === 'coach') {
        // standing at the open doors watching the waves, clipboard in his left hand, right hand on his hip; turns to
        // you and talks with his hand when you come near
        const talk = F.talkT > 0, look = tgt.copy(fw).applyAxisAngle(up, F.look + (near ? 0 : Math.sin(t * 0.25) * 0.3)); look.y = near ? 0.02 : -0.06; look.normalize();
        stand(F, fw, (sg) => [DA.copy(up).multiplyScalar(-1).addScaledVector(rt, sg * 0.1).normalize(), DB.copy(up).multiplyScalar(-1)]);
        aim(B.spine_03, B.neck_01, tgt2.copy(up).addScaledVector(look, 0.08).normalize());
        aim(B.neck_01, B.head, tgt2.copy(up).addScaledVector(look, 0.5).normalize());
        B.spine_03.getWorldPosition(W); const chest = W;
        const cb = F.props.clip; cb.position.copy(chest).addScaledVector(fw, 0.27).addScaledVector(rt, -0.14).addScaledVector(up, talk ? -0.12 : -0.2);
        cb.quaternion.setFromUnitVectors(_a.set(0, 0, 1), TA.copy(fw).addScaledVector(up, 0.9).normalize());   // (face up, tipped toward him)
        reach(B.upperarm_l, B.lowerarm_l, B.hand_l, TA.copy(cb.position).addScaledVector(rt, -0.1), pole.copy(up).multiplyScalar(-1).addScaledVector(rt, -0.6));
        if (talk) reach(B.upperarm_r, B.lowerarm_r, B.hand_r, TB.copy(chest).addScaledVector(fw, 0.38).addScaledVector(rt, 0.2).addScaledVector(up, -0.05 + 0.07 * Math.sin(t * 4.5)), pole.copy(up).multiplyScalar(-1).addScaledVector(rt, 0.7));
        else reach(B.upperarm_r, B.lowerarm_r, B.hand_r, TB.copy(hip).addScaledVector(rt, 0.24).addScaledVector(up, 0.08).addScaledVector(fw, -0.02), pole.copy(fw).multiplyScalar(-1).addScaledVector(rt, 0.5));
        F.props.whistle.position.copy(chest).addScaledVector(fw, 0.13).addScaledVector(up, -0.02);   // (on its cord at his chest: before W is reused for the head)
        const cap = F.props.cap; if (cap) { B.head.getWorldPosition(W); cap.position.copy(W).addScaledVector(up, 0.1); cap.lookAt(TA.copy(cap.position).add(look)); }
      } else if (S.pose === 'sofa') {
        // on the sofa with the map open on his lap; looks up and points out to sea when he talks
        root.position.y = S.y + S.seat + 0.02 - (hip.y - root.position.y); root.updateWorldMatrix(true, false);
        const talk = F.talkT > 0;
        for (const sd of ['l', 'r']) { const sg = sd === 'l' ? -1 : 1;
          aim(B['thigh_' + sd], B['calf_' + sd], tgt.copy(fw).multiplyScalar(0.95).addScaledVector(up, -0.12).addScaledVector(rt, sg * 0.2).normalize());
          aim(B['calf_' + sd], B['foot_' + sd], tgt.copy(up).multiplyScalar(-0.95).addScaledVector(fw, 0.2).addScaledVector(rt, sg * 0.05).normalize()); }
        aim(B.spine_02, B.spine_03, tgt.copy(up).addScaledVector(fw, -0.12).normalize());   // (leaning back into the cushions)
        aim(B.neck_01, B.head, tgt.copy(up).addScaledVector(fw, talk || near ? 0.25 : 0.9).addScaledVector(rt, Math.sin(F.look) * 0.9).normalize());
        B.pelvis.getWorldPosition(W); const mp = F.props.map; mp.position.copy(W).addScaledVector(fw, 0.34).addScaledVector(up, 0.3);
        mp.quaternion.setFromUnitVectors(_a.set(0, 0, 1), TA.copy(up).multiplyScalar(0.8).addScaledVector(fw, -1).normalize());   // (held up in front of him, tipped back so he reads it)
        const side = SD.copy(rt);
        reach(B.upperarm_l, B.lowerarm_l, B.hand_l, TA.copy(mp.position).addScaledVector(side, -0.22), pole.copy(up).multiplyScalar(-1).addScaledVector(side, -0.6));
        if (talk) { B.spine_03.getWorldPosition(TB); reach(B.upperarm_r, B.lowerarm_r, B.hand_r, TB.addScaledVector(fw, 0.5).addScaledVector(rt, 0.3).addScaledVector(up, 0.15 + 0.04 * Math.sin(t * 3)), pole.copy(up).multiplyScalar(-1).addScaledVector(rt, 0.5)); }   // (pointing out to sea)
        else reach(B.upperarm_r, B.lowerarm_r, B.hand_r, TB.copy(mp.position).addScaledVector(side, 0.22), pole.copy(up).multiplyScalar(-1).addScaledVector(side, 0.6));
      } else if (S.pose === 'pool') {
        // leaning on the end wall at the sea corner, forearms folded on the ledge, looking out at the view (her back to
        // the house: she talks over her shoulder, she doesn't turn round)
        if (!F.own) B.spine_03.scale.set(0.9, 1, 0.92);   // (narrower shoulders than the lads)
        stand(F, fw, (sg) => [DA.copy(up).multiplyScalar(-1).addScaledVector(fw, -0.08).addScaledVector(rt, sg * 0.07).normalize(), DB.copy(up).multiplyScalar(-1).addScaledVector(fw, 0.04).normalize()]);
        aim(B.spine_02, B.spine_03, tgt.copy(up).addScaledVector(fw, 0.28).normalize());   // (leaning in on the ledge)
        const lookOut = 0.3 * Math.sin(t * 0.13) + 0.15 * Math.sin(t * 0.37);   // (her gaze drifting slowly along the horizon)
        aim(B.neck_01, B.head, tgt.copy(up).addScaledVector(fw, 0.35).applyAxisAngle(up, lookOut).normalize());
        for (const sd of ['l', 'r']) { const sg = sd === 'l' ? -1 : 1;
          reach(B['upperarm_' + sd], B['lowerarm_' + sd], B['hand_' + sd], TA.set(S.x, 0, S.z).addScaledVector(fw, 0.42).addScaledVector(rt, -sg * 0.12).setY(S.edgeY), pole.copy(rt).multiplyScalar(sg).addScaledVector(up, -0.4)); }   // (forearms crossed on the ledge, elbows out)
        F.look = 0;
        // (a frame for the head from world directions: up along the neck, forward where she looks; the bone's own axes aren't upright)
        B.neck_01.getWorldPosition(TA); B.head.getWorldPosition(W); const hu = TB.subVectors(W, TA).normalize(), hf = SD.copy(fw).applyAxisAngle(up, lookOut); hf.addScaledVector(hu, -hf.dot(hu)).normalize();
        HM.makeBasis(HX.crossVectors(hu, hf), hu, hf); const k = L2(F);
        const hr = F.props.hair; if (hr) { hr.position.copy(W); hr.quaternion.setFromRotationMatrix(HM); hr.scale.setScalar(k); }
      }
      if (F.talkT > 0) F.talkT -= dt;
    }
    // the bubble follows the talker's head on screen
    if (talking) {
      if (talking.talkT <= 0) { bub.classList.remove('on'); talking = null; }
      else { V.copy(talking.head).addScaledVector(up, 0.4).project(camera); const on = V.z < 1 && Math.abs(V.x) < 1.1 && Math.abs(V.y) < 1.1;
        bub.style.opacity = on ? '' : '0'; bub.style.transform = `translate(${(V.x * 0.5 + 0.5) * innerWidth}px, ${(-V.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`; }
    }
  }
  const hide = () => { bub.classList.remove('on'); if (talking) talking.talkT = 0; talking = null; };   // (and the talker stops mid-gesture too)
  return { group, list, update, hide, say: (id, text) => { const F = list.find((f) => f.id === id); if (F && !(talking && talking !== F && talking.talkT > 0)) say(F, text); } };   // (a shout never cuts someone off mid-line)
}
