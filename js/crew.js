// The crew: other surfers out at Tanjung Uma, for watching from the villa's balcony. They sit in the lineup bobbing
// on the swell, and when a wave comes the one in position takes off: drops down the face, carves up and down it,
// sometimes stalls into the barrel, then kicks out over the back and paddles back out. They aren't physics riders
// (that's only you): each one follows a line on the wave's real face (the same shape you ride), so from the cliff they
// sit exactly on the water, in the pocket, under the lip. Once their bodies are in (setPeople: real people in
// boardshorts, see surfers.js) each is posed from the same points the old stick figures were drawn from; until then (or
// if they can't load) they're drawn as three instanced meshes (limbs, heads, boards).
import * as THREE from 'three';
import { heightAt } from './surf.js?v=197';
import { waterPerson, poseFrom } from './surfers.js?v=3';

const N = 7, SEG = 7;   // surfers; limb pieces each (2 thighs, 2 shins, torso, 2 arms)
const SKIN = [[0.62, 0.42, 0.3], [0.45, 0.3, 0.2], [0.75, 0.55, 0.42]], TOPS = [[0.08, 0.08, 0.09], [0.9, 0.9, 0.88], [0.15, 0.3, 0.55], [0.75, 0.2, 0.15], [0.95, 0.75, 0.2]],
  SHORTS = [[0.08, 0.08, 0.1], [0.1, 0.25, 0.4], [0.6, 0.12, 0.1], [0.2, 0.2, 0.2]], BOARDC = [[0.95, 0.95, 0.92], [0.95, 0.9, 0.75], [0.9, 0.4, 0.3], [0.3, 0.6, 0.75], [0.95, 0.8, 0.3]];

