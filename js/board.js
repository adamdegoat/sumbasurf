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
  // the bodyboard (3 Oct 2026, his call; ridden lying down, see BODYBOARD_PLAN.md): a 42" board for a 1.75 m rider, 107 x 54 cm
  // and 6 cm thick (Morey Cruiser 42.5 is 21.5" x 2.4"); a wide, blunt nose with rounded corners, widest a little toward
  // the nose, a crescent tail (the U cut across it: crescent), almost no rocker, a flat deck and hard rails, no fins
  body: { L: 1.07, W: 0.54, T: 0.06, nose: 0.028, kick: 0.012, fins: 'none', pad: false, flat: true, crescent: 0.035,
    OUT: [[-.05, .6], [0, .64], [.08, .71], [.25, .85], [.45, .96], [.6, 1], [.72, .99], [.82, .96], [.9, .92], [.94, .88], [.965, .82], [.982, .73], [.993, .62], [1, .56], [1.01, .5]] },   /* (the nose stays wide to its end: see the ends' closing in makeBoard) */
};
// each board's paint job, by where you are on it: u along (tail 0 -> nose 1), v across (-1 rail .. 0 stringer .. 1 rail),
// deck or bottom. Four completely different looks, so you know your board at a glance
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const PAINT0 = {
  // (1 Oct 2026, his "not designed properly": same colours, so everyone still knows their board, drawn cleanly: crisp
  // rail bands and pinlines that follow the outline nose to tail, no smudged fades, no stripe stopping halfway, no stray
  // marks at the nose)
  // performance shortboard: bright white deck, a crisp coral rail band with a coral pinline inside it, a thin wooden
  // stringer, coral bottom (the logo is drawn over it below)
  short: (u, v, deck) => { const WHITE = [0.95, 0.95, 0.93], CORAL = [0.93, 0.33, 0.24], av = Math.abs(v);
    if (!deck) return mix(CORAL, [0.97, 0.5, 0.38], sm(0.3, 1, u) * 0.35);
    if (av > 0.88) return CORAL;
    if (Math.abs(av - 0.8) < 0.018) return CORAL;
    if (av < 0.012) return [0.6, 0.46, 0.3];
    return WHITE; },
  // retro fish: mustard-yellow deck with a teal racing stripe running the whole length, cream pinlines either side, teal bottom
  fish: (u, v, deck) => { const MUSTARD = [0.95, 0.72, 0.22], TEAL = [0.08, 0.5, 0.5], av = Math.abs(v);
    if (!deck) return TEAL;
    if (u > 0.04 && u < 0.985) { if (av < 0.2) return TEAL; if (Math.abs(av - 0.25) < 0.025) return [0.97, 0.94, 0.86]; }
    return MUSTARD; },
  // classic longboard: cream deck, the wide three-strip wooden stringer, crisp pastel-blue resin rails, a navy pinline
  // tracing the outline inside them nose to tail, blue bottom
  long: (u, v, deck) => { const CREAM = [0.95, 0.91, 0.82], BLUE = [0.55, 0.74, 0.86], av = Math.abs(v);
    if (!deck) return BLUE;
    if (av < 0.05) return av < 0.015 ? [0.7, 0.55, 0.36] : [0.45, 0.3, 0.18];
    if (av > 0.68) return BLUE;
    if (Math.abs(av - 0.62) < 0.014 && u > 0.03) return [0.18, 0.28, 0.45];
    return CREAM; },
  // big-wave gun: deep red all over (easy to spot in the whitewater), a white centre stripe edged in black, a yellow nose tip
  gun: (u, v, deck) => { const RED = [0.72, 0.1, 0.09], av = Math.abs(v);
    if (u > 0.94) return [0.98, 0.8, 0.12];
    if (u > 0.93) return [0.1, 0.08, 0.08];
    if (!deck) return mix(RED, [0.5, 0.06, 0.06], sm(0.9, 1, av));
    if (av < 0.1) return [0.96, 0.95, 0.92];
    if (av < 0.125) return [0.1, 0.08, 0.08];
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
// the designs you can pick for each board you ride (his call 1 Oct 2026, looks only: same shape, same feel): [0] the
// board's own paint, [1] a second one that stays, [2] the seasonal one, changed by hand when the season changes (now
// Halloween). DESIGNS names them for the board room
const ikat = (u, v, L) => {   // a band of Sumba ikat diamonds (the island's woven cloth): indigo, rust and natural thread, slightly blurred like dyed yarn
  const a = u * L * 7, b = v * 3.2 + 0.5, fa = a - Math.floor(a), fb = b - Math.floor(b), d = Math.abs(fa - 0.5) + Math.abs(fb - 0.5), j = 0.03 * Math.sin(u * 900 + v * 40);
  return d + j < 0.15 ? [0.74, 0.27, 0.12] : d + j < 0.27 ? [0.93, 0.86, 0.7] : d + j < 0.33 ? [0.74, 0.27, 0.12] : [0.09, 0.13, 0.32]; };   // (indigo ground, cream diamonds with a rust heart and edge)
const HALLO_ORANGE = [0.96, 0.45, 0.08], HALLO_BLACK = [0.06, 0.05, 0.07];
const PAINT = {
  short: [PAINT0.short,
    // Night: deep navy deck, two thin glowing cyan pinlines down the rails (Pantai Bintang's colours), navy bottom
    (u, v, deck) => { const NAVY = [0.06, 0.09, 0.2]; if (!deck) return [0.08, 0.12, 0.26]; if (Math.abs(v) < 0.02) return [0.32, 0.25, 0.18];
      const pl = Math.abs(Math.abs(v) - 0.8); if (pl < 0.025) return [0.45, 0.95, 1]; if (pl < 0.06) return mix(NAVY, [0.2, 0.5, 0.6], 1 - (pl - 0.025) / 0.035);
      { const cu = Math.floor(u * 160), cv = Math.floor((v + 1) * 14), h = (n) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); }, r = h(cu * 12.9898 + cv * 78.233);   // (a faint scatter of stars: one now and then in a grid of cells, at a random spot in its cell)
        if (r > 0.9 && Math.abs(v) < 0.72) { const px = (u * 160 - cu) - h(r * 91.3), py = ((v + 1) * 14 - cv) - h(r * 47.1); if (px * px + py * py * 4 < 0.03) return mix(NAVY, [0.85, 0.95, 1], 0.6 + 0.4 * h(r * 13)); } }
      return NAVY; },
    // Halloween: black deck, orange pinlines, orange bottom (a jack-o'-lantern where the logo sits: drawn below)
    (u, v, deck) => { if (!deck) return HALLO_ORANGE; if (Math.abs(Math.abs(v) - 0.78) < 0.03) return HALLO_ORANGE; return [0.13, 0.07, 0.17]; }],   // (purple-black, so the black grip pad still reads)
  fish: [PAINT0.fish,
    // Sunset spray: white deck with orange to pink airbrushed rails and a black pinline inside them, orange bottom
    (u, v, deck) => { const SUN = mix([0.98, 0.5, 0.15], [0.95, 0.4, 0.55], sm(0.15, 0.95, u)); if (!deck) return SUN;
      const av = Math.abs(v); if (Math.abs(av - 0.58) < 0.02) return [0.08, 0.08, 0.08]; return mix([0.96, 0.95, 0.92], SUN, sm(0.6, 0.9, av)); },
    // Halloween: pumpkin orange with black spiderweb lines fanning from the nose (drawn below), black bottom
    (u, v, deck) => (deck ? HALLO_ORANGE : HALLO_BLACK)],
  long: [PAINT0.long,
    // Red tint: deep red resin all over, the wide three-strip wooden stringer, a cream nose block
    (u, v, deck) => { if (u > 0.965) return [0.93, 0.88, 0.78]; if (deck && Math.abs(v) < 0.05) return Math.abs(v) < 0.015 ? [0.7, 0.55, 0.36] : [0.45, 0.3, 0.18];
      return deck ? mix([0.62, 0.08, 0.07], [0.48, 0.05, 0.05], sm(0.8, 1, Math.abs(v))) : [0.5, 0.06, 0.06]; },
    // Halloween: cream deck, a black stringer with little black bats flying up it (drawn below), orange rails and bottom
    (u, v, deck) => { if (!deck) return HALLO_ORANGE; if (Math.abs(v) > 0.66) return HALLO_ORANGE; if (Math.abs(v) < 0.03) return HALLO_BLACK; return [0.95, 0.91, 0.82]; }],
  gun: [PAINT0.gun,
    // Hi-vis: fluoro yellow (big-wave boards are painted to be found in the whitewater), a black centre stripe, black nose
    (u, v, deck) => { if (u > 0.94) return [0.06, 0.06, 0.06]; if (!deck) return [0.9, 0.86, 0.1]; if (Math.abs(v) < 0.08 && u > 0.12) return [0.07, 0.07, 0.07]; return [0.95, 0.92, 0.12]; },
    // Halloween: midnight purple with a ghostly green glow along the rails, a green nose tip
    (u, v, deck) => { const PURPLE = [0.2, 0.08, 0.3], GLOW = [0.45, 1, 0.45]; if (u > 0.94) return GLOW; if (!deck) return [0.14, 0.05, 0.22];
      return mix(PURPLE, GLOW, sm(0.62, 0.97, Math.abs(v))); }],
  alaia: [PAINT0.alaia,
    // Painted: the oiled plank with a band of Sumba ikat across the nose and a thinner one at the tail
    (u, v, deck) => { const w = PAINT0.alaia(u, v, deck); if (!deck) return w; if ((u > 0.7 && u < 0.84) || (u > 0.1 && u < 0.16)) return ikat(u, v, SHAPES.alaia.L); if (Math.abs(u - 0.69) < 0.006 || Math.abs(u - 0.85) < 0.006) return [0.12, 0.1, 0.1]; return w; },
    // Halloween: the plank stained near-black, an orange zigzag band across the middle like a carved grin
    (u, v, deck) => { const w = PAINT0.alaia(u, v, deck), k = 0.32; const dark = [w[0] * k, w[1] * k, w[2] * k]; if (!deck) return dark;
      const zz = 0.5 + 0.025 * (2 * Math.abs(((v * 3 + 10) % 1) - 0.5) * 2 - 1); if (Math.abs(u - zz) < 0.022) return HALLO_ORANGE; return dark; }],
};
// the bodyboard's paint: a soft foam deck, a band of colour on the hard rails, a slick bottom with the channels (the grooves
// at the tail, deepest there, fading out toward the nose: drawn as shading), and the leash plug near the nose
const bbPaint = (DECK, RAIL, SLICK, CH) => (u, v, deck) => { const av = Math.abs(v);
  if (av > 0.9 || u < 0.016 || u > 0.984) return RAIL;   // (the rail's colour runs right round, over the rounded nose and tail too)
  if (!deck) { const k = 1 - sm(0.12, 0.55, u); for (const c of [0.22, 0.46]) { const dd = Math.abs(av - c); if (dd < 0.035 && k > 0) return mix(SLICK, CH, k * (1 - dd / 0.035)); } return SLICK; }
  { const dd = Math.hypot((u - 0.955) * 1.07 / 0.54, v * 0.5); if (dd < 0.022) return dd < 0.012 ? [0.06, 0.06, 0.07] : [0.55, 0.56, 0.58]; }   // (the leash plug)
  return DECK; };
