// All sound is made on the fly from filtered noise (no audio files to download):
// the sea, the breaking wave, the board hissing across the face, wind and rain, thunder, splashes, going under.
export class SurfAudio {
  constructor() { this.ok = false; }
  start() {
    if (this.ok) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // play even with the iPhone's silent switch on (it's a game, not a notification)
    const ctx = this.ctx = new AC(); this.ok = true;
    // 4 s of pink-ish noise, looped by every layer
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.03; b1 = 0.96 * b1 + w * 0.3; b2 = 0.6 * b2 + w; d[i] = (b0 * 3 + b1 + b2 * 0.3) * 0.25; }
    this.noise = buf;
    this.master = ctx.createGain(); this.master.gain.value = 0.55;   // (headroom: at 0.9 the limiter squashed everything and it pumped)
    this.under = ctx.createBiquadFilter(); this.under.type = 'lowpass'; this.under.frequency.value = 18000;   // muffles everything underwater
    // a limiter at the end: thunder, the lip and the barrel boom can stack up; phone speakers must never crackle
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -8; lim.knee.value = 8; lim.ratio.value = 8; lim.attack.value = 0.004; lim.release.value = 0.25;
    // cut the rumble under ~40 Hz: nobody hears it (least of all through a phone speaker) but it ate the limiter's headroom
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40; hp.Q.value = 0.7;
    this.master.connect(this.under).connect(hp).connect(lim).connect(ctx.destination); this.lim = lim;
    const layer = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = Math.random() * 3;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(fl).connect(g).connect(this.master); src.start(0, Math.random() * 3);
      return { fl, g };
    };
    this.sea = layer('lowpass', 500, 0.5);        // distant surf, always there
    this.roar = layer('bandpass', 260, 0.7);      // the breaking wave, loud near the curl
    this.tube = layer('lowpass', 180, 2.5);       // hollow boom inside the barrel
    this.hiss = layer('highpass', 1800, 0.6);     // board rail through the water
    this.wind = layer('bandpass', 700, 0.4);      // wind, stronger in the storm
    this.rain = layer('highpass', 4000, 0.3);     // rain on the water
    this.spray = layer('bandpass', 2600, 1.4);    // tail sliding: gritty sheet of spray, not the clean rail hiss
    this.drag = layer('bandpass', 750, 1.8);
    this.falls = layer('bandpass', 1400, 0.45);   // a waterfall down the coast: a soft steady rush (Watu Kanan only)
    this.crowd = layer('bandpass', 1050, 0.9);    // a crowd round the pool: a soft murmur (Sumba Ranch only)      // stalling: your hand and tail dragging in the face (a gurgle)
    // inside the barrel everything rings: a short echo off the curtain, fed from the whole mix
    const dl = ctx.createDelay(0.5); dl.delayTime.value = 0.085;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2200;
    this.echo = ctx.createGain(); this.echo.gain.value = 0;
    this.master.connect(dl); dl.connect(ef).connect(fb).connect(dl); ef.connect(this.echo).connect(this.under);
    this.slapT = 0;
  }
  set(p, v, t = 0.12) { if (this.ok) p.setTargetAtTime(v, this.ctx.currentTime, t); }
  // one-off burst of filtered noise: splashes, paddle strokes, thunder
  burst(gain, freq, dur, type = 'bandpass', delay = 0) {
    if (!this.ok || this.ctx.state !== 'running') return;   // (a paused context never finishes a sound: they'd pile up)
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = type === 'lowpass' ? 0.5 : 1;   // looped so long sounds never run off the end
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.04, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl).connect(g).connect(this.master); src.start(t0, Math.random() * 3); src.stop(t0 + dur + 0.05);
    src.onended = () => { src.disconnect(); fl.disconnect(); g.disconnect(); };   // (free each one-off sound when it's finished)
  }
  // called every frame with what's going on
  update(o) {
    if (!this.ok) return;
    const sm = o.seaMul ?? 1;   // (the villa: the sea softer from up the cliff, and softer still through the walls)
    this.set(this.sea.g.gain, (0.22 + 0.1 * o.H) * sm);
    this.set(this.roar.g.gain, Math.min(0.9, (0.08 + 0.55 * o.near) * (0.6 + 0.2 * o.H)) * sm);
    this.set(this.roar.fl.frequency, 200 + 160 * o.near);
    this.set(this.tube.g.gain, o.barrel ? 0.9 : 0, 0.25);
    const lean = Math.abs(o.lean || 0), slide = Math.min(1, o.slide || 0), sp = Math.min(1, o.v / 10);
    // the rail: steady hiss with speed, brighter and louder as you lay it over
    this.set(this.hiss.g.gain, o.riding ? Math.min(0.45, 0.015 * o.v + 0.12 * lean * sp) : 0, 0.06);
    this.set(this.hiss.fl.frequency, 1200 + 90 * o.v + 900 * lean);
    // the tail letting go: a rougher spray noise comes in on top
    this.set(this.spray.g.gain, o.riding ? Math.min(0.5, 0.55 * slide * (0.4 + sp)) : 0, 0.05);
    this.set(this.spray.fl.frequency, 1900 + 1400 * slide);
    this.set(this.drag.g.gain, o.riding && o.stall ? 0.22 * Math.min(1, o.v / 4) : 0, 0.08);
    this.set(this.echo.gain, o.barrel ? 0.55 : 0, 0.2);
    // chop slapping the bottom of the board: little low taps, more often the faster you go and the rougher the sea
    if (o.riding && o.dt) {
      this.slapT -= o.dt * (0.6 + 2.4 * sp) * (0.6 + 0.4 * (o.chop || 1));
      if (this.slapT <= 0) { this.slapT = 0.6 + Math.random() * 0.8; if (o.v > 3) this.burst(0.05 + 0.07 * sp, 160 + Math.random() * 80, 0.1, 'lowpass'); }
    }
    this.set(this.wind.g.gain, 0.04 + 0.2 * o.storm + 0.012 * o.v);   // the faster you go, the louder the wind past your ears
    this.set(this.wind.fl.frequency, 600 + 40 * o.v);
    this.set(this.rain.g.gain, 0.25 * o.rain);
    this.set(this.under.frequency, o.underwater ? 420 : 18000, o.underwater ? 0.05 : 0.3);
  }
  // the lip landing: a deep thump with a hiss of spray after it; bigger waves, deeper and louder
  crash(H, dist) {
    const k = Math.max(0, 1 - dist / 45);
    if (k <= 0) return;
    this.burst(0.55 * k * Math.min(1.3, H / 2), 70 + 30 / H, 0.9 + 0.25 * H, 'lowpass');
    this.burst(0.25 * k * Math.min(1.3, H / 2), 380, 0.5 + 0.15 * H);   // (the same thump's mid body: a phone speaker can't play the deep part)
    this.burst(0.22 * k, 1600, 0.7 + 0.2 * H, 'bandpass', 0.05);
  }
  pump() { this.burst(0.12, 500, 0.35, 'lowpass'); this.burst(0.07, 1800, 0.3); }   // weighting the board: a push of water off the rails
  paddle() { this.burst(0.18, 900 + Math.random() * 400, 0.25); }
  splash(size = 1) { this.burst(0.5 * size, 700, 0.9 * size); this.burst(0.35 * size, 2500, 0.5 * size, 'highpass'); }
  thunder(dist = 1) { this.burst(0.9, 90, 3.5, 'lowpass', 0.4 + dist * 1.5); this.burst(0.4, 260, 1.2, 'lowpass', 0.35 + dist * 1.5); }
  // an air: the rush of wind as you leave the lip, rising; the landing: a hard slap and a burst of spray
  air() { this.burst(0.2, 900, 0.7); this.burst(0.12, 2200, 0.5, 'highpass', 0.1); }
  land(k = 1) { this.burst(0.4 * k, 500, 0.35, 'lowpass'); this.burst(0.3 * k, 1600, 0.5); this.burst(0.2 * k, 3500, 0.4, 'highpass', 0.05); }
  // the Sumba Ranch machine: a deep whoosh as the chambers fire, with a metallic clank
  // a gull over the beach: a falling 'kee-ow', sometimes twice
  gull(k = 1) { const n = Math.random() < 0.4 ? 2 : 1; for (let i = 0; i < n; i++) { const f = 1700 + Math.random() * 500; this.tone(f, 0.03 * k, 0.34, { type: 'sawtooth', delay: i * 0.42, to: f * 0.62, band: 1600 }); } }
  // a warm gust over the dry grass (Tanjung Uma): a soft swell of wind rising and dying away over a few seconds
  breeze(k = 1) {
    if (!this.ok || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t0 = ctx.currentTime, dur = 4 + k * 2, src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 0.6; fl.frequency.setValueAtTime(450, t0); fl.frequency.linearRampToValueAtTime(800, t0 + dur * 0.45); fl.frequency.linearRampToValueAtTime(500, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.07 * k, t0 + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl).connect(g).connect(this.master); src.start(t0, 1.3 * k); src.stop(t0 + dur + 0.05);
    src.onended = () => { src.disconnect(); fl.disconnect(); g.disconnect(); };
  }
  // a wave slamming into the cliffs somewhere down the coast (Batu Hitam): a deep boom and the hiss of the water falling back
  boom(k = 1) { this.burst(0.34 * k, 85, 2.6, 'lowpass', 0); this.burst(0.16 * k, 260, 1.4, 'lowpass', 0.05); this.burst(0.07 * k, 1500, 2.2, 'bandpass', 0.35); }
  fallsLevel(k) { if (this.ok && this._fk !== k) { this._fk = k; this.set(this.falls.g.gain, 0.03 * k, 1.5); } }
  // the night (Pantai Bintang): a cricket's chirp from the trees behind the beach, now and then a frog
  cricket(k = 1) { const f = 4200 + Math.random() * 600, n = 3 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) this.tone(f, 0.012 * k, 0.05, { delay: i * 0.075 });
    if (Math.random() < 0.18) { const g = 380 + Math.random() * 120; for (let i = 0; i < 2; i++) this.tone(g, 0.02 * k, 0.12, { type: 'square', delay: 0.5 + i * 0.16, to: g * 0.8, band: 700 }); } }
  crowdLevel(k) { if (this.ok) this.set(this.crowd.g.gain, 0.05 * k, 0.8); }
  // the crowd round the pool going up for a barrel or a big move: a swell of voices (noise shaped like a roar, and a
  // few rising whoops on top)
  cheer(k = 1) {
    this.burst(0.28 * k, 1150, 2.2); this.burst(0.18 * k, 2300, 1.8, 'bandpass', 0.08); this.burst(0.12 * k, 600, 2.0, 'bandpass', 0.05);
    for (let i = 0; i < 5; i++) { const f = 330 + Math.random() * 260; this.tone(f, 0.022 * k, 0.5 + Math.random() * 0.4, { type: 'sawtooth', delay: 0.1 + Math.random() * 0.8, to: f * (1.25 + Math.random() * 0.2), band: 900 + Math.random() * 700 }); }
  }
  machine() { this.burst(0.5, 160, 2.2, 'lowpass'); this.burst(0.3, 420, 1.8); this.burst(0.12, 2600, 0.25, 'bandpass', 0.05); }
  // iOS only lets sound restart from a tap: call this from touch handlers
  // a one-off tone: chimes, birdsong, distant hoots (a glide from f to 'to', optionally through a band filter)
  tone(f, gain, dur, { type = 'sine', delay = 0, to = f, band = 0 } = {}) {
    if (!this.ok || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to !== f) o.frequency.exponentialRampToValueAtTime(to, t0 + dur * 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let fl = null; if (band) { fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = band; fl.Q.value = 2; o.connect(fl).connect(g); } else o.connect(g);
    g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
    o.onended = () => { o.disconnect(); if (fl) fl.disconnect(); g.disconnect(); };
  }
  crackle(k) { for (let i = 0; i < 1 + (Math.random() * 3 | 0); i++) this.burst(0.09 * k * (0.4 + Math.random()), 2200 + Math.random() * 4000, 0.02 + Math.random() * 0.05, 'highpass', Math.random() * 0.15);
    if (Math.random() < 0.3) this.burst(0.12 * k, 300, 0.4, 'lowpass'); }   // (snaps, and the low breathing of the fire)
  chime(k) { const P = [523, 587, 659, 784, 880, 1047], f = P[Math.random() * P.length | 0]; this.tone(f, 0.06 * k, 2.8); this.tone(f * 2.76, 0.018 * k, 1.1); }   // bamboo/metal chime: fundamental and its bell overtone
  bird(k) { const f = 2400 + Math.random() * 1400, n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) this.tone(f, 0.035 * k, 0.11, { delay: i * 0.16, to: f * (1.25 + Math.random() * 0.2) }); }
  hoot(k) { for (let i = 0; i < 3; i++) { const f = 230 + Math.random() * 120; this.tone(f, 0.05 * k, 0.55 + Math.random() * 0.3, { type: 'sawtooth', delay: i * 0.25 + Math.random() * 0.2, to: f * 1.4, band: 900 }); } }   // someone in the lineup hooting a barrel
  // music: a shuffled playlist of reggae tracks, streamed one at a time through its own level and tone (a lowpass
  // makes it sound like it's coming from the radio in the next room). It keeps going under everything else.
  // your camera drone: four little props humming, the pitch rising as it works harder (made once, then just turned up and down)
  // the tow ski (1 Oct 2026, the monster wave): a big four-stroke engine burbling at speed, rough and low, the pitch rising with
  // the throttle (made once, then turned up and down like the drone below)
  jetski(k, rev = 0.7) {
    if (!this.ok) return;
    if (!this.js) { const ctx = this.ctx, g = ctx.createGain(); g.gain.value = 0; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700; fl.Q.value = 1.2;
      const os = [62, 64.5, 124].map((f, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'square' : 'sawtooth'; o.frequency.value = f; o.connect(fl); o.start(); return o; });
      const trem = ctx.createGain(); trem.gain.value = 0.75; const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 0.25; lfo.connect(lg).connect(trem.gain); lfo.start();   // (the burble: the level wobbles ~9 times a second, between half and full; silent when g is down)
      fl.connect(trem).connect(g).connect(this.master); this.js = { g, os, fl }; }
    this.set(this.js.g.gain, k * 0.09, 0.3); const f = 52 + rev * 34; this.js.os.forEach((o, i) => this.set(o.frequency, f * [1, 1.04, 2][i], 0.35)); this.set(this.js.fl.frequency, 450 + rev * 650, 0.35);
  }
  droneBuzz(k, work = 0) {
    if (!this.ok) return;
    if (!this.dr) { const ctx = this.ctx, g = ctx.createGain(); g.gain.value = 0; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 900; fl.Q.value = 0.8;
      const os = [185, 192, 371].map((f, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'square' : 'sawtooth'; o.frequency.value = f; o.connect(fl); o.start(); return o; });
      fl.connect(g).connect(this.master); this.dr = { g, os }; }
    this.set(this.dr.g.gain, k * 0.045, 0.25); const f = 185 + work * 70; this.dr.os.forEach((o, i) => this.set(o.frequency, f * [1, 1.037, 2][i], 0.3));
  }
  musicStart(tracks) {
    if (!this.ok || this.mel) return; this.tracks = tracks; this.order = [];
    const el = this.mel = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', '');
    this.mLP = this.ctx.createBiquadFilter(); this.mLP.type = 'lowpass'; this.mLP.frequency.value = 20000; this.mLP.Q.value = 0.5;
    this.mGain = this.ctx.createGain(); this.mGain.gain.value = 0;
    this.ctx.createMediaElementSource(el).connect(this.mLP).connect(this.mGain).connect(this.lim);
    this.mAn = this.ctx.createAnalyser(); this.mAn.fftSize = 256; this.mAn.smoothingTimeConstant = 0.5; this.mLP.connect(this.mAn); this.mBins = new Uint8Array(this.mAn.frequencyBinCount);   // (listens for the bass, for the speaker cones)
    el.addEventListener('ended', () => this.musicNext()); el.addEventListener('error', () => setTimeout(() => this.musicNext(true), 1000));   // (a song that won't load isn't kept in the back history)
    this.musicNext(); this.musicKick();
  }
  musicNext(bad = false) {
    if (!this.mel) return;
    if (!this.order.length) { const o = this.tracks.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [o[i], o[j]] = [o[j], o[i]]; }
      if (o[0] === this.now && o.length > 1) o.push(o.shift()); this.order = o; }   // (never the same song twice in a row)
    if (this.now && !bad) (this.hist ||= []).push(this.now); if (this.hist && this.hist.length > 20) this.hist.shift();
    this.now = this.order.shift(); this.mel.src = this.now; if (this.mWant > 0) this.mel.play().catch(() => {}); if (this.onTrack) this.onTrack(this.now);
  }
  // one song, from a point in it (the drone show: game.js); the radio carries on after it as usual
  musicPlay(src, at = 0) {
    if (!this.mel) return; if (this.now && this.now !== src) (this.hist ||= []).push(this.now);
    this.now = src; this.mel.src = src; const go = () => { try { this.mel.currentTime = at; } catch (e) {} if (this.mWant > 0) this.mel.play().catch(() => {}); };
    if (this.mel.readyState >= 1) go(); else this.mel.addEventListener('loadedmetadata', go, { once: true }); if (this.onTrack) this.onTrack(this.now);
  }
  // back: a few seconds into a song it starts it again; right at the start it goes to the one before (like any player)
  musicPrev() {
    if (!this.mel) return;
    if (this.mel.currentTime > 4 || !this.hist || !this.hist.length) { this.mel.currentTime = 0; this.musicKick(); return; }
    this.order.unshift(this.now); this.now = this.hist.pop(); this.mel.src = this.now; if (this.mWant > 0) this.mel.play().catch(() => {}); if (this.onTrack) this.onTrack(this.now);
  }
  // how loud the music should be now, and how far off it sounds (lowpass Hz); silent for a while and it pauses (saves battery)
  musicLevel(v, lp = 20000) {
    if (!this.mel) return; this.mWant = v;
    this.set(this.mGain.gain, v, 0.7); this.set(this.mLP.frequency, lp, 0.4);
    if (v > 0.001) { clearTimeout(this.mStop); this.mStop = 0; if (this.mel.paused && this.ctx.state === 'running') this.mel.play().catch(() => {}); }
    else if (!this.mel.paused && !this.mStop) this.mStop = setTimeout(() => { this.mStop = 0; if (!(this.mWant > 0.001)) this.mel.pause(); }, 3000);
  }
  musicKick() { if (this.mel && this.mel.paused) this.mel.play().catch(() => {}); }   // (called inside a tap: on an iPhone the first play has to be)
  // how hard the bass is hitting right now, 0..1 (the kick and the bass line)
  musicBeat() { if (!this.mAn || this.mel.paused) return 0; this.mAn.getByteFrequencyData(this.mBins); let e = 0; for (let i = 1; i < 6; i++) e += this.mBins[i]; e /= 5 * 255; this.mB = Math.max(e, (this.mB || 0) * 0.9); return Math.max(0, (e - this.mB * 0.7) * 3.3); }
  quiet(on) { this.qOn = on; if (this.ok) this.set(this.master.gain, on ? 0 : 0.55 * (this.gK ?? 1), 0.3); }
  gameLevel(k) { if (!this.ok || this.gK === k) return; this.gK = k; if (!this.qOn) this.set(this.master.gain, 0.55 * k, 0.6); }   // (the game's own sounds turned down, for the earpiece)   // the game's own sounds off (in the menu), the music carries on
  // back from another app or tab: the phone often refuses to restart sound until the next touch, so every touch also
  // restarts the song if it should be playing (it used to stay silent after coming back)
  wake() { if (!this.ok) return; if (this.ctx.state !== 'running') this.ctx.resume(); if (this.mel && this.mel.paused && this.mWant > 0.001 && !document.hidden) this.mel.play().catch(() => {}); }
  pause(on) { if (!this.ok) return; if (on) { this.ctx.suspend(); if (this.mel) this.mel.pause(); return; }
    this.ctx.resume().catch(() => {}).then(() => this.wake()); }
}
