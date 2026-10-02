import { GENRES } from "./data";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let loungeBus: GainNode | null = null;
let duckGain: GainNode | null = null;
let delaySend: GainNode | null = null;
let delayNode: DelayNode | null = null;
let analyser: AnalyserNode | null = null;
let mixSourceBus: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;
let vinylBuf: AudioBuffer | null = null;
let loungeTimer: number | null = null;
let loungeOn = false;
let vinylSrc: AudioBufferSourceNode | null = null;
let vinylGain: GainNode | null = null;
const VISIBLE_LOOKAHEAD = 1.4;
const HIDDEN_LOOKAHEAD = 3.5;

export function getCtx(): AudioContext | null {
  return ctx;
}

function makeNoise(seconds: number, flavor: "white" | "vinyl"): AudioBuffer {
  const ac = ctx!;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  if (flavor === "white") {
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } else {
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.98 + white * 0.02;
      let click = 0;
      if (Math.random() < 0.0012) click = (Math.random() * 2 - 1) * 0.5;
      d[i] = last * 0.72 + white * 0.06 + click;
    }
  }
  return buf;
}

function graph(): void {
  if (!ctx || delayNode) return;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 128 - 1;
    curve[i] = Math.tanh(x * 1.35);
  }
  shaper.curve = curve;
  shaper.oversample = "2x";

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 3.6;
  comp.attack.value = 0.006;
  comp.release.value = 0.16;

  delayNode = ctx.createDelay(1.4);
  delayNode.delayTime.value = 0.28;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 2600;
  delaySend = ctx.createGain();
  delaySend.gain.value = 0.2;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.34;
  delaySend.connect(delayFilter);
  delayFilter.connect(delayNode);
  delayNode.connect(fb);
  fb.connect(delayFilter);
  delayNode.connect(delayOut);
  delayOut.connect(musicBus!);

  duckGain = ctx.createGain();
  duckGain.gain.value = 1;
  duckGain.connect(musicBus!);
  duckGain.connect(delaySend);
  mixSourceBus = ctx.createGain();
  mixSourceBus.connect(duckGain);

  musicBus!.disconnect();
  musicBus!.connect(shaper);
  shaper.connect(comp);
  loungeBus!.connect(comp);
  sfxBus!.connect(master!);
  comp.connect(analyser!);
  analyser!.connect(master!);
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    loungeBus = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.72;
    musicBus.gain.value = 0.82;
    sfxBus.gain.value = 0.88;
    loungeBus.gain.value = 0.0;
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    noiseBuf = makeNoise(1.5, "white");
    vinylBuf = makeNoise(4, "vinyl");
    graph();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function setMuted(next: boolean) {
  muted = next;
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.03);
}

export function isMuted() {
  return muted;
}

function destSfx(): AudioNode | null {
  return sfxBus;
}
function destMusic(): AudioNode | null {
  return mixSourceBus;
}

function resetMixSourceBus() {
  if (!ctx || !duckGain) return;
  if (mixSourceBus) mixSourceBus.disconnect();
  mixSourceBus = ctx.createGain();
  mixSourceBus.connect(duckGain);
}

function envGain(t: number, a: number, d: number, peak = 0.4): GainNode | null {
  if (!ctx) return null;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return g;
}

function panTo(dest: AudioNode, pan: number): AudioNode {
  if (!ctx) return dest;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(dest);
  return p;
}