PAINT.body = [
  bbPaint([0.08, 0.085, 0.095], [0.56, 0.86, 0.18], [0.94, 0.94, 0.92], [0.62, 0.64, 0.66]),   // Classic: black deck, lime rails, white slick (the wave logo on the deck: drawn below)
  bbPaint([0.08, 0.6, 0.64], [0.96, 0.96, 0.94], [0.95, 0.44, 0.34], [0.7, 0.28, 0.2]),         // Reef: turquoise deck, white rails, coral slick
  bbPaint(HALLO_ORANGE, HALLO_BLACK, [0.07, 0.06, 0.08], [0.45, 0.2, 0.05]) ];                 // Halloween: pumpkin deck, black rails and slick
export const DESIGNS = { short: ['Classic', 'Night', 'Halloween'], fish: ['Classic', 'Sunset Spray', 'Halloween'], long: ['Classic', 'Red Tint', 'Halloween'], gun: ['Classic', 'Hi-Vis', 'Halloween'], alaia: ['Classic', 'Painted', 'Halloween'], body: ['Classic', 'Reef', 'Halloween'] };
export const SEASON = 2;   // (which slot is the seasonal one: the board room marks it)
// the paint job as a sharp picture, pixel by pixel (it used to be one colour per mesh point, ~2 cm apart across the
// board, which smeared the logo, stripes and pad into blobs). One sheet per board type, made once and shared
const SHEETS = {};
function* sheetJob(type, S, design, key) {   // (a slice at a time: see bakeDesigns)
  const FW = 256, H = 1024, cv = document.createElement('canvas'); cv.width = FW * 2; cv.height = H; const c = cv.getContext('2d'), img = c.createImageData(FW * 2, H), d = img.data;
  const P = PAINT[type] || PAINT0[type] || PAINT.short, paint = Array.isArray(P) ? (P[design] || P[0]) : P, srgb = (x) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, x)), 1 / 2.2));
  for (let y = 0; y < H; y++) { const u = 1 - y / (H - 1);
    for (let x = 0; x < FW * 2; x++) { const deck = x < FW, v = ((x % FW) + 0.5) / FW * 2 - 1;
      let pc = paint(u, v, deck);
      // tail pad: dark traction pad over the fins, crisp grooves across it, a raised kick at the very back
      if (S.pad && deck && u > 0.05 && u < 0.3 && Math.abs(v) < 0.86) { const gr = (u * 140) % 1 < 0.28 ? 0.62 : 1, kick = u < 0.08 ? 1.25 : 1, edge = Math.abs(v) > 0.8 || u > 0.29 ? 1.35 : 1; pc = [0.1 * gr * kick * edge, 0.1 * gr * kick * edge, 0.11 * gr * kick * edge]; }
      const wax = 0.97 + 0.03 * Math.sin(x * 0.9 + y * 1.3) * Math.sin(x * 0.53 - y * 0.71);   // waxed deck: faintly mottled
      const i = (y * FW * 2 + x) * 4; d[i] = srgb(pc[0] * wax); d[i + 1] = srgb(pc[1] * wax); d[i + 2] = srgb(pc[2] * wax); d[i + 3] = 255; }
    if ((y & 3) === 3) yield; }
  c.putImageData(img, 0, 0);
  const hallo = design === 2;   // (Halloween's pictures: drawn with the canvas for smooth edges, like the logo)
  if (hallo && type === 'fish') {   // a spiderweb from the nose: spokes and sagging rings
    c.strokeStyle = '#111014'; c.lineWidth = 2.2; const ox = FW / 2, oy = 0.04 * H;
    const R = 0.64 * H;   // (stops above the grip pad)
    for (let k = -5; k <= 5; k++) { const an = Math.PI / 2 + k * 0.13; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(an) * R * 0.3, oy + Math.sin(an) * R); c.stroke(); }
    for (let r = 70; r < R; r += 80) { c.beginPath(); for (let k = -5; k <= 5; k++) { const an = Math.PI / 2 + k * 0.13, an2 = an + 0.13; const x1 = ox + Math.cos(an) * r * 0.3, y1 = oy + Math.sin(an) * r, x2 = ox + Math.cos(an2) * r * 0.3, y2 = oy + Math.sin(an2) * r;
      if (k === -5) c.moveTo(x1, y1); if (k < 5) c.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 10, x2, y2); } c.stroke(); } }
  if (hallo && type === 'long') {   // little bats flying up the stringer
    c.fillStyle = '#111014'; for (let k = 0; k < 7; k++) { const x = FW / 2 + (k % 2 ? 46 : -46), y = H * (0.12 + k * 0.105), s2 = 1.75 - k * 0.08;
      c.save(); c.translate(x, y); c.scale(s2 * 1.35, s2 * 2.3); c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(-10, -2, -26, 2); c.quadraticCurveTo(-20, 6, -18, 12); c.quadraticCurveTo(-12, 8, -8, 12); c.quadraticCurveTo(-4, 8, 0, 14);
      c.quadraticCurveTo(4, 8, 8, 12); c.quadraticCurveTo(12, 8, 18, 12); c.quadraticCurveTo(20, 6, 26, 2); c.quadraticCurveTo(10, -2, 0, 6); c.fill(); c.beginPath(); c.arc(0, 4, 4, 0, Math.PI * 2); c.fill(); c.restore(); } }
  if (hallo && type === 'short') {   // a jack-o'-lantern where the logo sits
    const cx = FW / 2, cy = (1 - 0.68) * (H - 1); c.save(); c.translate(cx, cy); c.scale(1.45, 1.45); c.translate(-cx, -cy); c.fillStyle = '#f2700f'; c.beginPath(); c.ellipse(cx, cy, 0.3 * FW / 2, 0.05 * (H - 1), 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3d7a24'; c.fillRect(cx - 4, cy - 0.05 * (H - 1) - 12, 8, 16);
    c.fillStyle = '#1a0f08'; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(cx + sx * 10, cy - 14); c.lineTo(cx + sx * 26, cy - 14); c.lineTo(cx + sx * 18, cy - 30); c.closePath(); c.fill(); }
    c.beginPath(); c.moveTo(cx - 26, cy + 8); for (let k = 0; k <= 8; k++) c.lineTo(cx - 26 + k * 6.5, cy + 8 + (k % 2 ? 9 : 0)); c.lineTo(cx + 26, cy + 22); c.quadraticCurveTo(cx, cy + 34, cx - 26, cy + 22); c.closePath(); c.fill(); c.restore(); }
  if (type === 'short' && !hallo) {   // the shortboard's logo inside its dark oval: the SumbaSurf wave (the game's icon)
    // (a little up toward the nose, so lying on the board to paddle you see all of it ahead of you, not a grey half-disc under your chin;
    // drawn with the canvas so its edge is smooth, not a staircase of pixels)
    const cx = FW / 2, cy = (1 - 0.68) * (H - 1); c.fillStyle = '#1e2126'; c.beginPath(); c.ellipse(cx, cy, 0.357 * FW / 2, 0.0556 * (H - 1), 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(cx, cy); c.scale(0.2, 0.2); c.translate(-261, -265);
    c.fillStyle = '#f2efe8'; c.beginPath(); c.moveTo(70, 390); c.bezierCurveTo(150, 390, 190, 300, 250, 190); c.bezierCurveTo(300, 110, 420, 110, 440, 200); c.bezierCurveTo(450, 250, 420, 300, 370, 300);
    c.bezierCurveTo(400, 260, 390, 210, 350, 205); c.bezierCurveTo(300, 200, 280, 260, 290, 330); c.bezierCurveTo(296, 370, 330, 390, 380, 390); c.closePath(); c.fill();
    c.fillStyle = '#ffc978'; c.fillRect(60, 405, 392, 16); c.restore(); }
  if (type === 'body' && !hallo) {   // the SumbaSurf wave on the bodyboard's deck, across the nose half where you see it lying on it
    const cx = FW / 2, cy = (1 - 0.7) * (H - 1); c.save(); c.translate(cx, cy); c.scale(0.24, 0.49); c.translate(-261, -265);   /* (about 20 x 16 cm: the sheet is stretched 2:1 along this short board) */
    c.fillStyle = design === 0 ? '#f2efe8' : '#0d2f36'; c.beginPath(); c.moveTo(70, 390); c.bezierCurveTo(150, 390, 190, 300, 250, 190); c.bezierCurveTo(300, 110, 420, 110, 440, 200); c.bezierCurveTo(450, 250, 420, 300, 370, 300);
    c.bezierCurveTo(400, 260, 390, 210, 350, 205); c.bezierCurveTo(300, 200, 280, 260, 290, 330); c.bezierCurveTo(296, 370, 330, 390, 380, 390); c.closePath(); c.fill();
    c.fillStyle = design === 0 ? '#8edb2e' : '#f2efe8'; c.fillRect(60, 405, 392, 16); c.restore(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  return (SHEETS[key] = t);
}
// each paint is drawn pixel by pixel once (0.1 to 0.25 s on a fast computer, several times that on a slow phone), then
// shared. Needed and not ready: finished on the spot. bakeDesigns() draws them all ahead, a few milliseconds at a time in
// the background, so a friend turning up on a design you haven't drawn yet never stalls your game (1 Oct 2026)
const JOBS = {};
function paintSheet(type, S, design = 0) {
  const key = type + ':' + design; if (SHEETS[key]) return SHEETS[key];
  const job = JOBS[key] || (JOBS[key] = sheetJob(type, S, design, key)); let r; do r = job.next(); while (!r.done); delete JOBS[key]; return SHEETS[key];
}
let baking = false;
export function bakeDesigns(first = []) {   // (first: [type, design] pairs to do before the rest, e.g. your own boards)
  if (baking) return; baking = true;
  const todo = [...first]; for (const t of Object.keys(DESIGNS)) if (t !== 'body' || globalThis.__bbTest) for (let d = 0; d < DESIGNS[t].length; d++) todo.push([t, d]);   // (the bodyboard's only once it's out: game.js BB_TEST)
  const tick = () => {
    if (document.hidden || (globalThis.__bakeBusy && globalThis.__bakeBusy())) { setTimeout(tick, 250); return; }   // (never while you're riding a wave)
    const t0 = performance.now();
    while (todo.length && performance.now() - t0 < 3) {   // (3 ms of work, then a rest)
      const [t, d] = todo[0], key = t + ':' + d; if (SHEETS[key]) { todo.shift(); continue; }
      const job = JOBS[key] || (JOBS[key] = sheetJob(t, SHEETS_SHAPE(t), d, key)); if (job.next().done) { delete JOBS[key]; todo.shift(); } }
    if (todo.length) setTimeout(tick, 40); };
  setTimeout(tick, 40);
}
const SHEETS_SHAPE = (t) => SHAPES[t] || SHAPES.short;
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

// the board's shape as numbers: half width, thickness and rocker along it (u: tail 0 -> nose 1). Used to build the mesh
// and, for the bodyboard grip (3 Oct 2026), to know where the deck is so the hands rest on it and the fingers wrap it
function shapeFns(S) {
  const L = S.L, W = S.W, T = S.T;
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
  // (a bodyboard is nearly as thick at its ends as in the middle, and its blunt ends are closed by a rounded rail, the deck
  //  curving down to meet the bottom over the last 3 cm: closed by width like a pointed board, its wide nose pinched into
  //  a crease, and its tail was left open, a slot you could see into, 3 Oct 2026)
  const ENDR = 0.028, endK = (u) => { const a = Math.min(u, 1 - u); return a >= ENDR ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(1 - a / ENDR, 2))); };
  const thick = S.flat ? (u) => T * endK(u) * (0.72 + 0.28 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.9 + 0.05))), 0.5))
    : (u) => T * (0.32 + 0.68 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.96 + 0.02))), 0.6));
  const rocker = (u) => S.nose * Math.pow(Math.max(0, u - 0.6) / 0.4, 2.2) + (S.kick ?? 0.03) * Math.pow(Math.max(0, 0.18 - u) / 0.18, 2);   // (kick: the tail's lift; a bodyboard's is small)
  return { halfWidth, thick, rocker };
}
// is a point (board-local metres) inside the board? and the deck's height there (null off the board)
export function boardSurface(type) {
  const S = SHAPES[type] || SHAPES.short, F = shapeFns(S), L = S.L;
  const at = (x, z) => { const u = z / L + 0.5; if (u < 0 || u > 1) return null; const hw = F.halfWidth(u); if (Math.abs(x) >= hw) return null; const v = x / hw, e = Math.max(0, 1 - v * v), th = F.thick(u), r = F.rocker(u);
    return S.flat ? { top: r + th * 0.5 * Math.pow(e, 0.14), bot: r - th * 0.5 * Math.pow(e, 0.07) } : { top: r + th * 0.62 * Math.pow(e, 0.55), bot: r - th * 0.38 * Math.pow(e, 0.3) }; };
  return { at, inside: (x, y, z) => { const a = at(x, z); return !!a && y > a.bot && y < a.top; }, deck: (x, z) => { const a = at(x, z); return a ? a.top : null; } };
}
export function makeBoard(type = 'short', water = false, design = 0) {   // (water: your own board, which meets the water: see BOARD_WATER; design: see DESIGNS)
  const S = SHAPES[type] || SHAPES.short;
  const L = S.L, W = S.W, T = S.T, NL = 90, NW = 24;
  const { halfWidth, thick, rocker } = shapeFns(S);
  // lengthwise stations bunched toward the nose (so its round tip stays smooth); across, bunched toward the rails
  const station = S.flat ? (i) => 0.5 - 0.5 * Math.cos(Math.PI * i / NL)   // (a bodyboard: bunched at both ends, for its rounded closing rails)
    : (i) => { const x = i / NL; return 1 - Math.pow(1 - x, 1.7) * 0.999; };
  const across = (j) => Math.sin((j / NW * 2 - 1) * Math.PI / 2);
  const pos = [], col = [], idx = [];
  // deck (domed) and bottom (flatter), meeting in a rounded rail
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NL; i++) {
      const u = station(i), hw = Math.max(0.0015, halfWidth(u)), z = (u - 0.5) * L, r = rocker(u), th = thick(u);
      for (let j = 0; j <= NW; j++) {
        const v = across(j), x = v * hw, e = Math.max(0, 1 - v * v);
        const notch = type === 'fish' && u < 0.09 ? 0.13 * Math.max(0, 1 - Math.abs(v) / 0.55) * (1 - u / 0.09) : S.crescent && u < 0.07 ? S.crescent * Math.max(0, 1 - Math.pow(Math.abs(v) / 0.82, 2)) * (1 - u / 0.07) : 0;   // the fish's swallow tail; the bodyboard's crescent
        const y = r + (S.flat ? (side > 0 ? th * 0.5 * Math.pow(e, 0.14) : -th * 0.5 * Math.pow(e, 0.07))   /* (a bodyboard: flat deck and bottom, the rails squared off) */
          : (side > 0 ? th * 0.62 * Math.pow(e, 0.55) : -th * 0.38 * Math.pow(e, 0.3)));
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
  const board = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: paintSheet(type, S, design), roughness: type === 'alaia' ? 0.55 : type === 'body' ? 0.6 : 0.2, side: THREE.DoubleSide })   /* (oiled wood is satin, not glassy resin: at 0.2 the alaia mirrored the blue sky and read grey-green on friends, his check 1 Oct 2026) */   /* (a wet glossy deck: the sun catches it) */);
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
