/**
 * Little sound effects made with Web Audio (no audio files, nothing licensed).
 * The AudioContext is created on first use, which must happen after a tap.
 */
let ctx = null;

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** One enveloped oscillator note. Times are in seconds from now. */
function tone({ type = 'sine', freq, freqEnd = freq, at = 0, dur = 0.3, gain = 0.25, attack = 0.005, filter = null }) {
  const ac = audio();
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (filter) {
    const f = ac.createBiquadFilter();
    f.type = filter.type ?? 'lowpass';
    f.frequency.value = filter.freq;
    osc.connect(f);
    node = f;
  }
  node.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Short burst of filtered noise (for clanks and thumps). */
function noise({ at = 0, dur = 0.1, gain = 0.3, freq = 2000, q = 3 }) {
  const ac = audio();
  const t = ac.currentTime + at;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(amp).connect(ac.destination);
  src.start(t);
}

export const sfx = {
  /** Call from any tap so later sounds are allowed to play. */
  unlock() {
    audio();
  },

  /** School bell: bright "ding-ding". */
  bell() {
    for (const at of [0, 0.35]) {
      tone({ freq: 1320, at, dur: 1.2, gain: 0.22 });
      tone({ freq: 2640, at, dur: 0.6, gain: 0.08 });
      tone({ freq: 3960, at, dur: 0.3, gain: 0.04 });
    }
  },

  /** Monster truck horn: "honk honk". */
  honk() {
    for (const at of [0, 0.28]) {
      tone({ type: 'sawtooth', freq: 233, at, dur: 0.22, gain: 0.18, attack: 0.02, filter: { freq: 1200 } });
      tone({ type: 'sawtooth', freq: 294, at, dur: 0.22, gain: 0.14, attack: 0.02, filter: { freq: 1200 } });
    }
  },

  /** Toy tank: a friendly metal "clank-clank". */
  clank() {
    for (const at of [0, 0.16]) {
      noise({ at, dur: 0.08, gain: 0.35, freq: 2500, q: 6 });
      tone({ type: 'square', freq: 820, at, dur: 0.12, gain: 0.05 });
      tone({ freq: 1230, at, dur: 0.18, gain: 0.07 });
    }
  },

  /** Stuffed animal squeak. */
  squeak() {
    tone({ freq: 900, freqEnd: 1900, dur: 0.18, gain: 0.18, attack: 0.02 });
    tone({ freq: 1900, freqEnd: 1300, at: 0.18, dur: 0.12, gain: 0.12 });
  },

  /** Little "pop" for buttons and checkmarks. */
  pop() {
    tone({ freq: 500, freqEnd: 1100, dur: 0.1, gain: 0.2 });
  },

  /** Soft key click. */
  tick() {
    tone({ freq: 1400, freqEnd: 900, dur: 0.05, gain: 0.08 });
  },

  /** Leaves rustling. */
  rustle() {
    for (const at of [0, 0.12, 0.22]) noise({ at, dur: 0.12, gain: 0.12, freq: 4500, q: 0.8 });
  },

  /** Underwater "blub blub". */
  bubble() {
    tone({ freq: 300, freqEnd: 900, dur: 0.12, gain: 0.18 });
    tone({ freq: 400, freqEnd: 1100, at: 0.14, dur: 0.1, gain: 0.14 });
  },

  /** Little "doop" going down (a box un-checked). */
  uncheck() {
    tone({ freq: 700, freqEnd: 380, dur: 0.14, gain: 0.14 });
  },

  /** Ta-da! for finishing attendance. */
  fanfare() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      tone({ type: 'triangle', freq, at: i * 0.12, dur: 0.3, gain: 0.16 });
    });
    tone({ type: 'triangle', freq: 1047, at: 0.5, dur: 0.8, gain: 0.14 });
    tone({ type: 'triangle', freq: 784, at: 0.5, dur: 0.8, gain: 0.1 });
  },

  /** Happy rising chime (e.g. a box getting checked). */
  chime() {
    [784, 988, 1175].forEach((freq, i) => tone({ freq, at: i * 0.08, dur: 0.35, gain: 0.15 }));
  },
};
