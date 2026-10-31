// Fully procedural WebAudio sound engine — no external assets.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.enabled = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 5;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(comp);

    // shared white-noise buffer (2s)
    const len = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.enabled = true;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  now() { return this.ctx.currentTime; }

  _noise(dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, at = 0, fadeOut = 0.1, pan = 0, playbackRate = 1 } = {}) {
    if (!this.enabled) return null;
    const t0 = this.now() + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = playbackRate;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) p.pan.value = pan;
    src.connect(f); f.connect(g);
    if (p) { g.connect(p); p.connect(this.master); } else g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
    return { src, f, g, t0 };
  }

  _tone(dur, { type = 'sine', f0 = 440, f1 = null, gain = 0.3, at = 0, pan = 0 } = {}) {
    if (!this.enabled) return null;
    const t0 = this.now() + at;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) p.pan.value = pan;
    o.connect(g);
    if (p) { g.connect(p); p.connect(this.master); } else g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }

  /** Electric plasma burst — player rifle. */
  plasma(pan = 0) {
    const pitch = 0.92 + Math.random() * 0.16;
    this._tone(0.14, { type: 'sawtooth', f0: 950 * pitch, f1: 180 * pitch, gain: 0.22, pan });
    this._tone(0.09, { type: 'sine', f0: 2200 * pitch, f1: 500 * pitch, gain: 0.12, pan });
    this._noise(0.1, { type: 'highpass', freq: 3000, gain: 0.14, pan });
  }

  /** Zapping enemy laser. */
  laser(pan = 0, vol = 1) {
    const pitch = 0.9 + Math.random() * 0.2;
    this._tone(0.11, { type: 'square', f0: 1500 * pitch, f1: 260 * pitch, gain: 0.09 * vol, pan });
    this._noise(0.07, { type: 'bandpass', freq: 2600, q: 4, gain: 0.07 * vol, pan });
  }

  /** Continuous jetpack whoosh — call startJet/stopJet, returns handle. */
  startJet(color = 'teal') {
    if (!this.enabled) return { stop() {} };
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = color === 'teal' ? 620 : 480; f.Q.value = 0.8;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 11;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 240;
    lfo.connect(lfoG); lfoG.connect(f.frequency); lfo.start();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.now());
    g.gain.exponentialRampToValueAtTime(0.34, this.now() + 0.08);
    const sub = this.ctx.createOscillator();
    sub.type = 'sawtooth'; sub.frequency.value = 55;
    const subG = this.ctx.createGain();
    subG.gain.value = 0.06;
    sub.connect(subG); subG.connect(g); sub.start();
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    return {
      stop: () => {
        const t = this.now();
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        setTimeout(() => { try { src.stop(); sub.stop(); lfo.stop(); } catch (e) {} }, 300);
      }
    };
  }

  /** Single footstep on metal grating or glass. */
  footstep(glass = false, vol = 1) {
    if (glass) {
      this._noise(0.06, { type: 'highpass', freq: 3400, gain: 0.16 * vol });
      this._tone(0.05, { type: 'sine', f0: 1900, f1: 1200, gain: 0.05 * vol });
    } else {
      this._noise(0.07, { type: 'bandpass', freq: 500, q: 1.6, gain: 0.2 * vol });
      this._tone(0.045, { type: 'sine', f0: 130, f1: 70, gain: 0.12 * vol });
    }
  }

  /** Sizzling impact of energy on metal. */
  impactSizzle(pan = 0, vol = 1) {
    this._noise(0.22, { type: 'highpass', freq: 4200, gain: 0.12 * vol, pan });
    this._tone(0.15, { type: 'sine', f0: 3000, f1: 900, gain: 0.04 * vol, pan });
  }

  /** Deep explosion boom. */
  explosion(vol = 1) {
    this._tone(0.9, { type: 'sine', f0: 150, f1: 28, gain: 0.8 * vol });
    this._tone(0.5, { type: 'triangle', f0: 90, f1: 30, gain: 0.5 * vol });
    this._noise(1.1, { type: 'lowpass', freq: 900, gain: 0.65 * vol });
    this._noise(0.4, { type: 'bandpass', freq: 2200, q: 0.7, gain: 0.25 * vol });
  }

  /** Grenade beep tick. */
  beep(at = 0) {
    this._tone(0.07, { type: 'sine', f0: 1250, gain: 0.16 });
    this._tone(0.05, { type: 'sine', f0: 2500, gain: 0.05, at });
  }

  /** Steam hiss — energy cell swap / venting. */
  steam(vol = 1) {
    const h = this._noise(0.7, { type: 'highpass', freq: 1400, gain: 0.22 * vol, playbackRate: 1.4 });
    if (h) h.g.gain.setValueAtTime(0.22 * vol, this.now());
    if (h) h.g.gain.exponentialRampToValueAtTime(0.0001, this.now() + 0.75);
  }

  /** Low canyon wind bed — start once. */
  startWind() {
    if (!this.enabled || this.windStarted) return;
    this.windStarted = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.075;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.035;
    lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  /** Jetpack fuel sputter warning. */
  sputter() {
    for (let i = 0; i < 4; i++) {
      this._tone(0.05, { type: 'sawtooth', f0: 180 - i * 25, f1: 90, gain: 0.12, at: i * 0.07 });
    }
  }

  /** Glass crack tick. */
  glassCrack() {
    this._noise(0.12, { type: 'highpass', freq: 5000, gain: 0.2 });
    this._tone(0.2, { type: 'sine', f0: 2600, f1: 1800, gain: 0.08 });
  }

  /** Glass shatter cascade. */
  glassShatter() {
    this._noise(0.5, { type: 'highpass', freq: 4000, gain: 0.3 });
    for (let i = 0; i < 10; i++) {
      this._tone(0.06, { type: 'sine', f0: 1800 + Math.random() * 2600, f1: 900, gain: 0.06, at: i * 0.045 });
    }
  }

  /** Body thud (ragdoll landing). */
  bodyFall(vol = 1) {
    this._tone(0.14, { type: 'sine', f0: 110, f1: 45, gain: 0.3 * vol });
    this._noise(0.1, { type: 'bandpass', freq: 350, q: 1, gain: 0.2 * vol });
  }

  /** Ricochet chirp. */
  ricochet(pan = 0) {
    this._tone(0.16, { type: 'sine', f0: 2400 + Math.random() * 800, f1: 400, gain: 0.06, pan });
  }

  /** Subtle kill confirm tick. */
  killTick() {
    this._tone(0.05, { type: 'sine', f0: 1700, f1: 1300, gain: 0.1 });
  }

  /** Round-win sting — short synth arpeggio. */
  winSting() {
    const notes = [440, 554.4, 659.3, 880];
    notes.forEach((f, i) => {
      this._tone(0.5, { type: 'sawtooth', f0: f, gain: 0.1, at: i * 0.11 });
      this._tone(0.5, { type: 'sine', f0: f * 2, gain: 0.05, at: i * 0.11 });
    });
    this._tone(1.2, { type: 'sine', f0: 220, gain: 0.08, at: 0.44 });
  }

  /** Round-lost sting. */
  loseSting() {
    const notes = [330, 262, 196];
    notes.forEach((f, i) => {
      this._tone(0.6, { type: 'sawtooth', f0: f, gain: 0.09, at: i * 0.16 });
    });
  }

  /** Grenade throw whoosh. */
  throwWhoosh() {
    this._noise(0.18, { type: 'bandpass', freq: 900, q: 1.2, gain: 0.12 });
  }
}