function noiseHit(
  t: number,
  dest: AudioNode,
  dur: number,
  peak: number,
  type: BiquadFilterType,
  freq: number,
  q = 1,
) {
  if (!ctx || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export function sfxClick() {
  if (!ctx || !destSfx()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = envGain(t, 0.004, 0.05, 0.1);
  if (!g) return;
  o.type = "square";
  o.frequency.value = 980;
  o.connect(g);
  g.connect(destSfx()!);
  o.start(t);
  o.stop(t + 0.06);
}

export function sfxCoin() {
  if (!ctx || !destSfx()) return;
  const ac = ctx;
  const t = ac.currentTime;
  [988, 1480].forEach((f, i) => {
    const o = ac.createOscillator();
    const g = envGain(t + i * 0.055, 0.004, 0.11, 0.16);
    if (!g) return;
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(g);
    g.connect(destSfx()!);
    o.start(t + i * 0.055);
    o.stop(t + i * 0.055 + 0.14);
  });
}

export function sfxFizz() {
  if (!ctx || !destSfx()) return;
  const t = ctx.currentTime;
  noiseHit(t, destSfx()!, 0.32, 0.18, "highpass", 1400, 0.7);
}

export function sfxPop() {
  if (!ctx || !destSfx()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = envGain(t, 0.004, 0.14, 0.2);
  if (!g) return;
  o.type = "sine";
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
  o.connect(g);
  g.connect(destSfx()!);
  o.start(t);
  o.stop(t + 0.16);
}

export function sfxWin() {
  if (!ctx || !destSfx()) return;
  const ac = ctx;
  const t = ac.currentTime;
  [0, 4, 7, 12].forEach((n, i) => {
    const o = ac.createOscillator();
    const g = envGain(t + i * 0.08, 0.01, 0.22, 0.14);
    if (!g) return;
    o.type = "triangle";
    o.frequency.value = 523.25 * Math.pow(2, n / 12);
    o.connect(g);
    g.connect(destSfx()!);
    o.start(t + i * 0.08);
    o.stop(t + i * 0.08 + 0.26);
  });
}

export function sfxLose() {
  if (!ctx || !destSfx()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = envGain(t, 0.01, 0.28, 0.14);
  if (!g) return;
  o.type = "sawtooth";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.28);
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 600;
  o.connect(f);
  f.connect(g);
  g.connect(destSfx()!);
  o.start(t);
  o.stop(t + 0.32);
}

export function sfxThumbs() {
  if (!ctx || !destSfx()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = envGain(t, 0.01, 0.18, 0.18);
  if (!g) return;
  o.type = "triangle";
  o.frequency.setValueAtTime(523, t);
  o.frequency.exponentialRampToValueAtTime(784, t + 0.12);
  o.connect(g);
  g.connect(destSfx()!);
  o.start(t);
  o.stop(t + 0.22);
}

function duck(t: number, amount = 0.42, recover = 0.2) {
  if (!duckGain) return;
  duckGain.gain.cancelScheduledValues(t);
  duckGain.gain.setValueAtTime(Math.max(amount, duckGain.gain.value * 0.85), t);
  duckGain.gain.linearRampToValueAtTime(amount, t + 0.028);
  duckGain.gain.exponentialRampToValueAtTime(1, t + recover);
}

function kick(t: number, dest: AudioNode, vel = 1) {
  if (!ctx) return;
  // Sub body — sits under bass without fighting midrange leads.
  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(168, t);
  body.frequency.exponentialRampToValueAtTime(42, t + 0.09);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t);
  bg.gain.exponentialRampToValueAtTime(1.18 * vel, t + 0.005);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  body.connect(bg);
  bg.connect(dest);
  body.start(t);
  body.stop(t + 0.4);

  // Mid thump for speaker punch / spectrum meters.
  const thump = ctx.createOscillator();
  thump.type = "triangle";
  thump.frequency.setValueAtTime(98, t);
  thump.frequency.exponentialRampToValueAtTime(55, t + 0.05);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.004);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  thump.connect(tg);
  tg.connect(dest);
  thump.start(t);
  thump.stop(t + 0.14);

  const click = ctx.createOscillator();
  click.type = "square";
  click.frequency.value = 64;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.26 * vel, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.014);
  click.connect(cg);
  cg.connect(dest);
  click.start(t);
  click.stop(t + 0.028);

  noiseHit(t, dest, 0.03, 0.12 * vel, "highpass", 2400, 0.55);
  duck(t, 0.28, 0.28);
}

function eightOhEight(t: number, dest: AudioNode, freq: number, dur: number, vel: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(Math.max(40, freq * 2.4), t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.58 * vel, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 280;
  o.connect(lp);
  lp.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function snare(t: number, dest: AudioNode, vel = 1, clap = false) {
  if (!ctx) return;
  if (clap) {
    [0, 0.011, 0.024, 0.04].forEach((off, i) => {
      noiseHit(t + off, dest, 0.1, (0.3 - i * 0.05) * vel, "bandpass", 1900 + i * 200, 0.85);
    });
    return;
  }
  noiseHit(t, dest, 0.18, 0.4 * vel, "bandpass", 2050, 1.15);
  noiseHit(t, dest, 0.09, 0.14 * vel, "highpass", 5400, 0.55);
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(210, t);
  o.frequency.exponentialRampToValueAtTime(145, t + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + 0.12);
}

function hat(t: number, dest: AudioNode, open = false, vel = 1) {
  if (!ctx) return;
  const d = panTo(dest, open ? 0.18 : 0.28);
  noiseHit(t, d, open ? 0.18 : 0.038, (open ? 0.15 : 0.1) * vel, "highpass", open ? 6200 : 9000, 0.65);
}

function shaker(t: number, dest: AudioNode, vel = 0.08) {
  noiseHit(t, panTo(dest, -0.22), 0.05, vel, "bandpass", 7000, 0.8);
}

function tom(t: number, dest: AudioNode, freq: number, vel = 0.4) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.14);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + 0.22);
}

function clave(t: number, dest: AudioNode, vel = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.value = 2450;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + 0.07);
}

function rim(t: number, dest: AudioNode, vel = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(780, t);
  o.frequency.exponentialRampToValueAtTime(420, t + 0.04);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g);
  g.connect(panTo(dest, -0.16));
  o.start(t);
  o.stop(t + 0.06);
  noiseHit(t, dest, 0.028, vel * 0.45, "bandpass", 3200, 1.4);
}

/** Soft chord pad under the bar — fills empty midrange without masking kick/bass. */
function padBed(t: number, dest: AudioNode, freqs: number[], dur: number, peak: number) {
  if (!ctx) return;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.linearRampToValueAtTime(720, t + dur);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 140;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.18);
  g.gain.setValueAtTime(peak * 0.85, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(hp);
  hp.connect(g);
  g.connect(dest);
  freqs.forEach((f, i) => {
    const o = ctx!.createOscillator();
    o.type = i % 2 === 0 ? "sawtooth" : "triangle";
    o.frequency.value = f;
    const og = ctx!.createGain();
    og.gain.value = (i === 0 ? 0.55 : 0.32) / Math.max(1, freqs.length * 0.7);
    o.connect(og);
    og.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.02);
  });
}

