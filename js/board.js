// The surfboards, built from an outline: shortboard 6'2", fish 5'8", longboard 9'2" and a 9'6" gun (see SHAPES), with rocker, domed deck, rounded rails and fins.
import * as THREE from 'three';

// The four boards' shapes: length, width, thickness, outline (share of the widest point along the board, tail 0 -> nose 1),
// nose lift, fins, and their colours
const SHAPES = {
  short: { L: 1.88, W: 0.49, T: 0.062, nose: 0.085, fins: 'thruster', deck: [0.95, 0.94, 0.91], stripe: [0.9, 0.35, 0.18], pad: true,
    OUT: [[-.05, .6], [0, .66], [.08, .78], [.25, .93], [.45, 1], [.62, .96], [.78, .82], [.88, .64], [.94, .48], [.975, .31], [.992, .15], [1, .0], [1.01, -.1]] },
  fish: { L: 1.73, W: 0.54, T: 0.066, nose: 0.07, fins: 'twin', deck: [0.96, 0.9, 0.7], stripe: [0.1, 0.55, 0.55], pad: true,
    OUT: [[-.05, .74], [0, .8], [.08, .89], [.25, .97], [.45, 1], [.62, .97], [.78, .87], [.88, .72], [.94, .55], [.975, .37], [.992, .19], [1, .0], [1.01, -.1]] },
  long: { L: 2.8, W: 0.57, T: 0.075, nose: 0.11, fins: 'single', deck: [0.93, 0.9, 0.82], stripe: [0.16, 0.36, 0.62], pad: false,
    OUT: [[-.05, .62], [0, .7], [.08, .82], [.25, .95], [.45, 1], [.62, .99], [.78, .95], [.88, .87], [.94, .75], [.975, .57], [.992, .33], [1, .0], [1.01, -.1]] },
  gun: { L: 2.9, W: 0.5, T: 0.075, nose: 0.14, fins: 'thruster', deck: [0.96, 0.96, 0.95], stripe: [0.75, 0.12, 0.1], pad: true,
    OUT: [[-.05, .16], [0, .26], [.08, .45], [.25, .78], [.45, .97], [.55, 1], [.7, .92], [.82, .75], [.9, .55], [.95, .35], [.985, .14], [1, .0], [1.01, -.1]] },
  // (display boards in the villa, never ridden: a 70s single fin, a pastel egg and a wooden alaia with no fins at all)
  retro: { L: 2.36, W: 0.55, T: 0.07, nose: 0.1, fins: 'single', pad: false,
    OUT: [[-.05, .5], [0, .58], [.08, .72], [.25, .9], [.45, 1], [.62, .98], [.78, .9], [.88, .77], [.94, .6], [.975, .42], [.992, .22], [1, .0], [1.01, -.1]] },
  egg: { L: 2.13, W: 0.57, T: 0.072, nose: 0.08, fins: 'single', pad: false,
    OUT: [[-.05, .7], [0, .76], [.08, .86], [.25, .96], [.45, 1], [.62, .99], [.78, .93], [.88, .83], [.94, .7], [.975, .52], [.992, .28], [1, .0], [1.01, -.1]] },
  alaia: { L: 2.2, W: 0.46, T: 0.028, nose: 0.03, fins: 'none', pad: false,
    OUT: [[-.05, .8], [0, .84], [.08, .88], [.25, .95], [.45, 1], [.62, 1], [.78, .96], [.88, .88], [.94, .75], [.975, .56], [.992, .3], [1, .0], [1.01, -.1]] },
};
// each board's paint job, by where you are on it: u along (tail 0 -> nose 1), v across (-1 rail .. 0 stringer .. 1 rail),
// deck or bottom. Four completely different looks, so you know your board at a glance
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const PAINT = {
  // performance shortboard: bright white deck, coral-red resin rails that fade in from the edges, coral bottom, black pad
  short: (u, v, deck) => { const WHITE = [0.95, 0.95, 0.93], CORAL = [0.93, 0.33, 0.24];
    if (!deck) return mix(CORAL, [0.98, 0.55, 0.42], sm(0.2, 0.9, u) * 0.4);
    if (Math.abs(v) < 0.02) return [0.55, 0.42, 0.28];
    return mix(WHITE, CORAL, sm(0.72, 0.95, Math.abs(v))); },   // (the logo is drawn over it below, with smooth edges)
  // retro fish: mustard-yellow deck with a wide teal racing stripe, teal bottom
  fish: (u, v, deck) => { const MUSTARD = [0.95, 0.72, 0.22], TEAL = [0.08, 0.5, 0.5];
    if (!deck) return TEAL;
    if (Math.abs(v) < 0.22 && u > 0.3) return mix(TEAL, [0.1, 0.6, 0.58], sm(0.3, 1, u));
    if (Math.abs(Math.abs(v) - 0.27) < 0.035 && u > 0.3) return [0.97, 0.94, 0.86];   // pinlines either side of the stripe
    return MUSTARD; },
  // classic longboard: cream deck with a wide three-strip wooden stringer, pastel-blue resin rails and bottom, nose pinline
  long: (u, v, deck) => { const CREAM = [0.95, 0.91, 0.82], BLUE = [0.55, 0.74, 0.86];
    if (!deck) return BLUE;
    if (Math.abs(v) < 0.05) return Math.abs(v) < 0.015 ? [0.7, 0.55, 0.36] : [0.45, 0.3, 0.18];
    if (Math.abs(v) > 0.62) return BLUE;
    if (u > 0.9 && Math.abs(v) < 0.6 && Math.abs(v) > 0.52) return [0.2, 0.3, 0.45];
    return CREAM; },
  // big-wave gun: deep red all over (easy to spot in the whitewater), a white centre stripe, a yellow nose tip
  gun: (u, v, deck) => { const RED = [0.72, 0.1, 0.09];
    if (u > 0.94) return [0.98, 0.8, 0.12];
    if (!deck) return mix(RED, [0.5, 0.06, 0.06], sm(0.9, 1, Math.abs(v)));
    if (Math.abs(v) < 0.1 && u > 0.12) return [0.96, 0.95, 0.92];
    return RED; },
  // 70s single fin: cream deck, a wooden stringer, orange, rust and brown stripes across the nose, amber tinted bottom
  retro: (u, v, deck) => { const CREAM = [0.94, 0.88, 0.74], AMBER = [0.8, 0.52, 0.22];
    if (!deck) return mix(AMBER, [0.62, 0.34, 0.14], sm(0.5, 1, Math.abs(v)));
    if (Math.abs(v) < 0.025) return [0.5, 0.33, 0.18];
    for (const [a, c] of [[0.7, [0.95, 0.55, 0.16]], [0.745, [0.78, 0.3, 0.12]], [0.79, [0.42, 0.24, 0.12]]]) if (u > a && u < a + 0.035) return c;
    return Math.abs(v) > 0.9 ? AMBER : CREAM; },
  // pastel egg: pink deck fading to peach at the rails, a white pinline, mint bottom
  egg: (u, v, deck) => { const PINK = [0.96, 0.66, 0.66], PEACH = [0.98, 0.8, 0.62];
    if (!deck) return [0.6, 0.86, 0.76];
    if (Math.abs(Math.abs(v) - 0.7) < 0.03) return [0.98, 0.97, 0.94];
    return mix(PINK, PEACH, sm(0.4, 0.95, Math.abs(v))); },
  // alaia: one plank of paulownia, oiled, its grain running nose to tail
  // (1 Oct 2026, the alaia became a board you ride: the grain was drawn across the board's own width, so it bunched into
  // a point at the nose like corduroy. Now it runs straight along the plank in real measure and off the rails at the
  // nose, as sawn wood does, with an uneven spacing, a few darker growth lines, a tone that shifts along it, oiled rails)
  alaia: (u, v, deck) => { const O = SHAPES.alaia.OUT; let i = 1; while (i < O.length - 1 && O[i][0] < u) i++;
    const f = Math.min(1, Math.max(0, (u - O[i - 1][0]) / (O[i][0] - O[i - 1][0]))), x = v * (O[i - 1][1] + (O[i][1] - O[i - 1][1]) * f);   // (across the plank in real terms)
    const g = x * 30 + 0.6 * Math.sin(u * 5.3 + x * 3) + 0.35 * Math.sin(u * 13.1 + 1.7);   // (the grain, wavering gently along its length)
    let k = 0.9 + 0.055 * Math.sin(g * 2.1) + 0.03 * Math.sin(g * 9.7 + 0.6 * Math.sin(x * 57));
    if (Math.abs(Math.sin(g * 0.37 + 0.8)) > 0.985) k -= 0.1;   // (a few darker growth lines)
    k *= (0.96 + 0.04 * Math.sin(u * 9 + 2.1)) * (1 - 0.16 * sm(0.86, 1, Math.abs(v))) * (deck ? 1 : 0.93);   // (tone along the plank, the oiled rails darker, the bottom a touch darker)
    return [0.68 * k, 0.47 * k, 0.28 * k]; },
};
// the paint job as a sharp picture, pixel by pixel (it used to be one colour per mesh point, ~2 cm apart across the
// board, which smeared the logo, stripes and pad into blobs). One sheet per board type, made once and shared
const SHEETS = {};
function paintSheet(type, S) {
  if (SHEETS[type]) return SHEETS[type];
  const FW = 256, H = 1024, cv = document.createElement('canvas'); cv.width = FW * 2; cv.height = H; const c = cv.getContext('2d'), img = c.createImageData(FW * 2, H), d = img.data;
  const paint = PAINT[type in PAINT ? type : 'short'], srgb = (x) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, x)), 1 / 2.2));
  for (let y = 0; y < H; y++) { const u = 1 - y / (H - 1);
    for (let x = 0; x < FW * 2; x++) { const deck = x < FW, v = ((x % FW) + 0.5) / FW * 2 - 1;
      let pc = paint(u, v, deck);
      // tail pad: dark traction pad over the fins, crisp grooves across it, a raised kick at the very back
      if (S.pad && deck && u > 0.05 && u < 0.3 && Math.abs(v) < 0.86) { const gr = (u * 140) % 1 < 0.28 ? 0.62 : 1, kick = u < 0.08 ? 1.25 : 1, edge = Math.abs(v) > 0.8 || u > 0.29 ? 1.35 : 1; pc = [0.1 * gr * kick * edge, 0.1 * gr * kick * edge, 0.11 * gr * kick * edge]; }
      const wax = 0.97 + 0.03 * Math.sin(x * 0.9 + y * 1.3) * Math.sin(x * 0.53 - y * 0.71);   // waxed deck: faintly mottled
      const i = (y * FW * 2 + x) * 4; d[i] = srgb(pc[0] * wax); d[i + 1] = srgb(pc[1] * wax); d[i + 2] = srgb(pc[2] * wax); d[i + 3] = 255; } }
  c.putImageData(img, 0, 0);
  if (type === 'short' || !(type in PAINT)) {   // the shortboard's logo inside its dark oval: the SumbaSurf wave (the game's icon)
    // (a little up toward the nose, so lying on the board to paddle you see all of it ahead of you, not a grey half-disc under your chin;
    // drawn with the canvas so its edge is smooth, not a staircase of pixels)
    const cx = FW / 2, cy = (1 - 0.68) * (H - 1); c.fillStyle = '#1e2126'; c.beginPath(); c.ellipse(cx, cy, 0.357 * FW / 2, 0.0556 * (H - 1), 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(cx, cy); c.scale(0.2, 0.2); c.translate(-261, -265);
    c.fillStyle = '#f2efe8'; c.beginPath(); c.moveTo(70, 390); c.bezierCurveTo(150, 390, 190, 300, 250, 190); c.bezierCurveTo(300, 110, 420, 110, 440, 200); c.bezierCurveTo(450, 250, 420, 300, 370, 300);
    c.bezierCurveTo(400, 260, 390, 210, 350, 205); c.bezierCurveTo(300, 200, 280, 260, 290, 330); c.bezierCurveTo(296, 370, 330, 390, 380, 390); c.closePath(); c.fill();
    c.fillStyle = '#ffc978'; c.fillRect(60, 405, 392, 16); c.restore(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  return (SHEETS[type] = t);
}
// where the board meets the water (29 Sep 2026, his call: looks only). The game sets the water's surface under the
// board each frame as a plane (normal, height) in world space; a see-through copy draws the part under the water (only
// where the water covers it) tinted and fading with depth, instead of the water slicing it off like a solid wall. (The
// foam where the water meets the board is drawn by the water itself: wave.js uBInv/uBDim)
export const BOARD_WATER = { uWP: { value: new THREE.Vector4(0, 1, 0, -99) }, uWOn: { value: 0 }, uBTime: { value: 0 }, uWCol: { value: new THREE.Color(0x1f9fd0) } };
const BW_VERT = (sh) => { Object.assign(sh.uniforms, BOARD_WATER); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBW;').replace('#include <project_vertex>', '#include <project_vertex>\nvBW = (modelMatrix * vec4(transformed, 1.)).xyz;'); };
const BW_HEAD = 'uniform vec4 uWP; uniform float uWOn, uBTime; uniform vec3 uWCol; varying vec3 vBW;\n';
function underwater(map) {
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.FrontSide, depthFunc: THREE.GreaterDepth, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });   // (drawn only where something is in front of the board: the water over it)
  m.onBeforeCompile = (sh) => { BW_VERT(sh); sh.fragmentShader = BW_HEAD + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    float bh = dot(uWP.xyz, vBW) - uWP.w; if (uWOn < .5 || bh > .15) discard;
    float dd = clamp(-bh / .45, 0., 1.);
    diffuseColor.rgb = mix(diffuseColor.rgb * .75, uWCol, .58 + .32 * dd); diffuseColor.a *= .62 * (1. - .8 * dd);`); };
  m.customProgramCacheKey = () => 'bwunder';
  return m;
}
export const BOARD_LENGTH = (type) => (SHAPES[type] || SHAPES.short).L;
export const BOARD_WIDTH = (type) => (SHAPES[type] || SHAPES.short).W;

export function makeBoard(type = 'short', water = false) {   // (water: your own board, which meets the water: see BOARD_WATER)
  const S = SHAPES[type] || SHAPES.short;
  const L = S.L, W = S.W, T = S.T, NL = 90, NW = 24;
  // outline from real shortboard proportions (share of max half-width along the board, tail 0 -> nose 1):
  // squash tail ~14" wide, widest just behind the middle, ~12" a foot from the nose, then a small rounded tip.
  // Joined with one smooth (Catmull-Rom) curve so the rail line has no bumps.
  const OUT = S.OUT;
  const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const halfWidth = (u) => {
    let i = 2; while (i < OUT.length - 2 && OUT[i][0] < u) i++;
    const a = OUT[i - 2], b = OUT[i - 1], c = OUT[i], d = OUT[i + 1], t = (u - b[0]) / (c[0] - b[0]);
    return W / 2 * Math.max(0, cr(a[1], b[1], c[1], d[1], Math.min(1, Math.max(0, t))));
  };
  // thickest just behind the middle, thinning toward the nose and tail
  const thick = (u) => T * (0.32 + 0.68 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.96 + 0.02))), 0.6));
  const rocker = (u) => S.nose * Math.pow(Math.max(0, u - 0.6) / 0.4, 2.2) + 0.03 * Math.pow(Math.max(0, 0.18 - u) / 0.18, 2);
  // lengthwise stations bunched toward the nose (so its round tip stays smooth); across, bunched toward the rails
  const station = (i) => { const x = i / NL; return 1 - Math.pow(1 - x, 1.7) * 0.999; };
  const across = (j) => Math.sin((j / NW * 2 - 1) * Math.PI / 2);
  const pos = [], col = [], idx = [];
  // deck (domed) and bottom (flatter), meeting in a rounded rail
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NL; i++) {
      const u = station(i), hw = Math.max(0.0015, halfWidth(u)), z = (u - 0.5) * L, r = rocker(u), th = thick(u);
      for (let j = 0; j <= NW; j++) {
        const v = across(j), x = v * hw, e = Math.max(0, 1 - v * v);
        const notch = type === 'fish' && u < 0.09 ? 0.13 * Math.max(0, 1 - Math.abs(v) / 0.55) * (1 - u / 0.09) : 0;   // the fish's swallow tail
        const y = r + (side > 0 ? th * 0.62 * Math.pow(e, 0.55) : -th * 0.38 * Math.pow(e, 0.3));
        pos.push(x, y, z + notch);
        col.push((v * 0.5 + 0.5) * 0.5 + (side > 0 ? 0 : 0.5), u);   // (where on the painted sheet: deck on its left half, bottom on its right)
      }
    }
    for (let i = 0; i < NL; i++) for (let j = 0; j < NW; j++) {
      const a = base + i * (NW + 1) + j, b = a + 1, c = a + NW + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(col, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const board = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: paintSheet(type, S), roughness: type === 'alaia' ? 0.55 : 0.2, side: THREE.DoubleSide })   /* (oiled wood is satin, not glassy resin: at 0.2 the alaia mirrored the blue sky and read grey-green on friends, his check 1 Oct 2026) */   /* (a wet glossy deck: the sun catches it) */);
  if (water) { const sheet = board.material.map; const under = new THREE.Mesh(g, underwater(sheet)); under.renderOrder = 20; under.frustumCulled = false; board.add(under); board.userData.under = under; }   // (the part under the water, seen through it)
  // three fins under the tail
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.quadraticCurveTo(0.02, -0.1, 0.07, -0.11); fin.lineTo(0.09, 0); fin.lineTo(0, 0);
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.006, bevelEnabled: false });
  const fm = new THREE.MeshStandardMaterial({ color: { long: 0x8a5a32, fish: 0x7a4a2a, retro: 0x8a5a32, egg: 0xd8d2c4 }[type] || 0x1c1c1e, roughness: 0.4 });   // (wooden keels and single fin on the retro boards)
  const FINS = { thruster: [[0, -L / 2 + 0.1, 0, 1], [-0.13, -L / 2 + 0.24, 0.06, 1], [0.13, -L / 2 + 0.24, -0.06, 1]],
    twin: [[-0.15, -L / 2 + 0.16, 0.05, 1.35], [0.15, -L / 2 + 0.16, -0.05, 1.35]],   // two big keel fins
    single: [[0, -L / 2 + 0.22, 0, 1.9]] };                                            // one tall fin
  for (const [x, z, rot, sc] of FINS[S.fins] || []) {
    const f = new THREE.Mesh(fg, fm); f.rotation.y = Math.PI / 2 + rot; f.position.set(x, 0, z); f.scale.setScalar(sc); board.add(f);
  }
  board.userData.length = L;
  return board;
}