export function crew(scene) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const limbs = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), mat, N * SEG);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mat, N);
  const boards = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 6), new THREE.MeshStandardMaterial({ roughness: 0.4 }), N);
  for (const m of [limbs, heads, boards]) { m.frustumCulled = false; group.add(m); }
  // spray thrown off the tail in hard turns and wipeouts: soft white points
  const SPN = 400, spPos = new Float32Array(SPN * 3).fill(-999), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN); let spK = 0;
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    const pts = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.45, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, color: 0xf6fafa })); pts.frustumCulled = false; group.add(pts); }
  const spray = (p, vx, vy, vz, n, spread) => { for (let k = 0; k < n; k++) { spK = (spK + 1) % SPN; spPos[spK * 3] = p.x; spPos[spK * 3 + 1] = p.y + 0.1; spPos[spK * 3 + 2] = p.z;
    spVel[spK * 3] = vx + (Math.random() - 0.5) * spread; spVel[spK * 3 + 1] = vy * (0.6 + Math.random() * 0.7); spVel[spK * 3 + 2] = vz + (Math.random() - 0.5) * spread; spLife[spK] = 0.7 + Math.random() * 0.6; } };
  const sprayTick = (dt) => { for (let k = 0; k < SPN; k++) { if (spLife[k] <= 0) continue; spLife[k] -= dt; if (spLife[k] <= 0) { spPos[k * 3 + 1] = -999; continue; } spVel[k * 3 + 1] -= 9.8 * dt;
    spPos[k * 3] += spVel[k * 3] * dt; spPos[k * 3 + 1] += spVel[k * 3 + 1] * dt; spPos[k * 3 + 2] += spVel[k * 3 + 2] * dt; } spGeo.attributes.position.needsUpdate = true; };
  const tail = new THREE.Vector3(), rot = new THREE.Quaternion();
  const col = new THREE.Color();
  const S = [];
  for (let i = 0; i < N; i++) {
    const skin = SKIN[i % 3], top = Math.random() < 0.35 ? skin : TOPS[i % 5], sh = SHORTS[(i * 3) % 4];   // (some just in boardshorts)
    const c = [sh, sh, skin, skin, top, top, top];   // thighs, shins, torso, arms (sleeves)
    for (let k = 0; k < SEG; k++) limbs.setColorAt(i * SEG + k, col.setRGB(...c[k]));
    heads.setColorAt(i, col.setRGB(...(i % 2 ? [0.12, 0.09, 0.07] : skin)));   // (hair from behind, or a face)
    boards.setColorAt(i, col.setRGB(...BOARDC[i % 5]));
    S.push({ st: 'SIT', x: -6 + i * 4.5 + Math.random() * 2, z: -14 - Math.random() * 10, home: null, sg: Math.random() < 0.5 ? 1 : -1, bob: Math.random() * 9,
      p: new THREE.Vector3(), f: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(0, 1, 0), crouch: 0.4, lean: 0, arm: Math.random() * 6, wait: Math.random() * 4 });
    S[i].home = [S[i].x, S[i].z];
  }
  for (const m of [limbs, heads, boards]) m.instanceColor.needsUpdate = true;

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3();
  const side = new THREE.Vector3(), L = [];   // (the figure's joints this frame, in the world)
  const W = (s, x, y, z, out) => out.copy(s.p).addScaledVector(s.f, x).addScaledVector(s.u, y).addScaledVector(side, z);   // figure-local point -> world
  const limb = (idx, p0, p1, r) => { v.subVectors(p1, p0); const len = v.length(); q.setFromUnitVectors(Y, v.divideScalar(len || 1)); a.addVectors(p0, p1).multiplyScalar(0.5);
    limbs.setMatrixAt(idx, m4.compose(a, q, sc.set(r, len, r))); };
  const P = Array.from({ length: 10 }, () => new THREE.Vector3());
  // real people: one each, posed from the joints each frame (the stick figures and their heads are then not drawn)
  const people = [], LK = new THREE.Vector3(), J = { up: new THREE.Vector3(), face: new THREE.Vector3(), look: null };
  let frame = 0; const api = { detail: false };   // detail: every surfer posed every frame (set while you zoom or watch a ride)
  const HD = new THREE.Vector3();
  function setPeople(list) {
    list.slice(0, N).forEach(([src, look], i) => { const Pn = waterPerson(src, look); Pn.body.traverse((o) => { if (o.isMesh) o.userData.crew = true; }); group.add(Pn.root); people[i] = Pn; });
    limbs.count = 0; heads.count = 0;
  }

  // one surfer's body, posed: standing (crouched by c, facing the side sg), lying down paddling, or sitting up
  function pose(i, s) {
    side.crossVectors(s.f, s.u).normalize();
    const [hip, sho, head, fL, fR, kL, kR, hL, hR] = P;
    if (s.st === 'RIDE' || s.st === 'WIPE') {
      const c = s.st === 'WIPE' ? 0.9 : s.crouch, sg = s.sg;
      W(s, 0.3, 0.07, 0, fL); W(s, -0.3, 0.07, 0, fR);
      W(s, 0.02, 0.95 - 0.35 * c, 0.1 * sg * c, hip);
      W(s, 0.12 + 0.1 * c, 1.47 - 0.45 * c, 0.3 * sg * c + 0.05 * sg, sho);
      W(s, 0.16 + 0.12 * c, 1.66 - 0.5 * c, 0.34 * sg * c + 0.08 * sg, head);
      W(s, 0.2, 0.5 - 0.2 * c, 0.22 * sg * c + 0.05 * sg, kL); W(s, -0.16, 0.48 - 0.2 * c, 0.2 * sg * c + 0.04 * sg, kR);
      const sw = Math.sin(s.arm) * 0.12;
      W(s, 0.75, 1.15 - 0.3 * c + sw, 0.3 * sg * c + 0.25 * sg, hL); W(s, -0.55, 1.05 - 0.35 * c - sw, 0.25 * sg * c + 0.15 * sg, hR);   // lead arm out over the nose, back arm trailing
    } else if (s.st === 'PADDLE') {
      const k = s.arm;
      W(s, -1.0, 0.14, 0.12, fL); W(s, -1.0, 0.14, -0.12, fR); W(s, -0.55, 0.15, 0.1, kL); W(s, -0.55, 0.15, -0.1, kR);
      W(s, -0.15, 0.17, 0, hip); W(s, 0.45, 0.26, 0, sho); W(s, 0.62, 0.36, 0, head);
      W(s, 0.45 + 0.45 * Math.cos(k), 0.1 + 0.3 * Math.max(0, Math.sin(k)) - 0.25 * Math.max(0, -Math.sin(k)), 0.32, hL);
      W(s, 0.45 + 0.45 * Math.cos(k + Math.PI), 0.1 + 0.3 * Math.max(0, Math.sin(k + Math.PI)) - 0.25 * Math.max(0, -Math.sin(k + Math.PI)), -0.32, hR);
    } else {   // SIT: straddling the board, legs in the water, hands on the rails in front
      W(s, 0.35, -0.45, 0.22, fL); W(s, 0.35, -0.45, -0.22, fR); W(s, 0.3, 0.12, 0.2, kL); W(s, 0.3, 0.12, -0.2, kR);
      W(s, -0.1, 0.14, 0, hip); W(s, -0.05, 0.7, 0, sho); W(s, -0.02, 0.88, 0, head);
      W(s, 0.34, 0.07, 0.24, hL); W(s, 0.34, 0.07, -0.24, hR);
    }
    const Pn = people[i];
    if (Pn) {   // a real person on those points
      Pn.root.visible = !s.hidden;
      Object.assign(J, { hip, sho, head, fL, fR, kL, kR, hL, hR });
      if (s.st === 'PADDLE') { J.up.subVectors(sho, hip); J.face.copy(s.u).negate(); J.look = null; }
      else if (s.st === 'RIDE' || s.st === 'WIPE') { J.up.subVectors(sho, hip); J.face.copy(side).multiplyScalar(s.sg); J.look = LK.copy(s.f); }
      else { J.up.copy(s.u); J.face.copy(s.f); J.look = LK.copy(s.f); }
      // (out at the break with the naked eye they're a few dots tall: posed every third frame, and between times just
      // carried along with their board)
      if (!s.hidden) { if (api.detail || (frame + i) % 3 === 0 || !Pn.hip) { poseFrom(Pn, J); (Pn.hip ||= new THREE.Vector3()).copy(hip); }
        else { Pn.root.position.add(HD.subVectors(hip, Pn.hip)); Pn.hip.copy(hip); } }
    }
    else { const o = i * SEG;
      limb(o, hip, kL, 0.075); limb(o + 1, hip, kR, 0.075); limb(o + 2, kL, fL, 0.055); limb(o + 3, kR, fR, 0.055);
      limb(o + 4, hip, sho, 0.15); limb(o + 5, sho, hL, 0.045); limb(o + 6, sho, hR, 0.045);
      heads.setMatrixAt(i, m4.compose(head, q.identity(), sc.set(0.11, 0.12, 0.11))); }
    // the board: a long thin lens under the feet, along the heading
    m4.makeBasis(s.f, s.u, side); q.setFromRotationMatrix(m4); a.copy(s.p).addScaledVector(s.u, 0.02);
    boards.setMatrixAt(i, m4.compose(a, q, sc.set(0.93, 0.04, 0.25)));
  }

  // a spot on the wave's face (s along the wave from the peel, at height fy of the face) -> the world, and the face's slope there
  function onFace(w, s, fy, out, nrm) {
    const H = w.cond.H, pr = w.prof, f = w.fade || 1, F = pr.slice(s).F, y = Math.min(fy * H, F[F.length - 1][1] - 0.15);   // (never above the top of the face: lower on the shoulder)
    const z0 = pr.frontZAt(s, Math.max(0, y - 0.3)), z1 = pr.frontZAt(s, y + 0.3), zl = pr.frontZAt(s, y);
    out.set(w.peelX + s, y * f, w.zW + w.bend(s) + zl);
    nrm.set(0, -(z1 - z0), 0.6 * f).normalize(); if (nrm.y < 0.15) nrm.y = 0.15; nrm.normalize();
  }
  const tgt = new THREE.Vector3(), nrm = new THREE.Vector3(), prev = new THREE.Vector3(), fwd = new THREE.Vector3();

  function update(dt, waves, T) {
    if (!group.visible) return; frame++;
    // a wave about to break: the free surfer sitting nearest the peak goes
    for (const w of waves) {
      const t = T - w.tBreak;
      if (w.crewTaken || t < -0.4 || t > 0.4) continue; w.crewTaken = true;
      if (Math.random() < 0.12) continue;   // (now and then nobody's in position)
      let best = null, bd = 1e9; for (const s of S) if (s.st === 'SIT' && s.wait <= 0) { const d = Math.hypot(s.x - w.peelX - 3, s.z + 8); if (d < bd) { bd = d; best = s; } }
      if (best) { const H = w.cond.H; Object.assign(best, { st: 'RIDE', kick: false, w, rs: 0.5 * H, fy: 0.85, tau: 0, ph: 0, tube: Math.random() < 0.85 ? 4.5 + Math.random() * 4 : 1e9, tubeT: 0, dur: 16 + Math.random() * 8, blend: 0, sBase: (0.9 + Math.random() * 0.5) * H, per: 2.6 + Math.random() * 1.2, wipeAt: Math.random() < 0.18 ? 4 + Math.random() * 7 : 1e9, cut: 0, hidden: false }); }
    }
    S.forEach((s, i) => {
      prev.copy(s.p);
      if (s.st === 'RIDE') {
        const w = s.w, H = w.cond.H; s.tau += dt;
        if (!waves.includes(w) || w.peelX > w.xEnd - 15) s.kick = true;
        let sT, fT, cT;
        if (s.tau < 1.3) { const k = s.tau / 1.3; sT = 0.5 * H + 0.4 * H * k; fT = 0.85 - 0.7 * k * k; cT = 0.6; }   // the drop
        else if (s.kick || s.tau > s.dur) { s.kick = true; sT = s.rs + 0.3 * H; fT = 1.05; cT = 0.3; }   // up the face and over the back
        else if (s.tau > s.tube && s.tubeT >= 3) { s.tubeT = 0; s.tube = Math.random() < 0.6 && s.tau < 9 ? s.tau + 2.5 + Math.random() * 2 : 1e9; }   // (another one further down the line? only while the wave is still coming at the villa, which sees into the barrel from down the line)
        if (sT === undefined && !s.kick && s.tau > s.tube && s.tubeT < 3) {   // stall into the barrel, hold, then race out
          const sl = w.prof.slice(-0.9 * H), open = sl.curl > 0.3 && sl.lipY < 0.62 * H;
          if (!open && s.tubeT === 0) s.tube = s.tau + 2; else { s.tubeT += dt; sT = s.tubeT < 2.4 ? -0.9 * H : 1.2 * H; fT = 0.3; cT = 1.4; }   // (tucked low under the lip)
        }
        if (sT === undefined && !s.kick && s.tau > 3.5 && !(s.cut > 0) && s.fy > 0.55 && Math.random() < dt * 0.14) s.cut = 1.6;   // now and then a cutback: round and back toward the curl
        if (sT === undefined && s.cut > 0) { s.cut -= dt; sT = s.sBase - 1.7 * H; fT = 0.5; cT = 0.8; }
        if (sT === undefined) { s.ph += dt * 2 * Math.PI / s.per; sT = s.sBase + 0.55 * H * Math.sin(s.ph); fT = 0.42 - 0.3 * Math.cos(s.ph); cT = 0.35 + 0.35 * Math.max(0, Math.cos(s.ph)); }   // carving: bottom turn (compressed), up to the lip, back down
        s.rs += (sT - s.rs) * Math.min(1, dt * (s.cut > 0 ? 2.6 : 1.6)); s.fy += (fT - s.fy) * Math.min(1, dt * 2.2); s.crouch += (cT - s.crouch) * Math.min(1, dt * 4);
        onFace(w, s.rs, Math.min(s.fy, 0.98), tgt, nrm);
        s.blend = Math.min(1, s.blend + dt * 1.5); s.p.lerp(tgt, s.blend < 1 ? s.blend * 0.3 + 0.1 : 1);
        s.u.copy(nrm).multiplyScalar(0.65).add(v.set(0, 0.35, 0)).normalize();
        if (s.kick && s.fy > 0.97) { s.st = 'PADDLE'; s.wait = 0; }
        // spray off the tail: in hard turns, and flicking off the top turn
        if (Math.abs(s.lean) > 0.2 || (s.fy > 0.7 && fT < s.fy)) { tail.copy(s.p).addScaledVector(s.f, -0.8); side.crossVectors(s.f, s.u).normalize();
          const k = Math.sign(s.lean) || 1; spray(tail, -s.f.x * 2 + side.x * k * 3, 3.5, -s.f.z * 2 + side.z * k * 3, Math.random() < dt * 40 ? 3 : 0, 1.5); }
        if (s.tau > s.wipeAt && !s.kick && !(s.tubeT > 0 && s.tubeT < 3)) { s.st = 'WIPE'; s.wt = 0; spray(s.p, 0, 5, 0, 30, 3); }   // caught by the lip
      } else if (s.st === 'WIPE') {   // pitched off: tumbling down the face, under for a few seconds, then up and paddling
        const w = s.w, H = w.cond.H; s.wt += dt;
        if (s.wt < 0.9 && waves.includes(w)) { s.rs -= H * 1.2 * dt; s.fy = Math.max(0.05, s.fy - dt * 1.2); onFace(w, s.rs, s.fy, tgt, nrm); s.p.lerp(tgt, 0.5);
          side.crossVectors(s.f, s.u).normalize(); rot.setFromAxisAngle(side, dt * 7); s.u.applyQuaternion(rot); s.f.applyQuaternion(rot); }
        else if (s.wt < 3.4) { if (!s.hidden) { s.hidden = true; spray(s.p, 0, 4, 0, 40, 2.5); } s.p.y = -1; }
        else { s.hidden = false; s.p.y = heightAt(waves, s.p.x, s.p.z); s.u.set(0, 1, 0); s.f.set(0, 0, -1); s.st = 'PADDLE'; spray(s.p, 0, 2, 0, 10, 1); }
      } else if (s.st === 'PADDLE') {   // back out to the lineup (the waves roll under you on the way)
        const dx = s.home[0] - s.p.x, dz = s.home[1] - s.p.z, d = Math.hypot(dx, dz);
        s.p.x += dx / d * 1.8 * dt; s.p.z += dz / d * 1.8 * dt; s.p.y = heightAt(waves, s.p.x, s.p.z) + 0.02; s.arm += dt * 5.5;
        s.u.lerp(Y, Math.min(1, dt * 3)).normalize();
        if (d < 1.5) { s.st = 'SIT'; s.x = s.p.x; s.z = s.p.z; s.wait = 4 + Math.random() * 6; }
      } else {   // sitting in the lineup, bobbing, facing out to sea
        s.wait -= dt; s.bob += dt; s.p.set(s.x, heightAt(waves, s.x, s.z) - 0.05 + Math.sin(s.bob * 1.3) * 0.04, s.z);
        s.u.lerp(Y, Math.min(1, dt * 3)).normalize(); s.f.lerp(fwd.set(0.2 * Math.sin(s.bob * 0.2 + i), 0, -1), Math.min(1, dt)).normalize();
      }
      // heading: along the way you're moving (projected flat onto the board's plane); a little roll into the turn
      if (s.st !== 'SIT' && s.st !== 'WIPE') { fwd.subVectors(s.p, prev); if (s.st === 'RIDE') fwd.addScaledVector(s.u, -fwd.dot(s.u)); const sp = fwd.length();
        if (sp > 0.02) { fwd.divideScalar(sp); const turn = new THREE.Vector3().crossVectors(s.f, fwd).dot(s.u) / Math.max(dt, 1e-3); s.lean += (Math.max(-0.5, Math.min(0.5, turn * 0.25)) - s.lean) * Math.min(1, dt * 3); s.f.lerp(fwd, Math.min(1, dt * 6)).normalize(); } }
      if (s.st !== 'WIPE') s.f.addScaledVector(s.u, -s.f.dot(s.u)).normalize();
      if (s.st === 'RIDE') { side.crossVectors(s.f, s.u).normalize(); s.u.addScaledVector(side, -s.lean).normalize(); s.arm += dt * 1.5; }
      pose(i, s);
      if (s.hidden) { m4.makeScale(0, 0, 0); for (let k = 0; k < SEG; k++) limbs.setMatrixAt(i * SEG + k, m4); heads.setMatrixAt(i, m4); boards.setMatrixAt(i, m4); }
    });
    sprayTick(dt);
    limbs.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; boards.instanceMatrix.needsUpdate = true;
  }
  return Object.assign(api, { group, update, surfers: S, setPeople });
}