function cowbell(t: number, dest: AudioNode, vel = 0.1) {
  if (!ctx) return;
  [845, 1125].forEach((f, i) => {
    const o = ctx!.createOscillator();
    o.type = "square";
    o.frequency.value = f;
    const bp = ctx!.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = 8;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(vel * (i === 0 ? 1 : 0.55), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(bp);
    bp.connect(g);
    g.connect(panTo(dest, 0.22));
    o.start(t);
    o.stop(t + 0.1);
  });
}

function bassNote(t: number, dest: AudioNode, freq: number, dur: number, peak: number, filt: number, slideTo?: number) {
  if (!ctx) return;
  const o1 = ctx.createOscillator();
  o1.type = "sawtooth";
  o1.frequency.setValueAtTime(freq, t);
  if (slideTo) o1.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.32);
  const o2 = ctx.createOscillator();
  o2.type = "square";
  o2.frequency.setValueAtTime(freq * 0.5, t);
  if (slideTo) o2.frequency.exponentialRampToValueAtTime(slideTo * 0.5, t + dur * 0.32);
  // Pure sub sine — weight without the mud that fights kicks/leads.
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(Math.max(32, freq * 0.5), t);
  if (slideTo) sub.frequency.exponentialRampToValueAtTime(Math.max(32, slideTo * 0.5), t + dur * 0.32);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 5.4;
  lp.frequency.setValueAtTime(filt * 1.85, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(70, filt * 0.35), t + dur * 0.4);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 38;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.setValueAtTime(peak * 0.78, t + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(peak * 0.55, t + 0.014);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o1.connect(lp);
  o2.connect(lp);
  lp.connect(hp);
  hp.connect(g);
  g.connect(dest);
  sub.connect(sg);
  sg.connect(dest);
  o1.start(t);
  o2.start(t);
  sub.start(t);
  o1.stop(t + dur + 0.02);
  o2.stop(t + dur + 0.02);
  sub.stop(t + dur + 0.02);
}

function chordStab(
  t: number,
  dest: AudioNode,
  freqs: number[],
  dur: number,
  peak: number,
  type: OscillatorType,
  filt: number,
) {
  if (!ctx) return;
  const ac = ctx;
  freqs.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = filt;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak / freqs.length, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    lp.connect(g);
    g.connect(dest);
    o.start(t + i * 0.004);
    o.stop(t + dur + 0.02);
  });
}

function rhodes(t: number, dest: AudioNode, freqs: number[], dur: number, peak: number) {
  if (!ctx) return;
  const ac = ctx;
  freqs.forEach((f, i) => {
    const o1 = ac.createOscillator();
    o1.type = "sine";
    o1.frequency.value = f;
    const o2 = ac.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = f * 2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((peak * (i === 0 ? 1 : 0.7)) / freqs.length, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(1400, t + dur * 0.5);
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(dest);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.02);
    o2.stop(t + dur + 0.02);
  });
}

function superSaw(t: number, dest: AudioNode, freq: number, dur: number, peak: number, filt: number) {
  if (!ctx) return;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 2.2;
  lp.frequency.setValueAtTime(filt, t);
  lp.frequency.exponentialRampToValueAtTime(filt * 0.55, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g);
  g.connect(dest);
  [-9, 0, 8].forEach((cents) => {
    const o = ctx!.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq * Math.pow(2, cents / 1200);
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.02);
  });
}

