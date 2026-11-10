// All sound is synthesized with Web Audio. No files needed.
//   - distant chatter: formant-filtered "voices" murmuring in syllables, muffled + reverb
//   - room tone, lamp hum, a slow eerie drone
//   - occasional glass clinks and far-off laughter
//   - card / chip / shuffle foley

const VOWELS = [
  [730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720], [490, 1350],
];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.voices = [];
  }

  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    this.noise = this.noiseBuffer(4);

    this.ambience();
    this.chatter();
    this.scheduleRandom(() => this.clink(), 5, 16);
    this.scheduleRandom(() => this.laugh(), 18, 45);
    this.scheduleRandom(() => this.creak(), 25, 60);
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  ambience() {
    const ctx = this.ctx;
    // Room tone: deep rumble.
    const rumble = this.noiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    rumble.connect(lp).connect(g).connect(this.master);
    rumble.start();

    // Lamp hum.
    this.hum = ctx.createGain();
    this.hum.gain.value = 0.012;
    for (const f of [60, 120, 180]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = f === 60 ? 1 : 0.35;
      o.connect(og).connect(this.hum);
      o.start();
    }
    this.hum.connect(this.master);

    // Eerie drone: detuned low tones with a slow swell.
    const drone = ctx.createGain();
    drone.gain.value = 0.0;
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 400;
    for (const f of [55, 55.6, 82.2, 110.9]) {
      const o = ctx.createOscillator();
      o.type = f > 100 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.connect(droneLp);
      o.start();
    }
    droneLp.connect(drone);
    drone.connect(this.master);
    drone.connect(this.reverb);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(drone.gain);
    lfo.start();
    drone.gain.setValueAtTime(0.035, ctx.currentTime);
    this.drone = drone;
  }

  chatter() {
    const ctx = this.ctx;
    // Everything chatter-related goes through a muffling bus so it sounds like the next room.
    this.chatterBus = ctx.createGain();
    this.chatterBus.gain.value = 1;
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 1100;
    const dry = ctx.createGain();
    dry.gain.value = 0.35;
    this.chatterBus.connect(muffle);
    muffle.connect(dry).connect(this.master);
    muffle.connect(this.reverb);
    this.chatterIn = this.chatterBus;

    for (let i = 0; i < 7; i++) this.voices.push(this.makeVoice(i));
    this.chatterTimer = setInterval(() => this.scheduleVoices(), 250);
  }

  makeVoice(i) {
    const ctx = this.ctx;
    const female = Math.random() < 0.4;
    const base = female ? rand(175, 240) : rand(85, 140);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = base;
    const vib = ctx.createOscillator();
    vib.frequency.value = rand(4, 6);
    const vibG = ctx.createGain();
    vibG.gain.value = base * 0.015;
    vib.connect(vibG).connect(osc.frequency);
    vib.start();

    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 9;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 12;
    const env = ctx.createGain();
    env.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.9, 0.9);
    const level = ctx.createGain();
    level.gain.value = rand(0.25, 0.6) * (i < 2 ? 1.2 : 0.8);

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(env);
    f2.connect(env);
    env.connect(level).connect(pan).connect(this.chatterIn);
    osc.start();
    return { osc, f1, f2, env, base, next: ctx.currentTime + rand(0, 3) };
  }

  scheduleVoices() {
    const ctx = this.ctx;
    const horizon = ctx.currentTime + 1.2;
    for (const v of this.voices) {
      while (v.next < horizon) {
        // A phrase of syllables, then a pause.
        const syllables = Math.floor(rand(3, 14));
        let t = Math.max(v.next, ctx.currentTime + 0.05);
        const phrasePitch = v.base * rand(0.92, 1.12);
        for (let s = 0; s < syllables; s++) {
          const dur = rand(0.09, 0.26);
          const [a, b] = pick(VOWELS);
          v.f1.frequency.setTargetAtTime(a * rand(0.9, 1.1), t, 0.02);
          v.f2.frequency.setTargetAtTime(b * rand(0.9, 1.1), t, 0.02);
          const p = phrasePitch * (1 - (s / syllables) * 0.12) * rand(0.97, 1.05);
          v.osc.frequency.setTargetAtTime(p, t, 0.03);
          const amp = rand(0.25, 1);
          v.env.gain.setTargetAtTime(amp, t, 0.015);
          v.env.gain.setTargetAtTime(0.0, t + dur * 0.75, 0.025);
          t += dur + rand(0.0, 0.06);
        }
        v.next = t + rand(0.4, 3.5);
      }
    }
  }

  scheduleRandom(fn, minS, maxS) {
    const loop = () => {
      setTimeout(() => {
        if (this.ctx && this.ctx.state === 'running') fn();
        loop();
      }, rand(minS, maxS) * 1000);
    };
    loop();
  }

  /** Make the room go quiet for a moment. */
  hush(seconds = 2.5, level = 0.08) {
    if (!this.ctx) return;
    const g = this.chatterBus.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(level, t, 0.25);
    g.setTargetAtTime(1, t + seconds, 1.2);
  }

  swell() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(98, t);
    o.frequency.exponentialRampToValueAtTime(61, t + 3);
    const o2 = this.ctx.createOscillator();
    o2.frequency.setValueAtTime(103.5, t);
    o2.frequency.exponentialRampToValueAtTime(58, t + 3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(g);
    o2.connect(g);
    g.connect(this.master);
    g.connect(this.reverb);
    o.start(t);
    o2.start(t);
    o.stop(t + 3.6);
    o2.stop(t + 3.6);
  }

  clink() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-1, 1);
    const out = ctx.createGain();
    out.gain.value = 0.05;
    out.connect(pan).connect(this.chatterIn);
    const hits = Math.random() < 0.5 ? 2 : 1;
    for (let h = 0; h < hits; h++) {
      const tt = t + h * rand(0.05, 0.12);
      for (const f of [rand(2600, 3400), rand(4200, 5200)]) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.8, tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.6);
        o.connect(g).connect(out);
        o.start(tt);
        o.stop(tt + 0.65);
      }
    }
  }

  laugh() {
    const ctx = this.ctx;
    let t = ctx.currentTime;
    const base = rand(140, 260);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 800;
    f.Q.value = 4;
    const env = ctx.createGain();
    env.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-1, 1);
    osc.connect(f).connect(env).connect(pan).connect(this.chatterIn);
    osc.start(t);
    const n = Math.floor(rand(4, 8));
    for (let i = 0; i < n; i++) {
      osc.frequency.setValueAtTime(base * (1.25 - i * 0.04), t);
      env.gain.setTargetAtTime(0.7, t, 0.01);
      env.gain.setTargetAtTime(0, t + 0.08, 0.03);
      t += rand(0.14, 0.2);
    }
    osc.stop(t + 0.3);
  }

  creak() {
    // A chair or floorboard somewhere in the dark.
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(40, 70), t);
    o.frequency.linearRampToValueAtTime(rand(60, 110), t + 0.6);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = rand(500, 900);
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.2);
    g.gain.linearRampToValueAtTime(0, t + 0.7);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-1, 1);
    o.connect(f).connect(g).connect(pan).connect(this.reverb);
    o.start(t);
    o.stop(t + 0.75);
  }

  burst({ dur = 0.06, freq = 3000, q = 1, gain = 0.3, type = 'bandpass', when = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const s = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 3);
    s.stop(t + dur + 0.02);
  }

  cardDeal() {
    this.burst({ dur: 0.09, freq: 2400, q: 0.7, gain: 0.25 });
    this.burst({ dur: 0.05, freq: 300, q: 1, gain: 0.25, type: 'lowpass', when: 0.25 });
  }

  cardFlip() {
    this.burst({ dur: 0.04, freq: 3500, q: 2, gain: 0.25 });
  }

  chips(count = 4) {
    if (!this.ctx) return;
    let w = 0;
    for (let i = 0; i < count; i++) {
      w += rand(0.03, 0.08);
      this.burst({ dur: 0.035, freq: rand(3500, 5500), q: 6, gain: 0.35, when: w });
    }
  }

  shuffle() {
    if (!this.ctx) return;
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 40; i++) {
        this.burst({ dur: 0.02, freq: rand(2500, 4500), q: 1.5, gain: 0.12, when: r * 1.0 + i * 0.018 });
      }
    }
  }

  // ---- the player's song ---------------------------------------------------------------------
  setSong(file) {
    this.songFile = file;
  }

  get songPlaying() {
    return !!(this.songEl && !this.songEl.paused);
  }

  playSong() {
    if (!this.songFile) return;
    this.start();
    if (!this.songEl) {
      this.songEl = new Audio(this.songFile);
      this.songEl.preload = 'auto';
      this.songEl.addEventListener('ended', () => {
        if (this.chatterBus) this.chatterBus.gain.setTargetAtTime(1, this.ctx.currentTime, 1.2);
        this.onSongChange?.(false);
      });
      this.songEl.addEventListener('pause', () => this.onSongChange?.(false));
      this.songEl.addEventListener('play', () => this.onSongChange?.(true));
      if (this.ctx) {
        // route through the mixer so the mute button covers it too
        const src = this.ctx.createMediaElementSource(this.songEl);
        this.songGain = this.ctx.createGain();
        this.songGain.gain.value = 0.9;
        src.connect(this.songGain).connect(this.master);
      }
    }
    this.songEl.currentTime = this.songEl.ended ? 0 : this.songEl.currentTime;
    this.songEl.play().catch(() => this.onSongChange?.(false));
    // the room quiets down under the music
    if (this.chatterBus) this.chatterBus.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.6);
  }

  stopSong() {
    if (!this.songEl) return;
    this.songEl.pause();
    if (this.chatterBus) this.chatterBus.gain.setTargetAtTime(1, this.ctx.currentTime, 1.2);
  }

  toggleSong() {
    if (this.songPlaying) this.stopSong();
    else this.playSong();
    return this.songPlaying;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }
}