function leadNote(t: number, dest: AudioNode, freq: number, dur: number, peak: number, type: OscillatorType, filt: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const twin = ctx.createOscillator();
  twin.type = type === "sine" ? "triangle" : "sawtooth";
  twin.frequency.value = freq * Math.pow(2, 7 / 1200);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.6;
  const vibg = ctx.createGain();
  vibg.gain.value = freq * 0.012;
  vib.connect(vibg);
  vibg.connect(o.frequency);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = Math.min(420, freq * 0.55);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 1.4;
  lp.frequency.setValueAtTime(filt * 1.15, t);
  lp.frequency.exponentialRampToValueAtTime(filt * 0.55, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(hp);
  twin.connect(hp);
  hp.connect(lp);
  lp.connect(g);
  g.connect(panTo(dest, 0.14));
  o.start(t);
  twin.start(t);
  vib.start(t);
  o.stop(t + dur + 0.02);
  twin.stop(t + dur + 0.02);
  vib.stop(t + dur + 0.02);
}

function pluckNote(t: number, dest: AudioNode, freq: number, dur: number, peak: number) {
  if (!ctx || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 14;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const og = ctx.createGain();
  og.gain.setValueAtTime(peak * 0.55, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
  o.connect(og);
  og.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function choir(t: number, dest: AudioNode, freq: number, dur: number, peak: number) {
  if (!ctx) return;
  const ac = ctx;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 780;
  bp.Q.value = 1.1;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  bp.connect(g);
  g.connect(dest);
  [1, 1.498, 2.002].forEach((mul, i) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = freq * mul;
    const og = ac.createGain();
    og.gain.value = i === 0 ? 1 : 0.42;
    o.connect(og);
    og.connect(bp);
    o.start(t);
    o.stop(t + dur + 0.02);
  });
}

const SCALES: Record<string, number[]> = {
  pop: [0, 2, 4, 5, 7, 9, 11],
  hiphop: [0, 3, 5, 7, 10],
  disco: [0, 2, 4, 7, 9, 10],
  rock: [0, 3, 5, 7, 10],
  latin: [0, 2, 4, 5, 7, 9, 10],
  chill: [0, 2, 4, 7, 9, 11],
};

const PROGRESSIONS: Record<string, number[][]> = {
  pop: [
    [0, 4, 7, 11],
    [7, 11, 14, 18],
    [9, 12, 16, 19],
    [5, 9, 12, 16],
    [0, 4, 7, 11],
    [7, 11, 14, 18],
    [5, 9, 12, 16],
    [7, 11, 14, 17],
  ],
  hiphop: [
    [0, 3, 7, 10],
    [0, 3, 7, 10],
    [5, 8, 12, 15],
    [7, 10, 14, 17],
    [0, 3, 7, 10],
    [10, 14, 17, 20],
    [5, 8, 12, 15],
    [7, 10, 14, 17],
  ],
  disco: [
    [0, 4, 7, 10],
    [5, 9, 12, 16],
    [7, 11, 14, 17],
    [0, 4, 7, 11],
    [0, 4, 7, 10],
    [9, 12, 16, 19],
    [5, 9, 12, 16],
    [7, 11, 14, 17],
  ],
  rock: [
    [0, 3, 7],
    [10, 14, 17],
    [8, 12, 15],
    [0, 3, 7],
    [0, 3, 7],
    [5, 8, 12],
    [8, 12, 15],
    [10, 14, 17],
  ],
  latin: [
    [0, 4, 7, 10],
    [5, 9, 12, 16],
    [7, 11, 14, 17],
    [2, 5, 9, 12],
    [0, 4, 7, 10],
    [5, 9, 12, 16],
    [7, 11, 14, 17],
    [0, 4, 7, 11],
  ],
  chill: [
    [0, 4, 7, 9],
    [9, 12, 16, 19],
    [5, 9, 12, 16],
    [7, 11, 14, 16],
    [0, 4, 7, 11],
    [4, 7, 11, 14],
    [5, 9, 12, 16],
    [7, 11, 14, 18],
  ],
};

const DEFAULT_CLIPS: Record<string, [string, string, string, string]> = {
  pop: ["four", "pulse", "keys", "ahhs"],
  hiphop: ["boom", "deep", "keys", "hook"],
  disco: ["four", "funk", "synth", "ahhs"],
  rock: ["break", "root", "lead", "stabs"],
  latin: ["skip", "funk", "pluck", "call"],
  chill: ["clap", "deep", "bells", "shimmer"],
};

const HOOKS: Record<string, number[][]> = {
  pop: [
    [4, 2, 0, 2, 4, 7, 4, 2],
    [7, 4, 5, 4, 2, 0, 2, 4],
  ],
  hiphop: [
    [0, 3, 0, 5, 3, 0, 7, 5],
    [7, 5, 3, 0, 3, 5, 7, 10],
  ],
  disco: [
    [4, 7, 9, 7, 4, 2, 0, 4],
    [7, 9, 11, 9, 7, 4, 7, 12],
  ],
  rock: [
    [0, 3, 5, 7, 5, 3, 0, 3],
    [7, 10, 7, 5, 3, 0, 3, 5],
  ],
  latin: [
    [0, 2, 4, 5, 7, 5, 4, 2],
    [7, 5, 4, 2, 0, 4, 7, 9],
  ],
  chill: [
    [4, 7, 9, 7, 4, 2, 0, 4],
    [9, 7, 4, 7, 11, 9, 7, 4],
  ],
};

function n2f(semi: number, root = 110) {
  return root * Math.pow(2, semi / 12);
}

type MixState = {
  genre: string;
  clips: [string | null, string | null, string | null, string | null];
  muted: [boolean, boolean, boolean, boolean];
  playing: boolean;
  nextBar: number;
  barIndex: number;
  timer: number | null;
};

const mix: MixState = {
  genre: "pop",
  clips: [null, null, null, null],
  muted: [false, false, false, false],
  playing: false,
  nextBar: 0,
  barIndex: 0,
  timer: null,
};

export function getMix() {
  return mix;
}

export function setMixGenre(id: string) {
  mix.genre = id;
  if (delayNode && ctx) {
    delayNode.delayTime.setTargetAtTime(delayFor(), ctx.currentTime, 0.05);
  }
}

export function setMixClip(track: 0 | 1 | 2 | 3, id: string | null) {
  mix.clips[track] = mix.clips[track] === id ? null : id;
}

export function setMixClips(clips: MixState["clips"]) {
  mix.clips = [...clips] as MixState["clips"];
}

export function setTrackMuted(track: 0 | 1 | 2 | 3, muted: boolean) {
  mix.muted[track] = muted;
}

export function toggleTrackMuted(track: 0 | 1 | 2 | 3) {
  mix.muted[track] = !mix.muted[track];
  return mix.muted[track];
}

/** Pick a fresh genre + one clip per lane for the "surprise mix" button. */
export function surpriseMix() {
  const genres = GENRES.map((g) => g.id);
  mix.genre = genres[Math.floor(Math.random() * genres.length)] ?? "pop";
  const pack = DEFAULT_CLIPS[mix.genre] ?? DEFAULT_CLIPS.pop;
  mix.clips = [...pack!] as MixState["clips"];
  mix.muted = [false, false, false, false];
  if (delayNode && ctx) {
    delayNode.delayTime.setTargetAtTime(delayFor(), ctx.currentTime, 0.05);
  }
  return { genre: mix.genre, clips: [...mix.clips] as MixState["clips"] };
}

function bpmOf() {
  return GENRES.find((g) => g.id === mix.genre)?.bpm ?? 118;
}

function keyRoot() {
  if (mix.genre === "rock") return 82.41;
  if (mix.genre === "hiphop") return 98;
  if (mix.genre === "chill") return 130.81;
  if (mix.genre === "latin") return 116.54;
  return 110;
}

function delayFor() {
  const beat = 60 / bpmOf();
  if (mix.genre === "hiphop" || mix.genre === "chill") return beat;
  if (mix.genre === "disco") return beat * 0.75;
  return beat * 0.75;
}

function activeClips() {
  const base = mix.clips.some(Boolean) ? mix.clips : (DEFAULT_CLIPS[mix.genre] ?? DEFAULT_CLIPS.pop)!;
  return [
    mix.muted[0] ? null : base[0],
    mix.muted[1] ? null : base[1],
    mix.muted[2] ? null : base[2],
    mix.muted[3] ? null : base[3],
  ] as MixState["clips"];
}

function velLine(s: string): number[] {
  const out: number[] = [];
  for (const ch of s.replace(/\s/g, "")) {
    if (ch === "X") out.push(1);
    else if (ch === "x") out.push(0.62);
    else if (ch === "o") out.push(0.88);
    else if (ch === "g") out.push(0.28);
    else out.push(0);
  }
  return out;
}

type DrumKit = { k: number[]; s: number[]; h: number[]; o: number[]; c: number[] };

function drumKit(id: string, chorus: boolean, fill: boolean): DrumKit {
  if (id === "boom") {
    return {
      k: velLine(fill ? "X.....g.X...X.g." : "X.....g.X......."),
      s: velLine(fill ? "....o...g..go.o." : "....o...g...o..."),
      h: velLine(chorus ? "x.x.x.x.x.x.x.Xx" : "x.g.x.x.x.g.x.x."),
      o: velLine(chorus ? "......X.......X." : "......X........."),
      c: velLine("................"),
    };
  }
  if (id === "skip") {
    return {
      k: velLine(fill ? "X..X..X.g.X.g.X." : "X..X..X.g.X....."),
      s: velLine(fill ? "....o...g..g.o.." : "....o...g...o.g."),
      h: velLine(".x.x.x.Xx.x.x.xX"),
      o: velLine("..............X."),
      c: velLine("................"),
    };
  }
  if (id === "four") {
    return {
      k: velLine(chorus ? "X...X...X...X.g." : "X...X...X...X..."),
      s: velLine(fill ? "....o...g..go.o." : "....o.......o..."),
      h: velLine(chorus ? "XxXxXxXxXxXxXxXx" : "xxxxxxxxxxxxxxxx"),
      o: velLine(chorus ? "......X.......X." : "......X........."),
      c: velLine(mix.genre === "disco" ? "....o...g...o..." : "................"),
    };
  }
  if (id === "break") {
    return {
      k: velLine(fill ? "X...g.X.X.X..g.." : "X...g.X...X....."),
      s: velLine(fill ? "....o..g.o.ooo.." : "....o..g.o.o...."),
      h: velLine("..x.g.x...x.g.x."),
      o: velLine("..............X."),
      c: velLine("................"),
    };
  }
  return {
    k: velLine(chorus ? "X.....g.X...g..." : "X.......X......."),
    s: velLine("................"),
    h: velLine("gxgxxgxgxgxxgxgx"),
    o: velLine(chorus ? "......X........." : "................"),
    c: velLine(fill ? "....o...g..g.o.." : "....o...g...o..."),
  };
}

type BassHit = { s: number; n: number; l: number; slide?: number };

function bassLine(id: string, fill: boolean): BassHit[] {
  if (id === "funk") {
    return [
      { s: 0, n: 0, l: 1.4 },
      { s: 3, n: 0, l: 0.8 },
      { s: 4, n: 7, l: 1.2, slide: 0 },
      { s: 7, n: 0, l: 0.8 },
      { s: 8, n: 10, l: 1.2 },
      { s: 10, n: 7, l: 1.2 },
      { s: 12, n: 0, l: fill ? 1 : 2 },
      { s: 14, n: 5, l: 1.4 },
    ];
  }
  if (id === "deep") {
    return [
      { s: 0, n: 0, l: 6 },
      { s: 8, n: 0, l: 4 },
      { s: 12, n: 7, l: 4 },
    ];
  }
  if (id === "root") {
    return [
      { s: 0, n: 0, l: 3.2 },
      { s: 4, n: 0, l: 3.2 },
      { s: 8, n: 0, l: 3.2 },
      { s: 12, n: 7, l: 1.6 },
      { s: 14, n: 5, l: 1.6 },
    ];
  }
  if (id === "walk") {
    return [
      { s: 0, n: 0, l: 1.8 },
      { s: 2, n: 2, l: 1.8 },
      { s: 4, n: 3, l: 1.8 },
      { s: 6, n: 5, l: 1.8 },
      { s: 8, n: 7, l: 1.8 },
      { s: 10, n: 5, l: 1.8 },
      { s: 12, n: 3, l: 1.8 },
      { s: 14, n: 2, l: 1.8 },
    ];
  }
  return [
    { s: 0, n: 0, l: 1.6 },
    { s: 4, n: 0, l: 1.2 },
    { s: 6, n: 12, l: 1.2 },
    { s: 8, n: 0, l: 1.6 },
    { s: 12, n: 7, l: 1.2 },
    { s: 14, n: 12, l: 1.4 },
  ];
}

function scheduleBar(start: number, dest: AudioNode, barIndex: number) {
  if (!ctx) return;
  const bpm = bpmOf();
  const step = 60 / bpm / 4;
  const swingAmt =
    mix.genre === "hiphop" ? 0.24 : mix.genre === "latin" ? 0.14 : mix.genre === "chill" ? 0.18 : mix.genre === "disco" ? 0.04 : 0.06;
  const tAt = (i: number) => start + i * step + (i % 2 === 1 ? step * swingAmt : 0);
  const scale = SCALES[mix.genre] ?? SCALES.pop;
  const root = keyRoot();
  const prog = PROGRESSIONS[mix.genre] ?? PROGRESSIONS.pop;
  const chord = prog[barIndex % prog.length]!;
  const clips = activeClips();
  const fill = barIndex % 4 === 3;
  const chorus = Math.floor(barIndex / 4) % 2 === 1;
  const drumsDest = dest;
  const melDest = duckGain ?? dest;
  const clapOn = mix.genre === "disco" || clips[0] === "clap";
  const chordFreqs = chord.map((n) => n2f(n, root * 2));
  const hook = (HOOKS[mix.genre] ?? HOOKS.pop)![barIndex % 2]!;
  const energy = (chorus ? 1.12 : 0.88) * (mix.genre === "disco" || mix.genre === "rock" ? 1.08 : mix.genre === "chill" ? 0.9 : 1);

  // Always-on soft pad when any melodic lane is live — rooms feel less hollow between hits.
  if (clips[2] || clips[3]) {
    padBed(tAt(0), melDest, chordFreqs, step * 15.5, (chorus ? 0.045 : 0.032) * energy);
  }

  const drums = clips[0];
  const kickSteps = new Set<number>();
  if (drums) {
    const kit = drumKit(drums, chorus, fill);
    for (let i = 0; i < 16; i++) {
      const t = tAt(i) + (Math.random() - 0.5) * 0.0035;
      if (kit.k[i]) {
        kickSteps.add(i);
        kick(t, drumsDest, kit.k[i]! * (fill && i > 12 ? 0.78 : 1));
      }
      if (kit.s[i]) {
        const ghost = kit.s[i]! < 0.4;
        if (ghost) rim(t, drumsDest, kit.s[i]! * 0.9);
        else snare(t, drumsDest, kit.s[i]!, clapOn && i % 4 === 0);
      }
      if (kit.c[i]) snare(t, drumsDest, kit.c[i]!, true);
      if (kit.o[i]) hat(t, drumsDest, true, kit.o[i]!);
      else if (kit.h[i]) hat(t, drumsDest, false, kit.h[i]! * (0.72 + (i % 4 === 2 ? 0.28 : 0)));
      if (drums === "clap" || mix.genre === "disco" || mix.genre === "latin") {
        shaker(t, drumsDest, i % 2 === 0 ? 0.075 : 0.048);
      }
      if (fill && drums !== "clap" && (i === 13 || i === 15)) tom(t, drumsDest, i === 13 ? 186 : 138, 0.4);
      // Ghost rims on offbeats when hats are sparse — sells groove without louder snares.
      if (!kit.s[i] && !kit.k[i] && (i === 7 || i === 15) && chorus) rim(t, drumsDest, 0.08);
    }
    if (mix.genre === "latin") {
      [0, 3, 6, 10, 12].forEach((i) => clave(tAt(i), drumsDest, 0.12));
      [2, 8, 14].forEach((i) => cowbell(tAt(i), drumsDest, chorus ? 0.09 : 0.06));
    }
    if (mix.genre === "rock" && chorus) {
      [0, 8].forEach((i) => cowbell(tAt(i), drumsDest, 0.05));
    }
    if (mix.genre === "disco") {
      [4, 12].forEach((i) => cowbell(tAt(i), drumsDest, 0.055));
    }
  }

  const bass = clips[1];
  if (bass) {
    const hits = bassLine(bass, fill);
    hits.forEach((h) => {
      // Leave a tiny hole under kick attacks so kick/bass read as separate instruments.
      const kickLock = kickSteps.has(h.s);
      const t = tAt(h.s) + (kickLock ? step * 0.04 : 0);
      const f = n2f(chord[0]! + h.n, root);
      const slide = h.slide != null ? n2f(chord[0]! + h.slide, root) : undefined;
      const dur = step * h.l * (kickLock ? 0.92 : 1);
      if (bass === "deep") {
        eightOhEight(t, dest, f, dur, 1);
        bassNote(t, dest, f, dur * 0.55, 0.11, 360);
      } else {
        const peak = (bass === "funk" ? 0.19 : bass === "pulse" ? 0.17 : 0.16) * (kickLock ? 0.82 : 1);
        const filt = bass === "funk" ? 820 : bass === "pulse" ? 700 : 520;
        bassNote(t, dest, f, dur, peak, filt, slide);
        // Octave fifth chirp on off hits — thicker without muddying the root.
        if ((bass === "funk" || bass === "pulse") && h.s % 4 === 0) {
          bassNote(t + step * 0.02, dest, f * 2, dur * 0.35, peak * 0.22, filt * 1.4);
        }
      }
    });
  }

  const melody = clips[2];
  if (melody) {
    if (melody === "keys") {
      rhodes(tAt(0), melDest, chordFreqs, step * (chorus ? 7.5 : 6.2), 0.28 * energy);
      rhodes(tAt(8), melDest, chordFreqs, step * 5.2, 0.2 * energy);
      ;[2, 5, 10, 13].forEach((i, k) => {
        leadNote(tAt(i), melDest, n2f(chord[k % chord.length]! + 12, root * 2), step * 1.4, 0.085 * energy, "triangle", 3400);
      });
      if (chorus) {
        chordStab(tAt(4), melDest, chordFreqs.map((f) => f * 2), step * 1.2, 0.07 * energy, "triangle", 2800);
      }
    } else if (melody === "synth") {
      superSaw(tAt(0), melDest, n2f(chord[0]! + 12, root * 2), step * 15.5, 0.1 * energy, chorus ? 2600 : 1600);
      chordStab(tAt(0), melDest, chordFreqs, step * 14, 0.11 * energy, "sawtooth", 1500);
      hook.forEach((n, i) => {
        if (i % 2 === 1 && !chorus) return;
        leadNote(tAt(i * 2), melDest, n2f(n + 12, root * 2), step * 1.8, 0.095 * energy, "sawtooth", 2800);
        if (chorus) leadNote(tAt(i * 2) + step * 0.05, melDest, n2f(n + 24, root * 2), step * 1.2, 0.045 * energy, "triangle", 3600);
      });
    } else if (melody === "bells") {
      hook.forEach((n, i) => {
        leadNote(tAt(i * 2), melDest, n2f(n, root * 4), step * 2.8, 0.1 * energy, "sine", 4600);
        if (i % 2 === 0) leadNote(tAt(i * 2 + 1), melDest, n2f(n + 7, root * 4), step * 1.2, 0.045 * energy, "sine", 5000);
      });
      chordStab(tAt(0), melDest, chordFreqs.map((f) => f * 2), step * 8, 0.07, "sine", 3800);
    } else if (melody === "pluck") {
      const arp = [...chord, chord[0]! + 12, chord[2]!, chord[1]!, chord[0]! + 12];
      arp.forEach((n, i) => {
        pluckNote(tAt(i * 2), melDest, n2f(n, root * 2), step * 1.55, 0.17 * energy);
      });
      if (chorus) {
        arp.forEach((n, i) => {
          if (i % 2) pluckNote(tAt(i * 2 + 1), melDest, n2f(n + 12, root * 2), step * 0.95, 0.09);
        });
      }
      // Counter-melody under plucks so the lane isn't a dry arp.
      leadNote(tAt(0), melDest, n2f(chord[0]! + 7, root * 2), step * 7, 0.04 * energy, "triangle", 2200);
    } else {
      hook.forEach((n, i) => {
        const hold = i === 4 || i === 0 ? 2.4 : 1.5;
        leadNote(tAt(i * 2), melDest, n2f(n + 12, root * 2), step * hold, 0.115 * energy, "square", 2100);
        if (chorus && i % 2 === 0) {
          leadNote(tAt(i * 2) + step * 0.5, melDest, n2f(n + 19, root * 2), step * 1.1, 0.05 * energy, "triangle", 3000);
        }
      });
    }
  }

  const vox = clips[3];
  if (vox) {
    const f = n2f(chord[2]! + 12, root * 2);
    const v = chorus ? 1.05 : 0.72;
    if (vox === "ahhs") {
      choir(tAt(0), melDest, f, step * 15, 0.08 * v);
      if (chorus) choir(tAt(8), melDest, n2f(chord[0]! + 24, root * 2), step * 7, 0.05 * v);
    } else if (vox === "hook") {
      choir(tAt(0), melDest, f, step * 6.5, 0.09 * v);
      choir(tAt(8), melDest, n2f(chord[0]! + 24, root * 2), step * 6.5, 0.08 * v);
      ;[4, 12].forEach((i) => {
        chordStab(tAt(i), melDest, [f * 2, f * 2.5], step * 0.85, 0.08, "triangle", 2600);
      });
    } else if (vox === "stabs") {
      [0, 4, 8, 12].forEach((i) => {
        chordStab(tAt(i), melDest, [f * 2, f * 3], step * 0.58, 0.1 * v, "square", 2200);
      });
      if (chorus) chordStab(tAt(2), melDest, [f * 1.5, f * 2], step * 0.4, 0.06 * v, "sawtooth", 1800);
    } else if (vox === "shimmer") {
      choir(tAt(2), melDest, f * 2, step * 12, 0.055 * v);
      leadNote(tAt(8), melDest, f * 2, step * 7, 0.06, "sine", 5200);
      if (chorus) leadNote(tAt(0), melDest, n2f(scale[4]! + 24, root * 2), step * 4, 0.045, "sine", 5400);
    } else {
      choir(tAt(0), melDest, f, step * 3.6, 0.09 * v);
      choir(tAt(8), melDest, n2f(chord[1]! + 12, root * 2), step * 3.6, 0.08 * v);
      if (chorus) choir(tAt(12), melDest, n2f(chord[0]! + 24, root * 2), step * 3.2, 0.07);
    }
  }
}

function pump() {
  if (!ctx || !mix.playing || !destMusic()) return;
  if (mix.timer != null) {
    window.clearTimeout(mix.timer);
    mix.timer = null;
  }
  const now = ctx.currentTime;
  const bar = (60 / bpmOf()) * 4;
  // Background tabs often receive timers only once per second. Keep enough
  // Web Audio queued to bridge that throttle, then skip stale bars after a
  // suspended context resumes instead of firing them all at once.
  if (mix.nextBar < now - 0.1) {
    const skipped = Math.ceil((now + 0.05 - mix.nextBar) / bar);
    mix.nextBar += skipped * bar;
    mix.barIndex += skipped;
  }
  const lookahead = document.visibilityState === "hidden" ? HIDDEN_LOOKAHEAD : VISIBLE_LOOKAHEAD;
  while (mix.nextBar < now + lookahead) {
    scheduleBar(mix.nextBar, destMusic()!, mix.barIndex);
    mix.nextBar += bar;
    mix.barIndex += 1;
  }
  mix.timer = window.setTimeout(pump, document.visibilityState === "hidden" ? 500 : 100);
}

export function startMix() {
  unlockAudio();
  if (!ctx || !duckGain) return;
  if (mix.playing) return;
  if (!mixSourceBus) resetMixSourceBus();
  stopLounge();
  if (!mix.clips.some(Boolean)) {
    const d = DEFAULT_CLIPS[mix.genre] ?? DEFAULT_CLIPS.pop;
    mix.clips = [...d] as MixState["clips"];
  }
  if (delayNode) delayNode.delayTime.setTargetAtTime(delayFor(), ctx.currentTime, 0.02);
  if (delaySend) {
    const wet =
      mix.genre === "chill" ? 0.36 :
      mix.genre === "disco" ? 0.3 :
      mix.genre === "hiphop" ? 0.22 :
      mix.genre === "latin" ? 0.24 :
      0.2;
    delaySend.gain.setTargetAtTime(wet, ctx.currentTime, 0.05);
  }
  // Soft vinyl under the mix (ducks with kicks) so jukebox / burn-disc feels less sterile.
  ensureVinylPresence(mix.genre === "chill" ? 0.055 : mix.genre === "hiphop" ? 0.048 : 0.038);
  mix.playing = true;
  mix.barIndex = 0;
  mix.nextBar = ctx.currentTime + 0.05;
  pump();
}

export function stopMix() {
  mix.playing = false;
  if (mix.timer != null) {
    clearTimeout(mix.timer);
    mix.timer = null;
  }
  // Every scheduled note for this playback feeds one disposable bus. Dropping
  // that bus makes Stop immediate and prevents a rapid restart from overlapping
  // bars that were already queued by Web Audio.
  resetMixSourceBus();
  if (ctx && duckGain) duckGain.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
  ensureVinylPresence(0.05);
  startLounge();
}

export function isMixPlaying() {
  return mix.playing;
}

export function getMixBpm() {
  return bpmOf();
}

/** 0..1 pulse synced to the mix clock — for jukebox/stage glow. */
export function getMixPulse(now = typeof performance !== "undefined" ? performance.now() / 1000 : 0) {
  if (!mix.playing) return 0;
  const bpm = bpmOf();
  const beatHz = bpm / 60;
  // Prefer AudioContext clock when unlocked so glow matches audible kicks.
  const t = ctx ? ctx.currentTime : now;
  return 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI * beatHz));
}

export function getSpectrum(out: Uint8Array<ArrayBuffer>): boolean {
  if (!analyser) return false;
  analyser.getByteFrequencyData(out);
  return true;
}

function loungeChord(t: number, dest: AudioNode, semis: number[], root: number) {
  if (!ctx) return;
  rhodes(
    t,
    dest,
    semis.map((n) => n2f(n, root)),
    3.4,
    0.12,
  );
  choir(t, dest, n2f(semis[2]! + 12, root), 3.2, 0.03);
}

function loungeTick() {
  if (!ctx || !loungeOn || !loungeBus) return;
  const t = ctx.currentTime + 0.04;
  const chords = [
    [0, 4, 7, 11],
    [9, 12, 16, 19],
    [5, 9, 12, 16],
    [7, 11, 14, 18],
  ];
  const ch = chords[Math.floor(Math.random() * chords.length)]!;
  loungeChord(t, loungeBus, ch, 196);
  kick(t, loungeBus, 0.12);
  hat(t + 0.62, loungeBus, false, 0.14);
  hat(t + 1.24, loungeBus, true, 0.12);
  shaker(t + 0.31, loungeBus, 0.05);
  loungeTimer = window.setTimeout(loungeTick, 2800);
}


/** Keep a soft vinyl bed under lounge / mix. Routed through duckGain so kicks pump it. */
function ensureVinylPresence(level: number) {
  if (!ctx || !vinylBuf) return;
  if (!vinylSrc) {
    vinylSrc = ctx.createBufferSource();
    vinylSrc.buffer = vinylBuf;
    vinylSrc.loop = true;
    vinylGain = ctx.createGain();
    vinylGain.gain.value = Math.max(0.0001, level);
    vinylSrc.connect(vinylGain);
    const dest = duckGain ?? musicBus ?? master;
    if (!dest) return;
    vinylGain.connect(dest);
    vinylSrc.start();
  } else if (vinylGain) {
    vinylGain.gain.cancelScheduledValues(ctx.currentTime);
    vinylGain.gain.setTargetAtTime(Math.max(0.0001, level), ctx.currentTime, 0.18);
  }
}

function sfxDiscBurn() {
  if (!ctx || !destSfx()) return;
  const t = ctx.currentTime;
  // Soft whoosh + click — "burn a disc" without trademarked samples.
  noiseHit(t, destSfx()!, 0.42, 0.16, "bandpass", 1800, 0.7);
  noiseHit(t + 0.05, destSfx()!, 0.28, 0.1, "highpass", 4200, 0.55);
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(660, t);
  o.frequency.exponentialRampToValueAtTime(220, t + 0.28);
  const g = envGain(t, 0.01, 0.3, 0.12);
  if (!g) return;
  o.connect(g);
  g.connect(destSfx()!);
  o.start(t);
  o.stop(t + 0.34);
}

export function burnDiscSfx() {
  sfxDiscBurn();
}

export function startLounge() {
  unlockAudio();
  if (!ctx || !loungeBus || loungeOn || mix.playing) return;
  loungeOn = true;
  loungeBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4);
  ensureVinylPresence(0.075);
  loungeTick();
}

export function stopLounge() {
  loungeOn = false;
  if (loungeTimer != null) {
    clearTimeout(loungeTimer);
    loungeTimer = null;
  }
  if (ctx && loungeBus) loungeBus.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (ctx?.state === "suspended") {
      void ctx.resume().then(() => {
        if (mix.playing) pump();
      }).catch(() => undefined);
    } else if (mix.playing) {
      pump();
    }
  });
}
